export interface ApiSuccessResponse<T = unknown> {
	success: true;
	message: string;
	data: T;
}

export interface ApiErrorResponse {
	code: string;
	message: string;
	details?: Record<string, unknown>;
}

export class ApiError extends Error {
	public readonly code: string;
	public readonly details?: Record<string, unknown>;

	constructor(
		code: string,
		message: string,
		details?: Record<string, unknown>,
	) {
		super(message);
		this.name = "ApiError";
		this.code = code;
		this.details = details;
	}
}
