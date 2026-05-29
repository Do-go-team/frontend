import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useReducer,
	useRef,
	useState,
} from "react";
import { ENV_PRODUCT_DETECTION_ADAPTER } from "@/features/product-detection/product-detection.adapter";
import type { DetectionTask } from "@/features/product-detection/product-detection.types";
import { cn } from "@/shared/lib/utils";
import { ZONE_CATEGORY_COLOR, ZONE_CATEGORY_LABEL } from "./asset-defaults";
import { useLayout } from "./LayoutContext";
import type { Fixture, FixtureDetectionPreview } from "./layout.types";
import {
	clamp,
	isContainerFixture,
	MIN_FIXTURE_SIZE,
} from "./layout-transform";

const EDGE_HIT_ENTER_PX = 10;
const EDGE_HIT_EXIT_PX = 14;

type ResizeEdge =
	| "top-left"
	| "top"
	| "top-right"
	| "right"
	| "bottom-right"
	| "bottom"
	| "bottom-left"
	| "left";

const RESIZE_EDGES: ResizeEdge[] = [
	"top-left",
	"top",
	"top-right",
	"right",
	"bottom-right",
	"bottom",
	"bottom-left",
	"left",
];

function createEmptyDetectionPreview(): FixtureDetectionPreview {
	return {
		sourceImageUrl: null,
		taskId: null,
		taskStatus: "IDLE",
		taskUpdatedAt: null,
		errorMessage: null,
		items: [],
	};
}

function refreshDetectionPreviewUrls(
	prev: FixtureDetectionPreview,
	task: DetectionTask,
): FixtureDetectionPreview {
	const activeTaskItems = task.items.filter(
		(item) => item.status !== "REJECTED",
	);
	const taskItemsById = new Map(
		activeTaskItems.map((item) => [item.detection_item_id, item]),
	);
	const prevItemIds = new Set(prev.items.map((item) => item.detectionItemId));
	const refreshedItems = prev.items.map((item) => {
		const next = taskItemsById.get(item.detectionItemId);
		if (!next) return item;
		return {
			...item,
			thumbnailUrl: next.thumbnail_url,
			confidence: next.confidence,
			assetGenerationStatus: next.asset_generation_status,
			asset3dUrl: next.asset_3d_url,
		};
	});
	const deletedItemIds = new Set(prev.deletedDetectionItemIds ?? []);
	for (const item of activeTaskItems) {
		if (prevItemIds.has(item.detection_item_id)) continue;
		if (deletedItemIds.has(item.detection_item_id)) continue;
		refreshedItems.push({
			detectionItemId: item.detection_item_id,
			name: `상품 ${item.detection_item_id}`,
			thumbnailUrl: item.thumbnail_url,
			relativePosition: item.relative_position,
			relativeSize: item.relative_size,
			confidence: item.confidence,
			assetGenerationStatus: item.asset_generation_status,
			asset3dUrl: item.asset_3d_url,
		});
	}
	return {
		...prev,
		taskId: task.detection_task_id,
		taskStatus: task.status,
		taskUpdatedAt: task.updated_at,
		errorMessage: task.error_message,
		deletedDetectionItemIds: prev.deletedDetectionItemIds ?? [],
		items: refreshedItems,
	};
}

function hasDetectionPreviewChanged(
	prev: FixtureDetectionPreview,
	next: FixtureDetectionPreview,
) {
	if (prev.taskStatus !== next.taskStatus) return true;
	if (prev.taskUpdatedAt !== next.taskUpdatedAt) return true;
	if (prev.errorMessage !== next.errorMessage) return true;
	if (prev.items.length !== next.items.length) return true;
	return prev.items.some((item, index) => {
		const nextItem = next.items[index];
		return (
			item.detectionItemId !== nextItem.detectionItemId ||
			item.thumbnailUrl !== nextItem.thumbnailUrl ||
			item.assetGenerationStatus !== nextItem.assetGenerationStatus ||
			item.asset3dUrl !== nextItem.asset3dUrl
		);
	});
}

type GroupDragItem = {
	index: number;
	x: number;
	y: number;
	width: number;
	height: number;
	polygon: [number, number][] | null;
};

type Interaction =
	| {
			kind: "drag";
			index: number;
			startX: number;
			startY: number;
			originX: number;
			originY: number;
			originPolygon: [number, number][] | null;
	  }
	| {
			kind: "resize";
			index: number;
			edge: ResizeEdge;
			startX: number;
			startY: number;
			originX: number;
			originY: number;
			originWidth: number;
			originHeight: number;
			originPolygon: [number, number][] | null;
	  }
	| {
			kind: "rotate";
			index: number;
			centerX: number;
			centerY: number;
			canvasLeft: number;
			canvasTop: number;
			originRotation: number;
			startAngle: number;
	  }
	| {
			kind: "product-drag";
			index: number;
			detectionItemId: number;
			mode: "move" | "resize";
			startX: number;
			startY: number;
			originRelativeX: number;
			originRelativeY: number;
			originRelativeWidth: number;
			originRelativeHeight: number;
	  };

interface Canvas2DState {
	interaction: Interaction | null;
	hoverEdge: ResizeEdge | null;
}

type Canvas2DAction =
	| {
			type: "START_DRAG";
			payload: Omit<Extract<Interaction, { kind: "drag" }>, "kind">;
	  }
	| {
			type: "START_RESIZE";
			payload: Omit<Extract<Interaction, { kind: "resize" }>, "kind">;
	  }
	| {
			type: "START_ROTATE";
			payload: Omit<Extract<Interaction, { kind: "rotate" }>, "kind">;
	  }
	| {
			type: "START_PRODUCT_DRAG";
			payload: Omit<Extract<Interaction, { kind: "product-drag" }>, "kind">;
	  }
	| { type: "END_INTERACTION" }
	| { type: "SET_HOVER_EDGE"; edge: ResizeEdge | null };

function reducer(state: Canvas2DState, action: Canvas2DAction): Canvas2DState {
	switch (action.type) {
		case "START_DRAG":
			return {
				...state,
				interaction: { kind: "drag", ...action.payload },
				hoverEdge: null,
			};
		case "START_RESIZE":
			return {
				...state,
				interaction: { kind: "resize", ...action.payload },
				hoverEdge: action.payload.edge,
			};
		case "START_ROTATE":
			return {
				...state,
				interaction: { kind: "rotate", ...action.payload },
				hoverEdge: null,
			};
		case "START_PRODUCT_DRAG":
			return {
				...state,
				interaction: { kind: "product-drag", ...action.payload },
				hoverEdge: null,
			};
		case "END_INTERACTION":
			return { ...state, interaction: null };
		case "SET_HOVER_EDGE":
			return { ...state, hoverEdge: action.edge };
	}
}

function translatePolygon(
	points: [number, number][],
	dx: number,
	dy: number,
): [number, number][] {
	return points.map(([x, y]) => [x + dx, y + dy]);
}

function scalePolygon2D(
	points: [number, number][],
	origin: { x: number; y: number; width: number; height: number },
	next: { x: number; y: number; width: number; height: number },
): [number, number][] {
	const sx = origin.width > 0 ? next.width / origin.width : 1;
	const sy = origin.height > 0 ? next.height / origin.height : 1;
	return points.map(([px, py]) => [
		Math.round(next.x + (px - origin.x) * sx),
		Math.round(next.y + (py - origin.y) * sy),
	]);
}

function polygonClipPath(fixture: Fixture): string {
	if (
		!fixture.polygon ||
		fixture.polygon.length < 3 ||
		fixture.width <= 0 ||
		fixture.height <= 0
	) {
		return "";
	}
	return fixture.polygon
		.map(([px, py]) => {
			const nx = ((px - fixture.x) / fixture.width) * 100;
			const ny = ((py - fixture.y) / fixture.height) * 100;
			return `${nx}% ${ny}%`;
		})
		.join(", ");
}

function detectEdge(
	fixture: Fixture,
	point: { x: number; y: number },
	scale: number,
	locked: ResizeEdge | null,
): ResizeEdge | null {
	const threshold = Math.max(EDGE_HIT_ENTER_PX / scale, 8);
	const exitThreshold = Math.max(EDGE_HIT_EXIT_PX / scale, threshold);
	const active = locked ? exitThreshold : threshold;

	const left = fixture.x;
	const right = fixture.x + fixture.width;
	const top = fixture.y;
	const bottom = fixture.y + fixture.height;

	const inside =
		point.x >= left - active &&
		point.x <= right + active &&
		point.y >= top - active &&
		point.y <= bottom + active;
	if (!inside) return null;

	const nearLeft = Math.abs(point.x - left) <= active;
	const nearRight = Math.abs(point.x - right) <= active;
	const nearTop = Math.abs(point.y - top) <= active;
	const nearBottom = Math.abs(point.y - bottom) <= active;

	const corners: { edge: ResizeEdge; dist: number; active: boolean }[] = [
		{
			edge: "top-left",
			dist: Math.hypot(point.x - left, point.y - top),
			active: nearTop && nearLeft,
		},
		{
			edge: "top-right",
			dist: Math.hypot(point.x - right, point.y - top),
			active: nearTop && nearRight,
		},
		{
			edge: "bottom-right",
			dist: Math.hypot(point.x - right, point.y - bottom),
			active: nearBottom && nearRight,
		},
		{
			edge: "bottom-left",
			dist: Math.hypot(point.x - left, point.y - bottom),
			active: nearBottom && nearLeft,
		},
	];
	const corner = corners
		.filter((c) => c.active)
		.sort((a, b) => a.dist - b.dist)[0];
	if (corner) return corner.edge;

	const edges: { edge: ResizeEdge; dist: number; active: boolean }[] = [
		{ edge: "left", dist: Math.abs(point.x - left), active: nearLeft },
		{ edge: "right", dist: Math.abs(point.x - right), active: nearRight },
		{ edge: "top", dist: Math.abs(point.y - top), active: nearTop },
		{ edge: "bottom", dist: Math.abs(point.y - bottom), active: nearBottom },
	];

	if (locked) {
		const found = edges.find((e) => e.edge === locked && e.active);
		if (found) return locked;
	}

	return (
		edges.filter((e) => e.active).sort((a, b) => a.dist - b.dist)[0]?.edge ??
		null
	);
}

function getCursor(edge: ResizeEdge | null): string {
	switch (edge) {
		case "left":
		case "right":
			return "ew-resize";
		case "top":
		case "bottom":
			return "ns-resize";
		case "top-left":
		case "bottom-right":
			return "nwse-resize";
		case "top-right":
		case "bottom-left":
			return "nesw-resize";
		default:
			return "grab";
	}
}

function pointInFixture(
	point: { x: number; y: number },
	fixture: Fixture,
): boolean {
	if (
		point.x < fixture.x ||
		point.x > fixture.x + fixture.width ||
		point.y < fixture.y ||
		point.y > fixture.y + fixture.height
	) {
		return false;
	}
	if (
		fixture.shape !== "polygon" ||
		!fixture.polygon ||
		fixture.polygon.length < 3
	) {
		return true;
	}
	let inside = false;
	const poly = fixture.polygon;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i++) {
		const [xi, yi] = poly[i];
		const [xj, yj] = poly[j];
		const intersects =
			yi > point.y !== yj > point.y &&
			point.x < ((xj - xi) * (point.y - yi)) / (yj - yi || 1) + xi;
		if (intersects) inside = !inside;
	}
	return inside;
}

