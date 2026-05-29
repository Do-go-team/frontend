export interface FixtureItem {
	fixture_id: number;
	name: string;
	width: number;
	height: number;
	depth: number;
	created_at: string;
}

export interface GetFixturesResponse {
	fixtures: FixtureItem[];
}

export interface FixtureAsset3D {
	model_url: string;
	file_format: string;
	file_size?: number;
}

export interface FixtureDetail {
	fixture_id: number;
	name: string;
	dimensions: {
		width: number;
		height: number;
		depth: number;
	};
	asset_3d: FixtureAsset3D | null;
	created_at: string;
	updated_at: string;
}

export interface CreateFixtureRequest {
	name: string;
	width: number;
	height: number;
	depth: number;
}

export interface CreateFixtureResponse {
	fixture_id: number;
	name: string;
	width: number;
	height: number;
	depth: number;
	created_at: string;
}

export interface UpdateFixtureRequest {
	name?: string;
	width?: number;
	height?: number;
	depth?: number;
}

export interface UpdateFixtureResponse {
	fixture_id: number;
	name: string;
	width: number;
	height: number;
	depth: number;
	updated_at: string;
}

// Fixture Versions
export interface FixtureVersion {
	version_id: number;
	version_name: string;
	created_at: string;
	updated_at: string;
}

export interface GetFixtureVersionsResponse {
	fixture_id: number;
	versions: FixtureVersion[];
}

export interface CreateFixtureVersionRequest {
	version_name: string;
}

export interface CreateFixtureVersionResponse {
	version_id: number;
	fixture_id: number;
	version_name: string;
	created_at: string;
}

// Fixture Placements
export interface PlacementVariant {
	variant_id: number;
	sku_code: string | null;
}

export interface PlacementItem {
	placement_id: number;
	local_pos_x: number;
	local_pos_y: number;
	local_pos_z: number;
	status: string;
	memo: string | null;
	variant: PlacementVariant;
}

export interface GetPlacementsResponse {
	version_id: number;
	placements: PlacementItem[];
}

export interface PlacementInput {
	placement_id?: number;
	variant_id: number;
	local_pos_x: number;
	local_pos_y: number;
	local_pos_z: number;
	status?: string;
	memo?: string;
}

export interface UpdatePlacementsRequest {
	placements: PlacementInput[];
}

export interface UpdatePlacementsResponse {
	version_id: number;
	updated_count: number;
	deleted_count?: number;
	updated_at: string;
}
