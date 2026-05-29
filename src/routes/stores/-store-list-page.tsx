import { Link } from "@tanstack/react-router";
import { useGetMyStores } from "@/features/store/hooks/useGetMyStores";
import type { StoreItem } from "@/features/store/store.types";
import { Button, Skeleton } from "@/shared/components/ui";

const ROLE_LABEL: Partial<
	Record<StoreItem["my_role"] | "VICE_MANAGER", string>
> = {
	OWNER: "오너",
	MANAGER: "매니저",
	VICE_MANAGER: "부매니저",
	VMD: "VMD",
	STAFF: "스태프",
};

export function StoreListPage() {
	const { data } = useGetMyStores();

	if (data.stores.length === 0) {
		return (
			<main className="flex flex-1 items-center justify-center">
				<div className="flex flex-col items-center gap-4 text-center">
					<p className="text-gray-400">아직 등록된 매장이 없습니다.</p>
					<Button asChild>
						<Link to="/stores/new">첫 매장 등록하기</Link>
					</Button>
				</div>
			</main>
		);
	}

	return (
		<main className="flex flex-1 flex-col">
			<div className="mx-auto w-full max-w-4xl px-6 py-10">
				<div className="mb-8 flex items-center justify-between">
					<h1 className="text-2xl font-bold text-text">내 매장</h1>
					<Button asChild>
						<Link to="/stores/new">매장 등록</Link>
					</Button>
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					{data.stores.map((store) => (
						<Link
							key={store.store_id}
							to="/stores/$storeId/layouts"
							params={{ storeId: String(store.store_id) }}
							className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
						>
							<div className="flex items-start justify-between gap-2">
								<span className="text-base font-semibold text-text">
									{store.name}
								</span>
								<span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
									{ROLE_LABEL[store.my_role] ?? store.my_role}
								</span>
							</div>
							<p className="text-sm text-gray-400">
								가로 {store.width.toLocaleString()} × 세로{" "}
								{store.depth.toLocaleString()} × 높이{" "}
								{store.height.toLocaleString()} cm
							</p>
						</Link>
					))}
				</div>
			</div>
		</main>
	);
}

export function StoreListError() {
	return (
		<main className="flex flex-1 items-center justify-center">
			<div className="flex flex-col items-center gap-4 text-center">
				<p className="text-gray-400">매장 목록을 불러오지 못했습니다.</p>
				<Button onClick={() => window.location.reload()}>다시 시도</Button>
			</div>
		</main>
	);
}

export function StoreListSkeleton() {
	return (
		<main className="flex flex-1 flex-col">
			<div className="mx-auto w-full max-w-4xl px-6 py-10">
				<div className="mb-8 flex items-center justify-between">
					<Skeleton className="h-8 w-24" />
					<Skeleton className="h-10 w-24 rounded-md" />
				</div>
				<Skeleton className="h-36 rounded-2xl" />
			</div>
		</main>
	);
}
