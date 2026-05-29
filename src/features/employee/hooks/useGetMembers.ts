import { useSuspenseQuery } from "@tanstack/react-query";
import { ENV_EMPLOYEE_ADAPTER } from "../employee.adapter";

export function useGetMembers(storeId: number) {
	return useSuspenseQuery({
		queryKey: ["stores", storeId, "members"],
		queryFn: () => ENV_EMPLOYEE_ADAPTER.getMembers(storeId),
	});
}
