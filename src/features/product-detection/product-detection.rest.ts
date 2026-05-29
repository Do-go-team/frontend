import { http } from "@/shared/api/http";
import type {
	DetectionTask,
	DetectionTaskCreateResponse,
	ProductDetectionAdapter,
	RejectDetectionItemResponse,
} from "./product-detection.adapter";

export const restProductDetectionAdapter: ProductDetectionAdapter = {
	async createTask({
		fixtureId,
		file,
		storeId,
		fixtureVersionId,
	}): Promise<DetectionTaskCreateResponse> {
		const formData = new FormData();
		formData.append("image", file);
		if (storeId) {
			formData.append("store_id", String(storeId));
		}
		if (fixtureVersionId) {
			formData.append("fixture_version_id", String(fixtureVersionId));
		}
		return http.post<DetectionTaskCreateResponse>(
			`/fixtures/${fixtureId}/detect-products`,
			formData,
		);
	},

	async getTask(
		taskId: number,
		options = { includeRejected: false },
	): Promise<DetectionTask> {
		const includeRejected = options.includeRejected ?? false;
		return http.get<DetectionTask>(
			`/products/detection-tasks/${taskId}?include_rejected=${includeRejected}`,
		);
	},

	async rejectItem({ taskId, itemId }): Promise<RejectDetectionItemResponse> {
		return http.patch<RejectDetectionItemResponse>(
			`/products/detection-tasks/${taskId}/items/${itemId}/reject`,
		);
	},
};
