import { useSuspenseQuery } from "@tanstack/react-query";
import { ENV_STORE_ADAPTER } from "../store.adapter";

export function useGetStoreDetail(storeId: number) {
	return useSuspenseQuery({
		queryKey: ["stores", storeId],
		queryFn: () => ENV_STORE_ADAPTER.getStoreDetail(storeId),
	});
}
