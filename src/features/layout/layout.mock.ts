import type { LayoutAdapter } from "./layout.adapter";
import type {
	CopyFixturesRequest,
	CreateLayoutRequest,
	LayoutDetail,
	LayoutFixture,
	LayoutItem,
	UpdateLayoutRequest,
} from "./layout.types";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const mockLayouts: Map<number, LayoutItem[]> = new Map();
const mockLayoutDetails: Map<number, LayoutDetail> = new Map();
let nextLayoutId = 100;
let nextLayoutFixtureId = 1000;

function createEmptyLayoutDetail(
	layout: LayoutItem,
	storeId: number,
): LayoutDetail {
	return {
		layout_id: layout.layout_id,
		store_id: storeId,
		name: layout.name,
		comment: layout.comment,
		is_active: layout.is_active,
		store_dimensions: { width: 10000, height: 3000, depth: 8000 },
		fixtures: [],
	};
}

function cloneDetail(detail: LayoutDetail): LayoutDetail {
	return structuredClone(detail) as LayoutDetail;
}

export const mockLayoutAdapter: LayoutAdapter = {
	getLayouts: async (storeId) => {
		await delay(300);
		return { layouts: mockLayouts.get(storeId) ?? [] };
	},

	createLayout: async (storeId, req: CreateLayoutRequest) => {
		await delay(300);
		const layouts = mockLayouts.get(storeId) ?? [];
		const newLayout: LayoutItem = {
			layout_id: nextLayoutId++,
			name: req.name,
			comment: req.comment ?? null,
			is_active: req.is_active ?? false,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};
		if (newLayout.is_active) {
			for (const l of layouts) l.is_active = false;
		}
		layouts.unshift(newLayout);
		mockLayouts.set(storeId, layouts);
		mockLayoutDetails.set(
			newLayout.layout_id,
			createEmptyLayoutDetail(newLayout, storeId),
		);
		return {
			layout_id: newLayout.layout_id,
			store_id: storeId,
			name: newLayout.name,
			comment: newLayout.comment,
			is_active: newLayout.is_active,
			created_at: newLayout.created_at,
		};
	},

	deleteLayout: async (layoutId) => {
		await delay(300);
		for (const [storeId, layouts] of mockLayouts.entries()) {
			const idx = layouts.findIndex((l) => l.layout_id === layoutId);
			if (idx !== -1) {
				if (layouts[idx].is_active) {
					throw new Error("활성 레이아웃은 삭제할 수 없습니다.");
				}
				layouts.splice(idx, 1);
				mockLayouts.set(storeId, layouts);
				mockLayoutDetails.delete(layoutId);
				return { deleted_layout_id: layoutId };
			}
		}
		throw new Error("레이아웃을 찾을 수 없습니다.");
	},

	getLayoutDetail: async (layoutId) => {
		await delay(300);
		for (const [storeId, layouts] of mockLayouts.entries()) {
			const layout = layouts.find((l) => l.layout_id === layoutId);
			if (layout) {
				const detail =
					mockLayoutDetails.get(layoutId) ??
					createEmptyLayoutDetail(layout, storeId);
				mockLayoutDetails.set(layoutId, detail);
				return cloneDetail(detail);
			}
		}
		throw new Error("레이아웃을 찾을 수 없습니다.");
	},

	exportPdf: async () => {
		await delay(500);
		return {
			file_id: "mock-pdf-id",
			file_name: "layout-export.pdf",
			download_url: "#",
			expires_at: new Date(Date.now() + 3600_000).toISOString(),
		};
	},

	updateLayout: async (layoutId, req: UpdateLayoutRequest) => {
		await delay(300);
		for (const [storeId, layouts] of mockLayouts.entries()) {
			const layout = layouts.find((l) => l.layout_id === layoutId);
			if (layout) {
				if (req.name !== undefined) layout.name = req.name;
				if (req.comment !== undefined) layout.comment = req.comment;
				if (req.is_active !== undefined) {
					if (req.is_active) {
						for (const l of layouts) l.is_active = false;
						for (const detail of mockLayoutDetails.values()) {
							if (detail.store_id === storeId) detail.is_active = false;
						}
					}
					layout.is_active = req.is_active;
				}
				layout.updated_at = new Date().toISOString();
				const detail =
					mockLayoutDetails.get(layoutId) ??
					createEmptyLayoutDetail(layout, storeId);
				detail.name = layout.name;
				detail.comment = layout.comment;
				detail.is_active = layout.is_active;
				if (req.fixtures) {
					const fixturesById = new Map(
						detail.fixtures.map((fixture) => [
							fixture.layout_fixture_id,
							fixture,
						]),
					);
					detail.fixtures = req.fixtures.map((fixtureReq) => {
						const existing =
							typeof fixtureReq.layout_fixture_id === "number"
								? fixturesById.get(fixtureReq.layout_fixture_id)
								: undefined;
						const layoutFixtureId =
							fixtureReq.layout_fixture_id ??
							existing?.layout_fixture_id ??
							nextLayoutFixtureId++;
						const nextFixture: LayoutFixture = {
							layout_fixture_id: layoutFixtureId,
							fixture_id: existing?.fixture_id ?? layoutFixtureId,
							fixture_version_id: (existing?.fixture_version_id ?? 0) + 1,
							world_pos_x: fixtureReq.world_pos_x ?? existing?.world_pos_x ?? 0,
							world_pos_y: fixtureReq.world_pos_y ?? existing?.world_pos_y ?? 0,
							world_pos_z: fixtureReq.world_pos_z ?? existing?.world_pos_z ?? 0,
							world_rot_y: fixtureReq.world_rot_y ?? existing?.world_rot_y ?? 0,
							is_locked: fixtureReq.is_locked ?? existing?.is_locked ?? false,
							width: fixtureReq.width ?? existing?.width ?? 100,
							height: fixtureReq.height ?? existing?.height ?? 200,
							depth: fixtureReq.depth ?? existing?.depth ?? 100,
							fixture_info: existing?.fixture_info ?? {
								name: "집기",
								width: fixtureReq.width ?? 100,
								height: fixtureReq.height ?? 200,
								depth: fixtureReq.depth ?? 100,
								asset_3d: null,
							},
						};
						return nextFixture;
					});
				}
				mockLayoutDetails.set(layoutId, detail);
				return cloneDetail(detail);
			}
		}
		throw new Error("레이아웃을 찾을 수 없습니다.");
	},

	copyFixtures: async (layoutId, req: CopyFixturesRequest) => {
		await delay(300);
		const detail = mockLayoutDetails.get(layoutId);
		if (!detail) throw new Error("레이아웃을 찾을 수 없습니다.");

		const copied = req.layout_fixture_ids.flatMap((sourceId) => {
			const source = detail.fixtures.find(
				(fixture) => fixture.layout_fixture_id === sourceId,
			);
			if (!source) return [];
			const newLayoutFixtureId = nextLayoutFixtureId++;
			const newFixtureVersionId = (source.fixture_version_id ?? 0) + 1000;
			detail.fixtures.push({
				...source,
				layout_fixture_id: newLayoutFixtureId,
				fixture_version_id: newFixtureVersionId,
			});
			return [
				{
					source_layout_fixture_id: sourceId,
					new_layout_fixture_id: newLayoutFixtureId,
					new_fixture_version_id: newFixtureVersionId,
				},
			];
		});

		return {
			layout_id: layoutId,
			copied_count: copied.length,
			copied,
		};
	},
};
