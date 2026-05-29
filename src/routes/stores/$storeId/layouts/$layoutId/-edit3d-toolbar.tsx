import { type ReactNode, useEffect, useState } from "react";
import { useLayout } from "@/features/layout-editor/LayoutContext";
import type { FixtureAssetType } from "@/features/layout-editor/layout.types";
import { cn } from "@/shared/lib/utils";

const ASSET_TYPES: FixtureAssetType[] = [
	"shoe_wall",
	"shoe_gondola",
	"shoe_pyramid",
	"shoe_island",
	"apparel_rack",
	"apparel_rack_round",
	"apparel_rack_wall",
	"apparel_rack_double",
	"apparel_island",
	"apparel_stack_table",
	"display_table",
	"mannequin",
	"counter",
	"fitting_room",
	"bench",
	"cafe_counter",
	"cafe_table",
	"cafe_seat_round",
	"pastry_display",
	"coffee_machine",
	"generic",
];

function Btn({
	onClick,
	title,
	disabled,
	children,
	variant = "default",
}: {
	onClick: () => void;
	title: string;
	disabled?: boolean;
	children: ReactNode;
	variant?: "default" | "danger" | "primary";
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			title={title}
			className={cn(
				"whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40",
				variant === "danger"
					? "text-red-600 hover:bg-red-50"
					: variant === "primary"
						? "bg-primary text-white hover:bg-primary/90"
						: "text-gray-600 hover:bg-gray-100 hover:text-text",
			)}
		>
			{children}
		</button>
	);
}

const COLOR_PRESETS = [
	"#1f2937",
	"#3b82f6",
	"#ef4444",
	"#f59e0b",
	"#10b981",
	"#a855f7",
	"#ec4899",
	"#78350f",
	"#fef3c7",
	"#e5e7eb",
	"#525252",
	"#ffffff",
];

