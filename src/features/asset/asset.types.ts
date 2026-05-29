export type AssetTargetType = "PRODUCT" | "FIXTURE" | "STORE";

export interface Upload3DAssetRequest {
	file: File;
	target_type: AssetTargetType;
	target_id: number;
}

export interface Upload3DAssetResponse {
	asset_id: number;
	target_type: AssetTargetType;
	target_id: number;
	file_format: string;
	model_url: string;
	file_size_bytes: number;
}
