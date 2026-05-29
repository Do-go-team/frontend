import type { InviteAdapter } from "./invite.adapter";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockInviteAdapter: InviteAdapter = {
	createInvitation: async (_storeId, req) => {
		await delay(300);
		return {
			invitation_id: Math.floor(Math.random() * 1000) + 1,
			invitee_email: req.invite_email,
			target_role: req.target_role,
			invite_link: `${window.location.origin}/invite?token=mock-token-${Date.now()}`,
			expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
		};
	},
	acceptInvitation: async (_req) => {
		await delay(300);
		return {
			store_id: 1,
			store_name: "DO-GO 홍대 본점",
			granted_role: "STAFF",
			joined_at: new Date().toISOString(),
		};
	},
};
