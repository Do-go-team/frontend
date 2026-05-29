import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ENV_LAYOUT_ADAPTER } from "../layout.adapter";
import type { CreateLayoutRequest } from "../layout.types";

export function useCreateLayout(storeId: number) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (req: CreateLayoutRequest) =>
			ENV_LAYOUT_ADAPTER.createLayout(storeId, req),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["layouts", storeId] });
		},
	});
}
