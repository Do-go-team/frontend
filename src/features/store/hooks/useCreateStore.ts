import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ENV_STORE_ADAPTER } from "../store.adapter";
import type { CreateStoreRequest } from "../store.types";

export function useCreateStore() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (req: CreateStoreRequest) => ENV_STORE_ADAPTER.createStore(req),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["stores", "my"] });
		},
	});
}
