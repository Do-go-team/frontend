import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useCreateProducts } from "@/features/product/hooks/useProducts";
import type { ProductItem } from "@/features/product/product.types";
import {
	useCreateDetectionTask,
	useDetectionTaskQuery,
} from "@/features/product-detection/hooks/useDetectionTask";
import { useStoreProductsQuery } from "@/features/store-product/hooks/useStoreProducts";
import { Button, Input, Skeleton } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { getErrorMessage } from "@/shared/utils/error";
import type {
	FixtureDetail,
	FixtureItem,
	FixtureVersion,
	PlacementInput,
	PlacementItem,
} from "../fixture.types";
import {
	useCreateFixture,
	useCreateFixtureVersion,
	useDeleteFixture,
	useDeleteFixtureVersion,
	useFixtureDetailQuery,
	useFixturesQuery,
	useFixtureVersionsQuery,
	usePlacementsQuery,
	useUpdateFixture,
	useUpdatePlacements,
} from "../hooks/useFixtures";

interface FixtureLibraryManagerProps {
	storeId: number;
	onActivateFixture?: (fixture: FixtureItem) => void;
}

interface FixtureDraft {
	name: string;
	width: string;
	height: string;
	depth: string;
}

interface PlacementDraft {
	placement_id?: number;
	variant_id: string;
	local_pos_x: string;
	local_pos_y: string;
	local_pos_z: string;
	status: string;
	memo: string;
}

const EMPTY_FIXTURES: FixtureItem[] = [];
const EMPTY_VERSIONS: FixtureVersion[] = [];
const EMPTY_PLACEMENTS: PlacementItem[] = [];
const EMPTY_PRODUCTS: ProductItem[] = [];
const EMPTY_DRAFT: FixtureDraft = {
	name: "",
	width: "",
	height: "",
	depth: "",
};

function fixtureDraftFromDetail(detail: FixtureDetail): FixtureDraft {
	return {
		name: detail.name,
		width: detail.dimensions.width.toString(),
		height: detail.dimensions.height.toString(),
		depth: detail.dimensions.depth.toString(),
	};
}

function placementDraftFromItem(item: PlacementItem): PlacementDraft {
	return {
		placement_id: item.placement_id,
		variant_id: item.variant.variant_id.toString(),
		local_pos_x: item.local_pos_x.toString(),
		local_pos_y: item.local_pos_y.toString(),
		local_pos_z: item.local_pos_z.toString(),
		status: item.status,
		memo: item.memo ?? "",
	};
}

function parseRequiredNumber(value: string) {
	const parsed = Number(value.trim());
	return Number.isFinite(parsed) ? parsed : null;
}

function buildFixtureRequest(draft: FixtureDraft) {
	const width = parseRequiredNumber(draft.width);
	const height = parseRequiredNumber(draft.height);
	const depth = parseRequiredNumber(draft.depth);
	if (
		!draft.name.trim() ||
		width === null ||
		height === null ||
		depth === null
	) {
		return null;
	}
	return {
		name: draft.name.trim(),
		width,
		height,
		depth,
	};
}

function buildPlacementRequest(
	placements: PlacementDraft[],
): PlacementInput[] | null {
	const parsed: PlacementInput[] = [];

	for (const placement of placements) {
		const variantId = parseRequiredNumber(placement.variant_id);
		const localPosX = parseRequiredNumber(placement.local_pos_x);
		const localPosY = parseRequiredNumber(placement.local_pos_y);
		const localPosZ = parseRequiredNumber(placement.local_pos_z);
		if (
			variantId === null ||
			localPosX === null ||
			localPosY === null ||
			localPosZ === null
		) {
			return null;
		}

		const nextPlacement: PlacementInput = {
			variant_id: variantId,
			local_pos_x: localPosX,
			local_pos_y: localPosY,
			local_pos_z: localPosZ,
			status: placement.status.trim() || undefined,
			memo: placement.memo.trim() || undefined,
		};
		if (placement.placement_id !== undefined) {
			nextPlacement.placement_id = placement.placement_id;
		}
		parsed.push(nextPlacement);
	}

	return parsed;
}

