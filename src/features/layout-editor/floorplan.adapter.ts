import { http } from "@/shared/api/http";

export interface FloorplanAdapter {
	upload: (
		storeId: number,
		file: File,
	) => Promise<{ floorplan_image_url: string }>;
}

const mockFloorplanAdapter: FloorplanAdapter = {
	upload: async (_storeId, file) => {
		await new Promise((resolve) => setTimeout(resolve, 300));
		const url = URL.createObjectURL(file);
		return { floorplan_image_url: url };
	},
};

const restFloorplanAdapter: FloorplanAdapter = {
	upload: async (storeId, file) => {
		const formData = new FormData();
		formData.append("file", file);
		return http.post<{ floorplan_image_url: string }>(
			`/stores/${storeId}/floorplan`,
			formData,
		);
	},
};

export const ENV_FLOORPLAN_ADAPTER: FloorplanAdapter =
	import.meta.env.VITE_USE_MOCK === "true"
		? mockFloorplanAdapter
		: restFloorplanAdapter;