function findResizeFixtureIndexAtPoint(
	point: { x: number; y: number },
	fixtures: Fixture[],
	scale: number,
	selectedIndex: number | null,
	locked: ResizeEdge | null,
): number | null {
	if (selectedIndex === null) return null;
	const fixture = fixtures[selectedIndex];
	if (!fixture) return null;
	const edge = detectEdge(fixture, point, scale, locked);
	return edge ? selectedIndex : null;
}

function findFixtureIndexAtPoint(
	point: { x: number; y: number },
	fixtures: Fixture[],
): number | null {
	const containerFlags = fixtures.map((fixture, index) =>
		isContainerFixture(fixture, fixtures, index),
	);

	const hits = fixtures
		.map((fixture, index) => ({
			index,
			fixture,
			isContainer: containerFlags[index],
			area: Math.max(1, fixture.width * fixture.height),
		}))
		.filter(({ fixture }) => pointInFixture(point, fixture));

	if (hits.length === 0) {
		return null;
	}

	hits.sort((a, b) => {
		if (a.isContainer !== b.isContainer) {
			return a.isContainer ? 1 : -1;
		}
		return b.index - a.index;
	});

	return hits[0]?.index ?? null;
}

interface FixtureTheme {
	border: string;
	fill: string;
	fillSelected: string;
	sheen: string;
	shadow: string;
	label: string;
}

const PRODUCT_ASSET_TYPES_2D = new Set<string>(["shoes_test", "fixtures_test"]);

function getFixtureTheme(fixture: Fixture): FixtureTheme {
	// Product (상품) — amber/warm tone to distinguish from fixtures.
	if (PRODUCT_ASSET_TYPES_2D.has(fixture.assetType ?? "")) {
		return {
			border: "#b45309",
			fill: "rgba(253, 230, 138, 0.70)",
			fillSelected: "rgba(251, 191, 36, 0.85)",
			sheen:
				"linear-gradient(145deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.55) 20%, rgba(255,255,255,0) 21%, rgba(255,255,255,0) 100%)",
			shadow: "rgba(180, 83, 9, 0.20)",
			label: "#92400e",
		};
	}
	switch (fixture.type) {
		case "bathtub":
			return {
				border: "#557974",
				fill: "rgba(210, 224, 220, 0.72)",
				fillSelected: "rgba(187, 209, 204, 0.92)",
				sheen:
					"linear-gradient(140deg, rgba(255,255,255,0.58) 0%, rgba(255,255,255,0.58) 18%, rgba(255,255,255,0) 19%, rgba(255,255,255,0) 100%)",
				shadow: "rgba(74, 109, 103, 0.18)",
				label: "#355650",
			};
		case "sink":
			return {
				border: "#6f837a",
				fill: "rgba(220, 229, 214, 0.72)",
				fillSelected: "rgba(204, 219, 198, 0.94)",
				sheen:
					"linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.6) 22%, rgba(255,255,255,0) 23%, rgba(255,255,255,0) 100%)",
				shadow: "rgba(98, 121, 106, 0.18)",
				label: "#42564d",
			};
		case "toilet":
			return {
				border: "#6d7f86",
				fill: "rgba(214, 224, 230, 0.72)",
				fillSelected: "rgba(197, 212, 220, 0.94)",
				sheen:
					"linear-gradient(145deg, rgba(255,255,255,0.58) 0%, rgba(255,255,255,0.58) 20%, rgba(255,255,255,0) 21%, rgba(255,255,255,0) 100%)",
				shadow: "rgba(88, 108, 116, 0.18)",
				label: "#42545b",
			};
		case "display":
			return {
				border: "#786f5c",
				fill: "rgba(229, 222, 206, 0.74)",
				fillSelected: "rgba(219, 209, 186, 0.94)",
				sheen:
					"linear-gradient(145deg, rgba(255,255,255,0.54) 0%, rgba(255,255,255,0.54) 22%, rgba(255,255,255,0) 23%, rgba(255,255,255,0) 100%)",
				shadow: "rgba(120, 108, 82, 0.16)",
				label: "#5e5647",
			};
		default:
			return {
				border: "#62857e",
				fill: "rgba(219, 229, 226, 0.72)",
				fillSelected: "rgba(200, 217, 212, 0.94)",
				sheen:
					"linear-gradient(145deg, rgba(255,255,255,0.58) 0%, rgba(255,255,255,0.58) 21%, rgba(255,255,255,0) 22%, rgba(255,255,255,0) 100%)",
				shadow: "rgba(90, 120, 113, 0.18)",
				label: "#3c5a54",
			};
	}
}

