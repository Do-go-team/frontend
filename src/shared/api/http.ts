import {
	ApiError,
	type ApiErrorResponse,
	type ApiSuccessResponse,
} from "@/shared/types/api.types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;
const CSRF_COOKIE_NAME = "csrftoken";
const CSRF_HEADER_NAME = "X-CSRFToken";
const REFRESH_PATHS = ["/users/refresh", "/auth/refresh"] as const;
type RefreshResult = "refreshed" | "unsupported";

export type RequestOptions = Omit<RequestInit, "method" | "body">;

function isFormData(value: unknown): value is FormData {
	return typeof FormData !== "undefined" && value instanceof FormData;
}

function getCsrfToken(): string | null {
	const match = document.cookie.match(
		new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`),
	);
	return match ? decodeURIComponent(match[1]) : null;
}

let refreshPromise: Promise<RefreshResult> | null = null;

async function refreshAccessToken(): Promise<RefreshResult> {
	if (refreshPromise) return refreshPromise;

	const headers: Record<string, string> = {};
	const csrfToken = getCsrfToken();
	if (csrfToken) {
		headers[CSRF_HEADER_NAME] = csrfToken;
	}

	refreshPromise = (async () => {
		for (const refreshPath of REFRESH_PATHS) {
			const res = await fetch(`${BASE_URL}${refreshPath}`, {
				method: "POST",
				credentials: "include",
				headers,
			});
			if (res.ok) {
				return "refreshed";
			}
			if (res.status !== 404) {
				break;
			}
		}
		return "unsupported";
	})().finally(() => {
		refreshPromise = null;
	});

	return refreshPromise;
}

function notifyUnauthorized() {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new CustomEvent("auth:unauthorized"));
}

async function throwApiError(response: Response): Promise<never> {
	let json: ApiSuccessResponse<never> | ApiErrorResponse | null = null;
	try {
		json = (await response.json()) as
			| ApiSuccessResponse<never>
			| ApiErrorResponse;
	} catch {
		json = null;
	}

	const err =
		json && "code" in json
			? json
			: {
					code: response.status === 401 ? "UNAUTHORIZED" : "HTTP_ERROR",
					message:
						response.status === 401
							? "권한이 없거나 인증이 유효하지 않습니다."
							: `요청이 실패했습니다. (HTTP ${response.status})`,
				};

	if (err.code === "UNAUTHORIZED") {
		notifyUnauthorized();
	}

	throw new ApiError(err.code, err.message, err.details);
}

async function request<T>(
	method: string,
	path: string,
	body?: unknown,
	options: RequestOptions = {},
): Promise<T> {
	const { headers: customHeaders, ...rest } = options;

	const headers: Record<string, string> = {
		...(customHeaders as Record<string, string>),
	};

	if (body !== undefined && !isFormData(body) && !headers["Content-Type"]) {
		headers["Content-Type"] = "application/json";
	}

	if (["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
		const csrfToken = getCsrfToken();
		if (csrfToken) {
			headers[CSRF_HEADER_NAME] = csrfToken;
		}
	}

	const fetchOptions: RequestInit = {
		...rest,
		method,
		headers,
		credentials: "include",
		body:
			body === undefined
				? undefined
				: isFormData(body)
					? body
					: JSON.stringify(body),
	};

	const response = await fetch(`${BASE_URL}${path}`, fetchOptions);
	const isAuthPath = ["/users/login", "/users/signup"].includes(path);

	if (response.status === 401 && !isAuthPath) {
		try {
			const refreshResult = await refreshAccessToken();
			if (refreshResult === "unsupported") {
				await throwApiError(response);
			}
		} catch {
			await throwApiError(response);
		}

		const retryResponse = await fetch(`${BASE_URL}${path}`, fetchOptions);

		if (retryResponse.status === 401) {
			await throwApiError(retryResponse);
		}

		const retryJson = (await retryResponse.json()) as ApiSuccessResponse<T>;
		return (retryJson as ApiSuccessResponse<T>).data;
	}

	if (!response.ok) {
		await throwApiError(response);
	}

	const json = (await response.json()) as ApiSuccessResponse<T>;
	return (json as ApiSuccessResponse<T>).data;
}

export const http = {
	get: <T>(path: string, options?: RequestOptions) =>
		request<T>("GET", path, undefined, options),

	post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
		request<T>("POST", path, body, options),

	put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
		request<T>("PUT", path, body, options),

	patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
		request<T>("PATCH", path, body, options),

	delete: <T>(path: string, options?: RequestOptions) =>
		request<T>("DELETE", path, undefined, options),
};
