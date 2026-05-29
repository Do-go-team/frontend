import { useMutation } from "@tanstack/react-query";
import { ENV_AUTH_ADAPTER } from "../auth.adapter";
import type { SignupRequest } from "../auth.types";

export function useSignup() {
	return useMutation({
		mutationFn: (req: SignupRequest) => ENV_AUTH_ADAPTER.signup(req),
	});
}
