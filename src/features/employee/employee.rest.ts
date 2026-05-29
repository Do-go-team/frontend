import { http } from "@/shared/api/http";
import type { EmployeeAdapter } from "./employee.adapter";

export const restEmployeeAdapter: EmployeeAdapter = {
	getMembers: (storeId) => http.get(`/stores/${storeId}/members`),
	updateMemberRole: (storeId, userId, req) =>
		http.patch(`/stores/${storeId}/members/${userId}`, req),
};
