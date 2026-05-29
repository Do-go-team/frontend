import { ApiError } from "@/shared/types/api.types";
import type { StoreAdapter } from "./store.adapter";
import type { StoreItem } from "./store.types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let nextId = 3;
const mockStores: StoreItem[] = [
	{
		store_id: 1,
		name: "DO-GO 홍대 본점",
		width: 5000,
		height: 3000,
		depth: 4500,
		my_role: "OWNER",
		floorplan_image_url: null,
		actual_photo_url: null,
		created_at: "2026-01-10T11:00:00Z",
	},
	{
		store_id: 2,
		name: "DO-GO 강남 팝업스토어",
		width: 3000,
		height: 2800,
		depth: 3000,
		my_role: "VMD",
		floorplan_image_url: null,
		actual_photo_url: null,
		created_at: "2026-03-05T14:30:00Z",
	},
];

export const mockStoreAdapter: StoreAdapter = {
	updateStore: async (storeId, req) => {
		await delay(300);
		const store = mockStores.find((s) => s.store_id === storeId);
		if (!store) throw new ApiError("NOT_FOUND", "매장을 찾을 수 없습니다.");
		if (req.name) store.name = req.name;
		if (req.width) store.width = req.width;
		if (req.height) store.height = req.height;
		if (req.depth) store.depth = req.depth;
		return {
			store_id: store.store_id,
			name: store.name,
			address: "",
			width: store.width,
			height: store.height,
			depth: store.depth,
			updated_at: new Date().toISOString(),
		};
	},
	deleteStore: async (storeId) => {
		await delay(300);
		const idx = mockStores.findIndex((s) => s.store_id === storeId);
		if (idx === -1) throw new ApiError("NOT_FOUND", "매장을 찾을 수 없습니다.");
		mockStores.splice(idx, 1);
		return null;
	},
	createStore: async (req) => {
		await delay(300);
		const newStore: StoreItem = {
			store_id: nextId++,
			name: req.name,
			width: req.width,
			height: req.height,
			depth: req.depth,
			my_role: "OWNER",
			floorplan_image_url: req.floorplan_image_url ?? null,
			actual_photo_url: req.actual_photo_url ?? null,
			created_at: new Date().toISOString(),
		};
		mockStores.push(newStore);
		return {
			store_id: newStore.store_id,
			name: newStore.name,
			address: req.address,
			width: newStore.width,
			height: newStore.height,
			depth: newStore.depth,
			created_at: newStore.created_at,
		};
	},
	getMyStores: async () => {
		await delay(300);
		return { stores: [...mockStores] };
	},
	getStoreDetail: async (storeId) => {
		await delay(300);
		const store = mockStores.find((s) => s.store_id === storeId);
		if (!store) throw new ApiError("NOT_FOUND", "매장을 찾을 수 없습니다.");
		return {
			...store,
			floorplan_image_url: store.floorplan_image_url ?? null,
			actual_photo_url: store.actual_photo_url ?? null,
			updated_at: store.created_at,
		};
	},
	uploadFloorplan: async (storeId, file) => {
		await delay(300);
		const store = mockStores.find((s) => s.store_id === storeId);
		if (!store) throw new ApiError("NOT_FOUND", "매장을 찾을 수 없습니다.");
		const url = URL.createObjectURL(file);
		store.floorplan_image_url = url;
		return {
			store_id: storeId,
			floorplan_image_url: url,
			updated_at: new Date().toISOString(),
		};
	},
};
