export interface LayoutItem {
	layout_id: number;
	name: string;
	comment: string | null;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface GetLayoutsResponse {
	layouts: LayoutItem[];
}

export interface CreateLayoutRequest {
	name: string;
	comment?: string;
	is_active?: boolean;
}

export interface CreateLayoutResponse {
	layout_id: number;
	store_id: number;
	name: string;
	comment: string | null;
	is_active: boolean;
	created_at: string;
}

export interface DeleteLayoutResponse {
	deleted_layout_id: number;
}

export interface StoreDimensions {
	width: number;
	height: number;
	depth: number;
}

export interface Asset3D {
	file_format: string;
	model_url: string;
}

export interface FixtureInfo {
	name: string;
	width: number;
	height: number;
	depth: number;
	asset_3d: Asset3D | null;
}

export interface LayoutFixture {
	layout_fixture_id: number;
	fixture_id: number;
	fixture_version_id: number;
	world_pos_x: number;
	world_pos_y: number;
	world_pos_z: number;
	world_rot_y: number;
	is_locked: boolean;
	/** Instance-level footprint width (X axis, cm) */
	width: number;
	/** Instance-level vertical height (Y axis, cm) */
	height: number;
	/** Instance-level footprint depth (Z axis, cm) */
	depth: number;
	fixture_info: FixtureInfo;
}

export interface LayoutDetail {
	layout_id: number;
	store_id: number;
	name: string;
	comment: string | null;
	is_active: boolean;
	floorplan_image_url?: string | null;
	store_dimensions: StoreDimensions;
	fixtures: LayoutFixture[];
}

export interface UpdateLayoutFixtureInput {
	layout_fixture_id?: number;
	fixture_id?: number;
	fixture_version_id?: number;
	world_pos_x?: number;
	world_pos_y?: number;
	world_pos_z?: number;
	world_rot_y?: number;
	is_locked?: boolean;
	/** Instance-level footprint width (X axis, cm) */
	width?: number;
	/** Instance-level vertical height (Y axis, cm) */
	height?: number;
	/** Instance-level footprint depth (Z axis, cm) */
	depth?: number;
}

export interface CopyFixturesRequest {
	layout_fixture_ids: number[];
}

export interface CopyFixturesResponse {
	layout_id: number;
	copied_count: number;
	copied?: Array<{
		source_layout_fixture_id: number;
		new_layout_fixture_id: number;
		new_fixture_version_id: number;
	}>;
}

export interface UpdateLayoutRequest {
	name?: string;
	comment?: string;
	is_active?: boolean;
	fixtures?: UpdateLayoutFixtureInput[];
}

export interface UpdateLayoutResponse {
	layout_id: number;
	name?: string | null;
	is_active?: boolean | null;
	updated_at: string;
	fixtures_updated_count?: number;
	fixtures_deleted_count?: number;
}

// PDF Export
export interface ExportLayoutPdfRequest {
	paper_size?: "A4" | "A3" | "A2";
	orientation?: "portrait" | "landscape";
	include_labels?: boolean;
	show_grid?: boolean;
}

export interface ExportLayoutPdfResponse {
	file_id: string;
	file_name: string;
	download_url: string;
	expires_at: string;
}
