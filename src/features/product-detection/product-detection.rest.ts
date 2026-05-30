import { http } from "@/shared/api/http";
import type {
	Asset3DTask,
	DetectionTask,
	DetectionTaskCreateResponse,
	Generate3DResponse,
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

	async generate3D({
		taskId,
		selectedItemIds,
		rejectUnselected = false,
	}): Promise<Generate3DResponse> {
		return http.post<Generate3DResponse>(
			`/products/detection-tasks/${taskId}/generate-3d`,
			{
				selected_item_ids: selectedItemIds,
				reject_unselected: rejectUnselected,
			},
		);
	},

	async getAsset3DTask(taskId: number): Promise<Asset3DTask> {
		return http.get<Asset3DTask>(`/assets/3d-tasks/${taskId}`);
	},

	async rejectItem({ taskId, itemId }): Promise<RejectDetectionItemResponse> {
		return http.patch<RejectDetectionItemResponse>(
			`/products/detection-tasks/${taskId}/items/${itemId}/reject`,
		);
	},
};
