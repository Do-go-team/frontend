import { http } from "@/shared/api/http";
import type { InviteAdapter } from "./invite.adapter";

export const restInviteAdapter: InviteAdapter = {
	createInvitation: (storeId, req) =>
		http.post(`/stores/${storeId}/invitations`, req),
	acceptInvitation: (req) => http.post("/invitations/accept", req),
};
