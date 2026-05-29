import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ENV_STORE_ADAPTER } from "../store.adapter";

export function useDeleteStore() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (storeId: number) => ENV_STORE_ADAPTER.deleteStore(storeId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["stores", "my"] });
		},
	});
}
