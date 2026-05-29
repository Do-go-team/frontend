import { ApiError } from "@/shared/types/api.types";

export function getErrorMessage(error: Error | null): string | null {
	if (!error) return null;

	if (error instanceof ApiError) {
		return error.message;
	}

	return "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
}