export function Edit3DToolbar() {
	const {
		layout,
		selectedIndices,
		setSelectedIndicesBatch,
		updateFixtures,
		addFixture,
		deleteFixtures,
		duplicateFixtures,
		resolveOverlaps,
		removeWrappingFixtures,
		alignFixtures,
		undo,
		redo,
		canUndo,
		canRedo,
	} = useLayout();
	const [resolveMsg, setResolveMsg] = useState<string | null>(null);
	const canAlign = selectedIndices.length >= 2;
	const [open, setOpen] = useState<"asset" | "color" | null>(null);
	// Touch-friendly interaction mode toggle.
	// "orbit" (default): drag empty = camera orbit; shift+drag = marquee.
	// "marquee": drag empty = marquee. Tap+hold on empty still orbits.
	const [interactionMode, setInteractionMode] = useState<"orbit" | "marquee">(
		"orbit",
	);
	useEffect(() => {
		window.dispatchEvent(
			new CustomEvent("scene3d-interaction-mode", {
				detail: { mode: interactionMode },
			}),
		);
	}, [interactionMode]);

	const hasSelection = selectedIndices.length > 0;
	const fixtures = layout?.fixtures ?? [];
	const firstSelected =
		hasSelection && fixtures[selectedIndices[0]]
			? fixtures[selectedIndices[0]]
			: null;

	function changeAssetType(assetType: FixtureAssetType) {
		updateFixtures(selectedIndices, { assetType });
		setOpen(null);
	}

	function changeColor(hex: string) {
		// updateFixtures with material spread
		for (const idx of selectedIndices) {
			const f = fixtures[idx];
			if (!f) continue;
			updateFixtures([idx], {
				material: { ...(f.material ?? {}), baseColor: hex },
			});
		}
		setOpen(null);
	}

	return (
		<div className="pointer-events-none absolute left-1/2 top-14 z-30 flex w-[calc(100vw-280px)] -translate-x-1/2 flex-col items-center gap-2">
			<div className="pointer-events-auto flex min-w-max items-center gap-1 overflow-x-auto rounded-full border border-border bg-white/95 p-1 shadow-sm backdrop-blur [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				<Btn onClick={undo} title="되돌리기 (Ctrl+Z)" disabled={!canUndo}>
					↶ 되돌리기
				</Btn>
				<Btn
					onClick={redo}
					title="다시 실행 (Ctrl+Y / Ctrl+Shift+Z)"
					disabled={!canRedo}
				>
					↷ 다시
				</Btn>
				<div className="mx-1 h-5 w-px bg-border" />
				<Btn
					onClick={() => {
						const all = (layout?.fixtures ?? []).map((_, i) => i);
						setSelectedIndicesBatch(all, true);
					}}
					title="모든 집기 선택 (Ctrl+A)"
				>
					🔲 전체
				</Btn>
				<button
					type="button"
					onClick={() =>
						setInteractionMode((m) => (m === "marquee" ? "orbit" : "marquee"))
					}
					title={
						interactionMode === "marquee"
							? "드래그 선택 모드 — 빈공간 드래그로 다중선택. 다시 누르면 카메라 회전 모드"
							: "카메라 회전 모드 — 빈공간 드래그로 회전. 누르면 드래그 선택 모드 (터치/태블릿용, Shift 없이 다중선택)"
					}
					className={cn(
						"rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
						interactionMode === "marquee"
							? "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
							: "text-gray-600 hover:bg-gray-100 hover:text-text",
					)}
				>
					{interactionMode === "marquee" ? "▣ 드래그 선택" : "🖱 회전"}
				</button>
				<Btn
					onClick={() => addFixture()}
					title="새 집기 추가 (도면 중앙)"
					variant="primary"
				>
					+ 추가
				</Btn>
				<Btn
					onClick={() => duplicateFixtures(selectedIndices)}
					title="선택된 집기 복제"
					disabled={!hasSelection}
				>
					⎘ 복제
				</Btn>
				<Btn
					onClick={() => {
						if (window.confirm(`${selectedIndices.length}개 집기 삭제?`)) {
							deleteFixtures(selectedIndices);
						}
					}}
					title="선택된 집기 삭제"
					disabled={!hasSelection}
					variant="danger"
				>
					🗑 삭제
				</Btn>
				<div className="mx-1 h-5 w-px bg-border" />
				<Btn
					onClick={() => setOpen(open === "asset" ? null : "asset")}
					title="자산 타입 변경 (선택된 집기 모두)"
					disabled={!hasSelection}
				>
					📦 타입
					{firstSelected?.assetType ? ` (${firstSelected.assetType})` : ""}
				</Btn>
				<Btn
					onClick={() => setOpen(open === "color" ? null : "color")}
					title="색상 변경 (선택된 집기 모두)"
					disabled={!hasSelection}
				>
					🎨 색
				</Btn>
				<div className="mx-1 h-5 w-px bg-border" />
				{[
					{
						mode: "grid" as const,
						icon: "▦",
						title: "그리드 스냅 — 형태 보존 미세정렬",
					},
					{ mode: "top" as const, icon: "⬒", title: "윗모서리 (행별)" },
					{ mode: "v-center" as const, icon: "⊟", title: "세로 가운데 (행별)" },
					{ mode: "bottom" as const, icon: "⬓", title: "아래모서리 (행별)" },
					{ mode: "left" as const, icon: "⬕", title: "왼쪽 (열별)" },
					{ mode: "h-center" as const, icon: "⊞", title: "가로 가운데 (열별)" },
					{ mode: "right" as const, icon: "⬔", title: "오른쪽 (열별)" },
				].map(({ mode, icon, title }) => (
					<button
						key={mode}
						type="button"
						onClick={() => {
							alignFixtures(selectedIndices, mode);
							setResolveMsg(`${selectedIndices.length}개 ${mode} 정렬`);
							setTimeout(() => setResolveMsg(null), 2000);
						}}
						title={title}
						disabled={!canAlign}
						className="rounded-full px-2 py-1.5 text-sm transition-colors hover:bg-gray-100 disabled:opacity-30"
					>
						{icon}
					</button>
				))}
				<Btn
					onClick={() => {
						const r = resolveOverlaps();
						setResolveMsg(
							r.resolved === 0
								? "겹친 집기 없음"
								: `${r.resolved}쌍 분리 완료 (${r.iterations} iter)`,
						);
						setTimeout(() => setResolveMsg(null), 3000);
					}}
					title="겹친 집기 분리 (선택 무관, 도면 전체)"
				>
					겹침해제
				</Btn>
				<Btn
					onClick={() => {
						const r = removeWrappingFixtures();
						setResolveMsg(
							r.removed === 0
								? "감싸는 집기 없음"
								: `감싸는 집기 ${r.removed}개 제거`,
						);
						setTimeout(() => setResolveMsg(null), 2500);
					}}
					title="다른 집기 전체를 감싸는(외곽) 집기 제거"
				>
					외곽제거
				</Btn>
				<div className="mx-1 h-5 w-px bg-border" />
				<span className="px-2 text-[11px] text-muted-foreground">
					{hasSelection
						? `${selectedIndices.length}개 선택`
						: "Shift+클릭으로 다중선택"}
				</span>
			</div>

			{resolveMsg && (
				<div className="pointer-events-auto rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] text-emerald-800 shadow-sm">
					{resolveMsg}
				</div>
			)}

			{open === "asset" && (
				<div className="pointer-events-auto grid max-h-72 grid-cols-3 gap-1 overflow-y-auto rounded-md border border-border bg-white p-2 shadow-md">
					{ASSET_TYPES.map((t) => (
						<button
							key={t}
							type="button"
							onClick={() => changeAssetType(t)}
							className="rounded border border-border/60 px-2 py-1 text-[11px] text-text hover:bg-primary hover:text-white"
						>
							{t}
						</button>
					))}
				</div>
			)}

			{open === "color" && (
				<div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-white p-2 shadow-md">
					{COLOR_PRESETS.map((c) => (
						<button
							key={c}
							type="button"
							onClick={() => changeColor(c)}
							style={{ backgroundColor: c }}
							className="h-6 w-6 rounded-full border border-border/60 hover:scale-110"
							title={c}
						/>
					))}
					<input
						type="color"
						defaultValue={firstSelected?.material?.baseColor ?? "#888888"}
						onChange={(e) => changeColor(e.target.value)}
						className="h-7 w-10 cursor-pointer rounded border border-border"
						title="커스텀 색상 선택"
					/>
				</div>
			)}
		</div>
	);
}