function DetectionStatusBadge({ status }: { status: string }) {
	return (
		<span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
			{status}
		</span>
	);
}

export function FixtureLibraryManager({
	storeId,
	onActivateFixture,
}: FixtureLibraryManagerProps) {
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search);
	const [selectedFixtureId, setSelectedFixtureId] = useState<number | null>(
		null,
	);
	const [selectedVersionId, setSelectedVersionId] = useState<number | null>(
		null,
	);
	const [newFixtureDraft, setNewFixtureDraft] =
		useState<FixtureDraft>(EMPTY_DRAFT);
	const [newVersionName, setNewVersionName] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [taskId, setTaskId] = useState<number | null>(null);
	const [selectedDetectionIds, setSelectedDetectionIds] = useState<number[]>(
		[],
	);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const fixturesQuery = useFixturesQuery();
	const fixtures = fixturesQuery.data?.fixtures ?? EMPTY_FIXTURES;

	const filteredFixtures = useMemo(() => {
		const keyword = deferredSearch.trim().toLowerCase();
		if (!keyword) return fixtures;
		return fixtures.filter((fixture) =>
			fixture.name.toLowerCase().includes(keyword),
		);
	}, [deferredSearch, fixtures]);

	const effectiveFixtureId =
		selectedFixtureId !== null &&
		fixtures.some((fixture) => fixture.fixture_id === selectedFixtureId)
			? selectedFixtureId
			: (filteredFixtures[0]?.fixture_id ?? fixtures[0]?.fixture_id ?? null);

	const fixtureDetailQuery = useFixtureDetailQuery(effectiveFixtureId);
	const versionsQuery = useFixtureVersionsQuery(effectiveFixtureId);
	const versions = versionsQuery.data?.versions ?? EMPTY_VERSIONS;
	const effectiveVersionId =
		selectedVersionId !== null &&
		versions.some((version) => version.version_id === selectedVersionId)
			? selectedVersionId
			: (versions[0]?.version_id ?? null);

	const placementsQuery = usePlacementsQuery(
		effectiveFixtureId,
		effectiveVersionId,
	);
	const placements = placementsQuery.data?.placements ?? EMPTY_PLACEMENTS;
	const storeProductsQuery = useStoreProductsQuery(storeId);
	const storeProducts = storeProductsQuery.data?.products ?? EMPTY_PRODUCTS;
	const detectionTaskQuery = useDetectionTaskQuery(taskId);
	const detectionItems = detectionTaskQuery.data?.items ?? [];
	const effectiveSelectedDetectionIds =
		selectedDetectionIds.length > 0
			? selectedDetectionIds
			: detectionItems
					.filter((item) => item.status === "DETECTED")
					.map((item) => item.detection_item_id);

	const createFixture = useCreateFixture();
	const updateFixture = useUpdateFixture();
	const deleteFixture = useDeleteFixture();
	const createVersion = useCreateFixtureVersion(effectiveFixtureId ?? 0);
	const deleteVersion = useDeleteFixtureVersion(effectiveFixtureId ?? 0);
	const updatePlacements = useUpdatePlacements(
		effectiveFixtureId,
		effectiveVersionId,
	);
	const createDetectionTask = useCreateDetectionTask();
	const createProducts = useCreateProducts();

	function activateFixture(fixture: FixtureItem) {
		setSelectedFixtureId(fixture.fixture_id);
		setSelectedVersionId(null);
		setTaskId(null);
		setSelectedDetectionIds([]);
		onActivateFixture?.(fixture);
	}

	const variantOptions = useMemo(
		() =>
			storeProducts.flatMap((product) =>
				product.variants.map((variant) => ({
					value: variant.id.toString(),
					label: [
						product.name ?? `상품 #${product.id}`,
						variant.sku_code ?? `옵션 #${variant.id}`,
					].join(" / "),
				})),
			),
		[storeProducts],
	);

	function handleCreateFixture() {
		setMessage(null);
		const req = buildFixtureRequest(newFixtureDraft);
		if (!req) {
			setMessage("집기 이름과 크기를 모두 입력하세요.");
			return;
		}
		createFixture.mutate(req, {
			onSuccess: (created) => {
				setSelectedFixtureId(created.fixture_id);
				setSelectedVersionId(null);
				setNewFixtureDraft(EMPTY_DRAFT);
				setMessage("집기 마스터를 생성했습니다.");
			},
			onError: (error) => {
				console.error("[fixture-create-error]", error);
				setMessage(getErrorMessage(error as Error));
			},
		});
	}

	function handleDeleteFixture(fixtureId: number) {
		if (!window.confirm("이 집기 마스터를 삭제하시겠습니까?")) return;
		deleteFixture.mutate(fixtureId, {
			onSuccess: () => {
				setSelectedFixtureId(null);
				setSelectedVersionId(null);
				setTaskId(null);
				setSelectedDetectionIds([]);
				setMessage("집기 마스터를 삭제했습니다.");
			},
			onError: (error) => setMessage(getErrorMessage(error as Error)),
		});
	}

	function handleCreateVersion() {
		if (!effectiveFixtureId) return;
		if (!newVersionName.trim()) {
			setMessage("버전 이름을 입력하세요.");
			return;
		}
		createVersion.mutate(
			{ version_name: newVersionName.trim() },
			{
				onSuccess: (created) => {
					setSelectedVersionId(created.version_id);
					setNewVersionName("");
					setMessage("버전을 추가했습니다.");
				},
				onError: (error) => setMessage(getErrorMessage(error as Error)),
			},
		);
	}

	function handleDeleteVersion(versionId: number) {
		if (!effectiveFixtureId) return;
		if (!window.confirm("이 버전을 삭제하시겠습니까?")) return;
		deleteVersion.mutate(versionId, {
			onSuccess: () => {
				setSelectedVersionId(null);
				setMessage("버전을 삭제했습니다.");
			},
			onError: (error) => setMessage(getErrorMessage(error as Error)),
		});
	}

	function handleUploadDetection(file: File | undefined) {
		if (!file || !effectiveFixtureId) return;
		setMessage(null);
		createDetectionTask.mutate(
			{
				fixtureId: effectiveFixtureId,
				file,
				storeId,
				fixtureVersionId: effectiveVersionId ?? undefined,
			},
			{
				onSuccess: (task) => {
					setTaskId(task.detection_task_id);
					setSelectedDetectionIds([]);
					setMessage("상품 탐지 작업을 시작했습니다.");
				},
				onError: (error) => setMessage(getErrorMessage(error as Error)),
			},
		);
	}

	function toggleDetectionSelection(detectionItemId: number) {
		setSelectedDetectionIds((current) => {
			const base =
				current.length > 0
					? current
					: detectionItems
							.filter((item) => item.status === "DETECTED")
							.map((item) => item.detection_item_id);
			return base.includes(detectionItemId)
				? base.filter((id) => id !== detectionItemId)
				: [...base, detectionItemId];
		});
	}

	function handleCreateProductsFromDetection() {
		const detail = fixtureDetailQuery.data;
		if (!detail) {
			setMessage("집기 상세를 먼저 불러오세요.");
			return;
		}
		const items = detectionItems.filter((item) =>
			effectiveSelectedDetectionIds.includes(item.detection_item_id),
		);
		if (items.length === 0) {
			setMessage("상품으로 만들 탐지 결과를 선택하세요.");
			return;
		}
		const itemsWithThumbnail = items.filter(
			(item): item is typeof item & { thumbnail_url: string } =>
				typeof item.thumbnail_url === "string" && item.thumbnail_url.length > 0,
		);
		if (itemsWithThumbnail.length === 0) {
			setMessage("선택한 탐지 결과의 썸네일 URL이 아직 준비되지 않았습니다.");
			return;
		}
		createProducts.mutate(
			{
				store_id: storeId,
				products: itemsWithThumbnail.map((item) => ({
					image_url: item.thumbnail_url,
					width: Math.max(
						1,
						Math.round(detail.dimensions.width * item.relative_size.width),
					),
					height: Math.max(
						1,
						Math.round(detail.dimensions.height * item.relative_size.height),
					),
				})),
			},
			{
				onSuccess: (response) => {
					setMessage(`${response.products.length}개 상품을 생성했습니다.`);
				},
				onError: (error) => setMessage(getErrorMessage(error as Error)),
			},
		);
	}

	return (
		<section className="grid min-w-0 gap-4 rounded-lg bg-white p-4 break-keep xl:grid-cols-[280px_minmax(0,1fr)]">
			<div className="min-w-0 space-y-4">
				<div className="min-w-0">
					<h3 className="text-sm font-semibold text-text">집기 라이브러리</h3>
					<p className="text-xs leading-relaxed text-muted-foreground">
						집기 마스터, 버전, 진열 배치를 백엔드 데이터와 연결합니다.
					</p>
				</div>

				<div className="rounded-lg border border-border p-3">
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="집기 검색"
					/>
					<div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
						{fixturesQuery.isLoading ? (
							<>
								<Skeleton className="h-16 rounded-lg" />
								<Skeleton className="h-16 rounded-lg" />
							</>
						) : filteredFixtures.length === 0 ? (
							<p className="text-xs text-muted-foreground">
								등록된 집기가 없습니다.
							</p>
						) : (
							filteredFixtures.map((fixture) => (
								<button
									key={fixture.fixture_id}
									type="button"
									onClick={() => activateFixture(fixture)}
									className={cn(
										"w-full rounded-lg border px-3 py-2 text-left transition-colors",
										effectiveFixtureId === fixture.fixture_id
											? "border-primary bg-primary/5"
											: "border-border hover:border-primary/40",
									)}
								>
									<p className="text-sm font-semibold text-text">
										{fixture.name}
									</p>
									<p className="text-[11px] text-muted-foreground">
										{fixture.width} × {fixture.height} × {fixture.depth} cm
									</p>
								</button>
							))
						)}
					</div>
				</div>

				<div className="rounded-lg border border-border p-3">
					<h4 className="text-xs font-semibold text-text">새 집기 마스터</h4>
					<div className="mt-3 space-y-2">
						<Input
							value={newFixtureDraft.name}
							onChange={(event) =>
								setNewFixtureDraft((current) => ({
									...current,
									name: event.target.value,
								}))
							}
							placeholder="집기 이름"
						/>
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
							<Input
								type="number"
								value={newFixtureDraft.width}
								onChange={(event) =>
									setNewFixtureDraft((current) => ({
										...current,
										width: event.target.value,
									}))
								}
								placeholder="가로"
							/>
							<Input
								type="number"
								value={newFixtureDraft.height}
								onChange={(event) =>
									setNewFixtureDraft((current) => ({
										...current,
										height: event.target.value,
									}))
								}
								placeholder="높이"
							/>
							<Input
								type="number"
								value={newFixtureDraft.depth}
								onChange={(event) =>
									setNewFixtureDraft((current) => ({
										...current,
										depth: event.target.value,
									}))
								}
								placeholder="깊이"
							/>
						</div>
						<Button
							type="button"
							className="w-full"
							onClick={handleCreateFixture}
							disabled={createFixture.isPending}
						>
							{createFixture.isPending ? "생성 중..." : "집기 생성"}
						</Button>
					</div>
				</div>
			</div>

			<div className="min-w-0 space-y-4">
				{effectiveFixtureId === null ? (
					<div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
						좌측에서 집기를 선택하세요.
					</div>
				) : fixtureDetailQuery.isLoading || !fixtureDetailQuery.data ? (
					<div className="space-y-3">
						<Skeleton className="h-24 rounded-lg" />
						<Skeleton className="h-40 rounded-lg" />
						<Skeleton className="h-40 rounded-lg" />
					</div>
				) : (
					<>
						<FixtureDetailEditor
							key={fixtureDetailQuery.data.fixture_id}
							fixture={fixtureDetailQuery.data}
							onDelete={handleDeleteFixture}
							onSaveMessage={setMessage}
							updateFixture={updateFixture}
						/>

						<section className="rounded-lg border border-border p-4">
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<h4 className="text-sm font-semibold text-text">버전</h4>
									<p className="text-xs text-muted-foreground">
										집기별 진열 버전과 placement를 관리합니다.
									</p>
								</div>
								<div className="flex gap-2">
									<Input
										value={newVersionName}
										onChange={(event) => setNewVersionName(event.target.value)}
										placeholder="예: 기본 진열"
										className="w-40"
									/>
									<Button
										size="sm"
										onClick={handleCreateVersion}
										disabled={createVersion.isPending}
									>
										버전 추가
									</Button>
								</div>
							</div>

							<div className="mt-3 flex flex-wrap gap-2">
								{versions.map((version) => (
									<div
										key={version.version_id}
										className={cn(
											"flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
											effectiveVersionId === version.version_id
												? "border-primary bg-primary/5"
												: "border-border",
										)}
									>
										<button
											type="button"
											onClick={() => setSelectedVersionId(version.version_id)}
											className="font-medium text-text"
										>
											{version.version_name}
										</button>
										<button
											type="button"
											onClick={() => handleDeleteVersion(version.version_id)}
											className="text-muted-foreground"
											aria-label={`${version.version_name} 삭제`}
										>
											×
										</button>
									</div>
								))}
								{versions.length === 0 && (
									<p className="text-xs text-muted-foreground">
										등록된 버전이 없습니다.
									</p>
								)}
							</div>
						</section>

						<PlacementsEditor
							key={`${effectiveFixtureId}-${effectiveVersionId ?? "none"}`}
							fixtureId={effectiveFixtureId}
							versionId={effectiveVersionId}
							placements={placements}
							isLoading={placementsQuery.isLoading}
							variantOptions={variantOptions}
							onSaveMessage={setMessage}
							updatePlacements={updatePlacements}
						/>

						<section className="rounded-lg border border-border p-4">
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<h4 className="text-sm font-semibold text-text">
										상품 탐지 업로드
									</h4>
									<p className="text-xs text-muted-foreground">
										집기 사진에서 상품 후보를 탐지하고 카탈로그 상품으로
										생성합니다.
									</p>
								</div>
								<div className="flex gap-2">
									<Button
										size="sm"
										variant="outline"
										onClick={() => fileInputRef.current?.click()}
										disabled={createDetectionTask.isPending}
									>
										사진 업로드
									</Button>
									<Button
										size="sm"
										onClick={handleCreateProductsFromDetection}
										disabled={
											createProducts.isPending ||
											effectiveSelectedDetectionIds.length === 0 ||
											detectionTaskQuery.data?.status !== "COMPLETED"
										}
									>
										선택 항목으로 상품 생성
									</Button>
								</div>
							</div>
							<input
								ref={fileInputRef}
								type="file"
								accept="image/png,image/jpeg"
								className="hidden"
								onChange={(event) =>
									handleUploadDetection(event.target.files?.[0])
								}
							/>

							{taskId !== null && (
								<div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
									<span>탐지 작업 #{taskId}</span>
									{detectionTaskQuery.data && (
										<DetectionStatusBadge
											status={detectionTaskQuery.data.status}
										/>
									)}
								</div>
							)}

							{detectionTaskQuery.isLoading ? (
								<div className="mt-3 grid gap-3 md:grid-cols-2">
									<Skeleton className="h-28 rounded-lg" />
									<Skeleton className="h-28 rounded-lg" />
								</div>
							) : detectionTaskQuery.data?.status === "FAILED" ? (
								<p className="mt-3 text-sm text-destructive">
									{detectionTaskQuery.data.error_message ??
										"상품 탐지 작업이 실패했습니다."}
								</p>
							) : detectionItems.length === 0 ? (
								<p className="mt-3 text-xs text-muted-foreground">
									업로드 후 탐지 결과가 여기에 표시됩니다.
								</p>
							) : (
								<div className="mt-3 grid gap-3 md:grid-cols-2">
									{detectionItems.map((item) => {
										const checked = effectiveSelectedDetectionIds.includes(
											item.detection_item_id,
										);
										return (
											<label
												key={item.detection_item_id}
												className={cn(
													"flex gap-3 rounded-lg border p-3",
													checked
														? "border-primary bg-primary/5"
														: "border-border",
												)}
											>
												<input
													type="checkbox"
													className="mt-1"
													checked={checked}
													onChange={() =>
														toggleDetectionSelection(item.detection_item_id)
													}
													disabled={item.status !== "DETECTED"}
												/>
												{item.thumbnail_url ? (
													<img
														src={item.thumbnail_url}
														alt={`탐지 후보 ${item.slot + 1}`}
														className="h-20 w-20 rounded-md object-cover"
													/>
												) : (
													<div className="flex h-20 w-20 items-center justify-center rounded-md bg-slate-100 text-[10px] text-muted-foreground">
														thumbnail 준비 중
													</div>
												)}
												<div className="min-w-0 flex-1">
													<div className="flex items-center gap-2">
														<p className="text-sm font-semibold text-text">
															후보 #{item.slot + 1}
														</p>
														<DetectionStatusBadge status={item.status} />
													</div>
													<p className="mt-1 text-[11px] text-muted-foreground">
														confidence {item.confidence?.toFixed(2) ?? "-"} / x{" "}
														{item.relative_position.x.toFixed(2)} / y{" "}
														{item.relative_position.y.toFixed(2)}
													</p>
													<p className="text-[11px] text-muted-foreground">
														w {item.relative_size.width.toFixed(2)} / h{" "}
														{item.relative_size.height.toFixed(2)}
													</p>
												</div>
											</label>
										);
									})}
								</div>
							)}
						</section>
					</>
				)}

				{message && <p className="text-xs text-muted-foreground">{message}</p>}
			</div>
		</section>
	);
}

