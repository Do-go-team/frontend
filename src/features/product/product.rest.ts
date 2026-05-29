import { http } from "@/shared/api/http";
import type {
	CreateProductRequest,
	CreateProductResponse,
	DeleteProductResponse,
	GetProductsResponse,
	ProductDetailResponse,
	UpdateProductRequest,
	UpdateProductResponse,
} from "./product.types";

export const productRest = {
	getProducts: (): Promise<GetProductsResponse> => http.get("/products"),

	getProductDetail: (productId: number): Promise<ProductDetailResponse> =>
		http.get(`/products/${productId}/variants`),

	createProduct: (req: CreateProductRequest): Promise<CreateProductResponse> =>
		http.post("/products", req),

	updateProduct: (
		productId: number,
		req: UpdateProductRequest,
	): Promise<UpdateProductResponse> =>
		http.patch(`/products/${productId}`, buildUpdateProductFormData(req)),

	deleteProduct: (productId: number): Promise<DeleteProductResponse> =>
		http.delete(`/products/${productId}`),
};

function buildUpdateProductFormData(req: UpdateProductRequest) {
	const formData = new FormData();
	formData.append("data", JSON.stringify(req));
	return formData;
}
