import { http } from "@/shared/api/http";
import type { LayoutAdapter } from "./layout.adapter";

export const restLayoutAdapter: LayoutAdapter = {
	getLayouts: (storeId) => http.get(`/stores/${storeId}/layouts`),
	createLayout: (storeId, req) => http.post(`/stores/${storeId}/layouts`, req),
	deleteLayout: (layoutId) => http.delete(`/layouts/${layoutId}`),
	getLayoutDetail: (layoutId) => http.get(`/layouts/${layoutId}`),
	updateLayout: (layoutId, req) => http.patch(`/layouts/${layoutId}`, req),
	copyFixtures: (layoutId, req) =>
		http.post(`/layouts/${layoutId}/fixtures:copy`, req),
	exportPdf: (storeId, layoutId, req) =>
		http.post(`/stores/${storeId}/layouts/${layoutId}/export`, req ?? {}),
};
