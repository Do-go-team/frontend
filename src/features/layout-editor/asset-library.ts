import * as THREE from "three";

export interface AssetDims {
	width: number; // x in world units (Three.js scene units)
	depth: number; // z
	height: number; // y
	baseColor: THREE.ColorRepresentation;
}

const FRAME_COLOR = 0x2a2d33; // dark metal/wood frame
const ACCENT_COLOR = 0xe5e7eb; // light fittings
const SKIN_COLOR = 0xd9c8b4;

function makeMesh(
	geometry: THREE.BufferGeometry,
	color: THREE.ColorRepresentation,
	opts: { roughness?: number; metalness?: number } = {},
): THREE.Mesh {
	const mat = new THREE.MeshStandardMaterial({
		color,
		roughness: opts.roughness ?? 0.78,
		metalness: opts.metalness ?? 0.05,
	});
	const mesh = new THREE.Mesh(geometry, mat);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	mesh.userData.isAssetDetail = true;
	return mesh;
}

/** Wall-mounted shoe display: back panel + horizontal shelves at 4 levels. */
function buildShoeWall({
	width,
	depth,
	height,
	baseColor,
}: AssetDims): THREE.Group {
	const group = new THREE.Group();
	const shelfThick = Math.min(0.04, height * 0.04);
	const backPanelThick = Math.min(0.05, depth * 0.2);

	const back = makeMesh(
		new THREE.BoxGeometry(width, height, backPanelThick),
		baseColor,
	);
	back.position.set(0, 0, -depth / 2 + backPanelThick / 2);
	group.add(back);

	const shelfCount = 4;
	for (let i = 0; i < shelfCount; i++) {
		const t = (i + 1) / (shelfCount + 1);
		const shelf = makeMesh(
			new THREE.BoxGeometry(width * 0.96, shelfThick, depth * 0.85),
			ACCENT_COLOR,
		);
		shelf.position.set(0, -height / 2 + height * t, depth * 0.05);
		group.add(shelf);
	}
	return group;
}

/** Center gondola: lower, double-sided, with central spine. */
function buildShoeGondola({
	width,
	depth,
	height,
	baseColor,
}: AssetDims): THREE.Group {
	const group = new THREE.Group();
	const shelfThick = Math.min(0.04, height * 0.05);
	const spineThick = Math.min(0.05, depth * 0.08);

	const spine = makeMesh(
		new THREE.BoxGeometry(width * 0.96, height, spineThick),
		baseColor,
	);
	spine.position.set(0, 0, 0);
	group.add(spine);

	for (let side = -1; side <= 1; side += 2) {
		const shelfCount = 3;
		for (let i = 0; i < shelfCount; i++) {
			const t = (i + 0.5) / shelfCount;
			const shelf = makeMesh(
				new THREE.BoxGeometry(width * 0.95, shelfThick, depth * 0.45),
				ACCENT_COLOR,
			);
			shelf.position.set(0, -height / 2 + height * t, depth * 0.27 * side);
			group.add(shelf);
		}
	}
	return group;
}

/** Apparel rack: two vertical posts + horizontal hanging bar at 0.85h. */
function buildApparelRack({
	width,
	depth,
	height,
	baseColor,
}: AssetDims): THREE.Group {
	const group = new THREE.Group();
	const postThick = Math.min(0.05, depth * 0.15);

	for (const sx of [-1, 1]) {
		const post = makeMesh(
			new THREE.BoxGeometry(postThick, height, postThick),
			FRAME_COLOR,
		);
		post.position.set((width / 2 - postThick / 2) * sx, 0, 0);
		group.add(post);
	}

	const bar = makeMesh(
		new THREE.BoxGeometry(width - postThick, postThick, postThick),
		FRAME_COLOR,
		{ metalness: 0.4, roughness: 0.35 },
	);
	bar.position.set(0, height * 0.35, 0);
	group.add(bar);

	// Suggested hanging clothes block (uses fixture baseColor)
	const clothesMat = new THREE.MeshStandardMaterial({
		color: baseColor,
		roughness: 0.95,
		metalness: 0.05,
		transparent: true,
		opacity: 0.85,
	});
	const clothes = new THREE.Mesh(
		new THREE.BoxGeometry(width * 0.94, height * 0.55, depth * 0.7),
		clothesMat,
	);
	clothes.castShadow = true;
	clothes.receiveShadow = true;
	clothes.userData.isAssetDetail = true;
	clothes.position.set(0, -height * 0.05, 0);
	group.add(clothes);

	return group;
}

