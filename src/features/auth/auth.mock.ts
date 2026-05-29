import type { AuthAdapter } from "./auth.adapter";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockAuthAdapter: AuthAdapter = {
	sendEmailCode: async () => {
		await delay(300);
		return { expires_in: 300 };
	},

	verifyEmail: async () => {
		await delay(300);
		return { is_verified: true, verification_token: "mock-verification-token" };
	},

	signup: async (req) => {
		await delay(300);
		return {
			user_id: 1,
			email: req.email,
			name: req.name,
			role: "USER",
			created_at: new Date().toISOString(),
		};
	},

	login: async (req) => {
		await delay(300);
		return {
			access_token: "mock-access-token",
			token_type: "Bearer",
			expires_in: 7200,
			user: { id: 1, email: req.email, name: "사용자", role: "USER" },
		};
	},

	getMe: async () => {
		await delay(300);
		return {
			id: 1,
			email: "user@example.com",
			name: "사용자",
			profile_image_url: null,
			system_role: "USER",
			accessible_stores: [
				{ store_id: 1, store_name: "DO-GO 홍대 본점", store_role: "OWNER" },
				{ store_id: 2, store_name: "DO-GO 강남 팝업스토어", store_role: "VMD" },
			],
		};
	},

	logout: async () => {
		await delay(300);
	},
};
