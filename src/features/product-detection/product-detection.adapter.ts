import { mockProductDetectionAdapter } from "./product-detection.mock";
import { restProductDetectionAdapter } from "./product-detection.rest";
import type {
	Asset3DTask,
	DetectionTask,
	DetectionTaskCreateResponse,
	Generate3DResponse,
	RejectDetectionItemResponse,
} from "./product-detection.types";

export type {
	Asset3DTask,
	DetectionTask,
	DetectionTaskCreateResponse,
	Generate3DResponse,
	RejectDetectionItemResponse,
};

export interface ProductDetectionAdapter {
	createTask: (params: {
		fixtureId: number;
		file: File;
		storeId?: number;
		fixtureVersionId?: number;
	}) => Promise<DetectionTaskCreateResponse>;
	getTask: (
		taskId: number,
		options?: { includeRejected?: boolean },
	) => Promise<DetectionTask>;
	generate3D: (params: {
		taskId: number;
		selectedItemIds: number[];
		rejectUnselected?: boolean;
	}) => Promise<Generate3DResponse>;
	getAsset3DTask: (taskId: number) => Promise<Asset3DTask>;
	rejectItem: (params: {
		taskId: number;
		itemId: number;
	}) => Promise<RejectDetectionItemResponse>;
}

export const ENV_PRODUCT_DETECTION_ADAPTER: ProductDetectionAdapter =
	import.meta.env.VITE_USE_MOCK === "true"
		? mockProductDetectionAdapter
		: restProductDetectionAdapter;
