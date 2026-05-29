import { mockEmployeeAdapter } from "./employee.mock";
import { restEmployeeAdapter } from "./employee.rest";
import type {
	GetMembersResponse,
	UpdateMemberRoleRequest,
	UpdateMemberRoleResponse,
} from "./employee.types";

export interface EmployeeAdapter {
	getMembers: (storeId: number) => Promise<GetMembersResponse>;
	updateMemberRole: (
		storeId: number,
		userId: number,
		req: UpdateMemberRoleRequest,
	) => Promise<UpdateMemberRoleResponse>;
}

export const ENV_EMPLOYEE_ADAPTER: EmployeeAdapter =
	import.meta.env.VITE_USE_MOCK === "true"
		? mockEmployeeAdapter
		: restEmployeeAdapter;
