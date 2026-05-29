import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";
import { ENV_AUTH_ADAPTER } from "../auth.adapter";
import type { LoginRequest } from "../auth.types";

export function useLogin() {
	const { setLoggedIn } = useAuth();
	return useMutation({
		mutationFn: (req: LoginRequest) => ENV_AUTH_ADAPTER.login(req),
		onSuccess: () => {
			setLoggedIn(true);
		},
	});
}
