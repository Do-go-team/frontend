export type DetectionTaskStatus =
	| "PENDING"
	| "PROCESSING"
	| "COMPLETED"
	| "FAILED";

export type DetectionItemStatus =
	| "DETECTED"
	| "FAILED"
	| "REGISTERED"
	| "REJECTED";

export type AssetGenerationStatus =
	| "NOT_REQUESTED"
	| "PENDING"
	| "PROCESSING"
	| "COMPLETED"
	| "FAILED";

export interface DetectionItem {
	detection_item_id: number;
	slot: number;
	thumbnail_key: string;
	thumbnail_url: string;
	relative_position: {
		x: number;
		y: number;
	};
	relative_size: {
		width: number;
		height: number;
	};
	status: DetectionItemStatus;
	asset_generation_status: AssetGenerationStatus;
	asset_generation_task_id: number | null;
	asset_3d_id: number | null;
	asset_3d_url: string | null;
	confidence: number | null;
	bbox_xyxy: [number, number, number, number];
}

export interface DetectionTask {
	detection_task_id: number;
	status: DetectionTaskStatus;
	error_message: string | null;
	created_at: string;
	updated_at: string;
	started_at: string | null;
	finished_at: string | null;
	items: DetectionItem[];
}

export interface DetectionTaskCreateResponse {
	detection_task_id: number;
	status: DetectionTaskStatus;
}

export interface RejectDetectionItemResponse {
	detection_task_id: number;
	detection_item_id: number;
	status: "REJECTED";
}
