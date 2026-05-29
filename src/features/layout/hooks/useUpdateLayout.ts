import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ENV_LAYOUT_ADAPTER } from "../layout.adapter";
import type { UpdateLayoutRequest } from "../layout.types";

export function useUpdateLayout(storeId: number) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			layoutId,
			req,
		}: {
			layoutId: number;
			req: UpdateLayoutRequest;
		}) => ENV_LAYOUT_ADAPTER.updateLayout(layoutId, req),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: ["layouts", storeId] });
			queryClient.invalidateQueries({
				queryKey: ["layouts", "detail", variables.layoutId],
			});
		},
	});
}
