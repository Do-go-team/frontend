export interface ProductVariant {
	id: number;
	size: string | null;
	color: string | null;
	sku_code: string | null;
	barcode_image_url: string | null;
}

export interface ProductAsset3D {
	file_format: string;
	model_url: string;
}

export interface ProductItem {
	id: number;
	name: string | null;
	price: number | null;
	image_url: string | null;
	width: number;
	height: number;
	depth: number | null;
	asset_3d: ProductAsset3D | null;
	variants: ProductVariant[];
}

export interface GetProductsResponse {
	products: ProductItem[];
}

export interface ProductDetailResponse extends ProductItem {
	product_id: number;
}

export interface ProductCaptureItem {
	image_url: string;
	width: number;
	height: number;
}

export interface CreateProductRequest {
	store_id: number;
	products: ProductCaptureItem[];
	create_3d_task?: boolean;
	auto_create_3d_task?: boolean;
}

export interface ProductCreatedItem {
	master_id: number;
	variant_id: number;
	image_url: string;
	width: number;
	height: number;
	created_at: string;
}

export interface CreateProductResponse {
	products: ProductCreatedItem[];
}

export interface UpdateProductVariantInput {
	variant_id?: number;
	size?: string;
	color?: string;
	sku_code?: string;
	barcode_image_url?: string;
}

export interface UpdateProductRequest {
	name?: string;
	price?: number;
	width?: number;
	height?: number;
	depth?: number | null;
	variants?: UpdateProductVariantInput[];
}

export interface UpdateProductResponse {
	product_id: number;
	name: string | null;
	synced_variants_count: number;
	deleted_variants_count: number;
	updated_at: string;
	variants?: Array<{
		variant_id: number;
		size: string | null;
		color: string | null;
		sku_code: string | null;
		barcode_image_url: string | null;
	}>;
}

export interface DeleteProductResponse {
	deleted_product_id: number;
	deleted_variants_count: number;
}
