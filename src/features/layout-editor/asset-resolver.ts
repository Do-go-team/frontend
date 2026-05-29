import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { type AssetDims, buildAssetVisual } from "./asset-library";

/**
 * Manifest of optional GLB models keyed by assetType.
 * Drop CC0/MIT/Apache GLB files into `frontend/public/assets/gltf/{name}.glb`
 * and they will be auto-loaded on first scene mount.
 *
 * If the file is missing (404), the resolver gracefully falls back to the
 * procedural mesh from asset-library.ts.
 */
const ASSET_MANIFEST: Record<string, string> = {
	shoe_wall: "/assets/gltf/shoe_wall.glb",
	shoe_gondola: "/assets/gltf/shoe_gondola.glb",
	shoe_pyramid: "/assets/gltf/shoe_pyramid.glb",
	shoe_island: "/assets/gltf/shoe_island.glb",
	apparel_rack: "/assets/gltf/apparel_rack.glb",
	apparel_rack_round: "/assets/gltf/apparel_rack_round.glb",
	apparel_rack_wall: "/assets/gltf/apparel_rack_wall.glb",
	apparel_rack_double: "/assets/gltf/apparel_rack_double.glb",
	apparel_island: "/assets/gltf/apparel_island.glb",
	apparel_stack_table: "/assets/gltf/apparel_stack_table.glb",
	display_table: "/assets/gltf/display_table.glb",
	mannequin: "/assets/gltf/mannequin.glb",
	counter: "/assets/gltf/counter.glb",
	fitting_room: "/assets/gltf/fitting_room.glb",
	bench: "/assets/gltf/bench.glb",
	cafe_counter: "/assets/gltf/cafe_counter.glb",
	cafe_table: "/assets/gltf/cafe_table.glb",
	cafe_seat_round: "/assets/gltf/cafe_seat_round.glb",
	pastry_display: "/assets/gltf/pastry_display.glb",
	coffee_machine: "/assets/gltf/coffee_machine.glb",
	// generic: intentionally omitted — falls back to procedural floor marker (no box)
	shoes_test: "/shoes-test.glb",
	fixtures_test: "/fixtures-test.glb",
};

interface CachedAsset {
	template: THREE.Group;
	bbox: THREE.Box3;
}

const cache = new Map<string, CachedAsset>();
const inflight = new Map<string, Promise<void>>();
let preloadStarted = false;
const updateListeners = new Set<() => void>();

const loader = new GLTFLoader();

function loadOne(assetType: string, url: string): Promise<void> {
	if (cache.has(assetType)) return Promise.resolve();
	const existing = inflight.get(assetType);
	if (existing) return existing;

	const promise = new Promise<void>((resolve) => {
		loader.load(
			url,
			(gltf) => {
				const template = gltf.scene;
				template.traverse((obj) => {
					// castShadow disabled: complex GLB meshes make shadow map computation heavy.
					obj.castShadow = false;
					obj.receiveShadow = true;
				});
				const bbox = new THREE.Box3().setFromObject(template);
				cache.set(assetType, { template, bbox });
				for (const cb of updateListeners) cb();
				resolve();
			},
			undefined,
			() => {
				// 404 / parse error — silently fall back to procedural.
				resolve();
			},
		);
	});
	inflight.set(assetType, promise);
	promise.finally(() => inflight.delete(assetType));
	return promise;
}

/** Kick off background loads for all manifest entries (idempotent). */
export function preloadAssetCache(): void {
	if (preloadStarted) return;
	preloadStarted = true;
	for (const [assetType, url] of Object.entries(ASSET_MANIFEST)) {
		loadOne(assetType, url).catch(() => {});
	}
}

/** Subscribe for cache update events (called when a new GLB finishes loading). */
export function onAssetCacheUpdate(cb: () => void): () => void {
	updateListeners.add(cb);
	return () => updateListeners.delete(cb);
}

/**
 * Build a visual mesh group for the given assetType.
 * - If a GLB is cached for this assetType, clone it and scale to fit dims.
 * - Otherwise return the procedural mesh from asset-library.ts.
 *
 * The fixture's baseColor is applied to the GLB only when a single mesh exists
 * inside the scene; multi-material GLBs keep their original textures so the
 * artist's intent is preserved.
 */
export function resolveAssetVisual(
	assetType: string | undefined,
	dims: AssetDims,
): THREE.Group {
	if (!assetType) return buildAssetVisual(undefined, dims);

	const cached = cache.get(assetType);
	if (!cached) return buildAssetVisual(assetType, dims);

	const instance = cached.template.clone(true);
	const size = new THREE.Vector3();
	cached.bbox.getSize(size);

	// Fit GLB to fixture dims; preserve aspect by uniform scale to the smallest ratio.
	const sx = size.x > 0 ? dims.width / size.x : 1;
	const sy = size.y > 0 ? dims.height / size.y : 1;
	const sz = size.z > 0 ? dims.depth / size.z : 1;
	const uniform = Math.min(sx, sy, sz);
	instance.scale.set(uniform, uniform, uniform);

	// Center horizontally; bottom of GLB sits on fixture floor.
	const center = new THREE.Vector3();
	cached.bbox.getCenter(center);
	instance.position.set(
		-center.x * uniform,
		-cached.bbox.min.y * uniform - dims.height / 2,
		-center.z * uniform,
	);

	// If exactly one mesh material exists, tint it with fixture baseColor.
	let meshCount = 0;
	let primary: THREE.Mesh | null = null;
	instance.traverse((obj) => {
		if ((obj as THREE.Mesh).isMesh) {
			meshCount += 1;
			primary = obj as THREE.Mesh;
		}
	});
	if (meshCount === 1 && primary) {
		const m = (primary as THREE.Mesh).material;
		if (m && !Array.isArray(m) && (m as THREE.MeshStandardMaterial).color) {
			(m as THREE.MeshStandardMaterial).color = new THREE.Color(dims.baseColor);
		}
	}

	const wrapper = new THREE.Group();
	wrapper.add(instance);
	return wrapper;
}

/** Useful for diagnostics. */
export function getAssetCacheStats() {
	return {
		loaded: Array.from(cache.keys()),
		manifest: Object.keys(ASSET_MANIFEST),
	};
}
