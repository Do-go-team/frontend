import { Link, useRouterState } from "@tanstack/react-router";
import { Suspense, useEffect } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { useMe } from "@/features/auth/hooks/useMe";
import { Avatar } from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";

const AUTH_ROUTES = ["/login", "/register"];

function AuthedHeaderActions() {
	const { data: me } = useMe();
	const { mutate: logout } = useLogout();
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	useEffect(() => {
		if (me?.name) {
			// 현재 URL에서 storeId 추출 (예: /stores/123/...)
			const storeIdMatch = pathname.match(/\/stores\/(\d+)/);
			const currentStoreId = storeIdMatch ? storeIdMatch[1] : null;

			window.dataLayer = window.dataLayer || [];
			window.dataLayer.push({
				event: "user_info",
				worker_name: me.name,
				user_role: me.system_role,
				store_id: currentStoreId,
			});
		}
	}, [me, pathname]);

	const handleLogout = () => {
		logout();
	};

	return (
		<div className="flex items-center gap-3">
			<Link
				to="/me"
				className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-gray-100"
			>
				<span className="text-sm font-medium text-text">{me?.name}</span>
				{me?.profile_image_url ? (
					<Avatar src={me.profile_image_url} />
				) : (
					<div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
						{me?.name?.charAt(0)}
					</div>
				)}
			</Link>
			<Button size="sm" variant="ghost" onClick={handleLogout}>
				로그아웃
			</Button>
		</div>
	);
}

function AuthedHeaderSkeleton() {
	return (
		<div className="flex items-center gap-3">
			<Skeleton className="h-5 w-16" />
			<Skeleton className="h-9 w-9 rounded-full" />
			<Skeleton className="h-8 w-16 rounded-md" />
		</div>
	);
}

export function Header() {
	const { isLoggedIn } = useAuth();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const isAuthPage = AUTH_ROUTES.includes(pathname);
	const homePath = isLoggedIn ? "/stores" : "/landing";

	return (
		<header className="flex h-[60px] items-center justify-between border-b border-border bg-white px-6">
			<Link to={homePath} className="flex items-center gap-2.5">
				<img src="/favicon.svg" alt="Do-go logo" width={32} height={32} />
				<span className="text-lg font-semibold text-primary">Do-go</span>
			</Link>

			{isLoggedIn ? (
				<Suspense fallback={<AuthedHeaderSkeleton />}>
					<AuthedHeaderActions />
				</Suspense>
			) : !isAuthPage ? (
				<Button size="sm" asChild>
					<Link to="/login">시작하기</Link>
				</Button>
			) : null}
		</header>
	);
}

export function HeaderSkeleton() {
	return (
		<header className="flex h-[60px] items-center justify-between border-b border-border bg-white px-6">
			<div className="flex items-center gap-2.5">
				<Skeleton className="h-8 w-8 rounded" />
				<Skeleton className="h-5 w-14" />
			</div>
			<Skeleton className="h-8 w-[72px] rounded-md" />
		</header>
	);
}
