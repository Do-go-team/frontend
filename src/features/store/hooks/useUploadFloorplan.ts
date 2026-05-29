import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ENV_STORE_ADAPTER } from "../store.adapter";

export function useUploadFloorplan(storeId: number) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (file: File) =>
			ENV_STORE_ADAPTER.uploadFloorplan(storeId, file),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["stores", "my"] });
			queryClient.invalidateQueries({ queryKey: ["stores", storeId] });
		},
	});
}
