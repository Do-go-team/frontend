import { mockStoreAdapter } from "./store.mock";
import { restStoreAdapter } from "./store.rest";
import type {
	CreateStoreRequest,
	CreateStoreResponse,
	DeleteStoreResponse,
	GetMyStoresResponse,
	GetStoreDetailResponse,
	UpdateStoreRequest,
	UpdateStoreResponse,
	UploadFloorplanResponse,
} from "./store.types";

export interface StoreAdapter {
	createStore: (req: CreateStoreRequest) => Promise<CreateStoreResponse>;
	getMyStores: () => Promise<GetMyStoresResponse>;
	getStoreDetail: (storeId: number) => Promise<GetStoreDetailResponse>;
	updateStore: (
		storeId: number,
		req: UpdateStoreRequest,
	) => Promise<UpdateStoreResponse>;
	deleteStore: (storeId: number) => Promise<DeleteStoreResponse>;
	uploadFloorplan: (
		storeId: number,
		file: File,
	) => Promise<UploadFloorplanResponse>;
}

// VITE_USE_MOCK=true 또는 VITE_MOCK_STORE=true 이면 mock 사용
export const ENV_STORE_ADAPTER: StoreAdapter =
	import.meta.env.VITE_USE_MOCK === "true" ||
	import.meta.env.VITE_MOCK_STORE === "true"
		? mockStoreAdapter
		: restStoreAdapter;
