import { useSuspenseQuery } from "@tanstack/react-query";
import { ENV_LAYOUT_ADAPTER } from "../layout.adapter";

export function useGetLayouts(storeId: number) {
	return useSuspenseQuery({
		queryKey: ["layouts", storeId],
		queryFn: () => ENV_LAYOUT_ADAPTER.getLayouts(storeId),
	});
}
