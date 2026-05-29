/**
 * 성능 측정 로그를 표시하는 플로팅 패널.
 * 에디터 우하단에 고정. 개발/운영 모두 사용 가능.
 */

import { useEffect, useReducer, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import {
	clearPerfEntries,
	exportPerfLogCSV,
	exportPerfLogJSON,
	getPerfEntries,
	type PerfCategory,
	type PerfEntry,
	subscribePerfLog,
} from "./perf-log";

const CATEGORY_COLOR: Record<PerfCategory, string> = {
	parse: "bg-blue-100 text-blue-700",
	rebuild: "bg-amber-100 text-amber-700",
	drag: "bg-emerald-100 text-emerald-700",
};

const CATEGORY_LABEL: Record<PerfCategory, string> = {
	parse: "파싱",
	rebuild: "재빌드",
	drag: "드래그",
};

function fmt(ms: number): string {
	return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(1)}ms`;
}

function fmtTime(ts: number): string {
	return new Date(ts).toLocaleTimeString("ko-KR", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

/** 카테고리별 평균 / 최대 / 건수 요약 */
function buildSummary(entries: PerfEntry[]) {
	const map: Record<string, { total: number; max: number; count: number }> = {};
	for (const e of entries) {
		const key = `${e.category}:${e.label}`;
		if (!map[key]) map[key] = { total: 0, max: 0, count: 0 };
		map[key].total += e.ms;
		map[key].max = Math.max(map[key].max, e.ms);
		map[key].count++;
	}
	return Object.entries(map).map(([key, v]) => ({
		key,
		category: key.split(":")[0] as PerfCategory,
		label: key.split(":").slice(1).join(":"),
		avg: v.total / v.count,
		max: v.max,
		count: v.count,
	}));
}

export function PerfLogPanel() {
	const [open, setOpen] = useState(false);
	const [tab, setTab] = useState<"log" | "summary">("log");
	const [, forceUpdate] = useReducer((n: number) => n + 1, 0);
	const listRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => subscribePerfLog(forceUpdate), []);

	// 새 항목 추가 시 자동 스크롤
	const entries = getPerfEntries();
	// biome-ignore lint/correctness/useExhaustiveDependencies: entries.length triggers scroll when new entry is appended
	useEffect(() => {
		if (open && listRef.current) {
			listRef.current.scrollTop = listRef.current.scrollHeight;
		}
	}, [open, entries.length]);

	const summary = buildSummary(entries);

	return (
		<div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
			{/* 패널 본체 */}
			{open && (
				<div className="pointer-events-auto flex w-80 flex-col rounded-xl border border-border bg-white shadow-lg">
					{/* 헤더 */}
					<div className="flex items-center justify-between border-b border-border px-3 py-2">
						<span className="text-xs font-semibold text-text">⏱ 성능 로그</span>
						<div className="flex items-center gap-1">
							<span className="text-[10px] text-muted-foreground">
								{entries.length}건
							</span>
							<button
								type="button"
								onClick={exportPerfLogCSV}
								title="CSV 내보내기"
								className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-gray-100 hover:text-text"
							>
								CSV↓
							</button>
							<button
								type="button"
								onClick={exportPerfLogJSON}
								title="JSON 내보내기"
								className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-gray-100 hover:text-text"
							>
								JSON↓
							</button>
							<button
								type="button"
								onClick={clearPerfEntries}
								title="로그 초기화"
								className="rounded px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-red-50 hover:text-red-600"
							>
								초기화
							</button>
						</div>
					</div>

					{/* 탭 */}
					<div className="flex gap-0 border-b border-border">
						{(["log", "summary"] as const).map((t) => (
							<button
								key={t}
								type="button"
								onClick={() => setTab(t)}
								className={cn(
									"flex-1 py-1 text-[11px] font-medium transition-colors",
									tab === t
										? "border-b-2 border-primary text-primary"
										: "text-muted-foreground hover:text-text",
								)}
							>
								{t === "log" ? "기록" : "요약"}
							</button>
						))}
					</div>

					{/* 기록 탭 */}
					{tab === "log" && (
						<div
							ref={listRef}
							className="flex max-h-64 flex-col gap-0.5 overflow-y-auto p-2"
						>
							{entries.length === 0 && (
								<p className="py-4 text-center text-[11px] text-muted-foreground">
									측정 기록 없음
								</p>
							)}
							{entries.map((e) => (
								<div
									key={e.id}
									className="flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-gray-50"
								>
									<span
										className={cn(
											"shrink-0 rounded px-1 py-0.5 text-[9px] font-medium",
											CATEGORY_COLOR[e.category],
										)}
									>
										{CATEGORY_LABEL[e.category]}
									</span>
									<span className="min-w-0 flex-1 truncate text-[10px] text-text">
										{e.label}
									</span>
									<span
										className={cn(
											"shrink-0 text-[10px] font-mono font-semibold",
											e.ms > 500
												? "text-red-500"
												: e.ms > 100
													? "text-amber-500"
													: "text-emerald-600",
										)}
									>
										{fmt(e.ms)}
									</span>
									<span className="shrink-0 text-[9px] text-muted-foreground">
										{fmtTime(e.ts)}
									</span>
								</div>
							))}
						</div>
					)}

					{/* 요약 탭 */}
					{tab === "summary" && (
						<div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto p-2">
							{summary.length === 0 && (
								<p className="py-4 text-center text-[11px] text-muted-foreground">
									측정 기록 없음
								</p>
							)}
							{summary.map((s) => (
								<div
									key={s.key}
									className="flex flex-col gap-0.5 rounded px-1.5 py-1.5 hover:bg-gray-50"
								>
									<div className="flex items-center gap-1.5">
										<span
											className={cn(
												"shrink-0 rounded px-1 py-0.5 text-[9px] font-medium",
												CATEGORY_COLOR[s.category],
											)}
										>
											{CATEGORY_LABEL[s.category]}
										</span>
										<span className="min-w-0 flex-1 truncate text-[10px] font-medium text-text">
											{s.label}
										</span>
										<span className="shrink-0 text-[9px] text-muted-foreground">
											{s.count}회
										</span>
									</div>
									<div className="flex gap-2 pl-1 text-[9px]">
										<span>
											평균{" "}
											<b
												className={cn(
													s.avg > 500
														? "text-red-500"
														: s.avg > 100
															? "text-amber-500"
															: "text-emerald-600",
												)}
											>
												{fmt(s.avg)}
											</b>
										</span>
										<span>
											최대 <b className="text-muted-foreground">{fmt(s.max)}</b>
										</span>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* 토글 버튼 */}
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className={cn(
					"pointer-events-auto flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium shadow-md transition-colors",
					open
						? "border-primary bg-primary text-white"
						: "border-border bg-white text-muted-foreground hover:text-text",
				)}
			>
				⏱{" "}
				{entries.length > 0 && (
					<span className={open ? "text-white/80" : "text-muted-foreground"}>
						{entries.length}
					</span>
				)}
			</button>
		</div>
	);
}
