import { ErrorBoundary, Suspense } from "@suspensive/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useDeleteLayout } from "@/features/layout/hooks/useDeleteLayout";
import { useGetLayouts } from "@/features/layout/hooks/useGetLayouts";
import { useDeleteStore } from "@/features/store/hooks/useDeleteStore";
import { useGetStoreDetail } from "@/features/store/hooks/useGetStoreDetail";
import { useUpdateStore } from "@/features/store/hooks/useUpdateStore";
import { useUploadFloorplan } from "@/features/store/hooks/useUploadFloorplan";
import type { StoreDetail } from "@/features/store/store.types";
import { Button, Input, Skeleton } from "@/shared/components/ui";
import { getErrorMessage } from "@/shared/utils/error";
import { LayoutItemCard } from "./-layout-item";
import { NewLayoutDialog } from "./-new-layout-dialog";

export const Route = createFileRoute("/stores/$storeId/layouts/")({
	component: () => (
		<ErrorBoundary fallback={<LayoutListError />}>
			<Suspense fallback={<LayoutListSkeleton />}>
				<LayoutListPage />
			</Suspense>
		</ErrorBoundary>
	),
});

const ROLE_LABEL: Record<StoreDetail["my_role"], string> = {
	OWNER: "오너",
	MANAGER: "매니저",
	VICE_MANAGER: "부매니저",
	VMD: "VMD",
	STAFF: "스태프",
};

