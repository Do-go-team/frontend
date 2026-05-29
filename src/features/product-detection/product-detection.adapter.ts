import { mockProductDetectionAdapter } from "./product-detection.mock";
import { restProductDetectionAdapter } from "./product-detection.rest";
import type {
	DetectionTask,
	DetectionTaskCreateResponse,
	RejectDetectionItemResponse,
} from "./product-detection.types";

export type {
	DetectionTask,
	DetectionTaskCreateResponse,
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
	rejectItem: (params: {
		taskId: number;
		itemId: number;
	}) => Promise<RejectDetectionItemResponse>;
}

export const ENV_PRODUCT_DETECTION_ADAPTER: ProductDetectionAdapter =
	import.meta.env.VITE_USE_MOCK === "true"
		? mockProductDetectionAdapter
		: restProductDetectionAdapter;
