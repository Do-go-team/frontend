import { mockAuthAdapter } from "./auth.mock";
import { restAuthAdapter } from "./auth.rest";
import type {
	LoginRequest,
	LoginResponse,
	MeResponse,
	SendEmailCodeRequest,
	SendEmailCodeResponse,
	SignupRequest,
	SignupResponse,
	VerifyEmailRequest,
	VerifyEmailResponse,
} from "./auth.types";

export interface AuthAdapter {
	sendEmailCode: (req: SendEmailCodeRequest) => Promise<SendEmailCodeResponse>;
	verifyEmail: (req: VerifyEmailRequest) => Promise<VerifyEmailResponse>;
	signup: (req: SignupRequest) => Promise<SignupResponse>;
	login: (req: LoginRequest) => Promise<LoginResponse>;
	getMe: () => Promise<MeResponse>;
	logout: () => Promise<void>;
}

export const ENV_AUTH_ADAPTER: AuthAdapter =
	import.meta.env.VITE_USE_MOCK === "true" ? mockAuthAdapter : restAuthAdapter;
