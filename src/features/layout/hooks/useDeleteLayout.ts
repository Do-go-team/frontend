import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ENV_LAYOUT_ADAPTER } from "../layout.adapter";

export function useDeleteLayout(storeId: number) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (layoutId: number) => ENV_LAYOUT_ADAPTER.deleteLayout(layoutId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["layouts", storeId] });
		},
	});
}