/** Folded clothing display table: top slab + 4 legs. */
function buildDisplayTable({
	width,
	depth,
	height,
	baseColor,
}: AssetDims): THREE.Group {
	const group = new THREE.Group();
	const topThick = Math.min(0.05, height * 0.08);
	const legThick = Math.min(0.05, Math.min(width, depth) * 0.08);

	const top = makeMesh(
		new THREE.BoxGeometry(width, topThick, depth),
		baseColor,
	);
	top.position.set(0, height / 2 - topThick / 2, 0);
	group.add(top);

	for (const sx of [-1, 1]) {
		for (const sz of [-1, 1]) {
			const leg = makeMesh(
				new THREE.BoxGeometry(legThick, height - topThick, legThick),
				FRAME_COLOR,
			);
			leg.position.set(
				(width / 2 - legThick) * sx,
				-topThick / 2,
				(depth / 2 - legThick) * sz,
			);
			group.add(leg);
		}
	}
	return group;
}

/** Mannequin: pedestal + tapered torso + sphere head. */
function buildMannequin({
	width,
	depth,
	height,
	baseColor,
}: AssetDims): THREE.Group {
	const group = new THREE.Group();
	const baseSize = Math.min(width, depth);

	const pedestal = makeMesh(
		new THREE.CylinderGeometry(
			baseSize * 0.45,
			baseSize * 0.5,
			height * 0.04,
			16,
		),
		FRAME_COLOR,
	);
	pedestal.position.set(0, -height / 2 + height * 0.02, 0);
	group.add(pedestal);

	const torso = makeMesh(
		new THREE.CylinderGeometry(
			baseSize * 0.18,
			baseSize * 0.3,
			height * 0.55,
			16,
		),
		baseColor,
	);
	torso.position.set(0, -height / 2 + height * 0.04 + height * 0.275, 0);
	group.add(torso);

	const neck = makeMesh(
		new THREE.CylinderGeometry(
			baseSize * 0.06,
			baseSize * 0.08,
			height * 0.06,
			12,
		),
		SKIN_COLOR,
	);
	neck.position.set(0, -height / 2 + height * 0.62, 0);
	group.add(neck);

	const head = makeMesh(
		new THREE.SphereGeometry(baseSize * 0.13, 16, 12),
		SKIN_COLOR,
	);
	head.position.set(0, -height / 2 + height * 0.78, 0);
	group.add(head);

	return group;
}

/** Counter / cashier: opaque front panel + thick top. */
function buildCounter({
	width,
	depth,
	height,
	baseColor,
}: AssetDims): THREE.Group {
	const group = new THREE.Group();
	const topThick = Math.min(0.06, height * 0.08);

	const body = makeMesh(
		new THREE.BoxGeometry(width, height - topThick, depth),
		baseColor,
	);
	body.position.set(0, -topThick / 2, 0);
	group.add(body);

	const top = makeMesh(
		new THREE.BoxGeometry(width * 1.04, topThick, depth * 1.04),
		ACCENT_COLOR,
		{ roughness: 0.4, metalness: 0.2 },
	);
	top.position.set(0, height / 2 - topThick / 2, 0);
	group.add(top);

	return group;
}

/** Fitting room: 3 walls + door gap on the front-right. */
function buildFittingRoom({
	width,
	depth,
	height,
	baseColor,
}: AssetDims): THREE.Group {
	const group = new THREE.Group();
	const wallThick = Math.min(0.04, Math.min(width, depth) * 0.05);

	// back
	const back = makeMesh(
		new THREE.BoxGeometry(width, height, wallThick),
		baseColor,
	);
	back.position.set(0, 0, -depth / 2 + wallThick / 2);
	group.add(back);
	// left
	const left = makeMesh(
		new THREE.BoxGeometry(wallThick, height, depth),
		baseColor,
	);
	left.position.set(-width / 2 + wallThick / 2, 0, 0);
	group.add(left);
	// right (with door cutout: shorter)
	const right = makeMesh(
		new THREE.BoxGeometry(wallThick, height, depth * 0.45),
		baseColor,
	);
	right.position.set(width / 2 - wallThick / 2, 0, -depth * 0.275);
	group.add(right);
	// front partial (top header above door)
	const header = makeMesh(
		new THREE.BoxGeometry(width, height * 0.18, wallThick),
		baseColor,
	);
	header.position.set(0, height / 2 - height * 0.09, depth / 2 - wallThick / 2);
	group.add(header);

	return group;
}