export function Canvas2D() {
	const {
		layout,
		selectedIndex,
		updateFixture,
		updateFixturesBatch,
		setSelectedFixture,
		selectedDetectionItemId,
		setSelectedDetectionItem,
		pendingBinding,
		applyBindingToFixture,
		zoneDraftCategory,
		addZone,
		cancelZoneDraft,
		updateZone,
		cameraDraftPhotoId,
		cancelCameraDraft,
		selectedIndices,
		setSelectedIndicesBatch,
		clearSelection,
		toggleFixtureSelection,
	} = useLayout();
	// Camera placement: 2 clicks (1=position, 2=direction). First captured here.
	const [cameraStep1, setCameraStep1] = useState<{
		x: number;
		y: number;
	} | null>(null);

	// Marquee (rubber-band) selection state.
	const interactionModeRef = useRef<"pan" | "marquee">("marquee");
	const thumbnailRefreshInFlightRef = useRef(new Set<number>());
	const lastThumbnailRefreshKeyRef = useRef("");
	const [marquee, setMarquee] = useState<{
		startX: number;
		startY: number;
		curX: number;
		curY: number;
		additive: boolean;
	} | null>(null);
	useEffect(() => {
		const onMode = (event: Event) => {
			const detail = (event as CustomEvent<{ mode: "pan" | "marquee" }>).detail;
			if (detail?.mode === "pan" || detail?.mode === "marquee") {
				interactionModeRef.current = detail.mode;
			}
		};
		window.addEventListener("canvas2d-interaction-mode", onMode);
		return () =>
			window.removeEventListener("canvas2d-interaction-mode", onMode);
	}, []);
	const containerRef = useRef<HTMLDivElement>(null);
	const scaleRef = useRef(1);
	const lastAutoFitKeyRef = useRef<string | null>(null);
	const [canvasScale, setCanvasScale] = useState(1);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const panRef = useRef(pan);
	const isPanningRef = useRef(false);
	const panStartRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });
	const gestureZoomStartScaleRef = useRef(1);
	const gestureZoomAnchorRef = useRef<{
		world: { x: number; y: number };
		client: { clientX: number; clientY: number };
	} | null>(null);
	const isGestureZoomingRef = useRef(false);
	const spaceDownRef = useRef(false);
	const touchPointsRef = useRef(
		new Map<number, { clientX: number; clientY: number }>(),
	);
	const touchGestureRef = useRef<
		| {
				kind: "pan";
				pointerId: number;
				lastClientX: number;
				lastClientY: number;
		  }
		| {
				kind: "pinch";
				pointerIds: [number, number];
				startDistance: number;
				startScale: number;
				anchorWorld: { x: number; y: number } | null;
		  }
		| null
	>(null);
	const workspaceGestureRef = useRef<
		| {
				kind: "tap";
				pointerId: number;
				x: number;
				y: number;
		  }
		| {
				kind: "pan";
				pointerId: number;
				lastClientX: number;
				lastClientY: number;
		  }
		| null
	>(null);
	const [state, dispatch] = useReducer(reducer, {
		interaction: null,
		hoverEdge: null,
	});

	// Zone drag state — local to the canvas component.
	const [zoneDrag, setZoneDrag] = useState<{
		startX: number;
		startY: number;
		curX: number;
		curY: number;
	} | null>(null);

	// Selected zone (for resize/move) — separate from fixture selection.
	const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
	const [zoneEdit, setZoneEdit] = useState<{
		zoneId: string;
		kind: "move" | "resize";
		edge?: ResizeEdge;
		startMouseX: number;
		startMouseY: number;
		originX: number;
		originY: number;
		originW: number;
		originH: number;
	} | null>(null);

	// Esc clears local Canvas2D drafts (zone/camera step1) — global key
	// handlers (select-all, undo/redo, draft cancellation) live in edit.tsx
	// so they also work while the 3D mode is mounted.
	useEffect(() => {
		if (!zoneDraftCategory && !cameraDraftPhotoId) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setZoneDrag(null);
				setCameraStep1(null);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [zoneDraftCategory, cameraDraftPhotoId]);

	// Track mutable interaction state for pointer move handler without re-renders
	const interactionRef = useRef<Interaction | null>(null);
	useEffect(() => {
		interactionRef.current = state.interaction;
	});

	useEffect(() => {
		panRef.current = pan;
	}, [pan]);

	// Track fixtures mutably during drag (avoids React state update on every mousemove)
	const liveFixturesRef = useRef<Fixture[] | null>(null);
	const canvasRef = useRef<HTMLDivElement>(null);
	// Cached reference to the element being dragged/resized/rotated — avoids querySelector on every pointermove.
	const draggingElRef = useRef<HTMLElement | null>(null);
	const groupDragRef = useRef<GroupDragItem[] | null>(null);
	const groupDraggingElsRef = useRef<Map<number, HTMLElement>>(new Map());
	// Pending requestAnimationFrame id — batches DOM style writes to the next paint frame.
	const rafRef = useRef(0);

	// After every React render, if an interaction is in progress, reapply live fixture
	// positions so a mid-drag re-render (e.g., from LayoutContext update) doesn't
	// snap the element back to its pre-drag coordinates.
	useLayoutEffect(() => {
		const interaction = interactionRef.current;
		const live = liveFixturesRef.current;
		if (!interaction || !live) return;
		const el = draggingElRef.current;
		if (!el) return;
		const f = live[interaction.index];
		if (!f) return;
		const s = scaleRef.current;
		el.style.transform = `translate(${f.x * s}px, ${f.y * s}px) rotate(${f.rotation ?? 0}deg)`;
		el.style.width = `${f.width * s}px`;
		el.style.height = `${f.height * s}px`;
	});

	const refreshDetectionTaskThumbnails = useCallback(
		async (taskId: number) => {
			if (!layout || thumbnailRefreshInFlightRef.current.has(taskId)) return;
			thumbnailRefreshInFlightRef.current.add(taskId);
			try {
				const task = await ENV_PRODUCT_DETECTION_ADAPTER.getTask(taskId);
				const updates = layout.fixtures.flatMap((fixture, index) => {
					const preview = fixture.detectionPreview;
					if (!preview || preview.taskId !== taskId) return [];
					const nextPreview = refreshDetectionPreviewUrls(preview, task);
					if (!hasDetectionPreviewChanged(preview, nextPreview)) return [];
					return [{ index, patch: { detectionPreview: nextPreview } }];
				});
				if (updates.length > 0) updateFixturesBatch(updates);
			} catch (error) {
				console.warn("[layout-editor] 상품 썸네일 URL 갱신 실패", error);
			} finally {
				thumbnailRefreshInFlightRef.current.delete(taskId);
			}
		},
		[layout, updateFixturesBatch],
	);

	useEffect(() => {
		if (!layout) return;
		const taskIds = Array.from(
			new Set(
				layout.fixtures
					.map((fixture) => fixture.detectionPreview?.taskId ?? null)
					.filter((taskId): taskId is number => taskId !== null),
			),
		);
		if (taskIds.length === 0) return;
		const refreshKey = taskIds.sort((a, b) => a - b).join(",");
		if (lastThumbnailRefreshKeyRef.current !== refreshKey) {
			lastThumbnailRefreshKeyRef.current = refreshKey;
			for (const taskId of taskIds) void refreshDetectionTaskThumbnails(taskId);
		}
		const intervalId = window.setInterval(
			() => {
				for (const taskId of taskIds)
					void refreshDetectionTaskThumbnails(taskId);
			},
			50 * 60 * 1000,
		);
		return () => window.clearInterval(intervalId);
	}, [layout, refreshDetectionTaskThumbnails]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const observer = new ResizeObserver(([entry]) => {
			if (!layout) return;
			const autoFitKey = `${layout.floorWidth}x${layout.floorHeight}:${layout.floorImageUrl ?? ""}`;
			if (lastAutoFitKeyRef.current === autoFitKey) return;
			lastAutoFitKeyRef.current = autoFitKey;
			const { width, height } = entry.contentRect;
			const availableWidth = Math.max(width - 32, 1);
			const availableHeight = Math.max(height - 32, 1);
			const s = Math.min(
				availableWidth / layout.floorWidth,
				availableHeight / layout.floorHeight,
			);
			scaleRef.current = s;
			setCanvasScale(s);
			panRef.current = { x: 0, y: 0 };
			setPan({ x: 0, y: 0 });
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, [layout]);

	const zoomCanvasAroundWorldPoint = useCallback(
		(
			nextScale: number,
			worldPoint: { x: number; y: number },
			clientX: number,
			clientY: number,
		) => {
			if (!layout) {
				scaleRef.current = nextScale;
				setCanvasScale(nextScale);
				return;
			}

			const canvasRect = canvasRef.current?.getBoundingClientRect();
			const containerRect = containerRef.current?.getBoundingClientRect();
			const nextWidth = layout.floorWidth * nextScale;
			const nextHeight = layout.floorHeight * nextScale;
			const nextBaseLeft = containerRect
				? containerRect.left + (containerRect.width - nextWidth) / 2
				: (canvasRect?.left ?? 0);
			const nextBaseTop = containerRect
				? containerRect.top + (containerRect.height - nextHeight) / 2
				: (canvasRect?.top ?? 0);
			const nextPan = {
				x: clientX - nextBaseLeft - worldPoint.x * nextScale,
				y: clientY - nextBaseTop - worldPoint.y * nextScale,
			};

			scaleRef.current = nextScale;
			setCanvasScale(nextScale);
			panRef.current = nextPan;
			setPan(nextPan);
		},
		[layout],
	);

	const zoomCanvasAroundClientPoint = useCallback(
		(nextScale: number, clientX: number, clientY: number) => {
			const canvas = canvasRef.current;
			if (!canvas) {
				scaleRef.current = nextScale;
				setCanvasScale(nextScale);
				return;
			}

			const currentScale = scaleRef.current;
			const rect = canvas.getBoundingClientRect();
			zoomCanvasAroundWorldPoint(
				nextScale,
				{
					x: (clientX - rect.left) / currentScale,
					y: (clientY - rect.top) / currentScale,
				},
				clientX,
				clientY,
			);
		},
		[zoomCanvasAroundWorldPoint],
	);

	const startPanAt = useCallback(
		(clientX: number, clientY: number, pointerId?: number) => {
			const container = containerRef.current;
			if (!container) return;
			isPanningRef.current = true;
			panStartRef.current = {
				mouseX: clientX,
				mouseY: clientY,
				panX: panRef.current.x,
				panY: panRef.current.y,
			};
			container.style.cursor = "grabbing";
			if (pointerId !== undefined) {
				try {
					container.setPointerCapture?.(pointerId);
				} catch {
					// Some browsers reject capture if the pointer originated on a child.
				}
			}
		},
		[],
	);

	// Figma-like trackpad navigation:
	// - two-finger scroll pans the canvas freely
	// - trackpad pinch (browser sends ctrlKey wheel) zooms around the pointer
	// layout is in deps so this re-runs after the containerRef div mounts (layout null → early return).
	// biome-ignore lint/correctness/useExhaustiveDependencies: layout triggers re-run when containerRef mounts
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const getGesturePoint = (event: Event) => {
			const source = event as Event & {
				clientX?: number;
				clientY?: number;
				pageX?: number;
				pageY?: number;
			};
			const rect = container.getBoundingClientRect();
			const hasClientPoint =
				Number.isFinite(source.clientX) &&
				Number.isFinite(source.clientY) &&
				!(source.clientX === 0 && source.clientY === 0);
			const hasPagePoint =
				Number.isFinite(source.pageX) &&
				Number.isFinite(source.pageY) &&
				!(source.pageX === 0 && source.pageY === 0);
			if (hasClientPoint) {
				return {
					clientX: source.clientX as number,
					clientY: source.clientY as number,
					isFallback: false,
				};
			}
			if (hasPagePoint) {
				return {
					clientX: (source.pageX as number) - window.scrollX,
					clientY: (source.pageY as number) - window.scrollY,
					isFallback: false,
				};
			}
			return {
				clientX: rect.left + rect.width / 2,
				clientY: rect.top + rect.height / 2,
				isFallback: true,
			};
		};
		const isPointInsideCanvas = (clientX: number, clientY: number) => {
			const rect = container.getBoundingClientRect();
			return (
				clientX >= rect.left &&
				clientX <= rect.right &&
				clientY >= rect.top &&
				clientY <= rect.bottom
			);
		};
		const isEventInsideCanvas = (event: Event) => {
			const point = getGesturePoint(event);
			if (isPointInsideCanvas(point.clientX, point.clientY)) return true;
			const target = event.target;
			if (target instanceof Node && container.contains(target)) return true;
			return event.type.startsWith("gesture");
		};
		const zoomByFactor = (factor: number, clientX: number, clientY: number) => {
			const MIN = 0.1;
			const MAX = 5;
			const next = Math.min(MAX, Math.max(MIN, scaleRef.current * factor));
			if (Math.abs(next - scaleRef.current) < 0.0001) return;
			zoomCanvasAroundClientPoint(next, clientX, clientY);
		};
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();

			if (isGestureZoomingRef.current) return;

			const isPinchWheel = e.ctrlKey || e.metaKey || e.deltaZ !== 0;
			if (isPinchWheel) {
				const delta = e.deltaZ !== 0 ? e.deltaZ : e.deltaY;
				const point = getGesturePoint(e);
				zoomByFactor(Math.exp(-delta * 0.004), point.clientX, point.clientY);
				return;
			}

			const nextPan = {
				x: panRef.current.x - e.deltaX,
				y: panRef.current.y - e.deltaY,
			};
			panRef.current = nextPan;
			setPan(nextPan);
		};
		const onGestureStart = (e: Event) => {
			if (!isEventInsideCanvas(e)) return;
			e.preventDefault();
			const point = getGesturePoint(e);
			const rect = canvasRef.current?.getBoundingClientRect();
			isGestureZoomingRef.current = true;
			gestureZoomStartScaleRef.current = scaleRef.current;
			gestureZoomAnchorRef.current = rect
				? {
						world: {
							x: (point.clientX - rect.left) / scaleRef.current,
							y: (point.clientY - rect.top) / scaleRef.current,
						},
						client: { clientX: point.clientX, clientY: point.clientY },
					}
				: null;
		};
		const onGestureChange = (e: Event) => {
			if (!isGestureZoomingRef.current) return;
			e.preventDefault();
			const gesture = e as Event & { scale?: number };
			const gestureScale = gesture.scale ?? 1;
			const targetScale = gestureZoomStartScaleRef.current * gestureScale;
			const point = getGesturePoint(e);
			const anchor = gestureZoomAnchorRef.current;
			if (anchor) {
				const clientPoint = point.isFallback ? anchor.client : point;
				zoomCanvasAroundWorldPoint(
					targetScale,
					anchor.world,
					clientPoint.clientX,
					clientPoint.clientY,
				);
				return;
			}
			const factor = targetScale / scaleRef.current;
			zoomByFactor(factor, point.clientX, point.clientY);
		};
		const onGestureEnd = (e: Event) => {
			if (!isGestureZoomingRef.current) return;
			e.preventDefault();
			window.setTimeout(() => {
				isGestureZoomingRef.current = false;
				gestureZoomAnchorRef.current = null;
			}, 0);
		};
		const gestureTargets: EventTarget[] = [container, document, window];
		const gestureOptions = {
			passive: false,
			capture: true,
		} as AddEventListenerOptions;
		container.addEventListener("wheel", onWheel, { passive: false });
		for (const target of gestureTargets) {
			target.addEventListener("gesturestart", onGestureStart, gestureOptions);
			target.addEventListener("gesturechange", onGestureChange, gestureOptions);
			target.addEventListener("gestureend", onGestureEnd, gestureOptions);
		}
		return () => {
			container.removeEventListener("wheel", onWheel);
			for (const target of gestureTargets) {
				target.removeEventListener("gesturestart", onGestureStart, {
					capture: true,
				} as EventListenerOptions);
				target.removeEventListener("gesturechange", onGestureChange, {
					capture: true,
				} as EventListenerOptions);
				target.removeEventListener("gestureend", onGestureEnd, {
					capture: true,
				} as EventListenerOptions);
			}
		};
	}, [layout, zoomCanvasAroundClientPoint, zoomCanvasAroundWorldPoint]);

	// Pan: middle-mouse drag OR Space + left-drag anywhere on the container.
	// biome-ignore lint/correctness/useExhaustiveDependencies: layout triggers re-run when containerRef mounts
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.code === "Space" && !spaceDownRef.current) {
				const t = e.target as HTMLElement | null;
				if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA") return;
				e.preventDefault();
				spaceDownRef.current = true;
				container.style.cursor = "grab";
			}
		};
		const onKeyUp = (e: KeyboardEvent) => {
			if (e.code === "Space") {
				spaceDownRef.current = false;
				if (!isPanningRef.current) container.style.cursor = "";
			}
		};

		const onPointerDown = (e: PointerEvent) => {
			const isMiddle = e.button === 1;
			const isSpaceLeft = spaceDownRef.current && e.button === 0;
			const isTabletWorkspacePan =
				e.pointerType === "touch" && e.button === 0 && e.target === container;
			if (!isMiddle && !isSpaceLeft && !isTabletWorkspacePan) return;
			e.preventDefault();
			startPanAt(e.clientX, e.clientY, e.pointerId);
		};
		const onPointerMove = (e: PointerEvent) => {
			if (!isPanningRef.current) return;
			const dx = e.clientX - panStartRef.current.mouseX;
			const dy = e.clientY - panStartRef.current.mouseY;
			const nextPan = {
				x: panStartRef.current.panX + dx,
				y: panStartRef.current.panY + dy,
			};
			panRef.current = nextPan;
			setPan(nextPan);
		};
		const onPointerUp = (e: PointerEvent) => {
			if (!isPanningRef.current) return;
			try {
				if (container.hasPointerCapture?.(e.pointerId)) {
					container.releasePointerCapture(e.pointerId);
				}
			} catch {
				// Pointer may already be gone.
			}
			isPanningRef.current = false;
			container.style.cursor = spaceDownRef.current ? "grab" : "";
		};

		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		container.addEventListener("pointerdown", onPointerDown);
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			container.removeEventListener("pointerdown", onPointerDown);
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
		};
	}, [layout, startPanAt]);

	const getPoint = useCallback(
		(e: React.PointerEvent): { x: number; y: number } => {
			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return { x: 0, y: 0 };
			return {
				x: Math.round((e.clientX - rect.left) / scaleRef.current),
				y: Math.round((e.clientY - rect.top) / scaleRef.current),
			};
		},
		[],
	);

	const getTouchDistance = useCallback(
		(points: { clientX: number; clientY: number }[]) =>
			Math.hypot(
				points[0].clientX - points[1].clientX,
				points[0].clientY - points[1].clientY,
			),
		[],
	);

	const getTouchCenter = useCallback(
		(points: { clientX: number; clientY: number }[]) => ({
			clientX: (points[0].clientX + points[1].clientX) / 2,
			clientY: (points[0].clientY + points[1].clientY) / 2,
		}),
		[],
	);

	const beginTouchPinch = useCallback(() => {
		const entries = Array.from(touchPointsRef.current.entries());
		if (entries.length < 2) return false;
		const points = entries.slice(0, 2).map(([, point]) => point);
		const center = getTouchCenter(points);
		const rect = canvasRef.current?.getBoundingClientRect();
		touchGestureRef.current = {
			kind: "pinch",
			pointerIds: [entries[0][0], entries[1][0]],
			startDistance: Math.max(getTouchDistance(points), 1),
			startScale: scaleRef.current,
			anchorWorld: rect
				? {
						x: (center.clientX - rect.left) / scaleRef.current,
						y: (center.clientY - rect.top) / scaleRef.current,
					}
				: null,
		};
		return true;
	}, [getTouchCenter, getTouchDistance]);

	const updateTouchPinch = useCallback(() => {
		const gesture = touchGestureRef.current;
		if (gesture?.kind !== "pinch") return;
		const points = gesture.pointerIds
			.map((pointerId) => touchPointsRef.current.get(pointerId))
			.filter((point): point is { clientX: number; clientY: number } =>
				Boolean(point),
			);
		if (points.length !== 2) return;
		const nextScale = Math.min(
			5,
			Math.max(
				0.1,
				gesture.startScale *
					(getTouchDistance(points) / Math.max(gesture.startDistance, 1)),
			),
		);
		const center = getTouchCenter(points);

		// Keep the world point that was between the user's fingers at pinch-start
		// under the current finger center, matching Figma's tablet pinch zoom.
		if (gesture.anchorWorld) {
			zoomCanvasAroundWorldPoint(
				nextScale,
				gesture.anchorWorld,
				center.clientX,
				center.clientY,
			);
			return;
		}

		zoomCanvasAroundClientPoint(nextScale, center.clientX, center.clientY);
	}, [
		getTouchCenter,
		getTouchDistance,
		zoomCanvasAroundClientPoint,
		zoomCanvasAroundWorldPoint,
	]);

	const beginWorkspacePan = useCallback((e: React.PointerEvent) => {
		e.preventDefault();
		e.currentTarget.setPointerCapture(e.pointerId);
		workspaceGestureRef.current = {
			kind: "pan",
			pointerId: e.pointerId,
			lastClientX: e.clientX,
			lastClientY: e.clientY,
		};
	}, []);

	const onWorkspacePointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!layout || e.target !== e.currentTarget) return;
			if (interactionModeRef.current === "pan") {
				beginWorkspacePan(e);
				return;
			}
			workspaceGestureRef.current = {
				kind: "tap",
				pointerId: e.pointerId,
				x: e.clientX,
				y: e.clientY,
			};
			e.preventDefault();
			e.currentTarget.setPointerCapture(e.pointerId);
			if (selectedZoneId) setSelectedZoneId(null);
			clearSelection();
		},
		[beginWorkspacePan, clearSelection, layout, selectedZoneId],
	);

	const onPointerDown = useCallback(
		(e: React.PointerEvent) => {
			if (!layout) return;
			// Block native HTML5 drag (otherwise the browser fires pointercancel
			// as soon as the user starts moving, leaving a not-allowed cursor).
			e.preventDefault();
			if (e.pointerType === "touch") {
				touchPointsRef.current.set(e.pointerId, {
					clientX: e.clientX,
					clientY: e.clientY,
				});
				if (touchPointsRef.current.size >= 2) {
					e.currentTarget.setPointerCapture(e.pointerId);
					if (rafRef.current) {
						cancelAnimationFrame(rafRef.current);
						rafRef.current = 0;
					}
					draggingElRef.current = null;
					groupDragRef.current = null;
					groupDraggingElsRef.current.clear();
					liveFixturesRef.current = null;
					dispatch({ type: "END_INTERACTION" });
					if (beginTouchPinch()) {
						updateTouchPinch();
						return;
					}
				}
			}

			// Zone drawing mode takes priority — drag creates a zone rectangle.
			if (zoneDraftCategory) {
				e.currentTarget.setPointerCapture(e.pointerId);
				const p = getPoint(e);
				setZoneDrag({ startX: p.x, startY: p.y, curX: p.x, curY: p.y });
				return;
			}

			// Camera placement: 1st click = position, 2nd click = direction target.
			if (cameraDraftPhotoId) {
				const p = getPoint(e);
				if (!cameraStep1) {
					setCameraStep1({ x: p.x, y: p.y });
				} else {
					const dx = p.x - cameraStep1.x;
					const dy = p.y - cameraStep1.y;
					const theta = Math.atan2(dy, dx);
					window.dispatchEvent(
						new CustomEvent("camera-draft-complete", {
							detail: {
								photoId: cameraDraftPhotoId,
								x: cameraStep1.x,
								y: cameraStep1.y,
								theta,
								fovDeg: 70,
							},
						}),
					);
					setCameraStep1(null);
					cancelCameraDraft();
				}
				return;
			}

			// Zone selection / resize / move (only if no fixture under cursor).
			const zonePt = getPoint(e);
			const fixtureHere = findFixtureIndexAtPoint(zonePt, layout.fixtures);
			if (fixtureHere === null) {
				const zones = layout.zones ?? [];
				const HANDLE = 14 / scaleRef.current; // px world units
				// Test edges first (resize hit), then body (move).
				for (let i = zones.length - 1; i >= 0; i--) {
					const z = zones[i];
					const onLeft =
						Math.abs(zonePt.x - z.x) <= HANDLE &&
						zonePt.y >= z.y - HANDLE &&
						zonePt.y <= z.y + z.height + HANDLE;
					const onRight =
						Math.abs(zonePt.x - (z.x + z.width)) <= HANDLE &&
						zonePt.y >= z.y - HANDLE &&
						zonePt.y <= z.y + z.height + HANDLE;
					const onTop =
						Math.abs(zonePt.y - z.y) <= HANDLE &&
						zonePt.x >= z.x - HANDLE &&
						zonePt.x <= z.x + z.width + HANDLE;
					const onBottom =
						Math.abs(zonePt.y - (z.y + z.height)) <= HANDLE &&
						zonePt.x >= z.x - HANDLE &&
						zonePt.x <= z.x + z.width + HANDLE;
					let edge: ResizeEdge | null = null;
					if (onLeft && onTop) edge = "top-left";
					else if (onRight && onTop) edge = "top-right";
					else if (onLeft && onBottom) edge = "bottom-left";
					else if (onRight && onBottom) edge = "bottom-right";
					else if (onLeft) edge = "left";
					else if (onRight) edge = "right";
					else if (onTop) edge = "top";
					else if (onBottom) edge = "bottom";
					if (edge) {
						e.currentTarget.setPointerCapture(e.pointerId);
						setSelectedZoneId(z.id);
						setZoneEdit({
							zoneId: z.id,
							kind: "resize",
							edge,
							startMouseX: e.clientX,
							startMouseY: e.clientY,
							originX: z.x,
							originY: z.y,
							originW: z.width,
							originH: z.height,
						});
						return;
					}
					const inside =
						zonePt.x >= z.x &&
						zonePt.x <= z.x + z.width &&
						zonePt.y >= z.y &&
						zonePt.y <= z.y + z.height;
					if (inside) {
						e.currentTarget.setPointerCapture(e.pointerId);
						setSelectedZoneId(z.id);
						setZoneEdit({
							zoneId: z.id,
							kind: "move",
							startMouseX: e.clientX,
							startMouseY: e.clientY,
							originX: z.x,
							originY: z.y,
							originW: z.width,
							originH: z.height,
						});
						return;
					}
				}
				// clicked empty area outside any zone → deselect zone
				if (selectedZoneId) setSelectedZoneId(null);
			}

			e.currentTarget.setPointerCapture(e.pointerId);

			const point = getPoint(e);
			const fixtures = layout.fixtures;
			const resizeIndex = findResizeFixtureIndexAtPoint(
				point,
				fixtures,
				scaleRef.current,
				selectedIndex,
				state.hoverEdge,
			);
			const hitIndex = resizeIndex ?? findFixtureIndexAtPoint(point, fixtures);

			if (hitIndex === null) {
				const isMarqueeMode = interactionModeRef.current === "marquee";
				if (isMarqueeMode || e.shiftKey) {
					// Shift + empty-space drag, or toolbar-selected marquee mode.
					e.currentTarget.setPointerCapture(e.pointerId);
					touchGestureRef.current = null;
					if (selectedZoneId) setSelectedZoneId(null);
					setMarquee({
						startX: point.x,
						startY: point.y,
						curX: point.x,
						curY: point.y,
						additive: e.shiftKey && e.pointerType !== "touch",
					});
					return;
				}
				if (e.pointerType === "touch") {
					e.currentTarget.setPointerCapture(e.pointerId);
					if (touchPointsRef.current.size >= 2 && beginTouchPinch()) {
						updateTouchPinch();
						return;
					}
					touchGestureRef.current = {
						kind: "pan",
						pointerId: e.pointerId,
						lastClientX: e.clientX,
						lastClientY: e.clientY,
					};
					if (selectedZoneId) setSelectedZoneId(null);
					clearSelection();
					return;
				}
				// Empty-space drag pans the floorplan without requiring Space.
				clearSelection();
				startPanAt(e.clientX, e.clientY, e.pointerId);
				return;
			}

			if (pendingBinding) {
				applyBindingToFixture(hitIndex);
				return;
			}

			// Shift+click on a fixture toggles its selection (no drag start).
			if (e.shiftKey) {
				toggleFixtureSelection(hitIndex);
				return;
			}

			// Locked fixtures can be selected but not dragged or resized.
			if (fixtures[hitIndex]?.locked) {
				setSelectedFixture(hitIndex);
				return;
			}

			const isDraggingSelectedGroup =
				selectedIndices.length > 1 && selectedIndices.includes(hitIndex);
			const dragIndices = isDraggingSelectedGroup
				? selectedIndices.filter((index) => !fixtures[index]?.locked)
				: [hitIndex];
			const fixture = fixtures[hitIndex];
			const edge = detectEdge(
				fixture,
				point,
				scaleRef.current,
				hitIndex === selectedIndex ? state.hoverEdge : null,
			);

			// Cache the element reference so pointermove skips querySelector on every event.
			draggingElRef.current =
				canvasRef.current?.querySelector<HTMLElement>(
					`.fixture[data-index="${hitIndex}"]`,
				) ?? null;

			if (edge) {
				groupDragRef.current =
					isDraggingSelectedGroup && dragIndices.length > 1
						? dragIndices.map((index) => {
								const item = fixtures[index];
								return {
									index,
									x: item.x,
									y: item.y,
									width: item.width,
									height: item.height,
									polygon:
										item.shape === "polygon" && item.polygon
											? item.polygon.map(([x, y]) => [x, y])
											: null,
								};
							})
						: null;
				groupDraggingElsRef.current = new Map(
					dragIndices
						.map(
							(index) =>
								[
									index,
									canvasRef.current?.querySelector<HTMLElement>(
										`.fixture[data-index="${index}"]`,
									) ?? null,
								] as const,
						)
						.filter((entry): entry is readonly [number, HTMLElement] =>
							Boolean(entry[1]),
						),
				);
				dispatch({
					type: "START_RESIZE",
					payload: {
						index: hitIndex,
						edge,
						startX: e.clientX,
						startY: e.clientY,
						originX: fixture.x,
						originY: fixture.y,
						originWidth: fixture.width,
						originHeight: fixture.height,
						originPolygon: fixture.polygon
							? fixture.polygon.map(([x, y]) => [x, y])
							: null,
					},
				});
			} else {
				groupDragRef.current =
					dragIndices.length > 1
						? dragIndices.map((index) => {
								const item = fixtures[index];
								return {
									index,
									x: item.x,
									y: item.y,
									width: item.width,
									height: item.height,
									polygon:
										item.shape === "polygon" && item.polygon
											? item.polygon.map(([x, y]) => [x, y])
											: null,
								};
							})
						: null;
				groupDraggingElsRef.current = new Map(
					dragIndices
						.map(
							(index) =>
								[
									index,
									canvasRef.current?.querySelector<HTMLElement>(
										`.fixture[data-index="${index}"]`,
									) ?? null,
								] as const,
						)
						.filter((entry): entry is readonly [number, HTMLElement] =>
							Boolean(entry[1]),
						),
				);
				dispatch({
					type: "START_DRAG",
					payload: {
						index: hitIndex,
						startX: e.clientX,
						startY: e.clientY,
						originX: fixture.x,
						originY: fixture.y,
						originPolygon:
							fixture.shape === "polygon" && fixture.polygon
								? fixture.polygon.map(([x, y]) => [x, y])
								: null,
					},
				});
			}
			if (!isDraggingSelectedGroup) setSelectedFixture(hitIndex);
			liveFixturesRef.current = fixtures.map((f) => ({ ...f }));
		},
		[
			layout,
			selectedIndex,
			state.hoverEdge,
			getPoint,
			setSelectedFixture,
			pendingBinding,
			applyBindingToFixture,
			zoneDraftCategory,
			selectedZoneId,
			cameraDraftPhotoId,
			cameraStep1,
			cancelCameraDraft,
			beginTouchPinch,
			clearSelection,
			toggleFixtureSelection,
			selectedIndices,
			updateTouchPinch,
			startPanAt,
		],
	);

	const onWorkspacePointerMove = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const gesture = workspaceGestureRef.current;
			if (!gesture || gesture.pointerId !== e.pointerId) return;
			if (gesture.kind === "tap") {
				if (Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 8) {
					workspaceGestureRef.current = null;
				}
				return;
			}
			const nextPan = {
				x: panRef.current.x + (e.clientX - gesture.lastClientX),
				y: panRef.current.y + (e.clientY - gesture.lastClientY),
			};
			gesture.lastClientX = e.clientX;
			gesture.lastClientY = e.clientY;
			panRef.current = nextPan;
			setPan(nextPan);
		},
		[],
	);

	const onPointerMove = useCallback(
		(e: React.PointerEvent) => {
			const interaction = interactionRef.current;
			if (!layout) return;
			if (
				e.pointerType === "touch" &&
				touchPointsRef.current.has(e.pointerId)
			) {
				touchPointsRef.current.set(e.pointerId, {
					clientX: e.clientX,
					clientY: e.clientY,
				});
			}

			const touchGesture = touchGestureRef.current;
			if (touchGesture) {
				if (
					touchGesture.kind === "pan" &&
					touchGesture.pointerId === e.pointerId
				) {
					const nextPan = {
						x: panRef.current.x + (e.clientX - touchGesture.lastClientX),
						y: panRef.current.y + (e.clientY - touchGesture.lastClientY),
					};
					touchGesture.lastClientX = e.clientX;
					touchGesture.lastClientY = e.clientY;
					panRef.current = nextPan;
					setPan(nextPan);
					if (touchPointsRef.current.size >= 2 && beginTouchPinch()) {
						updateTouchPinch();
					}
					return;
				}
				if (
					touchGesture.kind === "pinch" &&
					touchGesture.pointerIds.includes(e.pointerId)
				) {
					updateTouchPinch();
					return;
				}
			}

			// Marquee drag — update size.
			if (marquee) {
				const p = getPoint(e);
				setMarquee({ ...marquee, curX: p.x, curY: p.y });
				return;
			}

			// Zone drag in progress — update preview rect.
			if (zoneDrag) {
				const p = getPoint(e);
				setZoneDrag({
					startX: zoneDrag.startX,
					startY: zoneDrag.startY,
					curX: p.x,
					curY: p.y,
				});
				return;
			}

			// Zone resize/move in progress — apply delta directly to zone.
			if (zoneEdit) {
				const dx = (e.clientX - zoneEdit.startMouseX) / scaleRef.current;
				const dy = (e.clientY - zoneEdit.startMouseY) / scaleRef.current;
				if (zoneEdit.kind === "move") {
					updateZone(zoneEdit.zoneId, {
						x: Math.round(zoneEdit.originX + dx),
						y: Math.round(zoneEdit.originY + dy),
					});
				} else if (zoneEdit.edge) {
					let nx = zoneEdit.originX,
						ny = zoneEdit.originY;
					let nw = zoneEdit.originW,
						nh = zoneEdit.originH;
					if (zoneEdit.edge.includes("left")) {
						nx = zoneEdit.originX + dx;
						nw = zoneEdit.originW - dx;
					}
					if (zoneEdit.edge.includes("right")) {
						nw = zoneEdit.originW + dx;
					}
					if (zoneEdit.edge.includes("top")) {
						ny = zoneEdit.originY + dy;
						nh = zoneEdit.originH - dy;
					}
					if (zoneEdit.edge.includes("bottom")) {
						nh = zoneEdit.originH + dy;
					}
					if (nw < 12 || nh < 12) return;
					updateZone(zoneEdit.zoneId, {
						x: Math.round(nx),
						y: Math.round(ny),
						width: Math.round(nw),
						height: Math.round(nh),
					});
				}
				return;
			}

			if (!interaction) {
				// Update hover edge for selected fixture
				if (selectedIndex === null) return;
				const fixture = layout.fixtures[selectedIndex];
				if (!fixture) return;
				const point = getPoint(e);
				const edge = detectEdge(
					fixture,
					point,
					scaleRef.current,
					state.hoverEdge,
				);
				if (edge !== state.hoverEdge) {
					dispatch({ type: "SET_HOVER_EDGE", edge });
				}
				return;
			}

			if (interaction.kind === "product-drag") {
				const fixture = layout.fixtures[interaction.index];
				const preview = fixture?.detectionPreview;
				if (!fixture || !preview) return;
				const dx = (e.clientX - interaction.startX) / scaleRef.current;
				const dy = (e.clientY - interaction.startY) / scaleRef.current;
				const nextItems = preview.items.map((item) => {
					if (item.detectionItemId !== interaction.detectionItemId) return item;
					if (interaction.mode === "resize") {
						const nextWidth = clamp(
							interaction.originRelativeWidth + dx / fixture.width,
							0.03,
							3,
						);
						const nextHeight = clamp(
							interaction.originRelativeHeight + dy / fixture.height,
							0.03,
							3,
						);
						return {
							...item,
							relativePosition: {
								x: interaction.originRelativeX,
								y: interaction.originRelativeY,
							},
							relativeSize: {
								width: nextWidth,
								height: nextHeight,
							},
						};
					}
					return {
						...item,
						relativePosition: {
							x: interaction.originRelativeX + dx / fixture.width,
							y: interaction.originRelativeY + dy / fixture.height,
						},
					};
				});
				updateFixture(interaction.index, {
					detectionPreview: { ...preview, items: nextItems },
				});
				return;
			}

			if (interaction.kind === "rotate") {
				const mouseX = e.clientX - interaction.canvasLeft;
				const mouseY = e.clientY - interaction.canvasTop;
				const currentAngle = Math.atan2(
					mouseY - interaction.centerY,
					mouseX - interaction.centerX,
				);
				const deltaAngle = currentAngle - interaction.startAngle;
				const newRotation =
					interaction.originRotation + (deltaAngle * 180) / Math.PI;
				const live = liveFixturesRef.current;
				if (live) {
					live[interaction.index] = {
						...live[interaction.index],
						rotation: newRotation,
					};
				}
				const fx = live?.[interaction.index]?.x ?? 0;
				const fy = live?.[interaction.index]?.y ?? 0;
				const s = scaleRef.current;
				const el = draggingElRef.current;
				if (el) {
					if (rafRef.current) cancelAnimationFrame(rafRef.current);
					rafRef.current = requestAnimationFrame(() => {
						rafRef.current = 0;
						el.style.transform = `translate(${fx * s}px, ${fy * s}px) rotate(${newRotation}deg)`;
					});
				}
				return;
			}

			const scale = scaleRef.current;
			const deltaX = (e.clientX - interaction.startX) / scale;
			const deltaY = (e.clientY - interaction.startY) / scale;
			const index = interaction.index;
			const fixtures = liveFixturesRef.current ?? layout.fixtures;
			const fixture = { ...fixtures[index] };

			if (interaction.kind === "drag") {
				const groupItems = groupDragRef.current;
				if (groupItems?.length) {
					const minX = Math.min(...groupItems.map((item) => item.x));
					const minY = Math.min(...groupItems.map((item) => item.y));
					const maxRight = Math.max(
						...groupItems.map((item) => item.x + item.width),
					);
					const maxBottom = Math.max(
						...groupItems.map((item) => item.y + item.height),
					);
					const groupDx = clamp(deltaX, -minX, layout.floorWidth - maxRight);
					const groupDy = clamp(deltaY, -minY, layout.floorHeight - maxBottom);

					for (const item of groupItems) {
						const nextFixture = { ...fixtures[item.index] };
						nextFixture.x = item.x + groupDx;
						nextFixture.y = item.y + groupDy;
						if (nextFixture.shape === "polygon" && item.polygon) {
							nextFixture.polygon = translatePolygon(
								item.polygon,
								groupDx,
								groupDy,
							);
						}
						if (liveFixturesRef.current) {
							liveFixturesRef.current[item.index] = nextFixture;
						}
					}
					const primaryOrigin =
						groupItems.find((item) => item.index === index) ?? groupItems[0];
					fixture.x = primaryOrigin.x + groupDx;
					fixture.y = primaryOrigin.y + groupDy;
				} else {
					fixture.x = clamp(
						interaction.originX + deltaX,
						0,
						layout.floorWidth - fixture.width,
					);
					fixture.y = clamp(
						interaction.originY + deltaY,
						0,
						layout.floorHeight - fixture.height,
					);
					if (fixture.shape === "polygon" && interaction.originPolygon) {
						fixture.polygon = translatePolygon(
							interaction.originPolygon,
							fixture.x - interaction.originX,
							fixture.y - interaction.originY,
						);
					}
				}
			} else {
				const edge = interaction.edge;
				const resizeFixture = (
					current: Fixture,
					origin: {
						x: number;
						y: number;
						width: number;
						height: number;
						polygon: [number, number][] | null;
					},
				) => {
					const next = { ...current };
					const originRight = origin.x + origin.width;
					const originBottom = origin.y + origin.height;

					if (edge.includes("right")) {
						next.width = clamp(
							origin.width + deltaX,
							MIN_FIXTURE_SIZE,
							layout.floorWidth - next.x,
						);
					} else if (edge.includes("left")) {
						const maxX = originRight - MIN_FIXTURE_SIZE;
						next.x = clamp(origin.x + deltaX, 0, maxX);
						next.width = originRight - next.x;
					}
					if (edge.includes("bottom")) {
						next.height = clamp(
							origin.height + deltaY,
							MIN_FIXTURE_SIZE,
							layout.floorHeight - next.y,
						);
					} else if (edge.includes("top")) {
						const maxY = originBottom - MIN_FIXTURE_SIZE;
						next.y = clamp(origin.y + deltaY, 0, maxY);
						next.height = originBottom - next.y;
					}
					if (origin.polygon) {
						next.polygon = scalePolygon2D(
							origin.polygon,
							{
								x: origin.x,
								y: origin.y,
								width: origin.width,
								height: origin.height,
							},
							{
								x: next.x,
								y: next.y,
								width: next.width,
								height: next.height,
							},
						);
					}
					return next;
				};

				const groupItems = groupDragRef.current;
				if (groupItems?.length) {
					for (const item of groupItems) {
						const nextFixture = resizeFixture(fixtures[item.index], {
							x: item.x,
							y: item.y,
							width: item.width,
							height: item.height,
							polygon: item.polygon,
						});
						if (liveFixturesRef.current) {
							liveFixturesRef.current[item.index] = nextFixture;
						}
					}
					const primaryOrigin =
						groupItems.find((item) => item.index === index) ?? groupItems[0];
					Object.assign(
						fixture,
						resizeFixture(fixtures[index], {
							x: primaryOrigin.x,
							y: primaryOrigin.y,
							width: primaryOrigin.width,
							height: primaryOrigin.height,
							polygon: primaryOrigin.polygon,
						}),
					);
				} else {
					Object.assign(
						fixture,
						resizeFixture(fixture, {
							x: interaction.originX,
							y: interaction.originY,
							width: interaction.originWidth,
							height: interaction.originHeight,
							polygon: interaction.originPolygon,
						}),
					);
				}
			}

			if (liveFixturesRef.current) {
				liveFixturesRef.current[index] = fixture;
			}

			// Batch all DOM style writes to the next paint frame.
			// Capture values now (at event time) so the rAF closure is always fresh.
			const groupItems = groupDragRef.current;
			if (groupItems?.length) {
				const s = scaleRef.current;
				const writes = groupItems.flatMap((item) => {
					const live = liveFixturesRef.current?.[item.index];
					const el = groupDraggingElsRef.current.get(item.index);
					if (!live || !el) return [];
					return [{ el, fixture: live }];
				});
				if (rafRef.current) cancelAnimationFrame(rafRef.current);
				rafRef.current = requestAnimationFrame(() => {
					rafRef.current = 0;
					for (const { el, fixture } of writes) {
						el.style.transform = `translate(${fixture.x * s}px, ${fixture.y * s}px) rotate(${fixture.rotation ?? 0}deg)`;
						el.style.width = `${fixture.width * s}px`;
						el.style.height = `${fixture.height * s}px`;
						if (fixture.shape === "polygon") {
							const shape = el.querySelector<HTMLElement>(".polygon-shape");
							const clipStr = polygonClipPath(fixture);
							if (shape && clipStr)
								shape.style.clipPath = `polygon(${clipStr})`;
						}
					}
				});
				return;
			}

			const el = draggingElRef.current;
			if (el) {
				const s = scaleRef.current;
				const fx = fixture.x,
					fy = fixture.y,
					fw = fixture.width,
					fh = fixture.height;
				const fr = fixture.rotation ?? 0;
				const isPolygon = fixture.shape === "polygon";
				const clipStr = isPolygon ? polygonClipPath(fixture) : "";
				if (rafRef.current) cancelAnimationFrame(rafRef.current);
				rafRef.current = requestAnimationFrame(() => {
					rafRef.current = 0;
					el.style.transform = `translate(${fx * s}px, ${fy * s}px) rotate(${fr}deg)`;
					el.style.width = `${fw * s}px`;
					el.style.height = `${fh * s}px`;
					if (isPolygon && clipStr) {
						const shape = el.querySelector<HTMLElement>(".polygon-shape");
						if (shape) shape.style.clipPath = `polygon(${clipStr})`;
					}
				});
			}
		},
		[
			layout,
			selectedIndex,
			state.hoverEdge,
			getPoint,
			beginTouchPinch,
			zoneDrag,
			zoneEdit,
			updateZone,
			marquee,
			updateTouchPinch,
			updateFixture,
		],
	);

	const onWorkspacePointerUp = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const gesture = workspaceGestureRef.current;
			if (gesture?.pointerId === e.pointerId) {
				workspaceGestureRef.current = null;
				if (
					gesture.kind === "tap" &&
					Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) <= 8
				) {
					if (selectedZoneId) setSelectedZoneId(null);
					clearSelection();
				}
			}
			try {
				if (e.currentTarget.hasPointerCapture(e.pointerId)) {
					e.currentTarget.releasePointerCapture(e.pointerId);
				}
			} catch {
				// Safe to ignore stale pointer capture on touch end.
			}
		},
		[clearSelection, selectedZoneId],
	);

	const onPointerUp = useCallback(
		(e: React.PointerEvent) => {
			// Always release pointer capture first — every onPointerDown branch
			// calls setPointerCapture (some early-return without dispatching an
			// interaction), so capture must be released unconditionally or the
			// next click can land mid-drag with a stale capture.
			try {
				if (e.currentTarget.hasPointerCapture(e.pointerId)) {
					e.currentTarget.releasePointerCapture(e.pointerId);
				}
			} catch {
				// hasPointerCapture/releasePointerCapture can throw if pointerId
				// is gone — safe to ignore.
			}
			if (e.pointerType === "touch") {
				touchPointsRef.current.delete(e.pointerId);
				const gesture = touchGestureRef.current;
				if (gesture?.kind === "pan" && gesture.pointerId === e.pointerId) {
					touchGestureRef.current = null;
				} else if (
					gesture?.kind === "pinch" &&
					gesture.pointerIds.includes(e.pointerId)
				) {
					const remaining = Array.from(touchPointsRef.current.entries());
					if (remaining.length >= 2) {
						beginTouchPinch();
						updateTouchPinch();
					} else if (remaining.length === 1) {
						const [pointerId, point] = remaining[0];
						touchGestureRef.current = {
							kind: "pan",
							pointerId,
							lastClientX: point.clientX,
							lastClientY: point.clientY,
						};
					} else {
						touchGestureRef.current = null;
					}
				}
			}

			// Finalize marquee selection.
			if (marquee) {
				const x1 = Math.min(marquee.startX, marquee.curX);
				const x2 = Math.max(marquee.startX, marquee.curX);
				const y1 = Math.min(marquee.startY, marquee.curY);
				const y2 = Math.max(marquee.startY, marquee.curY);
				const minSize = 6;
				if (x2 - x1 >= minSize && y2 - y1 >= minSize && layout) {
					const hits: number[] = [];
					layout.fixtures.forEach((f, idx) => {
						const cx = f.x + f.width / 2;
						const cy = f.y + f.height / 2;
						if (cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2) {
							hits.push(idx);
						}
					});
					setSelectedIndicesBatch(hits, !marquee.additive);
				} else if (!marquee.additive) {
					clearSelection();
				}
				setMarquee(null);
				return;
			}

			// Finalize zone resize/move.
			if (zoneEdit) {
				setZoneEdit(null);
				return;
			}

			// Finalize zone draft drag.
			if (zoneDrag && zoneDraftCategory) {
				const x = Math.min(zoneDrag.startX, zoneDrag.curX);
				const y = Math.min(zoneDrag.startY, zoneDrag.curY);
				const w = Math.abs(zoneDrag.curX - zoneDrag.startX);
				const h = Math.abs(zoneDrag.curY - zoneDrag.startY);
				if (w >= 12 && h >= 12) {
					addZone({
						id: `zone-${Date.now().toString(36)}`,
						name: ZONE_CATEGORY_LABEL[zoneDraftCategory],
						category: zoneDraftCategory,
						x: Math.round(x),
						y: Math.round(y),
						width: Math.round(w),
						height: Math.round(h),
					});
				}
				setZoneDrag(null);
				cancelZoneDraft();
				return;
			}

			const interaction = interactionRef.current;
			if (!interaction || !layout) {
				liveFixturesRef.current = null;
				dispatch({ type: "END_INTERACTION" });
				return;
			}

			// Cancel any pending rAF and clear cached element reference.
			if (rafRef.current) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = 0;
			}
			draggingElRef.current = null;

			if (interaction.kind === "product-drag") {
				if (interaction.mode === "move") {
					const sourceFixture = layout.fixtures[interaction.index];
					const sourcePreview = sourceFixture?.detectionPreview;
					const item = sourcePreview?.items.find(
						(item) => item.detectionItemId === interaction.detectionItemId,
					);
					if (sourceFixture && sourcePreview && item) {
						const absoluteX =
							sourceFixture.x + item.relativePosition.x * sourceFixture.width;
						const absoluteY =
							sourceFixture.y + item.relativePosition.y * sourceFixture.height;
						const targetIndex = layout.fixtures
							.map((_, index) => index)
							.reverse()
							.find((index) => {
								const fixture = layout.fixtures[index];
								return (
									fixture &&
									absoluteX >= fixture.x &&
									absoluteX <= fixture.x + fixture.width &&
									absoluteY >= fixture.y &&
									absoluteY <= fixture.y + fixture.height
								);
							});
						if (
							targetIndex !== undefined &&
							targetIndex !== interaction.index
						) {
							const targetFixture = layout.fixtures[targetIndex];
							const targetPreview =
								targetFixture.detectionPreview ?? createEmptyDetectionPreview();
							updateFixturesBatch([
								{
									index: interaction.index,
									patch: {
										detectionPreview: {
											...sourcePreview,
											items: sourcePreview.items.filter(
												(sourceItem) =>
													sourceItem.detectionItemId !==
													interaction.detectionItemId,
											),
										},
									},
								},
								{
									index: targetIndex,
									patch: {
										detectionPreview: {
											...targetPreview,
											items: [
												...targetPreview.items,
												{
													...item,
													relativePosition: {
														x:
															(absoluteX - targetFixture.x) /
															targetFixture.width,
														y:
															(absoluteY - targetFixture.y) /
															targetFixture.height,
													},
												},
											],
										},
									},
								},
							]);
							setSelectedFixture(targetIndex);
							setSelectedDetectionItem(interaction.detectionItemId);
						}
					}
				}
				dispatch({ type: "END_INTERACTION" });
				return;
			}

			const groupItems = groupDragRef.current;
			if (interaction.kind === "drag" && groupItems?.length) {
				const didMove =
					Math.hypot(
						e.clientX - interaction.startX,
						e.clientY - interaction.startY,
					) > 3;
				if (!didMove) {
					setSelectedFixture(interaction.index);
				} else {
					const updates = groupItems.flatMap((item) => {
						const live = liveFixturesRef.current?.[item.index];
						if (!live) return [];
						return [
							{
								index: item.index,
								patch: {
									x: Math.round(live.x),
									y: Math.round(live.y),
									polygon: live.polygon,
								},
							},
						];
					});
					updateFixturesBatch(updates);
				}
			} else if (interaction.kind === "resize" && groupItems?.length) {
				const updates = groupItems.flatMap((item) => {
					const live = liveFixturesRef.current?.[item.index];
					if (!live) return [];
					return [
						{
							index: item.index,
							patch: {
								x: Math.round(live.x),
								y: Math.round(live.y),
								width: Math.round(live.width),
								height: Math.round(live.height),
								polygon: live.polygon,
							},
						},
					];
				});
				updateFixturesBatch(updates);
			} else {
				const index = interaction.index;
				const live = liveFixturesRef.current?.[index];
				if (live) {
					updateFixture(index, {
						x: Math.round(live.x),
						y: Math.round(live.y),
						width: Math.round(live.width),
						height: Math.round(live.height),
						polygon: live.polygon,
						rotation: Math.round(live.rotation ?? 0),
					});
				}
			}
			groupDragRef.current = null;
			groupDraggingElsRef.current.clear();
			liveFixturesRef.current = null;
			dispatch({ type: "END_INTERACTION" });
		},
		[
			layout,
			updateFixture,
			updateFixturesBatch,
			setSelectedFixture,
			setSelectedDetectionItem,
			beginTouchPinch,
			zoneDrag,
			zoneDraftCategory,
			addZone,
			cancelZoneDraft,
			zoneEdit,
			marquee,
			setSelectedIndicesBatch,
			clearSelection,
			updateTouchPinch,
		],
	);

	// Browser cancels (window blur, context menu, touch interrupted, etc.) —
	// drop all in-flight interaction state so the next click starts fresh.
	const onPointerCancel = useCallback((e: React.PointerEvent) => {
		try {
			if (e.currentTarget.hasPointerCapture(e.pointerId)) {
				e.currentTarget.releasePointerCapture(e.pointerId);
			}
		} catch {
			/* ignore */
		}
		if (rafRef.current) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = 0;
		}
		draggingElRef.current = null;
		groupDragRef.current = null;
		groupDraggingElsRef.current.clear();
		liveFixturesRef.current = null;
		touchPointsRef.current.clear();
		touchGestureRef.current = null;
		setMarquee(null);
		setZoneDrag(null);
		setZoneEdit(null);
		dispatch({ type: "END_INTERACTION" });
	}, []);

	if (!layout) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
				<svg
					width="40"
					height="40"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.2"
					className="text-border"
					aria-hidden="true"
				>
					<rect x="3" y="3" width="18" height="18" rx="2" />
					<path d="M3 9h18M9 21V9" />
				</svg>
				<p>좌측 패널에서 도면 이미지를 업로드해주세요</p>
			</div>
		);
	}

	const { floorWidth, floorHeight, fixtures } = layout;
	const scale = canvasScale > 0 ? canvasScale : 1;

	const containerFlags = fixtures.map((f, i) =>
		isContainerFixture(f, fixtures, i),
	);
	const renderOrder = fixtures
		.map((_, i) => i)
		.sort((a, b) => {
			if (containerFlags[a] === containerFlags[b]) return a - b;
			return containerFlags[a] ? -1 : 1;
		});

	return (
		<div
			ref={containerRef}
			className="flex h-full w-full items-center justify-center overflow-hidden bg-gray-100 p-4"
			style={{ touchAction: "none", overscrollBehavior: "contain" }}
			onPointerDown={onWorkspacePointerDown}
			onPointerMove={onWorkspacePointerMove}
			onPointerUp={onWorkspacePointerUp}
			onPointerCancel={onWorkspacePointerUp}
		>
			{zoneDraftCategory && (
				<div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-md border border-amber-400 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-800 shadow-sm">
					{ZONE_CATEGORY_LABEL[zoneDraftCategory]} 영역을 드래그해서 그리세요
					(Esc 취소)
				</div>
			)}
			{cameraDraftPhotoId && (
				<div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-md border border-blue-400 bg-blue-50 px-3 py-1.5 text-[11px] font-medium text-blue-800 shadow-sm">
					{!cameraStep1
						? "카메라 위치 클릭 → 사진을 찍은 지점을 도면에서 선택"
						: "카메라가 바라보는 방향 클릭 → 매장 안쪽으로 향한 지점"}{" "}
					(Esc 취소)
				</div>
			)}
			<div
				ref={canvasRef}
				className="relative mx-auto shrink-0 select-none bg-white shadow-md"
				style={{
					width: Math.round(floorWidth * scale),
					height: Math.round(floorHeight * scale),
					touchAction: "none",
					transform: `translate(${pan.x}px, ${pan.y}px)`,
					cursor:
						zoneDraftCategory || cameraDraftPhotoId
							? "crosshair"
							: state.interaction?.kind === "drag"
								? "grabbing"
								: "default",
					backgroundColor: "#f8f7f4",
					backgroundImage:
						"linear-gradient(rgba(124, 145, 148, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(124, 145, 148, 0.08) 1px, transparent 1px)",
					backgroundSize: `${24 * scale}px ${24 * scale}px`,
				}}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerCancel}
			>
				{layout.floorImageUrl && (
					<img
						src={layout.floorImageUrl}
						alt="도면"
						className="pointer-events-none absolute inset-0 h-full w-full"
						style={{ objectFit: "fill" }}
						draggable={false}
					/>
				)}
				{marquee && (
					<div
						className="pointer-events-none absolute"
						style={{
							left: Math.min(marquee.startX, marquee.curX) * scale,
							top: Math.min(marquee.startY, marquee.curY) * scale,
							width: Math.abs(marquee.curX - marquee.startX) * scale,
							height: Math.abs(marquee.curY - marquee.startY) * scale,
							border: "1.5px dashed #2563eb",
							backgroundColor: "rgba(37, 99, 235, 0.10)",
							zIndex: 6,
						}}
					/>
				)}
				{cameraStep1 && cameraDraftPhotoId && (
					<div
						className="pointer-events-none absolute"
						style={{
							left: cameraStep1.x * scale - 8,
							top: cameraStep1.y * scale - 8,
							width: 16,
							height: 16,
							border: "2px solid #2563eb",
							borderRadius: "50%",
							backgroundColor: "rgba(37, 99, 235, 0.3)",
							zIndex: 10,
						}}
					>
						<span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-blue-700">
							카메라
						</span>
					</div>
				)}
				{zoneDrag && zoneDraftCategory && (
					<div
						className="pointer-events-none absolute"
						style={{
							left: Math.min(zoneDrag.startX, zoneDrag.curX) * scale,
							top: Math.min(zoneDrag.startY, zoneDrag.curY) * scale,
							width: Math.abs(zoneDrag.curX - zoneDrag.startX) * scale,
							height: Math.abs(zoneDrag.curY - zoneDrag.startY) * scale,
							backgroundColor: `${ZONE_CATEGORY_COLOR[zoneDraftCategory]}33`,
							border: `2px dashed ${ZONE_CATEGORY_COLOR[zoneDraftCategory]}`,
							zIndex: 5,
						}}
					/>
				)}
				{(layout.zones ?? []).map((zone) => {
					const color = ZONE_CATEGORY_COLOR[zone.category];
					const isSel = zone.id === selectedZoneId;
					return (
						<div
							key={zone.id}
							className="pointer-events-none absolute"
							style={{
								left: zone.x * scale,
								top: zone.y * scale,
								width: zone.width * scale,
								height: zone.height * scale,
								backgroundColor: `${color}1f`,
								border: `${isSel ? "2.5px solid" : "1.5px dashed"} ${color}`,
								zIndex: isSel ? 2 : 0,
							}}
						>
							<span
								className="absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
								style={{ backgroundColor: color }}
							>
								{zone.name || ZONE_CATEGORY_LABEL[zone.category]}
							</span>
							{isSel &&
								(
									[
										"top-left",
										"top-right",
										"bottom-left",
										"bottom-right",
									] as const
								).map((c) => (
									<span
										key={c}
										className="absolute h-2 w-2 border border-white"
										style={{
											backgroundColor: color,
											left: c.includes("left") ? -4 : "auto",
											right: c.includes("right") ? -4 : "auto",
											top: c.includes("top") ? -4 : "auto",
											bottom: c.includes("bottom") ? -4 : "auto",
										}}
									/>
								))}
						</div>
					);
				})}
				{renderOrder.map((index) => {
					const fixture = fixtures[index];
					const isLocked = fixture.locked === true;
					const isSelected = selectedIndex === index;
					const isSelectionGroupMember =
						selectedIndices.length > 1 && selectedIndices.includes(index);
					const isMultiSelected =
						selectedIndices.includes(index) && !isSelected;
					const isDragging =
						state.interaction?.kind === "drag" &&
						state.interaction.index === index;
					const isResizing =
						state.interaction?.kind === "resize" &&
						state.interaction.index === index;
					const hasActiveProduct =
						(state.interaction?.kind === "product-drag" &&
							state.interaction.index === index) ||
						(selectedDetectionItemId !== null &&
							fixture.detectionPreview?.items.some(
								(item) => item.detectionItemId === selectedDetectionItemId,
							));
					const isContainer = containerFlags[index];
					const theme = getFixtureTheme(fixture);
					const showLabel =
						isSelected &&
						fixture.width * scale >= 72 &&
						fixture.height * scale >= 32;
					const clipPath =
						fixture.shape === "polygon" ? polygonClipPath(fixture) : "";
					const cursor = isLocked
						? "default"
						: isSelected
							? isDragging
								? "grabbing"
								: isResizing && state.hoverEdge
									? getCursor(state.hoverEdge)
									: state.hoverEdge
										? getCursor(state.hoverEdge)
										: "grab"
							: "grab";

					return (
						<div
							key={fixture.id}
							className={[
								"fixture absolute border",
								isContainer ? "border-2 border-dashed" : "",
								isDragging ? "opacity-80" : "",
								isLocked ? "border-dashed" : "",
							]
								.filter(Boolean)
								.join(" ")}
							data-index={index}
							style={{
								left: 0,
								top: 0,
								width: fixture.width * scale,
								height: fixture.height * scale,
								transform: `translate(${fixture.x * scale}px, ${fixture.y * scale}px) rotate(${fixture.rotation ?? 0}deg)`,
								willChange: isDragging || isResizing ? "transform" : "auto",
								cursor,
								borderColor: isContainer ? "#dc2626" : theme.border,
								backgroundColor: isContainer
									? "rgba(239, 68, 68, 0.06)"
									: isSelected
										? theme.fillSelected
										: isLocked
											? "rgba(226, 232, 240, 0.42)"
											: theme.fill,
								boxShadow: isContainer
									? "none"
									: isSelectionGroupMember
										? `0 0 0 3px #2563eb, 0 0 0 5px rgba(37,99,235,0.25), 0 3px 8px ${theme.shadow}`
										: isSelected
											? `0 0 0 1px ${theme.border}, 0 6px 16px ${theme.shadow}`
											: `0 1px 0 rgba(255,255,255,0.55) inset, 0 3px 8px ${theme.shadow}`,
								zIndex: hasActiveProduct
									? 1000
									: isSelected
										? 20
										: isMultiSelected
											? 15
											: 1,
							}}
						>
							{fixture.shape === "polygon" && clipPath && (
								<div
									className="polygon-shape absolute inset-0"
									style={{
										clipPath: `polygon(${clipPath})`,
										background: isSelected ? theme.fillSelected : theme.fill,
									}}
								/>
							)}
							<div
								className="pointer-events-none absolute inset-0"
								style={{
									background: isContainer ? "none" : theme.sheen,
									opacity: isSelected ? 1 : 0.8,
								}}
							/>
							{PRODUCT_ASSET_TYPES_2D.has(fixture.assetType ?? "") && (
								<div className="pointer-events-none absolute left-1 top-1 rounded bg-amber-500 px-1 py-0.5 text-[9px] font-bold text-white shadow">
									상품
								</div>
							)}
							{fixture.detectionPreview?.items?.length ? (
								<div
									className="absolute inset-0 overflow-visible"
									style={{ zIndex: 30 }}
								>
									{fixture.detectionPreview.items.slice(0, 50).map((item) => {
										const left =
											(item.relativePosition.x - item.relativeSize.width / 2) *
											100;
										const top =
											(item.relativePosition.y - item.relativeSize.height / 2) *
											100;
										const width = item.relativeSize.width * 100;
										const height = item.relativeSize.height * 100;
										return (
											<div
												key={item.detectionItemId}
												className={cn(
													"absolute touch-none cursor-grab overflow-visible rounded-sm active:cursor-grabbing",
													selectedDetectionItemId === item.detectionItemId
														? "ring-2 ring-primary ring-offset-1"
														: "",
												)}
												onPointerDown={(event) => {
													event.stopPropagation();
													setSelectedFixture(index);
													setSelectedDetectionItem(item.detectionItemId);
													(
														event.currentTarget as HTMLElement
													).setPointerCapture(event.pointerId);
													dispatch({
														type: "START_PRODUCT_DRAG",
														payload: {
															index,
															detectionItemId: item.detectionItemId,
															mode: "move",
															startX: event.clientX,
															startY: event.clientY,
															originRelativeX: item.relativePosition.x,
															originRelativeY: item.relativePosition.y,
															originRelativeWidth: item.relativeSize.width,
															originRelativeHeight: item.relativeSize.height,
														},
													});
												}}
												style={{
													left: `${left}%`,
													top: `${top}%`,
													width: `${width}%`,
													height: `${height}%`,
												}}
											>
												<img
													src={item.thumbnailUrl}
													alt={`Detection ${item.detectionItemId}`}
													className="pointer-events-none h-full w-full object-contain"
													onError={() => {
														const taskId = fixture.detectionPreview?.taskId;
														if (taskId !== null && taskId !== undefined) {
															void refreshDetectionTaskThumbnails(taskId);
														}
													}}
												/>
												{item.name && (
													<span className="pointer-events-none absolute left-1/2 top-full mt-0.5 max-w-[160%] -translate-x-1/2 truncate rounded bg-slate-900/80 px-1.5 py-0.5 text-center text-[9px] font-medium leading-tight text-white shadow-sm">
														{item.name}
													</span>
												)}
												{selectedDetectionItemId === item.detectionItemId && (
													<button
														type="button"
														aria-label="상품 크기 조절"
														className="absolute -bottom-3 -right-3 h-7 w-7 touch-none cursor-nwse-resize rounded-full border-2 border-white bg-primary shadow-md ring-2 ring-primary/20 md:-bottom-2 md:-right-2 md:h-5 md:w-5"
														onPointerDown={(event) => {
															event.stopPropagation();
															setSelectedFixture(index);
															setSelectedDetectionItem(item.detectionItemId);
															(
																event.currentTarget as HTMLElement
															).setPointerCapture(event.pointerId);
															dispatch({
																type: "START_PRODUCT_DRAG",
																payload: {
																	index,
																	detectionItemId: item.detectionItemId,
																	mode: "resize",
																	startX: event.clientX,
																	startY: event.clientY,
																	originRelativeX: item.relativePosition.x,
																	originRelativeY: item.relativePosition.y,
																	originRelativeWidth: item.relativeSize.width,
																	originRelativeHeight:
																		item.relativeSize.height,
																},
															});
														}}
													/>
												)}
											</div>
										);
									})}
									<div className="absolute bottom-1 left-1 rounded bg-slate-900/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
										AI {fixture.detectionPreview.items.length}
									</div>
								</div>
							) : null}
							<div className="pointer-events-none relative flex h-full flex-col items-center justify-center overflow-hidden p-1">
								{showLabel && (
									<>
										<span
											className="truncate text-[10px] font-semibold"
											style={{ color: theme.label }}
										>
											{fixture.label}
										</span>
										<small
											className="truncate text-[9px]"
											style={{ color: theme.label, opacity: 0.72 }}
										>
											{fixture.type}
										</small>
									</>
								)}
							</div>
							{isLocked && (
								<div className="pointer-events-none absolute right-1 top-1 rounded bg-gray-600/70 px-1 py-0.5 text-[9px] text-white">
									🔒
								</div>
							)}
							{isSelected && !isContainer && !isLocked && (
								<div
									className="rotate-handle absolute z-20"
									style={{
										top: -26,
										left: "50%",
										transform: "translateX(-50%)",
										width: 14,
										height: 14,
										borderRadius: "50%",
										backgroundColor: "#2563eb",
										border: "2.5px solid white",
										cursor: "grab",
										boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
									}}
									onPointerDown={(e) => {
										e.stopPropagation();
										const canvas = canvasRef.current;
										if (!canvas) return;
										const rect = canvas.getBoundingClientRect();
										const s = scaleRef.current;
										const f = fixture;
										const centerX = (f.x + f.width / 2) * s;
										const centerY = (f.y + f.height / 2) * s;
										const mouseX = e.clientX - rect.left;
										const mouseY = e.clientY - rect.top;
										const startAngle = Math.atan2(
											mouseY - centerY,
											mouseX - centerX,
										);
										// Cancel any pending rAF from a previous interaction.
										if (rafRef.current) {
											cancelAnimationFrame(rafRef.current);
											rafRef.current = 0;
										}
										// Cache the fixture element so pointermove avoids querySelector.
										draggingElRef.current =
											canvas.querySelector<HTMLElement>(
												`.fixture[data-index="${index}"]`,
											) ?? null;
										dispatch({
											type: "START_ROTATE",
											payload: {
												index,
												centerX,
												centerY,
												canvasLeft: rect.left,
												canvasTop: rect.top,
												originRotation: f.rotation ?? 0,
												startAngle,
											},
										});
										liveFixturesRef.current = fixtures.map((ff) => ({
											...ff,
										}));
										canvas.setPointerCapture(e.pointerId);
									}}
								/>
							)}
							{isSelected &&
								RESIZE_EDGES.map((edge) => (
									<div
										key={edge}
										className={`resize-handle-${edge} absolute z-10`}
										data-edge={edge}
										style={getResizeHandleStyle(edge)}
									/>
								))}
						</div>
					);
				})}
			</div>
		</div>
	);
}

