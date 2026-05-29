import { useState } from "react";
import { useLayout } from "@/features/layout-editor/LayoutContext";
import { useRejectDetectionItem } from "@/features/product-detection/hooks/useDetectionTask";

/**
 * Floating 2D-mode toolbar — currently only the auto-align action.
 * Mirrors Edit3DToolbar's "정렬" button so the feature is reachable from
 * both 2D and 3D editors per user request.
 */
type AlignMode =
	| "top"
	| "v-center"
	| "bottom"
	| "left"
	| "h-center"
	| "right"
	| "grid";

const ALIGN_BUTTONS: { mode: AlignMode; icon: string; title: string }[] = [
	{
		mode: "grid",
		icon: "▦",
		title:
			"그리드 스냅 — 같은 컬럼은 X 통일, 같은 행은 Y 통일 (형태 보존 미세정렬)",
	},
	{ mode: "top", icon: "⬒", title: "윗모서리 정렬 (각 행 leftmost 앵커)" },
	{
		mode: "v-center",
		icon: "⊟",
		title: "세로 가운데 정렬 (각 행 leftmost 앵커)",
	},
	{ mode: "bottom", icon: "⬓", title: "아래모서리 정렬 (각 행 leftmost 앵커)" },
	{ mode: "left", icon: "⬕", title: "왼쪽 정렬 (각 열 topmost 앵커)" },
	{
		mode: "h-center",
		icon: "⊞",
		title: "가로 가운데 정렬 (각 열 topmost 앵커)",
	},
	{ mode: "right", icon: "⬔", title: "오른쪽 정렬 (각 열 topmost 앵커)" },
];

interface Edit2DToolbarProps {
	onDuplicateFixtures?: (indices: number[]) => Promise<number[]>;
}

