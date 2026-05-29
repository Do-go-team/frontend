import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ENV_INVITE_ADAPTER } from "../invite.adapter";
import type { CreateInvitationRequest } from "../invite.types";

export function useCreateInvitation(storeId: number) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (req: CreateInvitationRequest) =>
			ENV_INVITE_ADAPTER.createInvitation(storeId, req),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["stores", storeId, "members"],
			});
		},
	});
}
