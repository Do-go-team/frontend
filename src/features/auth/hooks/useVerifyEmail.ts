import { useMutation } from "@tanstack/react-query";
import { ENV_AUTH_ADAPTER } from "../auth.adapter";
import type { VerifyEmailRequest } from "../auth.types";

export function useVerifyEmail() {
	return useMutation({
		mutationFn: (req: VerifyEmailRequest) => ENV_AUTH_ADAPTER.verifyEmail(req),
	});
}
