import { useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLayout } from "@/features/layout-editor/LayoutContext";
import type {
	Fixture,
	FixtureDetectionPreview,
} from "@/features/layout-editor/layout.types";
import { CameraCaptureDialog } from "@/features/product-detection/components/CameraCaptureDialog";
import {
	useCreateDetectionTask,
	useDetectionTaskQuery,
	useGenerate3DForDetectionItems,
} from "@/features/product-detection/hooks/useDetectionTask";
import { ENV_PRODUCT_DETECTION_ADAPTER } from "@/features/product-detection/product-detection.adapter";
import type {
	DetectionItem,
	DetectionTaskStatus,
} from "@/features/product-detection/product-detection.types";

const ALLOWED_RE = /\.(png|jpe?g|webp)$/i;
const DETECTION_POLL_INTERVAL_MS = 2000;
const DETECTION_POLL_LIMIT = 90;
const ASSET_3D_POLL_LIMIT = 90;

function wait(ms: number) {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

type DetectionPreviewStatus = DetectionTaskStatus | "IDLE";

const STATUS_LABEL: Record<DetectionPreviewStatus, string> = {
	IDLE: "업로드 대기",
	PENDING: "탐지 대기",
	PROCESSING: "탐지 처리 중",
	COMPLETED: "탐지 완료",
	FAILED: "탐지 실패",
};

function getFixturePhotoStateKey(
	fixture: { layoutFixtureId?: number | null; id?: string },
	index: number,
) {
	if (fixture.layoutFixtureId) return `layout:${fixture.layoutFixtureId}`;
	if (fixture.id) return `client:${fixture.id}`;
	return `index:${index}`;
}

function createEmptyDetectionPreview(
	sourceImageUrl?: string | null,
): FixtureDetectionPreview {
	return {
		sourceImageUrl: sourceImageUrl ?? null,
		taskId: null,
		taskStatus: "IDLE",
		taskUpdatedAt: null,
		errorMessage: null,
		items: [],
	};
}

function buildDetectionPreviewFromTask(
	task: {
		detection_task_id: number;
		status: DetectionTaskStatus;
		error_message: string | null;
		updated_at: string;
		items: DetectionItem[];
	},
	prev: FixtureDetectionPreview | null | undefined,
): FixtureDetectionPreview {
	return {
		sourceImageUrl: prev?.sourceImageUrl ?? null,
		taskId: task.detection_task_id,
		taskStatus: task.status,
		taskUpdatedAt: task.updated_at,
		errorMessage: task.error_message,
		deletedDetectionItemIds: prev?.deletedDetectionItemIds ?? [],
		items: task.items
			.filter(
				(item) =>
					item.status !== "REJECTED" &&
					!(prev?.deletedDetectionItemIds ?? []).includes(
						item.detection_item_id,
					),
			)
			.map((item) => {
				const prevItem = prev?.items.find(
					(prevItem) => prevItem.detectionItemId === item.detection_item_id,
				);
				return {
					detectionItemId: item.detection_item_id,
					name: prevItem?.name ?? `상품 ${item.detection_item_id}`,
					thumbnailUrl: item.thumbnail_url ?? prevItem?.thumbnailUrl ?? "",
					relativePosition: item.relative_position,
					relativeSize: item.relative_size,
					confidence: item.confidence,
					assetGenerationStatus: item.asset_generation_status,
					asset3dUrl: item.asset_3d_url,
				};
			}),
	};
}

function fixtureSummary(fixture: Fixture) {
	return {
		layoutFixtureId: fixture.layoutFixtureId ?? (Number(fixture.id) || null),
		fixtureVersionId: fixture.fixtureVersionId ?? null,
		fixtureId: fixture.fixtureId ?? null,
	};
}

export function PhotosTab() {
	const { storeId, layoutId } = useParams({
		from: "/stores/$storeId/layouts/$layoutId/edit",
	});
	const previewUrlByFixtureRef = useRef(new Map<string, string>());
	const convertStartTimeRef = useRef<number>(0);
	const latestLayoutRef = useRef<ReturnType<typeof useLayout>["layout"]>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isCameraDialogOpen, setIsCameraDialogOpen] = useState(false);

	useEffect(() => {
		window.dispatchEvent(
			new CustomEvent("layout-camera-capture-open", {
				detail: { open: isCameraDialogOpen },
			}),
		);
		return () => {
			window.dispatchEvent(
				new CustomEvent("layout-camera-capture-open", {
					detail: { open: false },
				}),
			);
		};
	}, [isCameraDialogOpen]);

	const {
		layout,
		selectedIndex,
		selectedDetectionItemId,
		setSelectedDetectionItem,
		updateFixture,
	} = useLayout();
	const createDetectionTask = useCreateDetectionTask();
	const generate3D = useGenerate3DForDetectionItems();

	useEffect(() => {
		latestLayoutRef.current = layout;
	}, [layout]);

	const selectedFixture =
		selectedIndex !== null ? (layout?.fixtures?.[selectedIndex] ?? null) : null;
	const selectedPreview = selectedFixture?.detectionPreview ?? null;
	const taskId = selectedPreview?.taskId ?? null;
	const detectionTaskQuery = useDetectionTaskQuery(taskId);

	useEffect(() => {
		if (
			selectedIndex === null ||
			!selectedFixture ||
			!detectionTaskQuery.data
		) {
			return;
		}
		const nextPreview = buildDetectionPreviewFromTask(
			detectionTaskQuery.data,
			selectedFixture.detectionPreview,
		);
		const prev = selectedFixture.detectionPreview;
		const prevThumbnailSignature = prev?.items
			.map((item) => `${item.detectionItemId}:${item.thumbnailUrl}`)
			.join("|");
		const nextThumbnailSignature = nextPreview.items
			.map((item) => `${item.detectionItemId}:${item.thumbnailUrl}`)
			.join("|");
		if (
			prev?.taskId === nextPreview.taskId &&
			prev?.taskStatus === nextPreview.taskStatus &&
			prev?.taskUpdatedAt === nextPreview.taskUpdatedAt &&
			prevThumbnailSignature === nextThumbnailSignature
		) {
			return;
		}
		updateFixture(selectedIndex, { detectionPreview: nextPreview });
	}, [detectionTaskQuery.data, selectedFixture, selectedIndex, updateFixture]);

	const persistDetectionPreview = useCallback(
		(
			fixture: Fixture,
			fixtureIndex: number,
			preview: FixtureDetectionPreview,
		) => {
			const key = `dogo-fixture-photos:${layoutId}`;
			const raw = window.localStorage.getItem(key);
			let state: Record<string, unknown> = {};
			try {
				state = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
			} catch {
				state = {};
			}
			state[getFixturePhotoStateKey(fixture, fixtureIndex)] = preview;
			window.localStorage.setItem(key, JSON.stringify(state));
		},
		[layoutId],
	);

	const patchFixtureDetection = useCallback(
		(
			fixtureIndex: number,
			fixtureSnapshot: Fixture,
			patch: Partial<FixtureDetectionPreview>,
		) => {
			const latestFixture =
				latestLayoutRef.current?.fixtures?.[fixtureIndex] ?? fixtureSnapshot;
			const current = latestFixture.detectionPreview
				? latestFixture.detectionPreview
				: createEmptyDetectionPreview();
			const nextPreview = {
				...current,
				...patch,
			};
			persistDetectionPreview(latestFixture, fixtureIndex, nextPreview);
			updateFixture(fixtureIndex, {
				detectionPreview: nextPreview,
			});
			window.dispatchEvent(new CustomEvent("layout-force-save"));
		},
		[persistDetectionPreview, updateFixture],
	);

	const patchSelectedFixtureDetection = useCallback(
		(patch: Partial<FixtureDetectionPreview>) => {
			if (selectedIndex === null || !selectedFixture) return;
			patchFixtureDetection(selectedIndex, selectedFixture, patch);
		},
		[patchFixtureDetection, selectedFixture, selectedIndex],
	);

	const replaceLocalPreviewUrl = useCallback(
		(fixtureKey: string, nextUrl: string) => {
			const prev = previewUrlByFixtureRef.current.get(fixtureKey);
			if (prev && prev !== nextUrl) {
				URL.revokeObjectURL(prev);
			}
			previewUrlByFixtureRef.current.set(fixtureKey, nextUrl);
		},
		[],
	);

	function renameDetectionItem(detectionItemId: number, name: string) {
		if (!selectedFixture?.detectionPreview) return;
		patchSelectedFixtureDetection({
			items: selectedFixture.detectionPreview.items.map((item) =>
				item.detectionItemId === detectionItemId ? { ...item, name } : item,
			),
		});
	}

	const pollDetectionTaskForFixture = useCallback(
		async (fixtureIndex: number, fixtureSnapshot: Fixture, taskId: number) => {
			for (let attempt = 0; attempt < DETECTION_POLL_LIMIT; attempt += 1) {
				const task = await ENV_PRODUCT_DETECTION_ADAPTER.getTask(taskId);
				const latestPreview =
					latestLayoutRef.current?.fixtures?.[fixtureIndex]?.detectionPreview;
				patchFixtureDetection(
					fixtureIndex,
					fixtureSnapshot,
					buildDetectionPreviewFromTask(task, latestPreview),
				);
				if (task.status === "COMPLETED" || task.status === "FAILED") return;
				await wait(DETECTION_POLL_INTERVAL_MS);
			}
		},
		[patchFixtureDetection],
	);

	const pollAsset3DTasks = useCallback(async (assetTaskIds: number[]) => {
		if (assetTaskIds.length === 0) return;
		for (let attempt = 0; attempt < ASSET_3D_POLL_LIMIT; attempt += 1) {
			const tasks = await Promise.all(
				assetTaskIds.map((taskId) =>
					ENV_PRODUCT_DETECTION_ADAPTER.getAsset3DTask(taskId),
				),
			);
			if (
				tasks.every(
					(task) => task.status === "COMPLETED" || task.status === "FAILED",
				)
			) {
				return;
			}
			await wait(DETECTION_POLL_INTERVAL_MS);
		}
	}, []);

	const handleGenerate3D = useCallback(
		async (detectionItemId: number) => {
			if (
				!selectedPreview?.taskId ||
				!selectedFixture ||
				selectedIndex === null
			) {
				return;
			}
			const prevItem = selectedPreview.items.find(
				(item) => item.detectionItemId === detectionItemId,
			);
			patchSelectedFixtureDetection({
				items: selectedPreview.items.map((item) =>
					item.detectionItemId === detectionItemId
						? { ...item, assetGenerationStatus: "PENDING" }
						: item,
				),
			});
			try {
				const result = await generate3D.mutateAsync({
					taskId: selectedPreview.taskId,
					selectedItemIds: [detectionItemId],
					rejectUnselected: false,
				});
				await pollAsset3DTasks(result.asset_generation_task_ids);
				const task = await ENV_PRODUCT_DETECTION_ADAPTER.getTask(
					selectedPreview.taskId,
				);
				patchFixtureDetection(
					selectedIndex,
					selectedFixture,
					buildDetectionPreviewFromTask(task, selectedPreview),
				);
				if (result.asset_generation_task_ids.length === 0) {
					setErrorMessage(
						"3D 생성 요청은 처리됐지만 생성 작업 ID가 없습니다. 백엔드 3D worker 연결 상태를 확인해주세요.",
					);
				} else {
					setErrorMessage(null);
				}
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "3D 생성 요청에 실패했습니다.";
				setErrorMessage(message);
				patchSelectedFixtureDetection({
					items: selectedPreview.items.map((item) =>
						item.detectionItemId === detectionItemId
							? {
									...item,
									assetGenerationStatus:
										prevItem?.assetGenerationStatus ?? "NOT_REQUESTED",
								}
							: item,
					),
				});
			}
		},
		[
			generate3D,
			patchFixtureDetection,
			patchSelectedFixtureDetection,
			pollAsset3DTasks,
			selectedFixture,
			selectedIndex,
			selectedPreview,
		],
	);

	const handleFile = useCallback(
		async (file: File | undefined): Promise<boolean> => {
			if (!file || !selectedFixture || selectedIndex === null) return false;
			if (!ALLOWED_RE.test(file.name)) {
				setErrorMessage("PNG / JPG / JPEG / WEBP 만 업로드할 수 있습니다.");
				return false;
			}

			const targetIndex = selectedIndex;
			const targetFixture = selectedFixture;
			const { fixtureId, fixtureVersionId } = fixtureSummary(targetFixture);
			const objectUrl = URL.createObjectURL(file);
			replaceLocalPreviewUrl(targetFixture.id, objectUrl);
			setErrorMessage(null);
			patchFixtureDetection(
				targetIndex,
				targetFixture,
				createEmptyDetectionPreview(objectUrl),
			);

			if (fixtureId === null) {
				setErrorMessage(
					"선택한 집기의 fixture_id 를 찾을 수 없습니다. 레이아웃 데이터를 새로고침한 뒤 다시 시도해주세요.",
				);
				return false;
			}

			patchFixtureDetection(targetIndex, targetFixture, {
				taskStatus: "PENDING",
			});

			const startedAt = Date.now();
			convertStartTimeRef.current = startedAt;
			window.dataLayer = window.dataLayer || [];
			window.dataLayer.push({
				event: "ai_3d_convert_start",
				fixture_id: fixtureId,
			});

			try {
				const task = await createDetectionTask.mutateAsync({
					fixtureId,
					file,
					storeId: Number(storeId),
					fixtureVersionId: fixtureVersionId ?? undefined,
				});
				const duration = (Date.now() - startedAt) / 1000;
				window.dataLayer = window.dataLayer || [];
				window.dataLayer.push({
					event: "ai_3d_convert_success",
					duration: duration,
				});
				patchFixtureDetection(targetIndex, targetFixture, {
					taskId: task.detection_task_id,
					taskStatus: task.status,
					errorMessage: null,
					items: [],
				});
				void pollDetectionTaskForFixture(
					targetIndex,
					targetFixture,
					task.detection_task_id,
				);
				return true;
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "상품 탐지 요청에 실패했습니다.";

				window.dataLayer = window.dataLayer || [];
				window.dataLayer.push({
					event: "ai_error",
					error_message: message,
				});

				setErrorMessage(message);
				patchFixtureDetection(targetIndex, targetFixture, {
					taskStatus: "FAILED",
					errorMessage: message,
					items: [],
				});
				return false;
			}
		},
		[
			createDetectionTask,
			patchFixtureDetection,
			pollDetectionTaskForFixture,
			replaceLocalPreviewUrl,
			selectedFixture,
			selectedIndex,
			storeId,
		],
	);

	const fixtureMeta = useMemo(
		() => (selectedFixture ? fixtureSummary(selectedFixture) : null),
		[selectedFixture],
	);

	const detectionStatus = (selectedPreview?.taskStatus ??
		"IDLE") as DetectionPreviewStatus;

	if (!selectedFixture || selectedIndex === null) {
		return (
			<section className="flex flex-col gap-2 rounded-lg bg-white p-4">
				<h3 className="text-xs font-semibold text-text">Detection</h3>
				<p className="text-xs text-muted-foreground">
					먼저 도면에서 집기 하나를 선택하세요. 선택된 집기 기준으로 사진을
					업로드하고 상품 탐지 결과를 확인할 수 있습니다.
				</p>
			</section>
		);
	}

	return (
		<section className="flex flex-col gap-3 rounded-lg bg-white p-4">
			<CameraCaptureDialog
				open={isCameraDialogOpen}
				isUploading={createDetectionTask.isPending}
				onClose={() => setIsCameraDialogOpen(false)}
				onUpload={handleFile}
			/>
			<div className="flex items-start justify-between gap-3">
				<div>
					<h3 className="text-xs font-semibold text-text">Detection</h3>
				</div>
				<div className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
					{STATUS_LABEL[detectionStatus]}
				</div>
			</div>

			<p className="text-[11px] leading-snug text-muted-foreground">
				선택한 집기의 실사 사진을 업로드하면 detection task를 생성하고, polling
				완료 후 상품 썸네일을 이 집기 위에 오버레이합니다.
			</p>

			{fixtureMeta?.fixtureId === null && (
				<div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
					선택한 집기 데이터에 <code>fixture_id</code> 가 없습니다. 최신
					레이아웃 응답이 반영되지 않았을 수 있으니 새로고침 후 다시
					확인해주세요.
				</div>
			)}

			<div className="flex flex-wrap gap-2">
				<label
					data-track="ai-source-upload"
					className={`relative inline-flex overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 ${
						createDetectionTask.isPending
							? "cursor-not-allowed opacity-60"
							: "cursor-pointer"
					}`}
				>
					{createDetectionTask.isPending ? "업로드 중..." : "사진 업로드"}
					<input
						type="file"
						accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
						disabled={createDetectionTask.isPending}
						className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
						onChange={(event) => {
							void handleFile(event.target.files?.[0]);
							event.currentTarget.value = "";
						}}
					/>
				</label>
				<button
					type="button"
					onClick={() => setIsCameraDialogOpen(true)}
					disabled={createDetectionTask.isPending}
					className="rounded-md border border-primary/40 bg-white px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
				>
					사진 촬영
				</button>
				{selectedPreview?.taskId && (
					<button
						type="button"
						onClick={() => detectionTaskQuery.refetch()}
						disabled={detectionTaskQuery.isFetching}
						className="rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-text hover:bg-slate-50 disabled:opacity-60"
					>
						{detectionTaskQuery.isFetching ? "동기화 중..." : "상태 새로고침"}
					</button>
				)}
			</div>

			{(errorMessage ||
				selectedPreview?.errorMessage ||
				detectionTaskQuery.error) && (
				<div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[11px] text-red-700">
					{errorMessage ??
						selectedPreview?.errorMessage ??
						(detectionTaskQuery.error instanceof Error
							? detectionTaskQuery.error.message
							: "탐지 상태를 불러오지 못했습니다.")}
				</div>
			)}

			{selectedPreview?.sourceImageUrl && (
				<div className="flex flex-col gap-2">
					<p className="text-[11px] font-medium text-text">업로드한 사진</p>
					<div className="overflow-hidden rounded-md border border-border bg-slate-50">
						<img
							src={selectedPreview.sourceImageUrl}
							alt={`${selectedFixture.label} source`}
							className="h-40 w-full object-cover"
						/>
					</div>
				</div>
			)}

			{selectedPreview?.taskId && (
				<div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
					task #{selectedPreview.taskId}
					{selectedPreview.taskUpdatedAt
						? ` · updated ${new Date(selectedPreview.taskUpdatedAt).toLocaleString()}`
						: ""}
				</div>
			)}

			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<p className="text-[11px] font-medium text-text">탐지된 상품 후보</p>
					<span className="text-[11px] text-muted-foreground">
						{selectedPreview?.items.length ?? 0}개
					</span>
				</div>

				{selectedPreview?.items.length ? (
					<div className="grid grid-cols-1 gap-2">
						{selectedPreview.items.map((item) => (
							<div
								key={item.detectionItemId}
								className={`overflow-hidden rounded-md border bg-white text-left transition-colors ${
									selectedDetectionItemId === item.detectionItemId
										? "border-primary ring-2 ring-primary/30"
										: "border-border hover:border-primary/40"
								}`}
							>
								{item.thumbnailUrl ? (
									<img
										src={item.thumbnailUrl}
										alt={`Detection ${item.detectionItemId}`}
										className="h-20 w-full bg-slate-100 object-contain"
									/>
								) : (
									<div className="flex h-20 w-full items-center justify-center bg-slate-100 text-[10px] text-muted-foreground">
										thumbnail 준비 중
									</div>
								)}
								<div className="space-y-1 px-2 py-1.5 text-[10px] text-muted-foreground">
									<input
										value={item.name ?? `상품 ${item.detectionItemId}`}
										onClick={(event) => event.stopPropagation()}
										onChange={(event) =>
											renameDetectionItem(
												item.detectionItemId,
												event.target.value,
											)
										}
										className="h-6 w-full rounded border border-border bg-white px-1.5 text-[10px] font-medium text-text"
										aria-label={`상품 ${item.detectionItemId} 이름`}
									/>
									<p>
										pos {item.relativePosition.x.toFixed(2)},
										{item.relativePosition.y.toFixed(2)}
									</p>
									<p>
										size {item.relativeSize.width.toFixed(2)}×
										{item.relativeSize.height.toFixed(2)}
									</p>
									<p>
										confidence{" "}
										{item.confidence !== null
											? `${(item.confidence * 100).toFixed(0)}%`
											: "-"}
									</p>
									<div className="flex items-center justify-between gap-2 pt-1">
										<span>
											3D {item.assetGenerationStatus ?? "NOT_REQUESTED"}
										</span>
										<button
											type="button"
											data-track="ai-detection-select"
											onClick={(event) => {
												event.stopPropagation();
												setSelectedDetectionItem(item.detectionItemId);
											}}
											className="rounded border border-border px-2 py-0.5 text-[10px] font-medium text-text hover:bg-slate-50"
										>
											선택
										</button>
										<button
											type="button"
											onClick={(event) => {
												event.stopPropagation();
												void handleGenerate3D(item.detectionItemId);
											}}
											disabled={
												generate3D.isPending ||
												item.assetGenerationStatus === "PENDING" ||
												item.assetGenerationStatus === "PROCESSING"
											}
											className="rounded border border-primary/30 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
										>
											{item.asset3dUrl ? "3D 재생성" : "3D 생성"}
										</button>
									</div>
								</div>
							</div>
						))}
					</div>
				) : (
					<p className="rounded-md border border-dashed border-border px-3 py-4 text-[11px] text-muted-foreground">
						{selectedPreview?.taskStatus === "COMPLETED"
							? "탐지 완료됐지만 후보 상품이 없습니다."
							: "탐지 결과가 아직 없습니다."}
					</p>
				)}
			</div>
		</section>
	);
}
