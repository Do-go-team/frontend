import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";
import { ENV_AUTH_ADAPTER } from "../auth.adapter";

export function useLogout() {
	const { setLoggedIn } = useAuth();
	return useMutation({
		mutationFn: () => ENV_AUTH_ADAPTER.logout(),
		onSettled: () => {
			setLoggedIn(false);
			window.location.replace("/landing");
		},
	});
}