export function Edit2DToolbar({ onDuplicateFixtures }: Edit2DToolbarProps) {
	const {
		resolveOverlaps,
		removeWrappingFixtures,
		alignFixtures,
		selectedIndex,
		selectedIndices,
		selectedDetectionItemId,
		setSelectedIndicesBatch,
		setSelectedDetectionItem,
		deleteFixtures,
		updateFixture,
		duplicateFixtures,
		layout,
		undo,
		redo,
		canUndo,
		canRedo,
	} = useLayout();
	const [msg, setMsg] = useState<string | null>(null);
	const [isDuplicatingFixtures, setIsDuplicatingFixtures] = useState(false);
	const rejectDetectionItem = useRejectDetectionItem();
	const hasProductSelection =
		selectedDetectionItemId !== null && selectedIndex !== null;
	const hasSelection = selectedIndices.length > 0;
	const canDuplicate = hasSelection || hasProductSelection;
	const canDelete = hasSelection || hasProductSelection;
	const canAlign = selectedIndices.length >= 2;

	function handleResolve() {
		const r = resolveOverlaps();
		setMsg(
			r.resolved === 0
				? "겹친 집기 없음"
				: `${r.resolved}쌍 분리 완료 (${r.iterations} iter)`,
		);
		setTimeout(() => setMsg(null), 3000);
	}

	function handleAlign(mode: AlignMode) {
		alignFixtures(selectedIndices, mode);
		setMsg(`${selectedIndices.length}개 ${mode} 정렬 완료`);
		setTimeout(() => setMsg(null), 2000);
	}

	async function handleDuplicate() {
		if (selectedDetectionItemId !== null && selectedIndex !== null) {
			const fixture = layout?.fixtures[selectedIndex];
			const detectionPreview = fixture?.detectionPreview;
			const selectedItem = detectionPreview?.items.find(
				(item) => item.detectionItemId === selectedDetectionItemId,
			);

			if (fixture && detectionPreview && selectedItem) {
				const maxDetectionItemId = Math.max(
					0,
					...(layout?.fixtures ?? []).flatMap(
						(fixture) =>
							fixture.detectionPreview?.items.map(
								(item) => item.detectionItemId,
							) ?? [],
					),
				);
				const duplicatedItem = {
					...structuredClone(selectedItem),
					detectionItemId: maxDetectionItemId + 1,
					relativePosition: {
						x: selectedItem.relativePosition.x + 0.05,
						y: selectedItem.relativePosition.y + 0.05,
					},
				};

				updateFixture(selectedIndex, {
					detectionPreview: {
						...detectionPreview,
						items: [...detectionPreview.items, duplicatedItem],
					},
				});
				setSelectedDetectionItem(duplicatedItem.detectionItemId);
				setMsg("상품 복제 완료");
				setTimeout(() => setMsg(null), 2000);
				return;
			}
		}

		setIsDuplicatingFixtures(true);
		try {
			const newIdxs = onDuplicateFixtures
				? await onDuplicateFixtures(selectedIndices)
				: duplicateFixtures(selectedIndices);
			if (newIdxs.length === 0) {
				setMsg("복제할 집기가 없습니다");
				setTimeout(() => setMsg(null), 2000);
				return;
			}
			setSelectedIndicesBatch(newIdxs, true);
			setMsg(`${newIdxs.length}개 복제 완료`);
		} catch (error) {
			setMsg(error instanceof Error ? error.message : "집기 복제 실패");
		} finally {
			setIsDuplicatingFixtures(false);
			setTimeout(() => setMsg(null), 2000);
		}
	}

	async function handleDelete() {
		if (selectedDetectionItemId !== null && selectedIndex !== null) {
			const fixture = layout?.fixtures[selectedIndex];
			const detectionPreview = fixture?.detectionPreview;
			if (detectionPreview && !detectionPreview.taskId) {
				updateFixture(selectedIndex, {
					detectionPreview: {
						...detectionPreview,
						items: detectionPreview.items.filter(
							(item) => item.detectionItemId !== selectedDetectionItemId,
						),
					},
				});
				setSelectedDetectionItem(null);
				setMsg("상품 삭제 완료");
				setTimeout(() => setMsg(null), 2000);
				return;
			}
			if (detectionPreview?.taskId) {
				try {
					await rejectDetectionItem.mutateAsync({
						taskId: detectionPreview.taskId,
						itemId: selectedDetectionItemId,
					});
					updateFixture(selectedIndex, {
						detectionPreview: {
							...detectionPreview,
							deletedDetectionItemIds: Array.from(
								new Set([
									...(detectionPreview.deletedDetectionItemIds ?? []),
									selectedDetectionItemId,
								]),
							),
							items: detectionPreview.items.filter(
								(item) => item.detectionItemId !== selectedDetectionItemId,
							),
						},
					});
					setSelectedDetectionItem(null);
					setMsg("상품 삭제 완료");
				} catch (error) {
					setMsg(
						error instanceof Error
							? error.message
							: "상품 후보를 삭제할 수 없습니다",
					);
				} finally {
					setTimeout(() => setMsg(null), 2500);
				}
				return;
			}
		}

		const count = selectedIndices.length;
		deleteFixtures(selectedIndices);
		setMsg(`${count}개 삭제 완료`);
		setTimeout(() => setMsg(null), 2000);
	}

	return (
		<div className="pointer-events-none absolute left-3 right-3 top-3 z-30 flex flex-col items-center gap-2 md:left-[296px] md:top-14">
			<div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 overflow-visible rounded-2xl border border-border bg-white/95 p-1.5 shadow-sm backdrop-blur md:rounded-full">
				<button
					type="button"
					onClick={undo}
					disabled={!canUndo}
					title="되돌리기 (Ctrl+Z)"
					className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-text disabled:opacity-30"
				>
					↶ 되돌리기
				</button>
				<button
					type="button"
					onClick={redo}
					disabled={!canRedo}
					title="다시 실행 (Ctrl+Y / Ctrl+Shift+Z)"
					className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-text disabled:opacity-30"
				>
					↷ 다시
				</button>
				<div className="mx-1 h-5 w-px bg-border" />
				<button
					type="button"
					onClick={() => {
						const all = (layout?.fixtures ?? []).map((_, i) => i);
						setSelectedIndicesBatch(all, true);
					}}
					title="모든 집기 선택 (Ctrl+A)"
					className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-text"
				>
					🔲 전체
				</button>
				<button
					type="button"
					onClick={handleDuplicate}
					disabled={!canDuplicate || isDuplicatingFixtures}
					title="선택된 상품 또는 집기 복제"
					className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-text disabled:opacity-30"
				>
					{isDuplicatingFixtures ? "복제 중..." : "복제"}
				</button>
				<button
					type="button"
					onClick={() => void handleDelete()}
					disabled={!canDelete || rejectDetectionItem.isPending}
					title="선택된 상품 또는 집기 삭제"
					className="rounded-full px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-30"
				>
					삭제
				</button>
				{ALIGN_BUTTONS.map(({ mode, icon, title }) => (
					<button
						key={mode}
						type="button"
						onClick={() => handleAlign(mode)}
						disabled={!canAlign}
						title={title}
						className="rounded-full px-2 py-1.5 text-sm transition-colors hover:bg-gray-100 disabled:opacity-30"
					>
						{icon}
					</button>
				))}
				<div className="mx-1 h-5 w-px bg-border" />
				<button
					type="button"
					onClick={handleResolve}
					title="겹친 집기 분리 (선택 무관, 도면 전체)"
					className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-text"
				>
					겹침해제
				</button>
				<button
					type="button"
					onClick={() => {
						const r = removeWrappingFixtures();
						setMsg(
							r.removed === 0
								? "감싸는 집기 없음"
								: `감싸는 집기 ${r.removed}개 제거`,
						);
						setTimeout(() => setMsg(null), 2500);
					}}
					title="다른 집기 전체를 감싸는(외곽) 집기 제거"
					className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-text"
				>
					외곽제거
				</button>
				<span className="px-2 text-[11px] text-muted-foreground">
					{canAlign
						? `${selectedIndices.length}개 선택`
						: "집기 이동 · 빈 공간 다중선택"}
				</span>
			</div>
			{msg && (
				<div className="pointer-events-auto rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] text-emerald-800 shadow-sm">
					{msg}
				</div>
			)}
		</div>
	);
}
