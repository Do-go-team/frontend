import { http } from "@/shared/api/http";
import type { AuthAdapter } from "./auth.adapter";

export const restAuthAdapter: AuthAdapter = {
	sendEmailCode: (req) => http.post("/users/email/send", req),
	verifyEmail: (req) => http.post("/users/email/verify", req),
	signup: (req) => http.post("/users/signup", req),
	login: (req) => http.post("/users/login", req),
	getMe: () => http.get("/users/me"),
	logout: () => http.post("/users/logout"),
};
