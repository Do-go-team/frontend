import { useMutation } from "@tanstack/react-query";
import { ENV_AUTH_ADAPTER } from "../auth.adapter";
import type { SendEmailCodeRequest } from "../auth.types";

export function useSendEmailCode() {
	return useMutation({
		mutationFn: (req: SendEmailCodeRequest) =>
			ENV_AUTH_ADAPTER.sendEmailCode(req),
	});
}
