import { mockInviteAdapter } from "./invite.mock";
import { restInviteAdapter } from "./invite.rest";
import type {
	AcceptInvitationRequest,
	AcceptInvitationResponse,
	CreateInvitationRequest,
	CreateInvitationResponse,
} from "./invite.types";

export interface InviteAdapter {
	createInvitation: (
		storeId: number,
		req: CreateInvitationRequest,
	) => Promise<CreateInvitationResponse>;
	acceptInvitation: (
		req: AcceptInvitationRequest,
	) => Promise<AcceptInvitationResponse>;
}

export const ENV_INVITE_ADAPTER: InviteAdapter =
	import.meta.env.VITE_USE_MOCK === "true"
		? mockInviteAdapter
		: restInviteAdapter;
