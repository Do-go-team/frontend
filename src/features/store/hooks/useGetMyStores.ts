import { useSuspenseQuery } from "@tanstack/react-query";
import { ENV_STORE_ADAPTER } from "../store.adapter";

export function useGetMyStores() {
	return useSuspenseQuery({
		queryKey: ["stores", "my"],
		queryFn: () => ENV_STORE_ADAPTER.getMyStores(),
	});
}
