import { useSuspenseQuery } from "@tanstack/react-query";
import { ENV_LAYOUT_ADAPTER } from "../layout.adapter";

export function useGetLayoutDetail(layoutId: number) {
	return useSuspenseQuery({
		queryKey: ["layouts", "detail", layoutId],
		queryFn: () => ENV_LAYOUT_ADAPTER.getLayoutDetail(layoutId),
	});
}
