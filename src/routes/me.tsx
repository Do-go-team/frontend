import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { useMe } from "@/features/auth/hooks/useMe";
import { Skeleton } from "@/shared/components/ui/skeleton";

export const Route = createFileRoute("/me")({
	component: () => (
		<Suspense fallback={<MyPageSkeleton />}>
			<MyPage />
		</Suspense>
	),
});

const ROLE_LABELS: Record<string, string> = {
	OWNER: "오너",
	MANAGER: "매니저",
	VMD: "VMD",
	STAFF: "스태프",
};

function MyPage() {
	const { data: me } = useMe();

	return (
		<main className="mx-auto w-full max-w-lg px-4 py-10">
			<div className="rounded-2xl bg-white p-8 shadow-sm">
				{/* 프로필 */}
				<div className="mb-8 flex flex-col items-center gap-3">
					{me.profile_image_url ? (
						<img
							src={me.profile_image_url}
							alt={me.name}
							className="h-20 w-20 rounded-full object-cover"
						/>
					) : (
						<div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white">
							{me.name.charAt(0)}
						</div>
					)}
					<div className="text-center">
						<p className="text-xl font-bold text-text">{me.name}</p>
						<p className="text-sm text-gray-400">{me.email}</p>
					</div>
					<span className="rounded-full bg-light px-3 py-1 text-xs font-medium text-sub">
						{me.system_role}
					</span>
				</div>

				{/* 접근 매장 목록 */}
				<div>
					<h2 className="mb-3 text-sm font-semibold text-text">접근 매장</h2>
					{me.accessible_stores.length === 0 ? (
						<p className="text-sm text-gray-400">
							접근 가능한 매장이 없습니다.
						</p>
					) : (
						<ul className="flex flex-col gap-2">
							{me.accessible_stores.map((s) => (
								<li key={s.store_id}>
									<Link
										to="/stores/$storeId/layouts"
										params={{ storeId: String(s.store_id) }}
										className="flex items-center justify-between rounded-xl border border-border px-4 py-3 transition-colors hover:bg-gray-50"
									>
										<span className="text-sm font-medium text-text">
											{s.store_name}
										</span>
										<span className="rounded-full bg-light px-2 py-0.5 text-xs font-medium text-sub">
											{ROLE_LABELS[s.store_role] ?? s.store_role}
										</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</main>
	);
}

function MyPageSkeleton() {
	return (
		<main className="mx-auto w-full max-w-lg px-4 py-10">
			<div className="rounded-2xl bg-white p-8 shadow-sm">
				<div className="mb-8 flex flex-col items-center gap-3">
					<Skeleton className="h-20 w-20 rounded-full" />
					<Skeleton className="h-6 w-24" />
					<Skeleton className="h-4 w-36" />
				</div>
				<Skeleton className="mb-3 h-4 w-16" />
				{[1, 2].map((i) => (
					<Skeleton key={i} className="mb-2 h-12 w-full rounded-xl" />
				))}
			</div>
		</main>
	);
}
