import { http } from "@/shared/api/http";
import type {
	AssignStoreProductsRequest,
	AssignStoreProductsResponse,
	GetStoreProductsResponse,
	RemoveStoreProductResponse,
	UpdateStoreProductRequest,
	UpdateStoreProductResponse,
} from "./store-product.types";

export const storeProductRest = {
	getStoreProducts: (storeId: number): Promise<GetStoreProductsResponse> =>
		http.get(`/stores/${storeId}/products`),

	assignProducts: (
		storeId: number,
		req: AssignStoreProductsRequest,
	): Promise<AssignStoreProductsResponse> =>
		http.post(`/stores/${storeId}/products`, req),

	updateStoreProduct: (
		storeId: number,
		productId: number,
		req: UpdateStoreProductRequest,
	): Promise<UpdateStoreProductResponse> =>
		http.patch(`/stores/${storeId}/products/${productId}`, req),

	removeStoreProduct: (
		storeId: number,
		productId: number,
	): Promise<RemoveStoreProductResponse> =>
		http.delete(`/stores/${storeId}/products/${productId}`),
};
