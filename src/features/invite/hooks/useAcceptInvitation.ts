import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ENV_INVITE_ADAPTER } from "../invite.adapter";

export function useAcceptInvitation() {
	const navigate = useNavigate();
	return useMutation({
		mutationFn: ENV_INVITE_ADAPTER.acceptInvitation,
		onSuccess: () => {
			navigate({ to: "/stores" });
		},
	});
}
