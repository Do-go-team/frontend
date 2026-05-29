import type { EmployeeAdapter } from "./employee.adapter";
import type { MemberItem } from "./employee.types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const mockMembers: MemberItem[] = [
	{
		user_id: 1,
		name: "김오너",
		email: "owner@example.com",
		profile_image_url: null,
		role: "OWNER",
		joined_at: "2026-01-10T11:00:00Z",
	},
	{
		user_id: 2,
		name: "이매니저",
		email: "manager@example.com",
		profile_image_url: null,
		role: "MANAGER",
		joined_at: "2026-02-01T09:00:00Z",
	},
	{
		user_id: 3,
		name: "박VMD",
		email: "vmd@example.com",
		profile_image_url: null,
		role: "VMD",
		joined_at: "2026-03-15T14:00:00Z",
	},
];

export const mockEmployeeAdapter: EmployeeAdapter = {
	getMembers: async (_storeId) => {
		await delay(300);
		return {
			admin_quota: { current: 2, max: 3 },
			members: [...mockMembers],
		};
	},
	updateMemberRole: async (_storeId, userId, req) => {
		await delay(300);
		const member = mockMembers.find((m) => m.user_id === userId);
		if (member) {
			member.role = req.role;
		}
		return {
			store_id: _storeId,
			user_id: userId,
			role: req.role,
			updated_at: new Date().toISOString(),
		};
	},
};
