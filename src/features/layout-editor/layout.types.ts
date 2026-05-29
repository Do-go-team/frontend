export type FixtureAssetType =
	| "shoe_wall"
	| "shoe_gondola"
	| "shoe_pyramid"
	| "shoe_island"
	| "apparel_rack"
	| "apparel_rack_round"
	| "apparel_rack_wall"
	| "apparel_rack_double"
	| "apparel_island"
	| "apparel_stack_table"
	| "display_table"
	| "mannequin"
	| "counter"
	| "fitting_room"
	| "bench"
	| "cafe_counter"
	| "cafe_table"
	| "cafe_seat_round"
	| "pastry_display"
	| "coffee_machine"
	| "generic"
	| "shoes_test"
	| "fixtures_test";

export interface FixtureMaterial {
	baseColor?: string;
	textureUrl?: string;
	roughness?: number;
}

export interface FixtureDetectionItemPreview {
	detectionItemId: number;
	name?: string;
	thumbnailUrl: string;
	relativePosition: {
		x: number;
		y: number;
	};
	relativeSize: {
		width: number;
		height: number;
	};
	confidence: number | null;
	assetGenerationStatus?: string;
	asset3dUrl?: string | null;
}

export interface FixtureDetectionPreview {
	sourceImageUrl?: string | null;
	taskId: number | null;
	taskStatus: "IDLE" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
	taskUpdatedAt?: string | null;
	errorMessage?: string | null;
	items: FixtureDetectionItemPreview[];
	deletedDetectionItemIds?: number[];
}

export interface Fixture {
	id: string;
	type: string;
	label: string;
	shape: "rect" | "polygon";
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	confidence?: number;
	polygon: [number, number][] | null;
	model3d?: { height?: number; assetUrl?: string };
	assetType?: FixtureAssetType;
	photoBindingId?: string;
	material?: FixtureMaterial;
	locked?: boolean;
	layoutFixtureId?: number | null;
	fixtureVersionId?: number | null;
	fixtureId?: number | null;
	detectionPreview?: FixtureDetectionPreview | null;
	apiMeta?: {
		layoutFixtureId?: number;
		fixtureVersionId?: number;
		worldPosY?: number;
	};
}

export type ZoneCategory =
	| "shoe"
	| "apparel"
	| "fitting"
	| "checkout"
	| "cafe"
	| "common";

export interface Zone {
	id: string;
	name: string;
	category: ZoneCategory;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface LayoutJSON {
	floorWidth: number;
	floorHeight: number;
	floorImageUrl?: string | null;
	fixtures: Fixture[];
	products: unknown[];
	zones?: Zone[];
}