function getResizeHandleStyle(edge: ResizeEdge): React.CSSProperties {
	const size = 8;
	const half = -size / 2;
	const center = "50%";
	const translate = "-50%";
	const base: React.CSSProperties = {
		position: "absolute",
		width: size,
		height: size,
		background: "white",
		border: "2px solid #344151",
		borderRadius: 2,
		zIndex: 10,
		pointerEvents: "none",
	};

	switch (edge) {
		case "top-left":
			return { ...base, top: half, left: half, cursor: "nwse-resize" };
		case "top":
			return {
				...base,
				top: half,
				left: center,
				transform: `translateX(${translate})`,
				cursor: "ns-resize",
			};
		case "top-right":
			return { ...base, top: half, right: half, cursor: "nesw-resize" };
		case "right":
			return {
				...base,
				top: center,
				right: half,
				transform: `translateY(${translate})`,
				cursor: "ew-resize",
			};
		case "bottom-right":
			return { ...base, bottom: half, right: half, cursor: "nwse-resize" };
		case "bottom":
			return {
				...base,
				bottom: half,
				left: center,
				transform: `translateX(${translate})`,
				cursor: "ns-resize",
			};
		case "bottom-left":
			return { ...base, bottom: half, left: half, cursor: "nesw-resize" };
		case "left":
			return {
				...base,
				top: center,
				left: half,
				transform: `translateY(${translate})`,
				cursor: "ew-resize",
			};
	}
}
