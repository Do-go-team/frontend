import type {
	LayoutFixture,
	StoreDimensions,
} from "@/features/layout/layout.types";
import { layoutDetailToEditorJSON } from "./api-transform";
import FloorplanWorker from "./floorplan-parser.worker.ts?worker";
import type { LayoutJSON } from "./layout.types";

export interface ParseFloorplanResponse {
	layout: LayoutJSON;
	floorplanImageUrl?: string | null;
	jsonPath?: string;
	uploadedFilename?: string;
	uploadedImagePath?: string;
	parsedAt?: string;
	message?: string;
}

/** BE 파서 API 응답의 data 필드 구조 */
interface ParseApiData {
	layout_id: number;
	store_id?: number;
	name?: string;
	comment?: string | null;
	is_active?: boolean;
	floorplan_image_url?: string | null;
	store_dimensions: StoreDimensions;
	fixtures: LayoutFixture[];
	parsed_at: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) ?? "/api/v1";
const REFRESH_PATHS = ["/users/refresh", "/auth/refresh"] as const;
type RefreshResult = "refreshed" | "unsupported";

const UNREACHABLE = "unreachable";

/**
 * 401 발생 시 토큰 리프레시. http.ts와 동일한 패턴.
 * 동시에 여러 요청이 401을 받아도 refresh는 한 번만 호출.
 */
let refreshPromise: Promise<RefreshResult> | null = null;

async function refreshAccessToken(): Promise<RefreshResult> {
	if (refreshPromise) return refreshPromise;

	refreshPromise = (async () => {
		for (const refreshPath of REFRESH_PATHS) {
			const res = await fetch(`${API_BASE_URL}${refreshPath}`, {
				method: "POST",
				credentials: "include",
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

/**
 * 쿠키에서 CSRF 토큰을 읽어옵니다.
 * Django는 POST 요청에 X-CSRFToken 헤더를 요구합니다.
 */
function getCsrfToken(): string | null {
	const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/);
	return match ? decodeURIComponent(match[1]) : null;
}

async function getParserErrorMessage(response: Response): Promise<string> {
	try {
		const json = await response.clone().json();
		if (typeof json.message === "string") {
			return json.message;
		}
	} catch {
		// ignore non-JSON error bodies
	}
	return "권한이 없거나 인증이 유효하지 않습니다.";
}

/**
 * multipart/form-data 파서 요청을 보내는 내부 함수.
 * Content-Type 헤더는 브라우저가 boundary를 자동 설정하도록 생략.
 * Django CSRF 보호를 위해 X-CSRFToken 헤더를 포함.
 */
async function fetchParserEndpoint(
	url: string,
	formData: FormData,
	signal: AbortSignal,
): Promise<Response> {
	const headers: Record<string, string> = {};
	const csrfToken = getCsrfToken();
	if (csrfToken) {
		headers["X-CSRFToken"] = csrfToken;
	}

	return fetch(url, {
		method: "POST",
		body: formData,
		credentials: "include",
		headers,
		signal,
	});
}

/**
 * BE 파서 엔드포인트로 도면 파싱 요청.
 * POST /api/v1/layouts/{layout_id}/floorplan/parse  (multipart/form-data)
 *
 * 응답 envelope: { success: true, data: ParseApiData }
 * → layoutDetailToEditorJSON()으로 에디터 포맷 변환
 *
 * 401 발생 시 토큰 리프레시 후 1회 재시도 (http.ts와 동일 패턴)
 */
async function tryRestParse(
	file: File,
	layoutId: number,
): Promise<ParseFloorplanResponse> {
	const formData = new FormData();
	formData.append("file", file);

	const url = `${API_BASE_URL}/layouts/${layoutId}/floorplan/parse`;
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 30_000);

	let response: Response;
	try {
		response = await fetchParserEndpoint(url, formData, controller.signal);
	} catch {
		throw new Error(UNREACHABLE);
	} finally {
		clearTimeout(timeoutId);
	}

	if ([502, 503, 504].includes(response.status)) {
		throw new Error(UNREACHABLE);
	}

	// 401 → 토큰 리프레시 후 재시도
	if (response.status === 401) {
		try {
			const refreshResult = await refreshAccessToken();
			if (refreshResult === "unsupported") {
				throw new Error(await getParserErrorMessage(response));
			}
		} catch {
			throw new Error(await getParserErrorMessage(response));
		}

		// 재시도: FormData는 한 번 소비되므로 새로 생성
		const retryFormData = new FormData();
		retryFormData.append("file", file);

		const retryController = new AbortController();
		const retryTimeoutId = setTimeout(() => retryController.abort(), 30_000);

		try {
			response = await fetchParserEndpoint(
				url,
				retryFormData,
				retryController.signal,
			);
		} catch {
			throw new Error(UNREACHABLE);
		} finally {
			clearTimeout(retryTimeoutId);
		}

		if (response.status === 401) {
			throw new Error(await getParserErrorMessage(response));
		}
	}

	const json = await response.json();

	if (!response.ok || json.success === false) {
		const message =
			typeof json.message === "string"
				? json.message
				: typeof json.code === "string"
					? json.code
					: `Parser request failed (${response.status}).`;
		throw new Error(message);
	}

	const data = json.data as ParseApiData;

	// BE LayoutDetail 형식 → 에디터 LayoutJSON 변환 (api-transform.ts 재사용)
	const layout = layoutDetailToEditorJSON({
		layout_id: data.layout_id,
		store_id: data.store_id ?? 0,
		name: data.name ?? "",
		comment: data.comment ?? null,
		is_active: data.is_active ?? true,
		floorplan_image_url: data.floorplan_image_url ?? null,
		store_dimensions: data.store_dimensions,
		fixtures: data.fixtures,
	});

	return {
		layout,
		floorplanImageUrl: data.floorplan_image_url ?? null,
		parsedAt: data.parsed_at,
		message: "BE API",
	};
}

function runOpenCVInWorker(file: File): Promise<LayoutJSON> {
	return new Promise((resolve, reject) => {
		const worker = new FloorplanWorker();
		worker.onmessage = (
			e: MessageEvent<{ ok: boolean; layout?: LayoutJSON; error?: string }>,
		) => {
			worker.terminate();
			if (e.data.ok && e.data.layout) resolve(e.data.layout);
			else reject(new Error(e.data.error ?? "Worker 파싱 실패"));
		};
		worker.onerror = (e) => {
			worker.terminate();
			reject(new Error(e.message ?? "Worker 오류"));
		};
		file.arrayBuffer().then((buffer) => {
			worker.postMessage({ buffer, name: file.name, type: file.type }, [
				buffer,
			]);
		});
	});
}

async function tryOpenCVParse(file: File): Promise<ParseFloorplanResponse> {
	const layout = await runOpenCVInWorker(file);
	return {
		layout,
		parsedAt: new Date().toISOString(),
		message: "OpenCV.js (browser worker)",
	};
}

export const floorplanParserAdapter = {
	async parse(file: File, layoutId: number): Promise<ParseFloorplanResponse> {
		try {
			return await tryRestParse(file, layoutId);
		} catch (restErr) {
			const isUnreachable =
				restErr instanceof Error && restErr.message === UNREACHABLE;
			if (!isUnreachable) throw restErr;
			return await tryOpenCVParse(file);
		}
	},
};
