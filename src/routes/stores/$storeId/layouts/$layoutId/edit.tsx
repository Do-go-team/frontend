import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	useBlocker,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ENV_LAYOUT_ADAPTER } from "@/features/layout/layout.adapter";
import {
	editorFixturesToApiItems,
	layoutDetailToEditorJSON,
} from "@/features/layout-editor/api-transform";
import { Canvas2D } from "@/features/layout-editor/Canvas2D";
import {
	LayoutProvider,
	useLayout,
} from "@/features/layout-editor/LayoutContext";
import type {
	FixtureDetectionItemPreview,
	FixtureDetectionPreview,
	LayoutJSON,
} from "@/features/layout-editor/layout.types";
import { ENV_PRODUCT_DETECTION_ADAPTER } from "@/features/product-detection/product-detection.adapter";
import { ENV_STORE_ADAPTER } from "@/features/store/store.adapter";
import { ApiError } from "@/shared/types/api.types";
import { Edit2DToolbar } from "./-edit2d-toolbar";
import { EditorPanel } from "./-editor-panel";
import type { ViewMode } from "./-mode-toggle";
import { ModeToggle } from "./-mode-toggle";

type SaveToastState = {
	id: number;
	message: string;
	variant: "success" | "error";
} | null;

export const Route = createFileRoute("/stores/$storeId/layouts/$layoutId/edit")(
	{
		component: EditPage,
	},
);

function EditPage() {
	const { layoutId, storeId } = useParams({
		from: "/stores/$storeId/layouts/$layoutId/edit",
	});

	return (
		<LayoutProvider key={layoutId}>
			<EditorContent layoutId={layoutId} storeId={storeId} />
		</LayoutProvider>
	);
}

function getFixturePhotoStateKey(
	fixture: { layoutFixtureId?: number | null; id?: string },
	index: number,
) {
	if (fixture.layoutFixtureId) return `layout:${fixture.layoutFixtureId}`;
	if (fixture.id) return `client:${fixture.id}`;
	return `index:${index}`;
}

function getLegacyFixturePhotoStateKey(fixture: {
	layoutFixtureId?: number | null;
	id?: string;
}) {
	return String(fixture.layoutFixtureId ?? fixture.id);
}

function createEmptyDetectionPreview(): FixtureDetectionPreview {
	return {
		sourceImageUrl: null,
		taskId: null,
		taskStatus: "IDLE",
		taskUpdatedAt: null,
		errorMessage: null,
		items: [],
	};
}

function cleanupLegacyFloorplanStorage() {
	for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
		const key = window.localStorage.key(i);
		if (!key?.startsWith("dogo-floor-panel-preview:")) continue;
		window.localStorage.removeItem(key);
	}
}

function mergeEditorStateFromCurrentLayout(
	nextLayout: LayoutJSON,
	currentLayout: LayoutJSON,
): LayoutJSON {
	const stateByKey = new Map<
		string,
		Pick<LayoutJSON["fixtures"][number], "detectionPreview" | "locked">
	>();

	currentLayout.fixtures.forEach((fixture, index) => {
		const state = {
			detectionPreview: fixture.detectionPreview,
			locked: fixture.locked,
		};
		stateByKey.set(getFixturePhotoStateKey(fixture, index), state);
		stateByKey.set(getLegacyFixturePhotoStateKey(fixture), state);
		if (fixture.fixtureId)
			stateByKey.set(`fixture:${fixture.fixtureId}`, state);
	});

	return {
		...nextLayout,
		fixtures: nextLayout.fixtures.map((fixture, index) => {
			const state =
				stateByKey.get(getFixturePhotoStateKey(fixture, index)) ??
				stateByKey.get(getLegacyFixturePhotoStateKey(fixture)) ??
				(fixture.fixtureId
					? stateByKey.get(`fixture:${fixture.fixtureId}`)
					: undefined);
			return {
				...fixture,
				locked: state?.locked ?? fixture.locked,
				detectionPreview:
					fixture.detectionPreview ?? state?.detectionPreview ?? null,
			};
		}),
	};
}

