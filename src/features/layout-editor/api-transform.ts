/**
 * Converts between the REST API LayoutDetail format and the editor's LayoutJSON format.
 *
 * Coordinate conventions:
 *  - API: world_pos_x/z are the CENTER of the fixture footprint (cm)
 *  - Editor: fixture.x / fixture.y are the TOP-LEFT corner (cm)
 *  - Floor: floorWidth = store_dimensions.width, floorHeight = store_dimensions.depth
 */

import type {
	LayoutDetail,
	UpdateLayoutFixtureInput,
} from "@/features/layout/layout.types";
import type { Fixture, LayoutJSON } from "./layout.types";

export function layoutDetailToEditorJSON(detail: LayoutDetail): LayoutJSON {
	const fixtures: Fixture[] = detail.fixtures.map((f) => ({
		layoutFixtureId: f.layout_fixture_id,
		fixtureVersionId: f.fixture_version_id,
		fixtureId: f.fixture_id,
		id: String(f.layout_fixture_id),
		type: f.fixture_info.name,
		label: f.fixture_info.name,
		shape: "rect" as const,
		x: f.world_pos_x - f.width / 2,
		y: f.world_pos_z - f.depth / 2,
		width: f.width,
		height: f.depth,
		rotation: f.world_rot_y,
		polygon: null,
		model3d: { height: f.height },
		locked: f.is_locked === true,
		apiMeta: {
			layoutFixtureId: f.layout_fixture_id,
			fixtureVersionId: f.fixture_version_id,
			worldPosY: f.world_pos_y,
		},
	}));

	return {
		floorWidth: detail.store_dimensions.width,
		floorHeight: detail.store_dimensions.depth,
		fixtures,
		products: [],
	};
}

function finiteNumber(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positiveNumber(value: unknown, fallback: number): number {
	return Math.max(1, finiteNumber(value, fallback));
}

function normalizeRotation(value: unknown): number {
	const rotation = Math.round(finiteNumber(value, 0));
	return ((rotation % 360) + 360) % 360;
}

export function editorFixturesToApiItems(
	fixtures: Fixture[],
): UpdateLayoutFixtureInput[] {
	const items: UpdateLayoutFixtureInput[] = [];
	for (const f of fixtures) {
		const layoutFixtureId =
			f.apiMeta?.layoutFixtureId ?? f.layoutFixtureId ?? Number(f.id);
		const fixtureId = f.fixtureId ?? undefined;
		const fixtureVersionId =
			f.apiMeta?.fixtureVersionId ?? f.fixtureVersionId ?? undefined;
		const hasLayoutFixtureId =
			Number.isFinite(layoutFixtureId) && layoutFixtureId > 0;
		if (!hasLayoutFixtureId && !fixtureId && !fixtureVersionId) continue;

		const width = positiveNumber(f.width, 1);
		const depth = positiveNumber(f.height, 1);
		const x = finiteNumber(f.x, 0);
		const z = finiteNumber(f.y, 0);
		const height = positiveNumber(f.model3d?.height ?? f.height, depth);

		items.push({
			layout_fixture_id: hasLayoutFixtureId ? layoutFixtureId : undefined,
			fixture_id: fixtureId,
			fixture_version_id: fixtureVersionId,
			world_pos_x: Math.round(x + width / 2),
			world_pos_y: Math.round(finiteNumber(f.apiMeta?.worldPosY, 0)),
			world_pos_z: Math.round(z + depth / 2),
			world_rot_y: normalizeRotation(f.rotation),
			is_locked: f.locked === true,
			width: Math.round(width),
			height: Math.round(height),
			depth: Math.round(depth),
		});
	}
	return items;
}
