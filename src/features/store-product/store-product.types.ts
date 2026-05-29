export interface StoreProductVariant {
	id: number;
	size: string | null;
	color: string | null;
	sku_code: string | null;
	barcode_image_url: string | null;
	stock_quantity: number;
	is_discontinued?: boolean;
}

export interface StoreProductItem {
	id: number;
	name: string | null;
	price: number | null;
	status: "ACTIVE" | "PAUSED" | "DISCONTINUED";
	width: number;
	height: number;
	depth: number | null;
	image_url: string | null;
	model_url: string | null;
	variants: StoreProductVariant[];
}

export interface GetStoreProductsResponse {
	products: StoreProductItem[];
}

export interface AssignStoreProductsRequest {
	product_ids: number[];
}

export interface AssignStoreProductsResponse {
	assigned_count: number;
	total_count: number;
}

export interface UpdateStoreProductRequest {
	status: "ACTIVE" | "PAUSED";
}

export interface UpdateStoreProductResponse {
	product_id: number;
	status: "ACTIVE" | "PAUSED";
	updated_at: string;
}

export interface RemoveStoreProductResponse {
	deleted_product_id: number;
	total_count: number;
}