/** Bench: seat slab + 4 short legs. */
function buildBench({
	width,
	depth,
	height,
	baseColor,
}: AssetDims): THREE.Group {
	const group = new THREE.Group();
	const seatThick = Math.min(0.04, height * 0.18);
	const legThick = Math.min(0.04, Math.min(width, depth) * 0.1);

	const seat = makeMesh(
		new THREE.BoxGeometry(width, seatThick, depth),
		baseColor,
	);
	seat.position.set(0, height / 2 - seatThick / 2, 0);
	group.add(seat);

	for (const sx of [-1, 1]) {
		for (const sz of [-1, 1]) {
			const leg = makeMesh(
				new THREE.BoxGeometry(legThick, height - seatThick, legThick),
				FRAME_COLOR,
			);
			leg.position.set(
				(width / 2 - legThick) * sx,
				-seatThick / 2,
				(depth / 2 - legThick) * sz,
			);
			group.add(leg);
		}
	}
	return group;
}

/** Generic / unknown: thin floor marker — no fake box volume.
 * Real stores don't have plain boxes, so an unidentified fixture renders as a
 * subtle disc on the floor showing footprint + extracted color, not a full block.
 */
function buildGeneric({
	width,
	depth,
	height,
	baseColor,
}: AssetDims): THREE.Group {
	const group = new THREE.Group();
	const markerH = Math.min(0.04, height * 0.08);
	const slab = makeMesh(
		new THREE.BoxGeometry(width * 0.94, markerH, depth * 0.94),
		baseColor,
		{ roughness: 0.95 },
	);
	slab.position.set(0, -height / 2 + markerH / 2, 0);
	group.add(slab);
	return group;
}

/** Round 4-way clothing rack (procedural fallback). */
function buildApparelRackRound({
	width,
	depth,
	height,
	baseColor,
}: AssetDims): THREE.Group {
	const group = new THREE.Group();
	const r = Math.min(width, depth) * 0.05;
	const post = makeMesh(
		new THREE.CylinderGeometry(r, r, height * 0.96, 12),
		FRAME_COLOR,
	);
	post.position.set(0, 0, 0);
	group.add(post);
	for (const angDeg of [0, 90, 180, 270]) {
		const ang = (angDeg * Math.PI) / 180;
		const arm = makeMesh(
			new THREE.BoxGeometry(Math.min(width, depth) * 0.5, r, r),
			FRAME_COLOR,
		);
		arm.position.set(
			Math.cos(ang) * Math.min(width, depth) * 0.25,
			height * 0.3,
			-Math.sin(ang) * Math.min(width, depth) * 0.25,
		);
		arm.rotation.y = ang;
		group.add(arm);
		const cloth = makeMesh(
			new THREE.BoxGeometry(
				Math.min(width, depth) * 0.4,
				height * 0.5,
				depth * 0.1,
			),
			baseColor,
			{ roughness: 0.95 },
		);
		cloth.position.set(
			Math.cos(ang) * Math.min(width, depth) * 0.3,
			-height * 0.05,
			-Math.sin(ang) * Math.min(width, depth) * 0.3,
		);
		cloth.rotation.y = ang;
		group.add(cloth);
	}
	return group;
}

/** Wall-mounted clothing display (procedural fallback). */
function buildApparelRackWall({
	width,
	depth,
	height,
	baseColor,
}: AssetDims): THREE.Group {
	const group = new THREE.Group();
	const wallT = Math.min(0.04, depth * 0.2);
	const back = makeMesh(
		new THREE.BoxGeometry(width, height * 0.92, wallT),
		ACCENT_COLOR,
	);
	back.position.set(0, 0, -depth / 2 + wallT / 2);
	group.add(back);
	for (const yOff of [0.18, 0.05, -0.1]) {
		const bar = makeMesh(
			new THREE.BoxGeometry(width * 0.92, 0.025, 0.025),
			FRAME_COLOR,
		);
		bar.position.set(0, height * yOff, -depth * 0.18);
		group.add(bar);
	}
	const cloth = makeMesh(
		new THREE.BoxGeometry(width * 0.85, height * 0.55, depth * 0.45),
		baseColor,
		{ roughness: 0.95 },
	);
	cloth.position.set(0, -height * 0.05, depth * 0.05);
	group.add(cloth);
	return group;
}

