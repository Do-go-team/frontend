export interface CreateStoreRequest {
	name: string;
	address: string;
	width: number;
	height: number;
	depth: number;
	floorplan_image_url?: string;
	actual_photo_url?: string;
}

export interface CreateStoreResponse {
	store_id: number;
	name: string;
	address: string;
	width: number;
	height: number;
	depth: number;
	created_at: string;
}

export interface StoreItem {
	store_id: number;
	name: string;
	width: number;
	height: number;
	depth: number;
	my_role: "OWNER" | "MANAGER" | "VICE_MANAGER" | "VMD" | "STAFF";
	floorplan_image_url?: string | null;
	actual_photo_url?: string | null;
	created_at: string;
}

export interface GetMyStoresResponse {
	stores: StoreItem[];
}

export interface StoreDetail {
	store_id: number;
	name: string;
	width: number;
	height: number;
	depth: number;
	my_role: "OWNER" | "MANAGER" | "VICE_MANAGER" | "VMD" | "STAFF";
	floorplan_image_url: string | null;
	actual_photo_url: string | null;
	created_at: string;
	updated_at: string;
}

export interface GetStoreDetailResponse extends StoreDetail {}

export interface UpdateStoreRequest {
	name?: string | null;
	address?: string | null;
	width?: number | null;
	height?: number | null;
	depth?: number | null;
	floorplan_image_url?: string | null;
	actual_photo_url?: string | null;
}

export interface UpdateStoreResponse {
	store_id: number;
	name: string;
	address: string;
	width: number;
	height: number;
	depth: number;
	updated_at: string;
}

export type DeleteStoreResponse = null;

export interface UploadFloorplanResponse {
	store_id: number;
	floorplan_image_url: string;
	updated_at: string;
}
