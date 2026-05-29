import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ENV_STORE_ADAPTER } from "../store.adapter";
import type { UpdateStoreRequest } from "../store.types";

export function useUpdateStore(storeId: number) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (req: UpdateStoreRequest) =>
			ENV_STORE_ADAPTER.updateStore(storeId, req),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["stores", "my"] });
			queryClient.invalidateQueries({ queryKey: ["stores", storeId] });
		},
	});
}
