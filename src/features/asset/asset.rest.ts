import { http } from "@/shared/api/http";
import type {
	Upload3DAssetRequest,
	Upload3DAssetResponse,
} from "./asset.types";

export const assetRest = {
	upload3DAsset: ({
		file,
		target_type,
		target_id,
	}: Upload3DAssetRequest): Promise<Upload3DAssetResponse> => {
		const formData = new FormData();
		formData.append("file", file);
		formData.append("target_type", target_type);
		formData.append("target_id", String(target_id));
		return http.post("/assets/3d", formData);
	},
};