/** Two-tier hanging rack (upper + lower bars). */
function buildApparelRackDouble({
	width,
	depth,
	height,
	baseColor,
}: AssetDims): THREE.Group {
	const group = new THREE.Group();
	const legT = Math.min(0.04, depth * 0.1);
	for (const sx of [-1, 1]) {
		const leg = makeMesh(
			new THREE.BoxGeometry(legT, height, legT),
			FRAME_COLOR,
		);
		leg.position.set((width / 2 - legT / 2) * sx, 0, 0);
		group.add(leg);
	}
	for (const y of [0.35, -0.1]) {
		const bar = makeMesh(
			new THREE.BoxGeometry(width - legT, 0.025, 0.025),
			FRAME_COLOR,
		);
		bar.position.set(0, height * y, 0);
		group.add(bar);
	}
	const top = makeMesh(
		new THREE.BoxGeometry(width * 0.92, height * 0.4, depth * 0.6),
		baseColor,
		{ roughness: 0.95 },
	);
	top.position.set(0, height * 0.13, 0);
	group.add(top);
	const bottom = makeMesh(
		new THREE.BoxGeometry(width * 0.92, height * 0.32, depth * 0.6),
		baseColor,
		{ roughness: 0.95 },
	);
	bottom.position.set(0, -height * 0.3, 0);
	group.add(bottom);
	return group;
}

/** Center island clothing display (rectangle base + perimeter posts + clothes). */
function buildApparelIsland({
	width,
	depth,
	height,
	baseColor,
}: AssetDims): THREE.Group {
	const group = new THREE.Group();
	const platform = makeMesh(
		new THREE.BoxGeometry(width, height * 0.08, depth),
		ACCENT_COLOR,
	);
	platform.position.set(0, -height / 2 + height * 0.04, 0);
	group.add(platform);
	const legT = Math.min(0.04, Math.min(width, depth) * 0.08);
	for (const sx of [-1, 1]) {
		for (const sz of [-1, 1]) {
			const post = makeMesh(
				new THREE.BoxGeometry(legT, height * 0.85, legT),
				FRAME_COLOR,
			);
			post.position.set((width / 2 - legT) * sx, 0, (depth / 2 - legT) * sz);
			group.add(post);
		}
	}
	for (const sz of [-1, 1]) {
		const cloth = makeMesh(
			new THREE.BoxGeometry(width * 0.92, height * 0.55, depth * 0.3),
			baseColor,
			{ roughness: 0.95 },
		);
		cloth.position.set(0, -height * 0.05, depth * 0.3 * sz);
		group.add(cloth);
	}
	return group;
}

/** Low shoe island table (flat top + 4 legs + shoe pair indicators). */
function buildShoeIsland({
	width,
	depth,
	height,
	baseColor,
}: AssetDims): THREE.Group {
	const group = new THREE.Group();
	const topT = Math.min(0.06, height * 0.08);
	const top = makeMesh(new THREE.BoxGeometry(width, topT, depth), baseColor);
	top.position.set(0, height / 2 - topT / 2, 0);
	group.add(top);
	const legT = Math.min(0.05, Math.min(width, depth) * 0.08);
	for (const sx of [-1, 1]) {
		for (const sz of [-1, 1]) {
			const leg = makeMesh(
				new THREE.BoxGeometry(legT, height - topT, legT),
				FRAME_COLOR,
			);
			leg.position.set(
				(width / 2 - legT) * sx,
				-topT / 2,
				(depth / 2 - legT) * sz,
			);
			group.add(leg);
		}
	}
	return group;
}

export function buildAssetVisual(
	assetType: string | undefined,
	dims: AssetDims,
): THREE.Group {
	switch (assetType) {
		case "shoe_wall":
			return buildShoeWall(dims);
		case "shoe_gondola":
			return buildShoeGondola(dims);
		case "shoe_island":
			return buildShoeIsland(dims);
		case "apparel_rack":
			return buildApparelRack(dims);
		case "apparel_rack_round":
			return buildApparelRackRound(dims);
		case "apparel_rack_wall":
			return buildApparelRackWall(dims);
		case "apparel_rack_double":
			return buildApparelRackDouble(dims);
		case "apparel_island":
			return buildApparelIsland(dims);
		case "display_table":
			return buildDisplayTable(dims);
		case "mannequin":
			return buildMannequin(dims);
		case "counter":
			return buildCounter(dims);
		case "fitting_room":
			return buildFittingRoom(dims);
		case "bench":
			return buildBench(dims);
		default:
			return buildGeneric(dims);
	}
}

/** Dispose all geometries/materials in a group recursively. */
export function disposeGroup(group: THREE.Object3D): void {
	group.traverse((obj) => {
		// biome-ignore lint/suspicious/noExplicitAny: Three.js mesh
		const mesh = obj as any;
		if (mesh.geometry) mesh.geometry.dispose?.();
		if (mesh.material) {
			if (Array.isArray(mesh.material)) {
				for (const m of mesh.material as THREE.Material[]) m.dispose();
			} else {
				mesh.material.dispose?.();
			}
		}
	});
}
