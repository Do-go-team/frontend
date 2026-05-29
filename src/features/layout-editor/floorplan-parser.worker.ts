/**
 * Web Worker: OpenCV.js 도면 파싱을 메인 스레드와 분리해 UI 블로킹 방지.
 */
import { parseFloorplanWithOpenCV } from "./floorplan-parser.opencv";

self.onmessage = async (e: MessageEvent) => {
	const { buffer, name, type } = e.data as {
		buffer: ArrayBuffer;
		name: string;
		type: string;
	};
	console.log("[Worker] 메시지 수신:", name);
	const file = new File([buffer], name, { type });
	try {
		const layout = await parseFloorplanWithOpenCV(file);
		console.log("[Worker] 파싱 완료, 결과 전송");
		self.postMessage({ ok: true, layout });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("[Worker] 파싱 오류:", msg);
		self.postMessage({ ok: false, error: msg });
	}
};

// Worker 내 미처리 reject도 메인 스레드로 전달
self.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
	const msg = e.reason instanceof Error ? e.reason.message : String(e.reason);
	console.error("[Worker] unhandledRejection:", msg);
	self.postMessage({ ok: false, error: `Worker 내부 오류: ${msg}` });
});
