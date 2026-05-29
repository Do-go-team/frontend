import { useSuspenseQuery } from "@tanstack/react-query";
import { ENV_AUTH_ADAPTER } from "../auth.adapter";

export function useMe() {
	return useSuspenseQuery({
		queryKey: ["me"],
		queryFn: () => ENV_AUTH_ADAPTER.getMe(),
		staleTime: 1000 * 60 * 5,
	});
}
