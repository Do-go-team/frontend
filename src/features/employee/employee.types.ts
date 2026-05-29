export type StoreRole = "OWNER" | "MANAGER" | "VMD" | "STAFF";

export interface MemberItem {
	user_id: number;
	name: string;
	email: string;
	profile_image_url: string | null;
	role: StoreRole;
	joined_at: string;
}

export interface AdminQuota {
	current: number;
	max: number;
}

export interface GetMembersResponse {
	admin_quota: AdminQuota;
	members: MemberItem[];
}

export interface UpdateMemberRoleRequest {
	role: Exclude<StoreRole, "OWNER">;
}

export interface UpdateMemberRoleResponse {
	store_id: number;
	user_id: number;
	role: StoreRole;
	updated_at: string;
}
