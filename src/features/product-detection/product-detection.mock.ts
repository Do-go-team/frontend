import type { ProductDetectionAdapter } from "./product-detection.adapter";
import type {
	DetectionTask,
	DetectionTaskCreateResponse,
} from "./product-detection.types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const taskStore = new Map<number, DetectionTask>();
let nextTaskId = 1;

function buildMockTask(taskId: number): DetectionTask {
	return {
		detection_task_id: taskId,
		status: "COMPLETED",
		error_message: null,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		started_at: new Date().toISOString(),
		finished_at: new Date().toISOString(),
		items: [0, 1, 2].map((slot) => ({
			detection_item_id: taskId * 100 + slot,
			slot,
			thumbnail_key: `mock/${taskId}/${slot}.png`,
			thumbnail_url: "/banner.png",
			relative_position: {
				x: 0.2 + slot * 0.18,
				y: 0.35,
			},
			relative_size: {
				width: 0.12,
				height: 0.18,
			},
			status: "DETECTED",
			asset_generation_status: "NOT_REQUESTED",
			asset_generation_task_id: null,
			asset_3d_id: null,
			asset_3d_url: null,
			confidence: 0.87,
			bbox_xyxy: [80 + slot * 120, 120, 180 + slot * 120, 260],
		})),
	};
}

export const mockProductDetectionAdapter: ProductDetectionAdapter = {
	async createTask(): Promise<DetectionTaskCreateResponse> {
		await delay(300);
		const taskId = nextTaskId++;
		taskStore.set(taskId, buildMockTask(taskId));
		return {
			detection_task_id: taskId,
			status: "PENDING",
		};
	},

	async getTask(
		taskId: number,
		options = { includeRejected: false },
	): Promise<DetectionTask> {
		await delay(400);
		const task = taskStore.get(taskId);
		if (!task) {
			throw new Error("탐지 작업을 찾을 수 없습니다.");
		}
		if (options.includeRejected ?? false) return task;
		return {
			...task,
			items: task.items.filter((item) => item.status !== "REJECTED"),
		};
	},

	async rejectItem({ taskId, itemId }) {
		await delay(200);
		const task = taskStore.get(taskId);
		if (!task) {
			throw new Error("탐지 작업을 찾을 수 없습니다.");
		}
		const item = task.items.find((item) => item.detection_item_id === itemId);
		if (!item) {
			throw new Error("탐지 상품 후보를 찾을 수 없습니다.");
		}
		if (
			item.asset_generation_status === "PENDING" ||
			item.asset_generation_status === "PROCESSING" ||
			item.asset_generation_status === "COMPLETED" ||
			item.asset_3d_id !== null
		) {
			throw new Error("이미 3D 생성이 진행된 후보는 제외할 수 없습니다.");
		}
		item.status = "REJECTED";
		return {
			detection_task_id: taskId,
			detection_item_id: itemId,
			status: "REJECTED" as const,
		};
	},
};
