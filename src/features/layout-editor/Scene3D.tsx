import { useEffect, useRef, useState } from "react";
import type { Material, Mesh, Object3D, Vector3 } from "three";
import { addPerfEntry } from "@/features/perf/perf-log";
import { ZONE_CATEGORY_LABEL } from "./asset-defaults";
import { disposeGroup } from "./asset-library";
import {
	onAssetCacheUpdate,
	preloadAssetCache,
	resolveAssetVisual,
} from "./asset-resolver";
import { useLayout } from "./LayoutContext";
import type { Fixture, LayoutJSON } from "./layout.types";
import {
	clamp,
	clampScenePosition,
	FLOOR_UNIT_SCALE,
	fixtureToSceneBox,
	getFloorSize,
	isContainerFixture,
	sceneBoxToFixturePatch,
} from "./layout-transform";

type SceneBoxMeshInput = Parameters<typeof sceneBoxToFixturePatch>[0];
type TintableMaterial = Material & {
	color: { set: (value: number | string) => void };
	opacity: number;
};

// Zone tile colors (must match ZONE_CATEGORY_COLOR in asset-defaults.ts).
const ZONE_HEX: Record<string, number> = {
	shoe: 0x3b82f6,
	apparel: 0xa855f7,
	fitting: 0xf59e0b,
	checkout: 0x10b981,
	cafe: 0xd97706,
	common: 0x94a3b8,
};

const FIXTURE_COLOR = 0x94a3b8; // slate-400 — neutral default wrapper tint
const SELECTED_COLOR = 0x0b5f59;
// Bright blue for multi-selected (non-primary) — matches the 2D marquee
// selection ring so users get a consistent visual cue across modes.
const MULTI_SELECTED_COLOR = 0x2563eb;
const DRAGGING_COLOR = 0x14b8a6;
const CONTAINER_COLOR = 0x94a3b8;
// Product (상품) visual distinction — warm amber wrapper so products stand out from fixtures.
const PRODUCT_COLOR = 0xf59e0b; // amber-400
// Asset types treated as "product" (not fixture) in 3D view.
const PRODUCT_ASSET_TYPES = new Set<string>(["shoes_test", "fixtures_test"]);
const CONTAINER_HEIGHT_UNITS = 4;
const FLOOR_COLOR = 0xffffff;
const GRID_COLOR = 0xd8dfdc;
const CAMERA_HOLD_DELAY_MS = 500;
const POINTER_MOVE_CANCEL_PX = 8;
const MIN_CAMERA_DISTANCE = 1.8;
const MAX_CAMERA_DISTANCE = 80;
const WHEEL_ZOOM_SPEED = 0.0014;
const RESIZE_HANDLE_COLOR = 0xffffff;
const RESIZE_HANDLE_ACTIVE_COLOR = 0x14b8a6;
const RESIZE_EDGES = [
	"top-left",
	"top",
	"top-right",
	"right",
	"bottom-right",
	"bottom",
	"bottom-left",
	"left",
] as const;

type ResizeEdge = (typeof RESIZE_EDGES)[number];

const RESIZE_CURSOR: Record<ResizeEdge, string> = {
	left: "ew-resize",
	right: "ew-resize",
	top: "ns-resize",
	bottom: "ns-resize",
	"top-left": "nwse-resize",
	"bottom-right": "nwse-resize",
	"top-right": "nesw-resize",
	"bottom-left": "nesw-resize",
};

function getFixtureColor(fixture: Fixture): number {
	if (fixture.material?.baseColor) {
		const hex = fixture.material.baseColor.replace("#", "");
		const parsed = Number.parseInt(hex, 16);
		if (Number.isFinite(parsed)) return parsed;
	}
	switch (fixture.type) {
		case "bathtub":
			return 0x7f9c97;
		case "sink":
			return 0xa3b59c;
		case "toilet":
			return 0x91aab3;
		case "display":
			return 0xb7a27f;
		default:
			return FIXTURE_COLOR;
	}
}

function getFixtureOpacity(fixture: Fixture): number {
	if (fixture.type === "display") return 0.86;
	if (fixture.type === "toilet") return 0.82;
	return 0.78;
}

function isTintableMaterial(material: Material): material is TintableMaterial {
	return (
		"color" in material &&
		"opacity" in material &&
		typeof material.color === "object" &&
		material.color !== null &&
		"set" in material.color &&
		typeof material.color.set === "function"
	);
}

function forEachTintableMaterial(
	mesh: Mesh,
	callback: (material: TintableMaterial) => void,
) {
	const materials = Array.isArray(mesh.material)
		? mesh.material
		: [mesh.material];
	for (const material of materials) {
		if (isTintableMaterial(material)) {
			callback(material);
		}
	}
}

function applyMeshVisual(mesh: Mesh, color: number | string, opacity: number) {
	forEachTintableMaterial(mesh, (material) => {
		material.color.set(color);
		material.opacity = opacity;
	});
}

function toSceneBoxMeshInput(mesh: Mesh): SceneBoxMeshInput {
	return {
		position: mesh.position,
		scale: mesh.scale,
		userData: {
			baseFixture: mesh.userData
				.baseFixture as SceneBoxMeshInput["userData"]["baseFixture"],
		},
	};
}

// (kept for type alignment with new zoneGroup field added at runtime)
interface SceneRefs {
	// biome-ignore lint/suspicious/noExplicitAny: Three.js types loaded lazily
	THREE: any;
	// biome-ignore lint/suspicious/noExplicitAny: Three.js types loaded lazily
	OrbitControls: any;
	// biome-ignore lint/suspicious/noExplicitAny: Three.js types loaded lazily
	scene: any;
	// biome-ignore lint/suspicious/noExplicitAny: Three.js types loaded lazily
	camera: any;
	// biome-ignore lint/suspicious/noExplicitAny: Three.js types loaded lazily
	renderer: any;
	// biome-ignore lint/suspicious/noExplicitAny: Three.js types loaded lazily
	controls: any;
	// biome-ignore lint/suspicious/noExplicitAny: Three.js types loaded lazily
	fixtureGroup: any;
	// biome-ignore lint/suspicious/noExplicitAny: Three.js group
	zoneGroup: any;
	// biome-ignore lint/suspicious/noExplicitAny: Three.js types loaded lazily
	resizeHandleGroup: any;
	// biome-ignore lint/suspicious/noExplicitAny: Three.js types loaded lazily
	raycaster: any;
	// biome-ignore lint/suspicious/noExplicitAny: Three.js types loaded lazily
	pointer: any;
	// biome-ignore lint/suspicious/noExplicitAny: Three.js types loaded lazily
	groundPlane: any;
	// biome-ignore lint/suspicious/noExplicitAny: Three.js types loaded lazily
	planeHit: any;
	// biome-ignore lint/suspicious/noExplicitAny: Three.js types loaded lazily
	floorMesh: any;
	// biome-ignore lint/suspicious/noExplicitAny: Three.js types loaded lazily
	gridHelper: any;
	// biome-ignore lint/suspicious/noExplicitAny: Three.js types loaded lazily
	selectedMesh: any;
	selectedIndex: number | null;
	isCameraControlActive: boolean;
	cameraHold: {
		pointerId: number;
		startX: number;
		startY: number;
		active: boolean;
		// biome-ignore lint/suspicious/noExplicitAny: PointerEvent
		originalEvent: any;
		timerId: ReturnType<typeof setTimeout>;
	} | null;
	directDrag: {
		// biome-ignore lint/suspicious/noExplicitAny: Three.js types loaded lazily
		mesh: any;
		pointerId: number;
		// biome-ignore lint/suspicious/noExplicitAny: Three.js intersection offset
		offset: any;
		// Other selected meshes that should move with the primary one,
		// each storing the world-space delta from the primary mesh's origin.
		// biome-ignore lint/suspicious/noExplicitAny: Three.js mesh
		additional: { mesh: any; offsetX: number; offsetZ: number }[];
	} | null;
	resizeDrag: {
		edge: ResizeEdge;
		// biome-ignore lint/suspicious/noExplicitAny: Three.js Mesh
		mesh: any;
		pointerId: number;
		originBox: { x: number; y: number; width: number; height: number };
	} | null;
	// Product (상품) rotate drag — horizontal drag: Y axis, vertical drag: X axis.
	productRotateDrag: {
		// biome-ignore lint/suspicious/noExplicitAny: Three.js mesh
		visualGroup: any;
		pointerId: number;
		startX: number;
		startY: number;
		startRotationY: number;
		startRotationX: number;
	} | null;
	// biome-ignore lint/suspicious/noExplicitAny: Three.js Mesh
	dragFootprint: any;
	// biome-ignore lint/suspicious/noExplicitAny: Three.js Mesh
	hoveredResizeHandle: any;
	activePointers: Map<number, { x: number; y: number; pointerType: string }>;
	touchCameraGesture:
		| {
				kind: "pan";
				pointerId: number;
				lastX: number;
				lastY: number;
		  }
		| {
				kind: "pinch";
				pointerIds: [number, number];
				startDistance: number;
				startCameraDistance: number;
				// biome-ignore lint/suspicious/noExplicitAny: Three.js Vector3
				anchorPoint: any;
		  }
		| null;
	animFrameId: number;
	isForwardingPointerDown: boolean;
	exportPngHandler?: () => void;
	exportGltfHandler?: () => void;
	gridCellCm?: number;
	markDirty?: () => void;
}

export type Scene3DCameraView = "default" | "fit" | "top" | "front" | "side";

