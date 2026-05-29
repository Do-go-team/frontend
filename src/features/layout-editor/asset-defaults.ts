import type { FixtureAssetType } from "./layout.types";

/**
 * Default fixture heights (cm) for fashion/shoe outlet stores.
 * Based on typical fixture spec used by Nike / Under Armour / Adidas / New Balance / Asics / ABC Mart outlets.
 */
export const DEFAULT_HEIGHT_CM: Record<FixtureAssetType, number> = {
	shoe_wall: 240,
	shoe_gondola: 150,
	shoe_pyramid: 130,
	shoe_island: 90,
	apparel_rack: 180,
	apparel_rack_round: 170,
	apparel_rack_wall: 200,
	apparel_rack_double: 200,
	apparel_island: 175,
	apparel_stack_table: 110,
	display_table: 90,
	mannequin: 180,
	counter: 100,
	fitting_room: 220,
	bench: 45,
	cafe_counter: 110,
	cafe_table: 75,
	cafe_seat_round: 75,
	pastry_display: 130,
	coffee_machine: 60,
	generic: 60, // intentionally low — rendered as a thin floor marker, not a box
	shoes_test: 15,
	fixtures_test: 15,
};

export function defaultHeightForAssetType(
	assetType: FixtureAssetType | string | undefined,
): number {
	if (!assetType) return DEFAULT_HEIGHT_CM.generic;
	const key = assetType as FixtureAssetType;
	return DEFAULT_HEIGHT_CM[key] ?? DEFAULT_HEIGHT_CM.generic;
}

/**
 * Natural footprint range per asset (in floor units, 1 unit ≈ 1cm).
 * Used by auto-match to score how well a fixture's box fits an asset type.
 *
 * - ratioMin/ratioMax = natural width/depth ratio range
 * - areaMin/areaMax = sanity bounds in cm²
 */
export interface AssetFootprint {
	ratioMin: number;
	ratioMax: number;
	areaMin: number;
	areaMax: number;
}

export const ASSET_FOOTPRINT: Record<FixtureAssetType, AssetFootprint> = {
	shoe_wall: { ratioMin: 3.0, ratioMax: 12.0, areaMin: 6_000, areaMax: 60_000 },
	shoe_gondola: {
		ratioMin: 0.6,
		ratioMax: 2.0,
		areaMin: 8_000,
		areaMax: 30_000,
	},
	shoe_pyramid: {
		ratioMin: 0.7,
		ratioMax: 1.4,
		areaMin: 5_000,
		areaMax: 25_000,
	},
	shoe_island: {
		ratioMin: 0.8,
		ratioMax: 1.6,
		areaMin: 8_000,
		areaMax: 50_000,
	},
	apparel_rack: {
		ratioMin: 1.5,
		ratioMax: 6.0,
		areaMin: 3_000,
		areaMax: 25_000,
	},
	apparel_rack_round: {
		ratioMin: 0.8,
		ratioMax: 1.3,
		areaMin: 6_400,
		areaMax: 22_500,
	},
	apparel_rack_wall: {
		ratioMin: 2.0,
		ratioMax: 12.0,
		areaMin: 3_000,
		areaMax: 30_000,
	},
	apparel_rack_double: {
		ratioMin: 1.2,
		ratioMax: 4.0,
		areaMin: 5_000,
		areaMax: 25_000,
	},
	apparel_island: {
		ratioMin: 0.7,
		ratioMax: 2.0,
		areaMin: 15_000,
		areaMax: 80_000,
	},
	apparel_stack_table: {
		ratioMin: 0.7,
		ratioMax: 1.6,
		areaMin: 6_000,
		areaMax: 30_000,
	},
	display_table: {
		ratioMin: 0.7,
		ratioMax: 2.0,
		areaMin: 5_000,
		areaMax: 30_000,
	},
	mannequin: { ratioMin: 0.6, ratioMax: 1.6, areaMin: 900, areaMax: 6_400 },
	counter: { ratioMin: 1.5, ratioMax: 5.0, areaMin: 6_000, areaMax: 40_000 },
	fitting_room: {
		ratioMin: 0.6,
		ratioMax: 1.7,
		areaMin: 6_400,
		areaMax: 40_000,
	},
	bench: { ratioMin: 1.5, ratioMax: 4.0, areaMin: 1_800, areaMax: 12_000 },
	cafe_counter: {
		ratioMin: 2.0,
		ratioMax: 6.0,
		areaMin: 8_000,
		areaMax: 50_000,
	},
	cafe_table: { ratioMin: 0.7, ratioMax: 1.5, areaMin: 2_500, areaMax: 12_000 },
	cafe_seat_round: {
		ratioMin: 0.8,
		ratioMax: 1.3,
		areaMin: 1_000,
		areaMax: 4_000,
	},
	pastry_display: {
		ratioMin: 1.5,
		ratioMax: 4.0,
		areaMin: 6_000,
		areaMax: 30_000,
	},
	coffee_machine: {
		ratioMin: 0.7,
		ratioMax: 2.0,
		areaMin: 2_500,
		areaMax: 12_000,
	},
	generic: { ratioMin: 0.05, ratioMax: 20, areaMin: 0, areaMax: Infinity },
	shoes_test: { ratioMin: 0.5, ratioMax: 2.0, areaMin: 100, areaMax: 10_000 },
	fixtures_test: {
		ratioMin: 0.5,
		ratioMax: 2.0,
		areaMin: 100,
		areaMax: 10_000,
	},
};

