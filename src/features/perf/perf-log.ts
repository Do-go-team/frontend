/**
 * 성능 측정 로그 스토어.
 * - localStorage에 최대 500개 항목 영속
 * - 구독자에게 변경 알림
 * - CSV / JSON 내보내기
 */

export type PerfCategory = "parse" | "rebuild" | "drag";

export interface PerfEntry {
	id: string;
	ts: number; // Unix ms
	category: PerfCategory;
	label: string;
	ms: number;
	meta?: Record<string, unknown>;
}

const MAX_ENTRIES = 500;
const STORAGE_KEY = "vmd_perf_log";

let _entries: PerfEntry[] = [];
const _listeners = new Set<() => void>();

function _load() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) _entries = JSON.parse(raw) as PerfEntry[];
	} catch {
		_entries = [];
	}
}

function _save() {
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify(_entries.slice(-MAX_ENTRIES)),
		);
	} catch {
		/* storage full — ignore */
	}
}

function _notify() {
	for (const fn of _listeners) fn();
}

// 초기 로드
_load();

/** 성능 항목 추가 */
export function addPerfEntry(entry: Omit<PerfEntry, "id" | "ts">): void {
	_entries.push({
		id: crypto.randomUUID(),
		ts: Date.now(),
		...entry,
	});
	if (_entries.length > MAX_ENTRIES) {
		_entries = _entries.slice(-MAX_ENTRIES);
	}
	_save();
	_notify();
}

/** 현재 로그 목록 반환 (복사본) */
export function getPerfEntries(): PerfEntry[] {
	return [..._entries];
}

/** 로그 전체 삭제 */
export function clearPerfEntries(): void {
	_entries = [];
	_save();
	_notify();
}

/** 변경 구독 — 반환값은 unsubscribe 함수 */
export function subscribePerfLog(fn: () => void): () => void {
	_listeners.add(fn);
	return () => _listeners.delete(fn);
}

/** CSV로 다운로드 */
export function exportPerfLogCSV(): void {
	const rows = [
		"timestamp,category,label,ms,meta",
		..._entries.map((e) => {
			const meta = e.meta ? JSON.stringify(e.meta) : "";
			return `${new Date(e.ts).toISOString()},${e.category},"${e.label}",${e.ms},"${meta.replace(/"/g, '""')}"`;
		}),
	];
	_download(rows.join("\n"), "text/csv", `vmd-perf-${Date.now()}.csv`);
}

/** JSON으로 다운로드 */
export function exportPerfLogJSON(): void {
	_download(
		JSON.stringify(_entries, null, 2),
		"application/json",
		`vmd-perf-${Date.now()}.json`,
	);
}

function _download(content: string, mime: string, filename: string): void {
	const blob = new Blob([content], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