export function Scene3D({
	cameraView = "default",
}: {
	cameraView?: Scene3DCameraView;
}) {
	const {
		layout,
		selectedIndex,
		selectedIndices,
		updateFixture,
		updateFixturesBatch,
		setSelectedFixture,
		toggleFixtureSelection,
		setSelectedIndicesBatch,
		clearSelection,
		zoneDraftCategory,
		cameraDraftPhotoId,
		addZone,
		cancelZoneDraft,
		cancelCameraDraft,
	} = useLayout();
	// Latest setters held in refs so the imperative pointer handlers below
	// (defined inside a one-shot init effect) always call the current closures.
	const setSelectedIndicesBatchRef = useRef(setSelectedIndicesBatch);
	const clearSelectionRef = useRef(clearSelection);
	const updateFixturesBatchRef = useRef(updateFixturesBatch);
	// Toolbar-controlled interaction mode (touch-friendly toggle).
	// "marquee" = empty-space drag becomes marquee selection without Shift.
	const interactionModeRef = useRef<"orbit" | "marquee">("orbit");
	useEffect(() => {
		const onMode = (e: Event) => {
			const detail = (e as CustomEvent<{ mode: "orbit" | "marquee" }>).detail;
			if (detail?.mode) {
				interactionModeRef.current = detail.mode;
			}
		};
		window.addEventListener("scene3d-interaction-mode", onMode);
		return () => window.removeEventListener("scene3d-interaction-mode", onMode);
	}, []);
	const selectedIndicesRef = useRef<number[]>([]);
	useEffect(() => {
		updateFixturesBatchRef.current = updateFixturesBatch;
		selectedIndicesRef.current = selectedIndices;
	}, [updateFixturesBatch, selectedIndices]);
	const zoneDraftCategoryRef = useRef(zoneDraftCategory);
	const cameraDraftPhotoIdRef = useRef(cameraDraftPhotoId);
	const addZoneRef = useRef(addZone);
	const cancelZoneDraftRef = useRef(cancelZoneDraft);
	const cancelCameraDraftRef = useRef(cancelCameraDraft);
	useEffect(() => {
		setSelectedIndicesBatchRef.current = setSelectedIndicesBatch;
		clearSelectionRef.current = clearSelection;
		zoneDraftCategoryRef.current = zoneDraftCategory;
		cameraDraftPhotoIdRef.current = cameraDraftPhotoId;
		addZoneRef.current = addZone;
		cancelZoneDraftRef.current = cancelZoneDraft;
		cancelCameraDraftRef.current = cancelCameraDraft;
	}, [
		setSelectedIndicesBatch,
		clearSelection,
		zoneDraftCategory,
		cameraDraftPhotoId,
		addZone,
		cancelZoneDraft,
		cancelCameraDraft,
	]);
	// Camera placement: 1st click stores floor coordinate; 2nd click computes
	// the look direction. Stored in screen space so we can also paint a
	// visual marker.
	const [cameraStep1, setCameraStep1] = useState<{
		floorX: number;
		floorY: number;
		clientX: number;
		clientY: number;
	} | null>(null);
	const cameraStep1Ref = useRef<typeof cameraStep1>(null);
	useEffect(() => {
		cameraStep1Ref.current = cameraStep1;
	}, [cameraStep1]);
	// Zone draft drag (screen-space rectangle, converted to floor on release).
	const [zoneDrag, setZoneDrag] = useState<{
		startX: number;
		startY: number;
		curX: number;
		curY: number;
	} | null>(null);
	const zoneDragRef = useRef<typeof zoneDrag>(null);
	useEffect(() => {
		zoneDragRef.current = zoneDrag;
	}, [zoneDrag]);
	// Reset local drafts when the corresponding context flag turns off.
	const [prevCameraDraftPhotoId, setPrevCameraDraftPhotoId] = useState<
		string | null
	>(cameraDraftPhotoId);
	if (cameraDraftPhotoId !== prevCameraDraftPhotoId) {
		setPrevCameraDraftPhotoId(cameraDraftPhotoId);
		if (!cameraDraftPhotoId) setCameraStep1(null);
	}
	const [prevZoneDraftCategory, setPrevZoneDraftCategory] = useState<
		string | null
	>(zoneDraftCategory);
	if (zoneDraftCategory !== prevZoneDraftCategory) {
		setPrevZoneDraftCategory(zoneDraftCategory);
		if (!zoneDraftCategory) setZoneDrag(null);
	}
	// Marquee rectangle in client (screen) coords. Rendered as DOM overlay.
	const [marquee, setMarquee] = useState<{
		startX: number;
		startY: number;
		curX: number;
		curY: number;
		additive: boolean;
	} | null>(null);
	const marqueeRef = useRef<typeof marquee>(null);
	useEffect(() => {
		marqueeRef.current = marquee;
	}, [marquee]);
	const containerRef = useRef<HTMLDivElement>(null);
	const refs = useRef<SceneRefs | null>(null);
	const layoutRef = useRef<LayoutJSON | null>(null);
	const selectedIndexRef = useRef<number | null>(null);
	const lastFittedLayoutKeyRef = useRef<string | null>(null);
	// Structural key: changes when fixture count / size / assetType / shape changes.
	// Stays the same when only x/y positions change (drag).
	const prevStructuralKeyRef = useRef<string | null>(null);
	const [_sceneReady, setSceneReady] = useState(0);
	const [_assetCacheVersion, setAssetCacheVersion] = useState(0);

	useEffect(() => {
		preloadAssetCache();
		const unsub = onAssetCacheUpdate(() => {
			setAssetCacheVersion((v) => v + 1);
		});
		return unsub;
	}, []);

	useEffect(() => {
		layoutRef.current = layout;
	}, [layout]);

	useEffect(() => {
		selectedIndexRef.current = selectedIndex;
	}, [selectedIndex]);

	// Initialize Three.js scene once
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional - toggleFixtureSelection is stable via useCallback
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		let disposed = false;

		async function init(el: HTMLDivElement) {
			const THREE = await import("three");
			const { OrbitControls } = await import(
				"three/addons/controls/OrbitControls.js"
			);

			if (disposed) return;

			const scene = new THREE.Scene();
			scene.background = new THREE.Color(0xf8faf9);

			const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
			const renderer = new THREE.WebGLRenderer({ antialias: true });
			// Cap DPR at 1.5 — retina screens (2–3×) otherwise render 4–9× the pixels.
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
			renderer.shadowMap.enabled = true;
			renderer.shadowMap.type = THREE.PCFSoftShadowMap;
			el.appendChild(renderer.domElement);
			renderer.domElement.style.cssText =
				"display:block;width:100%;height:100%;";
			renderer.domElement.style.touchAction = "none";

			const controls = new OrbitControls(camera, renderer.domElement);
			controls.enabled = false;
			controls.enableDamping = true;
			controls.dampingFactor = 0.2;
			controls.screenSpacePanning = false;

			const fixtureGroup = new THREE.Group();
			scene.add(fixtureGroup);
			const zoneGroup = new THREE.Group();
			scene.add(zoneGroup);
			const resizeHandleGroup = new THREE.Group();
			scene.add(resizeHandleGroup);

			// Lights
			const ambient = new THREE.HemisphereLight(0xffffff, 0xd8dfdc, 2.2);
			scene.add(ambient);
			const key = new THREE.DirectionalLight(0xffffff, 2.6);
			key.position.set(8, 12, 8);
			key.castShadow = true;
			key.shadow.mapSize.width = 1024;
			key.shadow.mapSize.height = 1024;
			scene.add(key);

			const r: SceneRefs = {
				THREE,
				OrbitControls,
				scene,
				camera,
				renderer,
				controls,
				fixtureGroup,
				zoneGroup,
				resizeHandleGroup,
				raycaster: new THREE.Raycaster(),
				pointer: new THREE.Vector2(),
				groundPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
				planeHit: new THREE.Vector3(),
				floorMesh: null,
				gridHelper: null,
				selectedMesh: null,
				selectedIndex: null,
				isCameraControlActive: false,
				cameraHold: null,
				directDrag: null,
				resizeDrag: null,
				productRotateDrag: null,
				dragFootprint: null,
				hoveredResizeHandle: null,
				activePointers: new Map(),
				touchCameraGesture: null,
				animFrameId: 0,
				isForwardingPointerDown: false,
			};
			refs.current = r;
			setSceneReady((value) => value + 1);

			// Initial camera
			camera.position.set(7, 8, 9);
			controls.target.set(0, 0, 0);
			controls.update();

			// Render-on-demand: only call renderer.render() when something changed.
			// controls.update() fires 'change' while damping is active → keeps dirty=true
			// until the camera fully comes to rest.
			let dirty = true;
			function markDirty() {
				dirty = true;
			}
			controls.addEventListener("change", markDirty);

			// Cached canvas rect for raycaster — updated on resize, not on every pointermove.
			let cachedRect = el.getBoundingClientRect();
			function refreshRect() {
				cachedRect = el.getBoundingClientRect();
			}

			r.markDirty = markDirty;

			// Resize handler
			function handleResize() {
				const w = Math.max(1, el.clientWidth);
				const h = Math.max(1, el.clientHeight);
				camera.aspect = w / h;
				camera.updateProjectionMatrix();
				renderer.setSize(w, h, false);
				refreshRect();
				markDirty();
			}
			handleResize();
			window.addEventListener("resize", handleResize);

			// 3D export handlers (fired by toolbar buttons via window CustomEvent)
			async function handleExportPng() {
				try {
					// Re-render once to ensure latest frame is in the framebuffer.
					renderer.render(scene, camera);
					const url = renderer.domElement.toDataURL("image/png");
					const a = document.createElement("a");
					a.href = url;
					a.download = `store-3d-${Date.now()}.png`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
				} catch (err) {
					console.error("PNG export failed:", err);
					window.alert(
						`PNG 내보내기 실패: ${err instanceof Error ? err.message : String(err)}`,
					);
				}
			}

			async function handleExportGltf() {
				try {
					const { GLTFExporter } = await import(
						"three/addons/exporters/GLTFExporter.js"
					);
					const exporter = new GLTFExporter();
					await new Promise<void>((resolve, reject) => {
						exporter.parse(
							scene,
							(result: ArrayBuffer | object) => {
								const data =
									result instanceof ArrayBuffer
										? result
										: new TextEncoder().encode(JSON.stringify(result)).buffer;
								const blob = new Blob([data], {
									type: "model/gltf-binary",
								});
								const url = URL.createObjectURL(blob);
								const a = document.createElement("a");
								a.href = url;
								a.download = `store-3d-${Date.now()}.glb`;
								document.body.appendChild(a);
								a.click();
								document.body.removeChild(a);
								setTimeout(() => URL.revokeObjectURL(url), 1000);
								resolve();
							},
							(err: unknown) => reject(err),
							{ binary: true },
						);
					});
				} catch (err) {
					console.error("glTF export failed:", err);
					window.alert(
						`glTF 내보내기 실패: ${err instanceof Error ? err.message : String(err)}`,
					);
				}
			}

			window.addEventListener("export-3d-png", handleExportPng);
			window.addEventListener("export-3d-gltf", handleExportGltf);
			r.exportPngHandler = handleExportPng;
			r.exportGltfHandler = handleExportGltf;

			function animate() {
				r.animFrameId = requestAnimationFrame(animate);
				// Always step OrbitControls so damping decelerates smoothly.
				// It fires 'change' events while still moving, keeping dirty=true.
				controls.update();
				if (!dirty) return;
				dirty = false;
				renderer.render(scene, camera);
			}
			animate();

			// Pointer events
			renderer.domElement.addEventListener("pointerdown", handlePointerDown);
			renderer.domElement.addEventListener("wheel", handleWheelZoom, {
				passive: false,
			});
			window.addEventListener("pointermove", handlePointerMove);
			window.addEventListener("pointerup", handlePointerUp);
			window.addEventListener("pointercancel", handlePointerUp);

			function updateRaycaster(event: PointerEvent) {
				// Use cachedRect instead of getBoundingClientRect() on every event.
				r.pointer.x =
					((event.clientX - cachedRect.left) / cachedRect.width) * 2 - 1;
				r.pointer.y =
					-((event.clientY - cachedRect.top) / cachedRect.height) * 2 + 1;
				r.raycaster.setFromCamera(r.pointer, camera);
			}

			function setRaycasterFromClient(clientX: number, clientY: number) {
				r.pointer.x = ((clientX - cachedRect.left) / cachedRect.width) * 2 - 1;
				r.pointer.y = -((clientY - cachedRect.top) / cachedRect.height) * 2 + 1;
				r.raycaster.setFromCamera(r.pointer, camera);
			}

			function getFixtureHit(event: PointerEvent) {
				updateRaycaster(event);
				const hits = r.raycaster.intersectObjects(
					r.fixtureGroup.children,
					false,
				);
				return (
					hits.find(
						(hit: { object: { userData?: { isContainer?: boolean } } }) =>
							!hit.object.userData?.isContainer,
					) ?? null
				);
			}

			function getHandleHit(event: PointerEvent) {
				updateRaycaster(event);
				const hits = r.raycaster.intersectObjects(
					r.resizeHandleGroup.children,
					false,
				);
				return hits[0] ?? null;
			}

			function getGroundPoint(event: PointerEvent) {
				updateRaycaster(event);
				return r.raycaster.ray.intersectPlane(r.groundPlane, r.planeHit);
			}

			function getGroundPointFromClient(
				clientX: number,
				clientY: number,
				target = new THREE.Vector3(),
			) {
				setRaycasterFromClient(clientX, clientY);
				return r.raycaster.ray.intersectPlane(r.groundPlane, target);
			}

			type DragKind = "productRotate" | "resize" | "direct";
			function getActiveDragKind(pointerId: number): DragKind | null {
				if (r.productRotateDrag?.pointerId === pointerId)
					return "productRotate";
				if (r.resizeDrag?.pointerId === pointerId) return "resize";
				if (r.directDrag?.pointerId === pointerId) return "direct";
				return null;
			}

			function syncOrbit() {
				controls.enabled =
					r.isCameraControlActive && !r.directDrag && !r.resizeDrag;
			}

			function setCameraActive(active: boolean) {
				r.isCameraControlActive = active;
				syncOrbit();
			}

			function getCameraDistance() {
				return camera.position.distanceTo(controls.target);
			}

			function setCameraDistance(distance: number) {
				const d = clamp(distance, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
				const dir = camera.position.clone().sub(controls.target);
				if (dir.lengthSq() === 0) dir.set(1, 1, 1);
				dir.normalize().multiplyScalar(d);
				camera.position.copy(controls.target).add(dir);
				controls.update();
			}

			function panCameraBetweenScreenPoints(
				fromX: number,
				fromY: number,
				toX: number,
				toY: number,
			) {
				const from = getGroundPointFromClient(
					fromX,
					fromY,
					new THREE.Vector3(),
				);
				const to = getGroundPointFromClient(toX, toY, new THREE.Vector3());
				if (!from || !to) return false;
				const delta = from.sub(to);
				camera.position.add(delta);
				controls.target.add(delta);
				controls.update();
				markDirty();
				return true;
			}

			function zoomCameraAroundClientPoint(
				nextDistance: number,
				clientX: number,
				clientY: number,
				anchorPoint?: Vector3 | null,
			) {
				const anchor =
					anchorPoint?.clone?.() ??
					getGroundPointFromClient(
						clientX,
						clientY,
						new THREE.Vector3(),
					)?.clone?.() ??
					null;
				setCameraDistance(nextDistance);
				if (!anchor) {
					markDirty();
					return;
				}
				const currentPoint = getGroundPointFromClient(
					clientX,
					clientY,
					new THREE.Vector3(),
				);
				if (currentPoint) {
					const delta = anchor.sub(currentPoint);
					camera.position.add(delta);
					controls.target.add(delta);
				}
				controls.update();
				markDirty();
			}

			function beginTouchCameraPinch() {
				const touches = Array.from(r.activePointers.entries()).filter(
					([, pointer]) => pointer.pointerType === "touch",
				);
				if (touches.length < 2) return false;
				const [first, second] = touches;
				const centerX = (first[1].x + second[1].x) / 2;
				const centerY = (first[1].y + second[1].y) / 2;
				r.touchCameraGesture = {
					kind: "pinch",
					pointerIds: [first[0], second[0]],
					startDistance: Math.max(
						Math.hypot(first[1].x - second[1].x, first[1].y - second[1].y),
						1,
					),
					startCameraDistance: getCameraDistance(),
					anchorPoint:
						getGroundPointFromClient(
							centerX,
							centerY,
							new THREE.Vector3(),
						)?.clone?.() ?? null,
				};
				return true;
			}

			function getTouchPointerCount() {
				return Array.from(r.activePointers.values()).filter(
					(pointer) => pointer.pointerType === "touch",
				).length;
			}

			function updateTouchCameraPinch() {
				const gesture = r.touchCameraGesture;
				if (gesture?.kind !== "pinch") return;
				const first = r.activePointers.get(gesture.pointerIds[0]);
				const second = r.activePointers.get(gesture.pointerIds[1]);
				if (!first || !second) return;
				const centerX = (first.x + second.x) / 2;
				const centerY = (first.y + second.y) / 2;
				const distance = Math.max(
					Math.hypot(first.x - second.x, first.y - second.y),
					1,
				);
				const nextDistance =
					gesture.startCameraDistance * (gesture.startDistance / distance);
				zoomCameraAroundClientPoint(
					nextDistance,
					centerX,
					centerY,
					gesture.anchorPoint,
				);
			}

			function forwardPointerDown(event: PointerEvent) {
				r.isForwardingPointerDown = true;
				renderer.domElement.dispatchEvent(
					new PointerEvent("pointerdown", {
						bubbles: true,
						cancelable: true,
						pointerId: event.pointerId,
						pointerType: event.pointerType,
						isPrimary: event.isPrimary,
						button: event.button,
						buttons: 1,
						clientX: event.clientX,
						clientY: event.clientY,
						screenX: event.screenX,
						screenY: event.screenY,
					}),
				);
				r.isForwardingPointerDown = false;
			}

			function startCameraHold(event: PointerEvent) {
				r.cameraHold = {
					pointerId: event.pointerId,
					startX: event.clientX,
					startY: event.clientY,
					active: false,
					originalEvent: event,
					timerId: setTimeout(() => {
						if (!r.cameraHold || r.cameraHold.pointerId !== event.pointerId)
							return;
						r.cameraHold.active = true;
						setCameraActive(true);
						forwardPointerDown(r.cameraHold.originalEvent);
					}, CAMERA_HOLD_DELAY_MS),
				};
			}

			function cancelCameraHold(waitForOrbit: boolean) {
				if (!r.cameraHold) return;
				clearTimeout(r.cameraHold.timerId);
				r.cameraHold = null;
				if (waitForOrbit) {
					setTimeout(() => setCameraActive(false), 0);
				} else {
					setCameraActive(false);
				}
			}

			function selectMesh(index: number | null, shouldEmit = true) {
				r.selectedIndex = index;
				r.selectedMesh =
					index !== null
						? (r.fixtureGroup.children.find(
								(m: Object3D) => m.userData.fixtureIndex === index,
							) ?? null)
						: null;

				r.fixtureGroup.children.forEach((obj: Object3D) => {
					const mesh = obj as Mesh;
					const base = mesh.userData.baseColor;
					const baseOp = mesh.userData.baseOpacity;
					const hasAsset = Boolean(mesh.userData.assetType);
					const isProductMesh = Boolean(mesh.userData.isProduct);
					const idx = mesh.userData?.fixtureIndex;
					const isPrimary = mesh === r.selectedMesh;
					const isInMulti =
						typeof idx === "number" && selectedIndicesRef.current.includes(idx);
					if (isPrimary) {
						applyMeshVisual(
							mesh,
							SELECTED_COLOR,
							mesh.userData.isContainer
								? 0.6
								: hasAsset
									? isProductMesh
										? 0.22
										: 0.28
									: 0.92,
						);
					} else if (isInMulti) {
						applyMeshVisual(
							mesh,
							MULTI_SELECTED_COLOR,
							mesh.userData.isContainer
								? 0.6
								: hasAsset
									? isProductMesh
										? 0.44
										: 0.55
									: 0.85,
						);
					} else {
						applyMeshVisual(mesh, base, baseOp);
					}
				});

				if (
					r.selectedMesh &&
					layoutRef.current?.fixtures?.[r.selectedMesh.userData.fixtureIndex]
						?.locked !== true
				) {
					updateResizeHandles(r.selectedMesh);
				} else {
					clearResizeHandles();
				}

				if (shouldEmit) setSelectedFixture(index);
			}

			function updateResizeHandles(mesh: Object3D) {
				if (
					layoutRef.current?.fixtures?.[mesh.userData.fixtureIndex]?.locked ===
					true
				) {
					clearResizeHandles();
					return;
				}
				const base = mesh.userData.baseFixture;
				const width = base.width * mesh.scale.x * FLOOR_UNIT_SCALE;
				const depth = base.depth * mesh.scale.z * FLOOR_UNIT_SCALE;
				const renderHeight = mesh.userData.isContainer
					? CONTAINER_HEIGHT_UNITS * FLOOR_UNIT_SCALE
					: base.height * FLOOR_UNIT_SCALE;
				const handleSize = Math.max(
					0.12,
					Math.min(0.28, Math.max(width, depth) * 0.08),
				);
				const y = renderHeight + handleSize * 0.8;

				const positions: Record<ResizeEdge, { x: number; z: number }> = {
					"top-left": { x: -width / 2, z: -depth / 2 },
					top: { x: 0, z: -depth / 2 },
					"top-right": { x: width / 2, z: -depth / 2 },
					right: { x: width / 2, z: 0 },
					"bottom-right": { x: width / 2, z: depth / 2 },
					bottom: { x: 0, z: depth / 2 },
					"bottom-left": { x: -width / 2, z: depth / 2 },
					left: { x: -width / 2, z: 0 },
				};

				// Fast path: if the correct number of handles already exist,
				// just translate them instead of destroying/recreating geometry.
				if (r.resizeHandleGroup.children.length === RESIZE_EDGES.length) {
					RESIZE_EDGES.forEach((edge, i) => {
						const pos = positions[edge];
						const handle = r.resizeHandleGroup.children[i] as Object3D;
						handle.position.set(
							mesh.position.x + pos.x,
							y,
							mesh.position.z + pos.z,
						);
					});
					return;
				}

				clearResizeHandles();
				RESIZE_EDGES.forEach((edge) => {
					const pos = positions[edge];
					const geo = new THREE.BoxGeometry(handleSize, handleSize, handleSize);
					const mat = new THREE.MeshBasicMaterial({
						color: RESIZE_HANDLE_COLOR,
						transparent: true,
						opacity: 0.96,
						depthTest: false,
					});
					const handle = new THREE.Mesh(geo, mat);
					handle.position.set(
						mesh.position.x + pos.x,
						y,
						mesh.position.z + pos.z,
					);
					handle.userData.resizeEdge = edge;
					handle.renderOrder = 10;
					r.resizeHandleGroup.add(handle);
				});
			}

			function clearResizeHandles() {
				r.hoveredResizeHandle = null;
				r.resizeHandleGroup.children.forEach((h: Object3D) => {
					(h as Mesh).geometry.dispose();
					((h as Mesh).material as Material).dispose();
				});
				r.resizeHandleGroup.clear();
			}

			function createDragFootprint(mesh: Object3D) {
				removeDragFootprint();
				const base = mesh.userData.baseFixture;
				const geo = new THREE.PlaneGeometry(
					base.width * FLOOR_UNIT_SCALE,
					base.depth * FLOOR_UNIT_SCALE,
				);
				const mat = new THREE.MeshBasicMaterial({
					color: DRAGGING_COLOR,
					transparent: true,
					opacity: 0.26,
					side: THREE.DoubleSide,
					depthWrite: false,
				});
				r.dragFootprint = new THREE.Mesh(geo, mat);
				r.dragFootprint.rotation.x = -Math.PI / 2;
				scene.add(r.dragFootprint);
				updateDragFootprint(mesh);
			}

			function updateDragFootprint(mesh: Object3D) {
				if (!r.dragFootprint) return;
				r.dragFootprint.position.set(mesh.position.x, 0.018, mesh.position.z);
				r.dragFootprint.scale.set(mesh.scale.x, mesh.scale.z, 1);
			}

			function removeDragFootprint() {
				if (!r.dragFootprint) return;
				scene.remove(r.dragFootprint);
				r.dragFootprint.geometry.dispose();
				r.dragFootprint.material.dispose();
				r.dragFootprint = null;
			}

			function scenePointToFloor(point: Vector3, layout: LayoutJSON) {
				const floor = getFloorSize(layout);
				return {
					x: point.x / FLOOR_UNIT_SCALE + floor.width / 2,
					y: point.z / FLOOR_UNIT_SCALE + floor.height / 2,
				};
			}

			function applyBoxToMesh(
				mesh: Object3D,
				box: { x: number; y: number; width: number; height: number },
				layout: LayoutJSON,
			) {
				const floor = getFloorSize(layout);
				const base = mesh.userData.baseFixture;
				mesh.position.x =
					(box.x + box.width / 2 - floor.width / 2) * FLOOR_UNIT_SCALE;
				mesh.position.z =
					(box.y + box.height / 2 - floor.height / 2) * FLOOR_UNIT_SCALE;
				mesh.scale.x = Math.max(0.05, box.width / base.width);
				mesh.scale.z = Math.max(0.05, box.height / base.depth);
				mesh.scale.y = 1;
			}

			function getResizedBox(
				origin: { x: number; y: number; width: number; height: number },
				edge: ResizeEdge,
				floorPoint: { x: number; y: number },
				layout: LayoutJSON,
			) {
				const floor = getFloorSize(layout);
				let left = origin.x;
				let top = origin.y;
				let right = origin.x + origin.width;
				let bottom = origin.y + origin.height;
				const min = 8;
				if (edge.includes("left")) left = clamp(floorPoint.x, 0, right - min);
				if (edge.includes("right"))
					right = clamp(floorPoint.x, left + min, floor.width);
				if (edge.includes("top")) top = clamp(floorPoint.y, 0, bottom - min);
				if (edge.includes("bottom"))
					bottom = clamp(floorPoint.y, top + min, floor.height);
				return { x: left, y: top, width: right - left, height: bottom - top };
			}

			function sceneBoxToFixturePatchLocal(
				mesh: Object3D,
				fixture: Fixture,
				layout: LayoutJSON,
			): Partial<Fixture> {
				return sceneBoxToFixturePatch(
					toSceneBoxMeshInput(mesh as Mesh),
					fixture,
					layout,
				);
			}

			function handlePointerDown(event: PointerEvent) {
				if (r.isForwardingPointerDown || event.button !== 0) return;

				r.activePointers.set(event.pointerId, {
					x: event.clientX,
					y: event.clientY,
					pointerType: event.pointerType,
				});
				if (
					event.pointerType === "touch" &&
					r.touchCameraGesture &&
					getTouchPointerCount() >= 2
				) {
					renderer.domElement.setPointerCapture?.(event.pointerId);
					if (beginTouchCameraPinch()) {
						updateTouchCameraPinch();
						event.preventDefault();
						return;
					}
				}

				// Camera placement mode (1st click = position, 2nd = direction).
				const camPhotoId = cameraDraftPhotoIdRef.current;
				if (camPhotoId) {
					const layoutNow = layoutRef.current;
					const groundHit = getGroundPoint(event);
					if (!layoutNow || !groundHit) return;
					const floorPt = scenePointToFloor(groundHit, layoutNow);
					const step1 = cameraStep1Ref.current;
					if (!step1) {
						setCameraStep1({
							floorX: floorPt.x,
							floorY: floorPt.y,
							clientX: event.clientX,
							clientY: event.clientY,
						});
					} else {
						const dx = floorPt.x - step1.floorX;
						const dy = floorPt.y - step1.floorY;
						const theta = Math.atan2(dy, dx);
						window.dispatchEvent(
							new CustomEvent("camera-draft-complete", {
								detail: {
									photoId: camPhotoId,
									x: step1.floorX,
									y: step1.floorY,
									theta,
									fovDeg: 70,
								},
							}),
						);
						setCameraStep1(null);
						cancelCameraDraftRef.current();
					}
					event.preventDefault();
					return;
				}

				// Zone drawing mode — drag on the floor to define the rect.
				if (zoneDraftCategoryRef.current) {
					setZoneDrag({
						startX: event.clientX,
						startY: event.clientY,
						curX: event.clientX,
						curY: event.clientY,
					});
					renderer.domElement.setPointerCapture?.(event.pointerId);
					event.preventDefault();
					return;
				}

				const handleHit = getHandleHit(event);
				if (handleHit && r.selectedMesh) {
					const layout = layoutRef.current;
					const fixture =
						layout?.fixtures?.[r.selectedMesh.userData.fixtureIndex];
					if (layout && fixture && fixture.locked !== true) {
						r.resizeDrag = {
							edge: handleHit.object.userData.resizeEdge,
							mesh: r.selectedMesh,
							pointerId: event.pointerId,
							originBox: {
								x: fixture.x,
								y: fixture.y,
								width: fixture.width,
								height: fixture.height,
							},
						};
						r.selectedMesh.userData.isResizing = true;
						createDragFootprint(r.selectedMesh);
						renderer.domElement.style.cursor =
							RESIZE_CURSOR[r.resizeDrag.edge] ?? "default";
						syncOrbit();
						renderer.domElement.setPointerCapture?.(event.pointerId);
						event.preventDefault();
					}
					return;
				}

				const hit = getFixtureHit(event);
				if (!hit) {
					if (event.pointerType === "touch") {
						renderer.domElement.setPointerCapture?.(event.pointerId);
						if (getTouchPointerCount() >= 2 && beginTouchCameraPinch()) {
							updateTouchCameraPinch();
						} else {
							r.touchCameraGesture = {
								kind: "pan",
								pointerId: event.pointerId,
								lastX: event.clientX,
								lastY: event.clientY,
							};
						}
						event.preventDefault();
						return;
					}
					const inMarqueeMode = interactionModeRef.current === "marquee";
					if (inMarqueeMode || event.shiftKey) {
						setMarquee({
							startX: event.clientX,
							startY: event.clientY,
							curX: event.clientX,
							curY: event.clientY,
							additive: event.shiftKey,
						});
						return;
					}
					startCameraHold(event);
					return;
				}

				const mesh = hit.object;
				if (event.shiftKey) {
					toggleFixtureSelection(mesh.userData.fixtureIndex);
					return;
				}
				const primaryIdx = mesh.userData.fixtureIndex;
				const primaryFixture = layoutRef.current?.fixtures?.[primaryIdx];
				if (primaryFixture?.locked === true) {
					selectMesh(primaryIdx);
					return;
				}

				// Products:
				// - Normal drag → move (same as regular fixtures).
				// - Alt+drag → free rotation of the GLB visual (X/Y axes).
				if (mesh.userData.isProduct && event.altKey) {
					selectMesh(mesh.userData.fixtureIndex);
					const visual = mesh.children.find(
						(c: Object3D) => c.userData.isAssetVisual,
					);
					if (visual) {
						r.productRotateDrag = {
							visualGroup: visual,
							pointerId: event.pointerId,
							startX: event.clientX,
							startY: event.clientY,
							startRotationY: visual.rotation.y,
							startRotationX: visual.rotation.x,
						};
						renderer.domElement.style.cursor = "move";
						syncOrbit();
						renderer.domElement.setPointerCapture?.(event.pointerId);
						event.preventDefault();
						return;
					}
				}

				const hitPoint = new THREE.Vector3(hit.point.x, 0, hit.point.z);
				// If the clicked mesh belongs to a multi-selection, drag the
				// whole group together (preserve selection); otherwise narrow
				// selection to just this fixture.
				const sel = selectedIndicesRef.current;
				const inGroup = sel.length > 1 && sel.includes(primaryIdx);
				const groupIndices = inGroup ? sel : [primaryIdx];
				if (inGroup) {
					selectMesh(primaryIdx, false);
				} else {
					selectMesh(primaryIdx);
				}
				const additional: {
					mesh: Object3D;
					offsetX: number;
					offsetZ: number;
				}[] = [];
				if (groupIndices.length > 1) {
					r.fixtureGroup.children.forEach((m: Object3D) => {
						if (m === mesh) return;
						if (m.userData?.isContainer) return;
						const idx = m.userData?.fixtureIndex;
						if (typeof idx !== "number") return;
						if (!groupIndices.includes(idx)) return;
						if (layoutRef.current?.fixtures?.[idx]?.locked === true) return;
						additional.push({
							mesh: m,
							offsetX: m.position.x - mesh.position.x,
							offsetZ: m.position.z - mesh.position.z,
						});
					});
				}
				r.directDrag = {
					mesh,
					pointerId: event.pointerId,
					offset: mesh.position.clone().sub(hitPoint),
					additional,
				};
				console.log(
					"[drag-start] idx=",
					mesh.userData.fixtureIndex,
					"isProduct=",
					mesh.userData.isProduct,
					"pos=",
					mesh.position.x.toFixed(3),
					mesh.position.z.toFixed(3),
				);
				applyMeshVisual(mesh as Mesh, DRAGGING_COLOR, 0.98);
				mesh.scale.y = 1.08;
				// Visually mark group members as dragging too.
				additional.forEach(({ mesh: m }) => {
					applyMeshVisual(m as Mesh, DRAGGING_COLOR, 0.98);
					(m as Mesh).scale.y = 1.08;
				});
				createDragFootprint(mesh);
				// Suspend shadow recomputation during drag — it's expensive and invisible while moving.
				key.shadow.autoUpdate = false;
				syncOrbit();
				renderer.domElement.setPointerCapture?.(event.pointerId);
				event.preventDefault();
			}

			function handlePointerMove(event: PointerEvent) {
				if (r.activePointers.has(event.pointerId)) {
					r.activePointers.set(event.pointerId, {
						x: event.clientX,
						y: event.clientY,
						pointerType:
							r.activePointers.get(event.pointerId)?.pointerType ??
							event.pointerType,
					});
				}

				// Zone draft drag — update preview rectangle.
				if (zoneDragRef.current) {
					setZoneDrag((z) =>
						z ? { ...z, curX: event.clientX, curY: event.clientY } : z,
					);
					event.preventDefault();
					return;
				}

				// Marquee in progress — just update screen-space rectangle.
				if (marqueeRef.current) {
					setMarquee((m) =>
						m ? { ...m, curX: event.clientX, curY: event.clientY } : m,
					);
					event.preventDefault();
					return;
				}

				if (r.cameraHold && !r.cameraHold.active) {
					const dx = event.clientX - r.cameraHold.startX;
					const dy = event.clientY - r.cameraHold.startY;
					if (Math.hypot(dx, dy) > POINTER_MOVE_CANCEL_PX) {
						cancelCameraHold(false);
					}
				}

				const touchGesture = r.touchCameraGesture;
				if (touchGesture) {
					if (
						touchGesture.kind === "pan" &&
						touchGesture.pointerId === event.pointerId
					) {
						panCameraBetweenScreenPoints(
							touchGesture.lastX,
							touchGesture.lastY,
							event.clientX,
							event.clientY,
						);
						touchGesture.lastX = event.clientX;
						touchGesture.lastY = event.clientY;
						if (getTouchPointerCount() >= 2 && beginTouchCameraPinch()) {
							updateTouchCameraPinch();
						}
						event.preventDefault();
						return;
					}
					if (
						touchGesture.kind === "pinch" &&
						touchGesture.pointerIds.includes(event.pointerId)
					) {
						updateTouchCameraPinch();
						event.preventDefault();
						return;
					}
				}

				switch (getActiveDragKind(event.pointerId)) {
					case "productRotate": {
						const drag = r.productRotateDrag;
						if (!drag) break;
						const deltaX = event.clientX - drag.startX;
						const deltaY = event.clientY - drag.startY;
						drag.visualGroup.rotation.y = drag.startRotationY + deltaX * 0.01;
						drag.visualGroup.rotation.x = drag.startRotationX + deltaY * 0.01;
						markDirty();
						event.preventDefault();
						return;
					}
					case "resize": {
						const drag = r.resizeDrag;
						if (!drag) break;
						const layout = layoutRef.current;
						const hitPoint = getGroundPoint(event);
						if (layout && hitPoint) {
							const fp = scenePointToFloor(hitPoint, layout);
							const box = getResizedBox(drag.originBox, drag.edge, fp, layout);
							applyBoxToMesh(drag.mesh, box, layout);
							updateDragFootprint(drag.mesh);
							updateResizeHandles(drag.mesh);
							markDirty();
						}
						event.preventDefault();
						return;
					}
					case "direct": {
						const drag = r.directDrag;
						if (!drag) break;
						const layout = layoutRef.current;
						const hitPoint = getGroundPoint(event);
						if (!hitPoint) {
							console.warn(
								"[3D-drag] getGroundPoint returned null! Camera may be looking away from floor.",
							);
						}
						if (layout && hitPoint) {
							const primary = drag.mesh;
							primary.position.copy(hitPoint.add(drag.offset));
							clampScenePosition(primary, layout);
							// Move group members along with the primary mesh,
							// preserving each member's original offset.
							drag.additional.forEach(({ mesh: m, offsetX, offsetZ }) => {
								m.position.x = primary.position.x + offsetX;
								m.position.z = primary.position.z + offsetZ;
								clampScenePosition(m, layout);
							});
							updateDragFootprint(primary);
							updateResizeHandles(primary);
							markDirty();
						}
						event.preventDefault();
						return;
					}
				}

				// Hover resize handle
				if (!r.directDrag && !r.resizeDrag && !r.cameraHold?.active) {
					const handleHit = getHandleHit(event);
					const nextHandle = handleHit?.object ?? null;
					if (nextHandle !== r.hoveredResizeHandle) {
						if (r.hoveredResizeHandle) {
							r.hoveredResizeHandle.material.color.set(RESIZE_HANDLE_COLOR);
							r.hoveredResizeHandle.material.opacity = 0.96;
						}
						r.hoveredResizeHandle = nextHandle;
						if (r.hoveredResizeHandle) {
							r.hoveredResizeHandle.material.color.set(
								RESIZE_HANDLE_ACTIVE_COLOR,
							);
							r.hoveredResizeHandle.material.opacity = 1;
						}
					}
					if (r.hoveredResizeHandle) {
						renderer.domElement.style.cursor =
							RESIZE_CURSOR[
								r.hoveredResizeHandle.userData.resizeEdge as ResizeEdge
							] ?? "default";
					} else {
						const fixtureHit = getFixtureHit(event);
						if (fixtureHit) {
							const isProduct = fixtureHit.object.userData.isProduct;
							renderer.domElement.style.cursor =
								isProduct && event.altKey ? "move" : "grab";
						} else {
							renderer.domElement.style.cursor = "default";
						}
					}
				}
			}

			function handlePointerUp(event: PointerEvent) {
				r.activePointers.delete(event.pointerId);
				if (event.pointerType === "touch") {
					const touchGesture = r.touchCameraGesture;
					if (
						touchGesture?.kind === "pan" &&
						touchGesture.pointerId === event.pointerId
					) {
						r.touchCameraGesture = null;
					} else if (
						touchGesture?.kind === "pinch" &&
						touchGesture.pointerIds.includes(event.pointerId)
					) {
						const remainingTouches = Array.from(
							r.activePointers.entries(),
						).filter(([, pointer]) => pointer.pointerType === "touch");
						if (remainingTouches.length >= 2) {
							beginTouchCameraPinch();
							updateTouchCameraPinch();
						} else if (remainingTouches.length === 1) {
							r.touchCameraGesture = {
								kind: "pan",
								pointerId: remainingTouches[0][0],
								lastX: remainingTouches[0][1].x,
								lastY: remainingTouches[0][1].y,
							};
						} else {
							r.touchCameraGesture = null;
						}
					}
				}

				// Finalize zone draft: convert screen-space rect → floor coords.
				if (zoneDragRef.current) {
					const z = zoneDragRef.current;
					const cat = zoneDraftCategoryRef.current;
					try {
						renderer.domElement.releasePointerCapture?.(event.pointerId);
					} catch {
						/* ignore */
					}
					const layoutNow = layoutRef.current;
					if (cat && layoutNow) {
						// Cast both corners onto the floor plane via ray.
						const corner1 = (() => {
							const e1 = new PointerEvent("synth", {
								clientX: z.startX,
								clientY: z.startY,
							});
							return getGroundPoint(e1);
						})();
						const corner2 = (() => {
							const e2 = new PointerEvent("synth", {
								clientX: z.curX,
								clientY: z.curY,
							});
							return getGroundPoint(e2);
						})();
						if (corner1 && corner2) {
							const p1 = scenePointToFloor(corner1, layoutNow);
							const p2 = scenePointToFloor(corner2, layoutNow);
							const x = Math.min(p1.x, p2.x);
							const y = Math.min(p1.y, p2.y);
							const w = Math.abs(p2.x - p1.x);
							const h = Math.abs(p2.y - p1.y);
							if (w >= 12 && h >= 12) {
								addZoneRef.current({
									id: `zone-${Date.now().toString(36)}`,
									name: ZONE_CATEGORY_LABEL[cat],
									category: cat,
									x: Math.round(x),
									y: Math.round(y),
									width: Math.round(w),
									height: Math.round(h),
								});
							}
						}
					}
					setZoneDrag(null);
					cancelZoneDraftRef.current();
					return;
				}

				// Finalize marquee: project each fixture's center to screen
				// space and select those whose center lands inside the box.
				if (marqueeRef.current) {
					const m = marqueeRef.current;
					try {
						renderer.domElement.releasePointerCapture?.(event.pointerId);
					} catch {
						/* ignore */
					}
					const x1 = Math.min(m.startX, m.curX);
					const x2 = Math.max(m.startX, m.curX);
					const y1 = Math.min(m.startY, m.curY);
					const y2 = Math.max(m.startY, m.curY);
					const minSize = 6;
					if (x2 - x1 >= minSize && y2 - y1 >= minSize) {
						const rect = renderer.domElement.getBoundingClientRect();
						const hits: number[] = [];
						const projected = new THREE.Vector3();
						r.fixtureGroup.children.forEach((mesh: Object3D) => {
							if (mesh.userData?.isContainer) return;
							const idx = mesh.userData?.fixtureIndex;
							if (typeof idx !== "number") return;
							projected.set(mesh.position.x, mesh.position.y, mesh.position.z);
							projected.project(camera);
							// behind camera → skip
							if (projected.z < -1 || projected.z > 1) return;
							const sx = rect.left + ((projected.x + 1) / 2) * rect.width;
							const sy = rect.top + ((1 - projected.y) / 2) * rect.height;
							if (sx >= x1 && sx <= x2 && sy >= y1 && sy <= y2) {
								hits.push(idx);
							}
						});
						setSelectedIndicesBatchRef.current(hits, !m.additive);
					} else if (!m.additive) {
						clearSelectionRef.current();
					}
					setMarquee(null);
					return;
				}

				if (r.cameraHold?.pointerId === event.pointerId) {
					const wasActive = r.cameraHold.active;
					cancelCameraHold(true);
					if (!wasActive) selectMesh(null);
				}

				switch (getActiveDragKind(event.pointerId)) {
					case "productRotate": {
						try {
							renderer.domElement.releasePointerCapture?.(event.pointerId);
						} catch {
							/* ignore */
						}
						renderer.domElement.style.cursor = "grab";
						r.productRotateDrag = null;
						syncOrbit();
						return;
					}
					case "resize": {
						const drag = r.resizeDrag;
						if (!drag) break;
						const layout = layoutRef.current;
						const fixture = layout?.fixtures?.[drag.mesh.userData.fixtureIndex];
						r.resizeDrag = null;
						drag.mesh.userData.isResizing = false;
						removeDragFootprint();
						key.shadow.autoUpdate = true;
						key.shadow.needsUpdate = true;
						markDirty();
						renderer.domElement.releasePointerCapture?.(event.pointerId);
						renderer.domElement.style.cursor = "default";
						if (layout && fixture) {
							updateFixture(
								drag.mesh.userData.fixtureIndex,
								sceneBoxToFixturePatchLocal(drag.mesh, fixture, layout),
							);
						}
						syncOrbit();
						return;
					}
					case "direct": {
						const drag = r.directDrag;
						if (!drag) break;
						const layout = layoutRef.current;
						const { mesh: primary, additional } = drag;
						r.directDrag = null;
						primary.scale.y = 1;
						additional.forEach(({ mesh: m }) => {
							m.scale.y = 1;
						});
						removeDragFootprint();
						key.shadow.autoUpdate = true;
						key.shadow.needsUpdate = true;
						markDirty();
						renderer.domElement.releasePointerCapture?.(event.pointerId);
						console.log(
							"[drag-end] layout=",
							!!layout,
							"finalPos=",
							primary.position.x.toFixed(3),
							primary.position.z.toFixed(3),
						);
						if (layout) {
							const updates: { index: number; patch: Partial<Fixture> }[] = [];
							const primaryFx =
								layout.fixtures?.[primary.userData.fixtureIndex];
							const patch = primaryFx
								? sceneBoxToFixturePatchLocal(primary, primaryFx, layout)
								: null;
							console.log(
								"[drag-end] fixtureIndex=",
								primary.userData.fixtureIndex,
								"primaryFx=",
								!!primaryFx,
								"patch=",
								patch,
							);
							if (primaryFx && patch) {
								updates.push({ index: primary.userData.fixtureIndex, patch });
							}
							additional.forEach(({ mesh: m }) => {
								const idx = m.userData?.fixtureIndex;
								const fx = layout.fixtures?.[idx];
								if (fx)
									updates.push({
										index: idx,
										patch: sceneBoxToFixturePatchLocal(m, fx, layout),
									});
							});
							if (updates.length === 1)
								updateFixture(updates[0].index, updates[0].patch);
							else if (updates.length > 1)
								updateFixturesBatchRef.current(updates);
						}
						syncOrbit();
					}
				}
			}

			function handleWheelZoom(event: WheelEvent) {
				if (r.directDrag || r.resizeDrag) return;
				event.preventDefault();
				const scale = Math.exp(event.deltaY * WHEEL_ZOOM_SPEED);
				zoomCameraAroundClientPoint(
					getCameraDistance() * scale,
					event.clientX,
					event.clientY,
				);
			}

			// Cleanup function stored so main useEffect can call it
			(r as SceneRefs & { _cleanup?: () => void })._cleanup = () => {
				cancelAnimationFrame(r.animFrameId);
				r.touchCameraGesture = null;
				r.activePointers.clear();
				renderer.domElement.removeEventListener(
					"pointerdown",
					handlePointerDown,
				);
				renderer.domElement.removeEventListener("wheel", handleWheelZoom);
				window.removeEventListener("pointermove", handlePointerMove);
				window.removeEventListener("pointerup", handlePointerUp);
				window.removeEventListener("pointercancel", handlePointerUp);
				window.removeEventListener("resize", handleResize);
				window.removeEventListener("export-3d-png", handleExportPng);
				window.removeEventListener("export-3d-gltf", handleExportGltf);
				renderer.dispose();
				if (renderer.domElement.parentNode === el) {
					el.removeChild(renderer.domElement);
				}
			};
		}

		init(container).catch(console.error);

		return () => {
			disposed = true;
			const r = refs.current as (SceneRefs & { _cleanup?: () => void }) | null;
			r?._cleanup?.();
			refs.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [updateFixture, setSelectedFixture]);

	// Rebuild meshes when layout changes
	useEffect(() => {
		const r = refs.current;
		if (!r || !layout) return;

		// Structural key: fixture count + per-fixture identity (not position).
		// If only x/y changed (drag), skip full rebuild and just translate meshes.
		const fixtures = layout.fixtures ?? [];
		const structKey = `${layout.floorWidth}x${layout.floorHeight}|${fixtures.length}|${fixtures.map((f) => `${f.id}:${f.assetType ?? ""}:${f.width}:${f.height}:${f.shape}:${f.rotation ?? 0}:${f.material?.baseColor ?? ""}`).join(",")}`;
		const isPositionOnly = prevStructuralKeyRef.current === structKey;
		prevStructuralKeyRef.current = structKey;

		if (isPositionOnly) {
			// Fast path: translate existing meshes without recreating geometry.
			const t0 = performance.now();
			fixtures.forEach((fixture, index) => {
				const mesh = r.fixtureGroup.children.find(
					(m: Object3D) => m.userData.fixtureIndex === index,
				);
				if (!mesh) return;
				const box = fixtureToSceneBox(fixture, layout);
				mesh.position.set(box.x, mesh.position.y, box.z);
			});
			const dragMs = performance.now() - t0;
			addPerfEntry({
				category: "drag",
				label: `위치 업데이트 (집기 ${fixtures.length}개)`,
				ms: dragMs,
				meta: { fixtureCount: fixtures.length },
			});
			refs.current?.markDirty?.();
			return;
		}

		const t0Rebuild = performance.now();

		const { THREE, scene, fixtureGroup } = r;

		// Clear resize handles
		r.hoveredResizeHandle = null;
		r.resizeHandleGroup.children.forEach((h: Object3D) => {
			(h as Mesh).geometry.dispose();
			((h as Mesh).material as Material).dispose();
		});
		r.resizeHandleGroup.clear();
		r.selectedMesh = null;
		r.selectedIndex = null;
		r.directDrag = null;
		r.resizeDrag = null;

		// Dispose previous asset visuals (procedural geometries/materials) before clearing.
		fixtureGroup.children.forEach((mesh: Object3D) => {
			mesh.children.forEach((child: Object3D) => {
				if (child?.userData?.isAssetVisual) {
					disposeGroup(child);
				}
			});
		});
		fixtureGroup.clear();

		// Floor
		if (r.floorMesh) {
			scene.remove(r.floorMesh);
			(r.floorMesh as Mesh).geometry.dispose();
			((r.floorMesh as Mesh).material as Material).dispose();
			r.floorMesh = null;
		}
		if (r.gridHelper) {
			scene.remove(r.gridHelper);
			r.gridHelper.dispose();
			r.gridHelper = null;
		}

		const floor = getFloorSize(layout);
		const fw = Math.max(1, floor.width * FLOOR_UNIT_SCALE);
		const fd = Math.max(1, floor.height * FLOOR_UNIT_SCALE);

		const floorGeo = new THREE.BoxGeometry(fw, 0.04, fd);
		const floorMat = new THREE.MeshStandardMaterial({
			color: FLOOR_COLOR,
			roughness: 0.86,
		});
		r.floorMesh = new THREE.Mesh(floorGeo, floorMat);
		r.floorMesh.position.y = -0.02;
		r.floorMesh.receiveShadow = true;
		scene.add(r.floorMesh);

		// Grid: each cell = GRID_CELL_CM cm (default 30) — matches real fixture units.
		const GRID_CELL_CM = 30;
		const gridSize = Math.max(fw, fd);
		// Each layout unit ≈ 1 cm; FLOOR_UNIT_SCALE shrinks to scene units.
		// We want cell width in scene units = GRID_CELL_CM * FLOOR_UNIT_SCALE.
		const cellSizeScene = GRID_CELL_CM * FLOOR_UNIT_SCALE;
		const gridDivs = Math.max(4, Math.round(gridSize / cellSizeScene));
		r.gridHelper = new THREE.GridHelper(
			gridSize,
			gridDivs,
			GRID_COLOR,
			GRID_COLOR,
		);
		r.gridHelper.position.y = 0.002;
		r.gridHelper.material.transparent = true;
		r.gridHelper.material.opacity = 0.45;
		scene.add(r.gridHelper);
		r.gridCellCm = GRID_CELL_CM;

		// Zones — translucent colored tiles slightly above floor.
		r.zoneGroup.children.forEach((obj: Object3D) => {
			const m = obj as Mesh;
			m.geometry?.dispose();
			if (m.material) {
				const mat = m.material;
				if (Array.isArray(mat)) {
					for (const mm of mat as Material[]) mm.dispose?.();
				} else (mat as Material).dispose?.();
			}
		});
		r.zoneGroup.clear();
		const zones = layout.zones ?? [];
		for (const zone of zones) {
			const zw = Math.max(1, zone.width * FLOOR_UNIT_SCALE);
			const zd = Math.max(1, zone.height * FLOOR_UNIT_SCALE);
			const cxLayout = zone.x + zone.width / 2 - layout.floorWidth / 2;
			const czLayout = zone.y + zone.height / 2 - layout.floorHeight / 2;
			const cx = cxLayout * FLOOR_UNIT_SCALE;
			const cz = czLayout * FLOOR_UNIT_SCALE;

			const tileGeo = new THREE.PlaneGeometry(zw, zd);
			const tileMat = new THREE.MeshBasicMaterial({
				color: ZONE_HEX[zone.category] ?? 0x94a3b8,
				transparent: true,
				opacity: 0.18,
				depthWrite: false,
			});
			const tile = new THREE.Mesh(tileGeo, tileMat);
			tile.rotation.x = -Math.PI / 2;
			tile.position.set(cx, 0.025, cz);
			tile.renderOrder = 0;
			r.zoneGroup.add(tile);
		}

		// Fixtures (fixtures already declared above in structural key computation)
		const containerFlags = fixtures.map((f, i) =>
			isContainerFixture(f, fixtures, i),
		);
		const order = fixtures
			.map((_, i) => i)
			.sort((a, b) => {
				if (containerFlags[a] === containerFlags[b]) return a - b;
				return containerFlags[a] ? -1 : 1;
			});

		order.forEach((index) => {
			const fixture = fixtures[index];
			const isContainer = containerFlags[index];
			const isProduct =
				!isContainer && PRODUCT_ASSET_TYPES.has(fixture.assetType ?? "");
			const box = fixtureToSceneBox(fixture, layout);
			const renderHeight = isContainer
				? CONTAINER_HEIGHT_UNITS * FLOOR_UNIT_SCALE
				: box.sceneHeight;
			const wrapperColor = isContainer
				? CONTAINER_COLOR
				: isProduct
					? PRODUCT_COLOR
					: getFixtureColor(fixture);
			// Wrapper: bbox raycast target. Translucent so procedural details inside are visible.
			// Products get 20% more transparent than regular asset fixtures (0.06 × 0.8 = 0.048).
			const wrapperOpacity = isContainer
				? 0.42
				: fixture.assetType
					? isProduct
						? 0.048
						: 0.06
					: getFixtureOpacity(fixture);

			const geo = new THREE.BoxGeometry(
				box.sceneWidth,
				renderHeight,
				box.sceneDepth,
			);
			const mat = new THREE.MeshStandardMaterial({
				color: wrapperColor,
				roughness: isContainer ? 0.92 : 0.72,
				metalness: 0.04,
				transparent: true,
				opacity: wrapperOpacity,
				depthWrite: !isContainer && !fixture.assetType,
			});
			const mesh = new THREE.Mesh(geo, mat);
			mesh.position.set(box.x, renderHeight / 2, box.z);
			mesh.castShadow = !isContainer;
			mesh.receiveShadow = true;
			mesh.renderOrder = isContainer ? 0 : 1;
			mesh.userData.fixtureIndex = index;
			mesh.userData.isContainer = isContainer;
			mesh.userData.isProduct = isProduct;
			mesh.userData.baseFixture = {
				width: box.width,
				depth: box.depth,
				height: box.height,
			};
			mesh.userData.baseColor = wrapperColor;
			mesh.userData.baseOpacity = wrapperOpacity;
			mesh.userData.assetType = fixture.assetType;

			// Procedural visual (asset library) for non-container fixtures.
			if (!isContainer) {
				const fixtureFillColor =
					fixture.material?.baseColor ??
					`#${wrapperColor.toString(16).padStart(6, "0")}`;
				const visual = resolveAssetVisual(fixture.assetType, {
					width: box.sceneWidth,
					depth: box.sceneDepth,
					height: renderHeight,
					baseColor: fixtureFillColor,
				});
				visual.userData.isAssetVisual = true;
				mesh.add(visual);
			}

			fixtureGroup.add(mesh);
		});

		// Restore selection
		const currentSelected = selectedIndexRef.current;
		if (currentSelected !== null) {
			const mesh = fixtureGroup.children.find(
				(m: Object3D) => m.userData.fixtureIndex === currentSelected,
			);
			if (mesh) {
				r.selectedMesh = mesh;
				r.selectedIndex = currentSelected;
				const hasAsset = Boolean(mesh.userData.assetType);
				const isProductMesh = Boolean(mesh.userData.isProduct);
				applyMeshVisual(
					mesh as Mesh,
					SELECTED_COLOR,
					mesh.userData.isContainer
						? 0.6
						: hasAsset
							? isProductMesh
								? 0.22
								: 0.28
							: 0.92,
				);
			}
		}

		// AABB collision detection — paint colliding fixtures red.
		// Pure axis-aligned in fixture coords (no rotation considered).
		const COLLISION_COLOR = 0xef4444;
		const collidingIdx = new Set<number>();
		for (let i = 0; i < fixtures.length; i++) {
			if (containerFlags[i]) continue;
			const a = fixtures[i];
			for (let j = i + 1; j < fixtures.length; j++) {
				if (containerFlags[j]) continue;
				const b = fixtures[j];
				if (
					a.x < b.x + b.width &&
					a.x + a.width > b.x &&
					a.y < b.y + b.height &&
					a.y + a.height > b.y
				) {
					collidingIdx.add(i);
					collidingIdx.add(j);
				}
			}
		}
		fixtureGroup.children.forEach((obj: Object3D) => {
			const mesh = obj as Mesh;
			if (collidingIdx.has(mesh.userData.fixtureIndex)) {
				applyMeshVisual(
					mesh,
					COLLISION_COLOR,
					mesh.userData.assetType ? 0.35 : 0.6,
				);
				mesh.userData.isColliding = true;
			} else {
				mesh.userData.isColliding = false;
			}
		});

		const layoutFitKey = `${layout.floorWidth}x${layout.floorHeight}:${fixtures.length}`;
		if (lastFittedLayoutKeyRef.current !== layoutFitKey) {
			const maxSize =
				Math.max(layout.floorWidth, layout.floorHeight, 600) * FLOOR_UNIT_SCALE;
			r.camera.position.set(maxSize * 0.8, maxSize * 0.9, maxSize * 1.1);
			r.controls.target.set(0, 0, 0);
			r.controls.update();
			lastFittedLayoutKeyRef.current = layoutFitKey;
		}
		addPerfEntry({
			category: "rebuild",
			label: `메시 재빌드 (집기 ${fixtures.length}개)`,
			ms: performance.now() - t0Rebuild,
			meta: { fixtureCount: fixtures.length },
		});
		refs.current?.markDirty?.();
	}, [layout]);

	// Sync selected highlight without rebuilding meshes
	useEffect(() => {
		const r = refs.current;
		if (!r) return;

		r.selectedIndex = selectedIndex;
		const selSet = new Set(selectedIndices);
		const COLLISION_COLOR = 0xef4444;
		r.fixtureGroup.children.forEach((obj: Object3D) => {
			const mesh = obj as Mesh;
			const isSelected = selSet.has(mesh.userData.fixtureIndex);
			const isPrimary = mesh.userData.fixtureIndex === selectedIndex;
			const isColliding = mesh.userData.isColliding;
			const base = mesh.userData.baseColor;
			const baseOp = mesh.userData.baseOpacity;
			const hasAsset = Boolean(mesh.userData.assetType);

			// Priority: collision (red) → selected primary → multi-selected → fixture material
			if (isColliding && !isSelected) {
				applyMeshVisual(mesh, COLLISION_COLOR, hasAsset ? 0.35 : 0.6);
			} else if (isSelected) {
				applyMeshVisual(
					mesh,
					isPrimary ? SELECTED_COLOR : MULTI_SELECTED_COLOR,
					mesh.userData.isContainer
						? 0.6
						: hasAsset
							? isPrimary
								? 0.4
								: 0.55
							: isPrimary
								? 0.92
								: 0.85,
				);
			} else {
				applyMeshVisual(mesh, base, baseOp);
			}
		});

		const selected = r.fixtureGroup.children.find(
			(m: Object3D) => m.userData.fixtureIndex === selectedIndex,
		);
		r.selectedMesh = selected ?? null;
		if (r.selectedMesh) {
			// rebuild handles
			const mesh = r.selectedMesh;
			r.hoveredResizeHandle = null;
			r.resizeHandleGroup.children.forEach((h: Object3D) => {
				(h as Mesh).geometry.dispose();
				((h as Mesh).material as Material).dispose();
			});
			r.resizeHandleGroup.clear();

			const THREE = r.THREE;
			const base = mesh.userData.baseFixture;
			const width = base.width * mesh.scale.x * FLOOR_UNIT_SCALE;
			const depth = base.depth * mesh.scale.z * FLOOR_UNIT_SCALE;
			const renderHeight = mesh.userData.isContainer
				? CONTAINER_HEIGHT_UNITS * FLOOR_UNIT_SCALE
				: base.height * FLOOR_UNIT_SCALE;
			const handleSize = Math.max(
				0.12,
				Math.min(0.28, Math.max(width, depth) * 0.08),
			);
			const y = renderHeight + handleSize * 0.8;

			const positions: Record<ResizeEdge, { x: number; z: number }> = {
				"top-left": { x: -width / 2, z: -depth / 2 },
				top: { x: 0, z: -depth / 2 },
				"top-right": { x: width / 2, z: -depth / 2 },
				right: { x: width / 2, z: 0 },
				"bottom-right": { x: width / 2, z: depth / 2 },
				bottom: { x: 0, z: depth / 2 },
				"bottom-left": { x: -width / 2, z: depth / 2 },
				left: { x: -width / 2, z: 0 },
			};

			RESIZE_EDGES.forEach((edge) => {
				const pos = positions[edge];
				const geo = new THREE.BoxGeometry(handleSize, handleSize, handleSize);
				const mat = new THREE.MeshBasicMaterial({
					color: RESIZE_HANDLE_COLOR,
					transparent: true,
					opacity: 0.96,
					depthTest: false,
				});
				const handle = new THREE.Mesh(geo, mat);
				handle.position.set(
					mesh.position.x + pos.x,
					y,
					mesh.position.z + pos.z,
				);
				handle.userData.resizeEdge = edge;
				handle.renderOrder = 10;
				r.resizeHandleGroup.add(handle);
			});
		} else {
			r.hoveredResizeHandle = null;
			r.resizeHandleGroup.children.forEach((h: Object3D) => {
				(h as Mesh).geometry.dispose();
				((h as Mesh).material as Material).dispose();
			});
			r.resizeHandleGroup.clear();
		}
		r.markDirty?.();
	}, [selectedIndex, selectedIndices]);

	useEffect(() => {
		const r = refs.current;
		const activeLayout = layoutRef.current;
		if (!r || !activeLayout) return;

		const maxSize =
			Math.max(activeLayout.floorWidth, activeLayout.floorHeight, 600) *
			FLOOR_UNIT_SCALE;

		switch (cameraView) {
			case "top":
				r.camera.position.set(0, maxSize * 1.4, 0.001);
				break;
			case "front":
				r.camera.position.set(0, maxSize * 0.55, maxSize * 1.35);
				break;
			case "side":
				r.camera.position.set(maxSize * 1.35, maxSize * 0.55, 0);
				break;
			case "fit":
				r.camera.position.set(maxSize * 0.8, maxSize * 0.9, maxSize * 1.1);
				break;
			default:
				r.camera.position.set(7, 8, 9);
		}

		r.controls.target.set(0, 0, 0);
		r.controls.update();
	}, [cameraView]);

	return (
		<div className="relative h-full w-full">
			<div ref={containerRef} className="h-full w-full" />
			{marquee && (
				<div
					className="pointer-events-none fixed z-50 border-2 border-blue-500 bg-blue-500/10"
					style={{
						left: Math.min(marquee.startX, marquee.curX),
						top: Math.min(marquee.startY, marquee.curY),
						width: Math.abs(marquee.curX - marquee.startX),
						height: Math.abs(marquee.curY - marquee.startY),
					}}
				/>
			)}
			{zoneDrag && zoneDraftCategory && (
				<div
					className="pointer-events-none fixed z-50 border-2 border-amber-500 bg-amber-500/15"
					style={{
						left: Math.min(zoneDrag.startX, zoneDrag.curX),
						top: Math.min(zoneDrag.startY, zoneDrag.curY),
						width: Math.abs(zoneDrag.curX - zoneDrag.startX),
						height: Math.abs(zoneDrag.curY - zoneDrag.startY),
					}}
				/>
			)}
			{cameraStep1 && (
				<div
					className="pointer-events-none fixed z-50 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 shadow"
					style={{ left: cameraStep1.clientX, top: cameraStep1.clientY }}
				/>
			)}
			{(zoneDraftCategory || cameraDraftPhotoId) && (
				<div className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2 rounded-md border bg-white/95 px-3 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur">
					{zoneDraftCategory
						? `${ZONE_CATEGORY_LABEL[zoneDraftCategory]} 영역을 드래그해서 그리세요 (Esc 취소)`
						: !cameraStep1
							? "카메라 위치 클릭 → 매장에서 사진 찍은 지점 (Esc 취소)"
							: "카메라가 바라보는 방향 클릭 (Esc 취소)"}
				</div>
			)}
		</div>
	);
}
