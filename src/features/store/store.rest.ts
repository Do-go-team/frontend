import { http } from "@/shared/api/http";
import type { StoreAdapter } from "./store.adapter";

export const restStoreAdapter: StoreAdapter = {
	createStore: (req) => http.post("/users/me/stores", req),
	getMyStores: () => http.get("/users/me/stores"),
	getStoreDetail: (storeId) => http.get(`/stores/${storeId}`),
	updateStore: (storeId, req) => http.patch(`/stores/${storeId}`, req),
	deleteStore: (storeId) => http.delete(`/stores/${storeId}`),
	uploadFloorplan: (storeId, file) => {
		const formData = new FormData();
		formData.append("file", file);
		return http.post(`/stores/${storeId}/floorplan`, formData);
	},
};
