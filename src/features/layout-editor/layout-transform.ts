import type { Fixture, LayoutJSON } from "./layout.types";

export const FLOOR_UNIT_SCALE = 0.01;
export const DEFAULT_FIXTURE_HEIGHT = 80;
export const MIN_FIXTURE_SIZE = 8;
const MAX_AUTO_FIXTURE_HEIGHT = 220;

export function getFloorSize(layout: LayoutJSON | null) {
	return {
		width: Number(layout?.floorWidth ?? 1),
		height: Number(layout?.floorHeight ?? 1),
	};
}

export function getFixtureHeight(fixture: Fixture): number {
	const footprintWidth = Math.max(
		MIN_FIXTURE_SIZE,
		Number(fixture?.width ?? MIN_FIXTURE_SIZE),
	);
	const footprintDepth = Math.max(
		MIN_FIXTURE_SIZE,
		Number(fixture?.height ?? MIN_FIXTURE_SIZE),
	);
	const autoHeight = Math.min(
		MAX_AUTO_FIXTURE_HEIGHT,
		Math.max(
			DEFAULT_FIXTURE_HEIGHT,
			Math.round(Math.min(footprintWidth, footprintDepth) * 0.9),
		),
	);

	return Math.max(
		MIN_FIXTURE_SIZE,
		Number(fixture?.model3d?.height ?? autoHeight),
	);
}

export interface SceneBox {
	width: number;
	depth: number;
	height: number;
	sceneWidth: number;
	sceneDepth: number;
	sceneHeight: number;
	x: number;
	y: number;
	z: number;
}

export function fixtureToSceneBox(
	fixture: Fixture,
	layout: LayoutJSON,
): SceneBox {
	const floor = getFloorSize(layout);
	const width = Math.max(
		MIN_FIXTURE_SIZE,
		Number(fixture.width ?? MIN_FIXTURE_SIZE),
	);
	const depth = Math.max(
		MIN_FIXTURE_SIZE,
		Number(fixture.height ?? MIN_FIXTURE_SIZE),
	);
	const height = getFixtureHeight(fixture);

	return {
		width,
		depth,
		height,
		sceneWidth: width * FLOOR_UNIT_SCALE,
		sceneDepth: depth * FLOOR_UNIT_SCALE,
		sceneHeight: height * FLOOR_UNIT_SCALE,
		x:
			(Number(fixture.x ?? 0) + width / 2 - floor.width / 2) * FLOOR_UNIT_SCALE,
		y: (height * FLOOR_UNIT_SCALE) / 2,
		z:
			(Number(fixture.y ?? 0) + depth / 2 - floor.height / 2) *
			FLOOR_UNIT_SCALE,
	};
}

export function scalePolygonToBox(
	fixture: Fixture,
	patch: { x: number; y: number; width: number; height: number },
): [number, number][] {
	const oldWidth = Math.max(1, Number(fixture.width ?? 1));
	const oldHeight = Math.max(1, Number(fixture.height ?? 1));
	const oldX = Number(fixture.x ?? 0);
	const oldY = Number(fixture.y ?? 0);

	if (!fixture.polygon) return [];

	return fixture.polygon.map(([px, py]) => [
		patch.x + ((Number(px) - oldX) / oldWidth) * patch.width,
		patch.y + ((Number(py) - oldY) / oldHeight) * patch.height,
	]);
}