function FixtureDetailEditor({
	fixture,
	onDelete,
	onSaveMessage,
	updateFixture,
}: {
	fixture: FixtureDetail;
	onDelete: (fixtureId: number) => void;
	onSaveMessage: (message: string | null) => void;
	updateFixture: ReturnType<typeof useUpdateFixture>;
}) {
	const [draft, setDraft] = useState<FixtureDraft>(() =>
		fixtureDraftFromDetail(fixture),
	);

	function handleSave() {
		const req = buildFixtureRequest(draft);
		if (!req) {
			onSaveMessage("집기 이름과 크기를 올바르게 입력하세요.");
			return;
		}
		updateFixture.mutate(
			{ fixtureId: fixture.fixture_id, req },
			{
				onSuccess: () => onSaveMessage("집기 정보를 저장했습니다."),
				onError: (error) => onSaveMessage(getErrorMessage(error as Error)),
			},
		);
	}

	return (
		<section className="rounded-lg border border-border p-4">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h4 className="text-sm font-semibold text-text">집기 상세</h4>
					<p className="text-xs text-muted-foreground">
						마스터 치수와 3D 자산 연결 상태를 확인합니다.
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						size="sm"
						onClick={handleSave}
						disabled={updateFixture.isPending}
					>
						저장
					</Button>
					<Button
						size="sm"
						variant="destructive"
						onClick={() => onDelete(fixture.fixture_id)}
					>
						삭제
					</Button>
				</div>
			</div>

			<div className="mt-3 grid gap-3">
				<Input
					value={draft.name}
					onChange={(event) =>
						setDraft((current) => ({ ...current, name: event.target.value }))
					}
					placeholder="집기 이름"
				/>
				<div className="grid grid-cols-3 gap-2">
					<Input
						type="number"
						value={draft.width}
						onChange={(event) =>
							setDraft((current) => ({ ...current, width: event.target.value }))
						}
						placeholder="가로"
					/>
					<Input
						type="number"
						value={draft.height}
						onChange={(event) =>
							setDraft((current) => ({
								...current,
								height: event.target.value,
							}))
						}
						placeholder="높이"
					/>
					<Input
						type="number"
						value={draft.depth}
						onChange={(event) =>
							setDraft((current) => ({ ...current, depth: event.target.value }))
						}
						placeholder="깊이"
					/>
				</div>
				<p className="text-[11px] text-muted-foreground">
					3D 자산:{" "}
					{fixture.asset_3d
						? `${fixture.asset_3d.file_format} / ${fixture.asset_3d.model_url}`
						: "연결된 3D 자산 없음"}
				</p>
			</div>
		</section>
	);
}

