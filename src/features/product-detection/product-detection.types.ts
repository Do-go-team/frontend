export type DetectionTaskStatus =
	| "PENDING"
	| "PROCESSING"
	| "COMPLETED"
	| "FAILED";

export type DetectionItemStatus =
	| "DETECTED"
	| "SELECTED"
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
	thumbnail_url: string | null;
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
	bbox_xyxy: number[] | null;
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

export interface Generate3DRequest {
	selected_item_ids: number[];
	reject_unselected?: boolean;
}

export interface Generate3DResponse {
	detection_task_id: number;
	created_task_count: number;
	selected_item_ids: number[];
	rejected_item_ids: number[];
	skipped_reject_item_ids: number[];
	asset_generation_task_ids: number[];
}

export type Asset3DTaskStatus =
	| "PENDING"
	| "PROCESSING"
	| "COMPLETED"
	| "FAILED";

export interface Asset3DTask {
	task_id: number;
	target_type: string;
	target_id: number;
	source_image_url: string;
	status: Asset3DTaskStatus;
	result_url: string | null;
	asset_3d_id: number | null;
	error_message: string | null;
}

export interface RejectDetectionItemResponse {
	detection_task_id: number;
	detection_item_id: number;
	status: "REJECTED";
}