/**
 * Score how well a fixture's footprint matches an asset type.
 * Returns 0 (very bad fit) to 1 (perfect natural size).
 */
export function footprintScore(
	fixtureWidth: number,
	fixtureDepth: number,
	assetType: FixtureAssetType,
): number {
	const fp = ASSET_FOOTPRINT[assetType] ?? ASSET_FOOTPRINT.generic;
	const longSide = Math.max(fixtureWidth, fixtureDepth);
	const shortSide = Math.max(1, Math.min(fixtureWidth, fixtureDepth));
	const ratio = longSide / shortSide;
	const area = fixtureWidth * fixtureDepth;

	// Ratio fit: 1 if inside range, decays linearly outside.
	let ratioFit = 1;
	if (ratio < fp.ratioMin) {
		ratioFit = Math.max(0, 1 - (fp.ratioMin - ratio) / fp.ratioMin);
	} else if (ratio > fp.ratioMax) {
		ratioFit = Math.max(0, 1 - (ratio - fp.ratioMax) / fp.ratioMax);
	}

	// Area fit: 1 if inside range, log-scale decay outside.
	let areaFit = 1;
	if (area < fp.areaMin) {
		areaFit = Math.max(0, area / Math.max(1, fp.areaMin));
	} else if (area > fp.areaMax) {
		areaFit = Math.max(0, fp.areaMax / Math.max(1, area));
	}

	return ratioFit * 0.6 + areaFit * 0.4;
}

/** Zone categories → permitted asset types (used to gate auto-match). */
export type ZoneCategory =
	| "shoe"
	| "apparel"
	| "fitting"
	| "checkout"
	| "cafe"
	| "common";

export const ZONE_TO_ASSET_TYPES: Record<ZoneCategory, FixtureAssetType[]> = {
	shoe: ["shoe_wall", "shoe_gondola", "shoe_pyramid", "shoe_island", "bench"],
	apparel: [
		"apparel_rack",
		"apparel_rack_round",
		"apparel_rack_wall",
		"apparel_rack_double",
		"apparel_island",
		"apparel_stack_table",
		"display_table",
		"mannequin",
	],
	fitting: ["fitting_room", "bench"],
	checkout: ["counter"],
	cafe: [
		"cafe_counter",
		"cafe_table",
		"cafe_seat_round",
		"pastry_display",
		"coffee_machine",
		"bench",
	],
	common: [],
};

export const ZONE_CATEGORY_LABEL: Record<ZoneCategory, string> = {
	shoe: "신발 구역",
	apparel: "의류 구역",
	fitting: "피팅 구역",
	checkout: "계산 구역",
	cafe: "카페 구역",
	common: "공용",
};

export const ZONE_CATEGORY_COLOR: Record<ZoneCategory, string> = {
	shoe: "#3b82f6", // blue
	apparel: "#a855f7", // purple
	fitting: "#f59e0b", // amber
	checkout: "#10b981", // emerald
	cafe: "#d97706", // brown/coffee
	common: "#94a3b8", // slate
};