function offsetCopiedFixtures(
	layout: LayoutJSON,
	copiedLayoutFixtureIds: number[],
): LayoutJSON {
	if (copiedLayoutFixtureIds.length === 0) return layout;
	const copiedIdSet = new Set(copiedLayoutFixtureIds);
	const offset = 30;

	return {
		...layout,
		fixtures: layout.fixtures.map((fixture) => {
			const layoutFixtureId =
				fixture.layoutFixtureId ??
				fixture.apiMeta?.layoutFixtureId ??
				Number(fixture.id);
			if (!copiedIdSet.has(layoutFixtureId)) return fixture;

			const maxX = Math.max(0, layout.floorWidth - fixture.width);
			const maxY = Math.max(0, layout.floorHeight - fixture.height);
			const nextX = Math.min(Math.max(0, fixture.x + offset), maxX);
			const nextY = Math.min(Math.max(0, fixture.y + offset), maxY);
			const dx = nextX - fixture.x;
			const dy = nextY - fixture.y;

			return {
				...fixture,
				x: nextX,
				y: nextY,
				polygon: fixture.polygon
					? fixture.polygon.map(
							([x, y]) => [x + dx, y + dy] as [number, number],
						)
					: null,
			};
		}),
	};
}

function resolveExportDownloadUrl(downloadUrl: string): string {
	const value = downloadUrl.trim();
	if (/^https?:\/\//i.test(value)) return value;
	if (value.startsWith("/")) {
		return new URL(value, window.location.origin).href;
	}

	const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "/");
	const base = apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`;
	return new URL(value, new URL(base, window.location.origin)).href;
}

function EditorContent({
	layoutId,
	storeId,
}: {
	layoutId: string;
	storeId: string;
}) {
	const mode: ViewMode = "2D";
	const navigate = useNavigate();
	const [isEditorPanelCollapsed, setIsEditorPanelCollapsed] = useState(false);
	const [isCameraCaptureOpen, setIsCameraCaptureOpen] = useState(false);
	const {
		layout,
		layoutVersion,
		selectedIndex,
		selectedIndices,
		selectedDetectionItemId,
		setSelectedIndicesBatch,
		setLayout,
		syncLayout,
		undo,
		redo,
		copyFixtures,
		pasteFixtures,
		deleteFixtures,
		updateFixture,
		setSelectedDetectionItem,
		zoneDraftCategory,
		cameraDraftPhotoId,
		cancelZoneDraft,
		cancelCameraDraft,
	} = useLayout();
	const layoutIdNum = Number(layoutId);
	const storeIdNum = Number(storeId);
	const queryClient = useQueryClient();
	const copiedDetectionItemRef = useRef<{
		fixtureIndex: number;
		item: FixtureDetectionItemPreview;
	} | null>(null);

	const { data: layoutDetail, isLoading: isLoadingLayout } = useQuery({
		queryKey: ["layouts", "detail", layoutIdNum],
		queryFn: () => ENV_LAYOUT_ADAPTER.getLayoutDetail(layoutIdNum),
		staleTime: Number.POSITIVE_INFINITY,
	});
	const lastSavedVersionRef = useRef(0);
	const saveMsgTimeoutRef = useRef<number | null>(null);
	const isMountedRef = useRef(false);

	useEffect(() => {
		isMountedRef.current = true;
		cleanupLegacyFloorplanStorage();
		return () => {
			isMountedRef.current = false;
			if (saveMsgTimeoutRef.current !== null) {
				window.clearTimeout(saveMsgTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		function handleCameraCaptureOpen(event: Event) {
			const detail = (event as CustomEvent<{ open?: boolean }>).detail;
			setIsCameraCaptureOpen(detail?.open === true);
		}
		window.addEventListener(
			"layout-camera-capture-open",
			handleCameraCaptureOpen,
		);
		return () => {
			window.removeEventListener(
				"layout-camera-capture-open",
				handleCameraCaptureOpen,
			);
		};
	}, []);

	useEffect(() => {
		if (layoutDetail && layout === null) {
			const editorLayout = layoutDetailToEditorJSON(layoutDetail);
			const rawPhotoState = window.localStorage.getItem(
				`dogo-fixture-photos:${layoutIdNum}`,
			);
			let photoState: Record<string, unknown> = {};
			try {
				photoState = rawPhotoState
					? (JSON.parse(rawPhotoState) as Record<string, unknown>)
					: {};
			} catch {
				photoState = {};
			}
			setLayout({
				...editorLayout,
				fixtures: editorLayout.fixtures.map((fixture, index) => ({
					...fixture,
					detectionPreview:
						(photoState[
							getFixturePhotoStateKey(fixture, index)
						] as typeof fixture.detectionPreview) ??
						(photoState[
							getLegacyFixturePhotoStateKey(fixture)
						] as typeof fixture.detectionPreview) ??
						fixture.detectionPreview,
				})),
			});
			lastSavedVersionRef.current = layoutVersion + 1;
		}
	}, [layoutDetail, layout, layoutIdNum, layoutVersion, setLayout]);

	const [exportMsg, setExportMsg] = useState<string | null>(null);
	const [isSavingFloorSize, setIsSavingFloorSize] = useState(false);

	const [saveToast, setSaveToast] = useState<SaveToastState>(null);
	const showSaveMessage = useCallback((message: string) => {
		if (saveMsgTimeoutRef.current !== null) {
			window.clearTimeout(saveMsgTimeoutRef.current);
			saveMsgTimeoutRef.current = null;
		}
		setSaveToast({
			id: Date.now(),
			message,
			variant: message.startsWith("저장 실패") ? "error" : "success",
		});
	}, []);

	useEffect(() => {
		if (!saveToast) return;
		if (saveMsgTimeoutRef.current !== null) {
			window.clearTimeout(saveMsgTimeoutRef.current);
		}
		saveMsgTimeoutRef.current = window.setTimeout(() => {
			if (!isMountedRef.current) return;
			setSaveToast(null);
			saveMsgTimeoutRef.current = null;
		}, 2500);
		return () => {
			if (saveMsgTimeoutRef.current !== null) {
				window.clearTimeout(saveMsgTimeoutRef.current);
				saveMsgTimeoutRef.current = null;
			}
		};
	}, [saveToast]);

	const saveMutation = useMutation({
		mutationFn: (fixtures: ReturnType<typeof editorFixturesToApiItems>) =>
			ENV_LAYOUT_ADAPTER.updateLayout(layoutIdNum, { fixtures }),
	});
	const isSavingLayout = saveMutation.isPending;
	const saveLayoutMutation = saveMutation.mutateAsync;
	const saveLayoutNow = useCallback(
		async (
			successMessage?: string,
			options?: { silent?: boolean; force?: boolean },
		) => {
			if (!layout) return true;
			if (!options?.force && layoutVersion <= lastSavedVersionRef.current) {
				if (successMessage && !options?.silent) {
					showSaveMessage(successMessage);
				}
				return true;
			}
			const versionToSave = layoutVersion;
			try {
				const fixturesToSave = editorFixturesToApiItems(layout.fixtures ?? []);
				let latestLayout = await (options?.silent
					? ENV_LAYOUT_ADAPTER.updateLayout(layoutIdNum, {
							fixtures: fixturesToSave,
						})
					: saveLayoutMutation(fixturesToSave));
				latestLayout ??= await ENV_LAYOUT_ADAPTER.getLayoutDetail(layoutIdNum);
				queryClient.setQueryData(
					["layouts", "detail", layoutIdNum],
					latestLayout,
				);
				lastSavedVersionRef.current = Math.max(
					lastSavedVersionRef.current,
					versionToSave,
				);
				if (isMountedRef.current && !options?.silent) {
					syncLayout(
						mergeEditorStateFromCurrentLayout(
							layoutDetailToEditorJSON(latestLayout),
							layout,
						),
					);
				}
				if (successMessage && !options?.silent) {
					showSaveMessage(successMessage);
				}
				window.dataLayer = window.dataLayer || [];
				window.dataLayer.push({
					event: "save_vmd_version",
					layout_id: layoutIdNum,
					fixtures_count: fixturesToSave.length,
					status: "success",
				});
				return true;
			} catch (err) {
				const detailText =
					err instanceof ApiError && err.details
						? ` (${JSON.stringify(err.details)})`
						: "";
				if (!options?.silent) {
					showSaveMessage(
						`저장 실패: ${err instanceof Error ? err.message : "오류"}${detailText}`,
					);
				}
				window.dataLayer = window.dataLayer || [];
				window.dataLayer.push({
					event: "save_vmd_version",
					layout_id: layoutIdNum,
					status: "fail",
					error_message: err instanceof Error ? err.message : "오류",
				});
				return false;
			}
		},
		[
			layout,
			layoutIdNum,
			layoutVersion,
			queryClient,
			saveLayoutMutation,
			showSaveMessage,
			syncLayout,
		],
	);

	const handleDuplicateFixtures = useCallback(
		async (indices: number[]): Promise<number[]> => {
			if (!layout || indices.length === 0) return [];

			const fixturesToSave = editorFixturesToApiItems(layout.fixtures ?? []);
			const hasUnsavedChanges = layoutVersion > lastSavedVersionRef.current;
			const selectedHasServerIds = indices.every((index) => {
				const fixture = layout.fixtures[index];
				return Boolean(
					fixture?.layoutFixtureId ??
						fixture?.apiMeta?.layoutFixtureId ??
						Number(fixture?.id),
				);
			});

			let baseLayoutDetail = layoutDetail ?? null;
			if (hasUnsavedChanges || !selectedHasServerIds) {
				baseLayoutDetail = await ENV_LAYOUT_ADAPTER.updateLayout(layoutIdNum, {
					fixtures: fixturesToSave,
				});
				queryClient.setQueryData(
					["layouts", "detail", layoutIdNum],
					baseLayoutDetail,
				);
				lastSavedVersionRef.current = Math.max(
					lastSavedVersionRef.current,
					layoutVersion,
				);
			}
			baseLayoutDetail ??=
				await ENV_LAYOUT_ADAPTER.getLayoutDetail(layoutIdNum);

			const layoutFixtureIds = indices
				.map((index) => baseLayoutDetail?.fixtures[index]?.layout_fixture_id)
				.filter((id): id is number => typeof id === "number" && id > 0);
			if (layoutFixtureIds.length !== indices.length) {
				throw new Error("저장된 집기 ID를 확인할 수 없어 복제할 수 없습니다.");
			}

			const copyResult = await ENV_LAYOUT_ADAPTER.copyFixtures(layoutIdNum, {
				layout_fixture_ids: layoutFixtureIds,
			});
			const copiedLayoutFixtureIds =
				copyResult.copied?.map((item) => item.new_layout_fixture_id) ?? [];
			const copiedIdSet = new Set(copiedLayoutFixtureIds);

			const copiedLayoutDetail =
				await ENV_LAYOUT_ADAPTER.getLayoutDetail(layoutIdNum);
			let nextLayout = mergeEditorStateFromCurrentLayout(
				layoutDetailToEditorJSON(copiedLayoutDetail),
				layout,
			);
			nextLayout = offsetCopiedFixtures(nextLayout, copiedLayoutFixtureIds);
			const finalLayoutDetail = await ENV_LAYOUT_ADAPTER.updateLayout(
				layoutIdNum,
				{
					fixtures: editorFixturesToApiItems(nextLayout.fixtures),
				},
			);
			queryClient.setQueryData(
				["layouts", "detail", layoutIdNum],
				finalLayoutDetail,
			);

			const finalLayout = mergeEditorStateFromCurrentLayout(
				layoutDetailToEditorJSON(finalLayoutDetail),
				nextLayout,
			);
			syncLayout(finalLayout);
			lastSavedVersionRef.current = Math.max(
				lastSavedVersionRef.current,
				layoutVersion,
			);

			if (copiedIdSet.size > 0) {
				return finalLayout.fixtures.flatMap((fixture, index) => {
					const layoutFixtureId =
						fixture.layoutFixtureId ?? fixture.apiMeta?.layoutFixtureId;
					return layoutFixtureId && copiedIdSet.has(layoutFixtureId)
						? [index]
						: [];
				});
			}

			return finalLayout.fixtures
				.slice(-copyResult.copied_count)
				.map(
					(_, index) =>
						finalLayout.fixtures.length - copyResult.copied_count + index,
				);
		},
		[layout, layoutDetail, layoutIdNum, layoutVersion, queryClient, syncLayout],
	);

	const handleGoToLayoutList = useCallback(() => {
		void navigate({
			to: "/stores/$storeId/layouts",
			params: { storeId },
		});
	}, [navigate, storeId]);

	const handleSaveFloorSize = useCallback(
		async (floorWidth: number, floorHeight: number) => {
			setIsSavingFloorSize(true);
			try {
				await ENV_STORE_ADAPTER.updateStore(storeIdNum, {
					width: floorWidth,
					depth: floorHeight,
				});
				const latestLayout =
					await ENV_LAYOUT_ADAPTER.getLayoutDetail(layoutIdNum);
				queryClient.setQueryData(
					["layouts", "detail", layoutIdNum],
					latestLayout,
				);
				if (isMountedRef.current && layout) {
					syncLayout(
						mergeEditorStateFromCurrentLayout(
							layoutDetailToEditorJSON(latestLayout),
							layout,
						),
					);
				}
				showSaveMessage("도면 크기 저장 완료");
				return true;
			} catch (err) {
				showSaveMessage(
					`도면 크기 저장 실패: ${err instanceof Error ? err.message : "오류"}`,
				);
				return false;
			} finally {
				setIsSavingFloorSize(false);
			}
		},
		[layout, layoutIdNum, queryClient, showSaveMessage, storeIdNum, syncLayout],
	);

	const handleExportPdf = useCallback(async () => {
		if (!layout) {
			setExportMsg("PDF로 내보낼 레이아웃을 아직 불러오지 못했습니다.");
			setTimeout(() => setExportMsg(null), 4000);
			return;
		}

		const pdfWindow = window.open("", "_blank");
		if (!pdfWindow) {
			setExportMsg("PDF 창을 열 수 없습니다. 팝업 차단을 확인해주세요.");
			setTimeout(() => setExportMsg(null), 6000);
			return;
		}

		pdfWindow.document.open();
		pdfWindow.document.write(
			"<!doctype html><title>PDF 생성 중</title><body style='font-family: system-ui; padding: 24px;'>PDF를 생성하는 중입니다...</body>",
		);
		pdfWindow.document.close();
		setExportMsg("PDF 생성 요청 중입니다.");

		try {
			const saved = await saveLayoutNow(undefined, {
				silent: true,
				force: true,
			});
			if (!saved) {
				pdfWindow.close();
				setExportMsg("PDF 생성 전 레이아웃 저장에 실패했습니다.");
				setTimeout(() => setExportMsg(null), 6000);
				return;
			}

			const result = await ENV_LAYOUT_ADAPTER.exportPdf(
				storeIdNum,
				layoutIdNum,
				{
					paper_size: "A4",
					orientation: "landscape",
					include_labels: false,
					show_grid: false,
				},
			);
			pdfWindow.location.href = resolveExportDownloadUrl(result.download_url);
			setExportMsg("PDF 다운로드를 시작했습니다.");
			setTimeout(() => setExportMsg(null), 3000);
		} catch (err) {
			pdfWindow.close();
			setExportMsg(
				`PDF 생성 실패: ${err instanceof Error ? err.message : "오류"}`,
			);
			setTimeout(() => setExportMsg(null), 6000);
		}
	}, [layout, layoutIdNum, saveLayoutNow, storeIdNum]);

	useEffect(() => {
		if (!layout) return;
		const photoState = Object.fromEntries(
			layout.fixtures
				.filter((fixture) => fixture.detectionPreview)
				.map((fixture, index) => [
					getFixturePhotoStateKey(fixture, index),
					fixture.detectionPreview,
				]),
		);
		if (Object.keys(photoState).length > 0) {
			try {
				window.localStorage.setItem(
					`dogo-fixture-photos:${layoutIdNum}`,
					JSON.stringify(photoState),
				);
			} catch (error) {
				cleanupLegacyFloorplanStorage();
				console.warn(
					"[layout-editor] 사진 상태 저장 공간 확보 후 재시도",
					error,
				);
				try {
					window.localStorage.setItem(
						`dogo-fixture-photos:${layoutIdNum}`,
						JSON.stringify(photoState),
					);
				} catch (retryError) {
					console.warn(
						"[layout-editor] 사진 상태를 localStorage에 저장하지 못했습니다",
						retryError,
					);
				}
			}
		}
	}, [layout, layoutIdNum]);

	useEffect(() => {
		const hasUnsavedChanges =
			layout !== null && layoutVersion > lastSavedVersionRef.current;
		if (!hasUnsavedChanges || isSavingLayout) return;

		const timer = window.setTimeout(() => {
			void saveLayoutNow(undefined, { silent: true });
		}, 400);
		return () => window.clearTimeout(timer);
	}, [isSavingLayout, layout, layoutVersion, saveLayoutNow]);

	useEffect(() => {
		const onForceSave = () => {
			void saveLayoutNow(undefined, { silent: true, force: true });
		};
		window.addEventListener("layout-force-save", onForceSave);
		return () => window.removeEventListener("layout-force-save", onForceSave);
	}, [saveLayoutNow]);

	useEffect(() => {
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			const shouldBlock =
				isSavingLayout ||
				(layout !== null && layoutVersion > lastSavedVersionRef.current);
			if (!shouldBlock) return;
			void saveLayoutNow(undefined, { silent: true });
			event.preventDefault();
			event.returnValue = "";
		};

		window.addEventListener("beforeunload", onBeforeUnload);
		return () => window.removeEventListener("beforeunload", onBeforeUnload);
	}, [isSavingLayout, layout, layoutVersion, saveLayoutNow]);

	useBlocker({
		shouldBlockFn: async () => {
			const shouldSave =
				isSavingLayout ||
				(layout !== null && layoutVersion > lastSavedVersionRef.current);
			if (!shouldSave) return false;
			return !(await saveLayoutNow(undefined, { silent: true }));
		},
	});

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === "INPUT" || target.tagName === "TEXTAREA")
			) {
				return;
			}
			if (e.key === "Escape" && (zoneDraftCategory || cameraDraftPhotoId)) {
				e.preventDefault();
				cancelZoneDraft();
				cancelCameraDraft();
				return;
			}
			if (e.key === "Backspace" || e.key === "Delete") {
				if (!layout) return;
				if (selectedDetectionItemId !== null && selectedIndex !== null) {
					const fixture = layout.fixtures[selectedIndex];
					const detectionPreview = fixture?.detectionPreview;
					if (detectionPreview) {
						e.preventDefault();
						const removeSelectedItem = () => {
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
						};
						if (!detectionPreview.taskId) {
							removeSelectedItem();
							return;
						}
						void ENV_PRODUCT_DETECTION_ADAPTER.rejectItem({
							taskId: detectionPreview.taskId,
							itemId: selectedDetectionItemId,
						})
							.then(removeSelectedItem)
							.catch((error: unknown) => {
								showSaveMessage(
									`상품 삭제 실패: ${error instanceof Error ? error.message : "오류"}`,
								);
							});
						return;
					}
				}
				if (selectedIndices.length === 0) return;
				e.preventDefault();
				const deletable = selectedIndices.filter(
					(i) => !layout.fixtures[i]?.locked,
				);
				if (deletable.length > 0) deleteFixtures(deletable);
				return;
			}
			const meta = e.ctrlKey || e.metaKey;
			if (!meta) return;
			const k = e.key.toLowerCase();
			if (k === "a") {
				if (!layout?.fixtures) return;
				e.preventDefault();
				setSelectedIndicesBatch(
					layout.fixtures.map((_, i) => i),
					true,
				);
			} else if (k === "s") {
				e.preventDefault();
				void saveLayoutNow("저장 완료", { force: true });
			} else if (k === "z" && !e.shiftKey) {
				e.preventDefault();
				undo();
			} else if ((k === "z" && e.shiftKey) || k === "y") {
				e.preventDefault();
				redo();
			} else if (k === "c") {
				e.preventDefault();
				if (
					selectedDetectionItemId !== null &&
					selectedIndex !== null &&
					layout
				) {
					const item = layout.fixtures[
						selectedIndex
					]?.detectionPreview?.items.find(
						(item) => item.detectionItemId === selectedDetectionItemId,
					);
					if (item) {
						copiedDetectionItemRef.current = {
							fixtureIndex: selectedIndex,
							item: structuredClone(item),
						};
						return;
					}
				}
				copyFixtures(selectedIndices);
			} else if (k === "v") {
				e.preventDefault();
				if (
					copiedDetectionItemRef.current &&
					selectedIndex !== null &&
					layout
				) {
					const fixture = layout.fixtures[selectedIndex];
					if (!fixture) return;
					const currentPreview =
						fixture.detectionPreview ?? createEmptyDetectionPreview();
					const maxDetectionItemId = Math.max(
						0,
						...layout.fixtures.flatMap(
							(fixture) =>
								fixture.detectionPreview?.items.map(
									(item) => item.detectionItemId,
								) ?? [],
						),
					);
					const pastedItem: FixtureDetectionItemPreview = {
						...structuredClone(copiedDetectionItemRef.current.item),
						detectionItemId: maxDetectionItemId + 1,
						relativePosition: {
							x:
								copiedDetectionItemRef.current.fixtureIndex === selectedIndex
									? copiedDetectionItemRef.current.item.relativePosition.x +
										0.05
									: copiedDetectionItemRef.current.item.relativePosition.x,
							y:
								copiedDetectionItemRef.current.fixtureIndex === selectedIndex
									? copiedDetectionItemRef.current.item.relativePosition.y +
										0.05
									: copiedDetectionItemRef.current.item.relativePosition.y,
						},
					};
					updateFixture(selectedIndex, {
						detectionPreview: {
							...currentPreview,
							items: [...currentPreview.items, pastedItem],
						},
					});
					setSelectedDetectionItem(pastedItem.detectionItemId);
					return;
				}
				const newIdxs = pasteFixtures();
				if (newIdxs.length > 0) setSelectedIndicesBatch(newIdxs, true);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [
		layout,
		selectedDetectionItemId,
		selectedIndex,
		selectedIndices,
		setSelectedIndicesBatch,
		undo,
		redo,
		copyFixtures,
		pasteFixtures,
		deleteFixtures,
		updateFixture,
		setSelectedDetectionItem,
		showSaveMessage,
		zoneDraftCategory,
		cameraDraftPhotoId,
		saveLayoutNow,
		cancelZoneDraft,
		cancelCameraDraft,
	]);

	return (
		<div className="relative h-[calc(100vh-60px)] overflow-hidden">
			<div
				className={`absolute inset-0 z-0 px-4 pb-4 pt-16 transition-[padding] duration-200 ${
					isEditorPanelCollapsed ? "md:pl-[76px]" : "md:pl-[312px]"
				}`}
			>
				<div className="relative h-full w-full overflow-hidden rounded-2xl border border-border/60 bg-white/70 shadow-sm">
					<div className="absolute inset-0">
						<Canvas2D />
					</div>
					{isLoadingLayout && (
						<div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
							<span className="text-sm text-muted-foreground">
								레이아웃 불러오는 중...
							</span>
						</div>
					)}
				</div>
			</div>

			<EditorPanel
				collapsed={isEditorPanelCollapsed}
				exportDisabled={isLoadingLayout || layout === null}
				exportMsg={exportMsg}
				floorplanPreviewUrl={layoutDetail?.floorplan_image_url ?? null}
				isSavingFloorSize={isSavingFloorSize}
				layoutName={layoutDetail?.name ?? `레이아웃 #${layoutId}`}
				onCollapsedChange={setIsEditorPanelCollapsed}
				onExportPdf={handleExportPdf}
				onGoToLayoutList={handleGoToLayoutList}
				onSaveFloorSize={handleSaveFloorSize}
			/>

			{!isCameraCaptureOpen && (
				<div className="pointer-events-none absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-3">
					<div className="pointer-events-auto">
						<ModeToggle value={mode} onChange={() => {}} />
					</div>
					<button
						type="button"
						onClick={() => void saveLayoutNow("저장 완료", { force: true })}
						disabled={isSavingLayout || isLoadingLayout || layout === null}
						className="pointer-events-auto rounded-full border border-border bg-white/95 px-4 py-2 text-sm text-gray-600 shadow-sm backdrop-blur hover:bg-gray-50 hover:text-text disabled:opacity-50"
					>
						저장
					</button>
				</div>
			)}

			{saveToast && (
				<div className="pointer-events-none fixed right-4 top-20 z-[99999]">
					<div
						data-testid="layout-save-toast"
						key={saveToast.id}
						className={
							saveToast.variant === "error"
								? "rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-lg"
								: "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg"
						}
					>
						{saveToast.message}
					</div>
				</div>
			)}

			{!isCameraCaptureOpen && (
				<Edit2DToolbar onDuplicateFixtures={handleDuplicateFixtures} />
			)}
		</div>
	);
}
