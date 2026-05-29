import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ENV_EMPLOYEE_ADAPTER } from "../employee.adapter";
import type { UpdateMemberRoleRequest } from "../employee.types";

export function useUpdateMemberRole(storeId: number) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			userId,
			req,
		}: {
			userId: number;
			req: UpdateMemberRoleRequest;
		}) => ENV_EMPLOYEE_ADAPTER.updateMemberRole(storeId, userId, req),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["stores", storeId, "members"],
			});
		},
	});
}
