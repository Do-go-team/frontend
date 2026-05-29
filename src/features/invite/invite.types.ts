export interface CreateInvitationRequest {
	invite_email: string;
	target_role: "MANAGER" | "VMD" | "STAFF";
}

export interface CreateInvitationResponse {
	invitation_id: number;
	invitee_email: string;
	target_role: string;
	invite_link: string;
	expires_at: string;
}

export interface AcceptInvitationRequest {
	invite_token: string;
}

export interface AcceptInvitationResponse {
	store_id: number;
	store_name: string;
	granted_role: string;
	joined_at: string;
}