export function sceneBoxToFixturePatch(
	mesh: {
		position: { x: number; z: number };
		scale: { x: number; y: number; z: number };
		userData: { baseFixture: { width: number; depth: number; height: number } };
	},
	fixture: Fixture,
	layout: LayoutJSON,
): Partial<Fixture> {
	const floor = getFloorSize(layout);
	const base = mesh.userData.baseFixture;
	const scaleX = Math.max(0.05, mesh.scale.x);
	const scaleY = Math.max(0.05, mesh.scale.y);
	const scaleZ = Math.max(0.05, mesh.scale.z);

	const width = Math.max(MIN_FIXTURE_SIZE, Math.round(base.width * scaleX));
	const depth = Math.max(MIN_FIXTURE_SIZE, Math.round(base.depth * scaleZ));
	const height = Math.max(MIN_FIXTURE_SIZE, Math.round(base.height * scaleY));
	const x = clamp(
		Math.round(
			mesh.position.x / FLOOR_UNIT_SCALE + floor.width / 2 - width / 2,
		),
		0,
		Math.max(0, floor.width - width),
	);
	const y = clamp(
		Math.round(
			mesh.position.z / FLOOR_UNIT_SCALE + floor.height / 2 - depth / 2,
		),
		0,
		Math.max(0, floor.height - depth),
	);

	const patch: Partial<Fixture> = {
		x,
		y,
		width,
		height: depth,
		model3d: {
			...(fixture.model3d ?? {}),
			height,
		},
	};

	if (Array.isArray(fixture.polygon) && fixture.polygon.length > 2) {
		patch.polygon = scalePolygonToBox(fixture, { x, y, width, height: depth });
	}

	return patch;
}

const CONTAINMENT_TOLERANCE = 1;
const CONTAINER_AREA_RATIO = 1.15;

export function isContainerFixture(
	fixture: Fixture,
	fixtures: Fixture[],
	selfIndex: number,
): boolean {
	const ax1 = Number(fixture?.x ?? 0);
	const ay1 = Number(fixture?.y ?? 0);
	const aw = Number(fixture?.width ?? 0);
	const ah = Number(fixture?.height ?? 0);
	if (aw <= 0 || ah <= 0) return false;

	const ax2 = ax1 + aw;
	const ay2 = ay1 + ah;
	const areaA = aw * ah;

	for (let i = 0; i < fixtures.length; i++) {
		if (i === selfIndex) continue;
		const other = fixtures[i];
		const bw = Number(other?.width ?? 0);
		const bh = Number(other?.height ?? 0);
		if (bw <= 0 || bh <= 0) continue;
		const bx1 = Number(other?.x ?? 0);
		const by1 = Number(other?.y ?? 0);
		const bx2 = bx1 + bw;
		const by2 = by1 + bh;
		const areaB = bw * bh;
		if (areaB * CONTAINER_AREA_RATIO > areaA) continue;
		if (
			bx1 >= ax1 - CONTAINMENT_TOLERANCE &&
			by1 >= ay1 - CONTAINMENT_TOLERANCE &&
			bx2 <= ax2 + CONTAINMENT_TOLERANCE &&
			by2 <= ay2 + CONTAINMENT_TOLERANCE
		) {
			return true;
		}
	}
	return false;
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export function clampScenePosition(
	mesh: {
		position: { x: number; z: number };
		scale: { x: number; z: number };
		userData: { baseFixture: { width: number; depth: number } };
	},
	layout: LayoutJSON,
) {
	const floor = getFloorSize(layout);
	const base = mesh.userData.baseFixture;
	const width = base.width * Math.max(0.05, mesh.scale.x);
	const depth = base.depth * Math.max(0.05, mesh.scale.z);
	const minX = (-floor.width / 2 + width / 2) * FLOOR_UNIT_SCALE;
	const maxX = (floor.width / 2 - width / 2) * FLOOR_UNIT_SCALE;
	const minZ = (-floor.height / 2 + depth / 2) * FLOOR_UNIT_SCALE;
	const maxZ = (floor.height / 2 - depth / 2) * FLOOR_UNIT_SCALE;

	mesh.position.x = clamp(
		mesh.position.x,
		Math.min(minX, maxX),
		Math.max(minX, maxX),
	);
	mesh.position.z = clamp(
		mesh.position.z,
		Math.min(minZ, maxZ),
		Math.max(minZ, maxZ),
	);
}