function PlacementsEditor({
	fixtureId,
	versionId,
	placements,
	isLoading,
	variantOptions,
	onSaveMessage,
	updatePlacements,
}: {
	fixtureId: number;
	versionId: number | null;
	placements: PlacementItem[];
	isLoading: boolean;
	variantOptions: Array<{ value: string; label: string }>;
	onSaveMessage: (message: string | null) => void;
	updatePlacements: ReturnType<typeof useUpdatePlacements>;
}) {
	const [drafts, setDrafts] = useState<PlacementDraft[]>(() =>
		placements.map(placementDraftFromItem),
	);

	function updateDraftRow(
		index: number,
		key: keyof PlacementDraft,
		value: string,
	) {
		setDrafts((current) =>
			current.map((draft, draftIndex) =>
				draftIndex === index ? { ...draft, [key]: value } : draft,
			),
		);
	}

	function addPlacementRow() {
		setDrafts((current) => [
			...current,
			{
				variant_id: variantOptions[0]?.value ?? "",
				local_pos_x: "0",
				local_pos_y: "0",
				local_pos_z: "0",
				status: "ACTIVE",
				memo: "",
			},
		]);
	}

	function removePlacementRow(index: number) {
		setDrafts((current) =>
			current.filter((_, draftIndex) => draftIndex !== index),
		);
	}

	function handleSavePlacements() {
		const parsed = buildPlacementRequest(drafts);
		if (!versionId || !parsed) {
			onSaveMessage("배치 좌표와 variant를 올바르게 입력하세요.");
			return;
		}
		updatePlacements.mutate(
			{ placements: parsed },
			{
				onSuccess: () => onSaveMessage("배치를 저장했습니다."),
				onError: (error) => onSaveMessage(getErrorMessage(error as Error)),
			},
		);
	}

	return (
		<section className="rounded-lg border border-border p-4">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h4 className="text-sm font-semibold text-text">배치</h4>
					<p className="text-xs text-muted-foreground">
						fixture #{fixtureId}
						{versionId ? ` / version #${versionId}` : " / 버전 선택 필요"}
					</p>
				</div>
				<div className="flex gap-2">
					<Button size="sm" variant="outline" onClick={addPlacementRow}>
						행 추가
					</Button>
					<Button
						size="sm"
						onClick={handleSavePlacements}
						disabled={!versionId || updatePlacements.isPending}
					>
						배치 저장
					</Button>
				</div>
			</div>

			{isLoading ? (
				<div className="mt-3 space-y-2">
					<Skeleton className="h-16 rounded-lg" />
					<Skeleton className="h-16 rounded-lg" />
				</div>
			) : drafts.length === 0 ? (
				<p className="mt-3 text-xs text-muted-foreground">
					등록된 배치가 없습니다.
				</p>
			) : (
				<div className="mt-3 space-y-3">
					{drafts.map((draft, index) => (
						<div
							key={draft.placement_id ?? `draft-${index}`}
							className="rounded-lg border border-border p-3"
						>
							<div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.8fr))_minmax(0,1fr)_auto]">
								<select
									value={draft.variant_id}
									onChange={(event) =>
										updateDraftRow(index, "variant_id", event.target.value)
									}
									className="h-10 rounded-md border border-input bg-background px-3 text-sm"
								>
									<option value="">variant 선택</option>
									{variantOptions.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
								<Input
									type="number"
									value={draft.local_pos_x}
									onChange={(event) =>
										updateDraftRow(index, "local_pos_x", event.target.value)
									}
									placeholder="x"
								/>
								<Input
									type="number"
									value={draft.local_pos_y}
									onChange={(event) =>
										updateDraftRow(index, "local_pos_y", event.target.value)
									}
									placeholder="y"
								/>
								<Input
									type="number"
									value={draft.local_pos_z}
									onChange={(event) =>
										updateDraftRow(index, "local_pos_z", event.target.value)
									}
									placeholder="z"
								/>
								<Input
									value={draft.status}
									onChange={(event) =>
										updateDraftRow(index, "status", event.target.value)
									}
									placeholder="status"
								/>
								<Button
									size="sm"
									variant="outline"
									onClick={() => removePlacementRow(index)}
								>
									삭제
								</Button>
							</div>
							<Input
								value={draft.memo}
								onChange={(event) =>
									updateDraftRow(index, "memo", event.target.value)
								}
								placeholder="메모"
								className="mt-2"
							/>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