function LayoutListPage() {
	const { storeId } = Route.useParams();
	const navigate = useNavigate();
	const storeIdNum = Number(storeId);

	const { data: storeData } = useGetStoreDetail(storeIdNum);
	const { data: layoutData } = useGetLayouts(storeIdNum);
	const { mutate: deleteLayout } = useDeleteLayout(storeIdNum);
	const updateStore = useUpdateStore(storeIdNum);
	const deleteStore = useDeleteStore();
	const uploadFloorplan = useUploadFloorplan(storeIdNum);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [editDraft, setEditDraft] = useState(() => ({
		name: storeData.name,
		address: "",
		width: storeData.width.toString(),
		height: storeData.height.toString(),
		depth: storeData.depth.toString(),
	}));
	const [message, setMessage] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const layouts = layoutData.layouts;

	function handleSaveStore() {
		const width = Number(editDraft.width);
		const height = Number(editDraft.height);
		const depth = Number(editDraft.depth);
		if (
			!editDraft.name.trim() ||
			!Number.isFinite(width) ||
			!Number.isFinite(height) ||
			!Number.isFinite(depth)
		) {
			setMessage("매장 이름과 크기를 올바르게 입력하세요.");
			return;
		}
		updateStore.mutate(
			{
				name: editDraft.name.trim(),
				address: editDraft.address.trim() || undefined,
				width,
				height,
				depth,
			},
			{
				onSuccess: () => setMessage("매장 정보를 저장했습니다."),
				onError: (error) => setMessage(getErrorMessage(error as Error)),
			},
		);
	}

	function handleDeleteStore() {
		if (!window.confirm("이 매장을 삭제하시겠습니까?")) return;
		deleteStore.mutate(storeIdNum, {
			onSuccess: () => navigate({ to: "/stores" }),
			onError: (error) => setMessage(getErrorMessage(error as Error)),
		});
	}

	function handleUploadFloorplan(file: File | undefined) {
		if (!file) return;
		uploadFloorplan.mutate(file, {
			onSuccess: () => setMessage("도면 이미지를 업로드했습니다."),
			onError: (error) => setMessage(getErrorMessage(error as Error)),
		});
	}

	return (
		<main className="flex flex-1 flex-col">
			<div className="mx-auto w-full max-w-4xl px-6 py-10">
				{/* 매장 상세 헤더 */}
				<div className="mb-8 rounded-2xl bg-white p-6 shadow-sm">
					<div className="flex items-start justify-between gap-2">
						<h1 className="text-2xl font-bold text-text">{storeData.name}</h1>
						<span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
							{ROLE_LABEL[storeData.my_role]}
						</span>
					</div>
					<p className="mt-2 text-sm text-gray-400">
						가로 {storeData.width.toLocaleString()} × 세로{" "}
						{storeData.depth.toLocaleString()} × 높이{" "}
						{storeData.height.toLocaleString()} cm
					</p>
					<div className="mt-4 border-t border-border pt-4">
						<div className="grid gap-3 sm:grid-cols-2">
							<Input
								value={editDraft.name}
								onChange={(event) =>
									setEditDraft((current) => ({
										...current,
										name: event.target.value,
									}))
								}
								placeholder="매장 이름"
							/>
							<Input
								value={editDraft.address}
								onChange={(event) =>
									setEditDraft((current) => ({
										...current,
										address: event.target.value,
									}))
								}
								placeholder="매장 주소"
							/>
						</div>
						<div className="mt-3 grid gap-3 sm:grid-cols-3">
							<Input
								type="number"
								value={editDraft.width}
								onChange={(event) =>
									setEditDraft((current) => ({
										...current,
										width: event.target.value,
									}))
								}
								placeholder="가로"
							/>
							<Input
								type="number"
								value={editDraft.depth}
								onChange={(event) =>
									setEditDraft((current) => ({
										...current,
										depth: event.target.value,
									}))
								}
								placeholder="세로"
							/>
							<Input
								type="number"
								value={editDraft.height}
								onChange={(event) =>
									setEditDraft((current) => ({
										...current,
										height: event.target.value,
									}))
								}
								placeholder="높이"
							/>
						</div>
						<div className="mt-3 flex flex-wrap gap-2">
							<Button
								size="sm"
								onClick={handleSaveStore}
								disabled={updateStore.isPending}
							>
								매장 정보 저장
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => fileInputRef.current?.click()}
								disabled={uploadFloorplan.isPending}
							>
								도면 업로드
							</Button>
							<Button
								size="sm"
								variant="destructive"
								onClick={handleDeleteStore}
								disabled={deleteStore.isPending}
							>
								매장 삭제
							</Button>
							<input
								ref={fileInputRef}
								type="file"
								accept="image/png,image/jpeg"
								className="hidden"
								onChange={(event) =>
									handleUploadFloorplan(event.target.files?.[0])
								}
							/>
						</div>
						{storeData.floorplan_image_url && (
							<a
								href={storeData.floorplan_image_url}
								target="_blank"
								rel="noreferrer"
								className="mt-3 inline-block text-xs text-primary underline-offset-4 hover:underline"
							>
								현재 도면 보기
							</a>
						)}
						{message && (
							<p className="mt-3 text-xs text-muted-foreground">{message}</p>
						)}
					</div>
				</div>

				{/* 레이아웃 목록 섹션 */}
				<div>
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-lg font-semibold text-text">레이아웃 목록</h2>
						{layouts.length > 0 && (
							<Button size="sm" onClick={() => setDialogOpen(true)}>
								레이아웃 만들기
							</Button>
						)}
					</div>

					{layouts.length === 0 ? (
						<div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-white p-12 shadow-sm">
							<p className="text-gray-400">레이아웃이 없습니다.</p>
							<Button onClick={() => setDialogOpen(true)}>
								레이아웃 만들기
							</Button>
						</div>
					) : (
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							{layouts.map((layout) => (
								<LayoutItemCard
									key={layout.layout_id}
									layout={layout}
									storeId={storeIdNum}
									onDelete={deleteLayout}
								/>
							))}
						</div>
					)}
				</div>
			</div>

			<NewLayoutDialog
				storeId={storeIdNum}
				open={dialogOpen}
				onOpenChange={setDialogOpen}
			/>
		</main>
	);
}

function LayoutListError() {
	return (
		<main className="flex flex-1 items-center justify-center">
			<div className="flex flex-col items-center gap-4 text-center">
				<p className="text-gray-400">매장 정보를 불러오지 못했습니다.</p>
			</div>
		</main>
	);
}

function LayoutListSkeleton() {
	return (
		<main className="flex flex-1 flex-col">
			<div className="mx-auto w-full max-w-4xl px-6 py-10">
				<div className="mb-8 rounded-2xl bg-white p-6 shadow-sm">
					<div className="flex items-start justify-between gap-2">
						<Skeleton className="h-8 w-48" />
						<Skeleton className="h-5 w-16 rounded-full" />
					</div>
					<Skeleton className="mt-2 h-4 w-64" />
				</div>
				<div>
					<div className="mb-4 flex items-center justify-between">
						<Skeleton className="h-6 w-28" />
					</div>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<Skeleton className="h-36 rounded-2xl" />
						<Skeleton className="h-36 rounded-2xl" />
					</div>
				</div>
			</div>
		</main>
	);
}
