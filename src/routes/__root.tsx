import {
	createRootRoute,
	Outlet,
	redirect,
	useRouterState,
} from "@tanstack/react-router";
import { ENV_AUTH_ADAPTER } from "@/features/auth/auth.adapter";
import { isPublicPath } from "@/features/auth/auth-routes";
import {
	isLoggedInPersisted,
	LOGGED_IN_KEY,
} from "@/features/auth/auth-storage";
import { Footer } from "@/shared/components/layout/footer";
import { Header } from "@/shared/components/layout/header";
import { queryClient } from "@/shared/lib/query-client";
import { ApiError } from "@/shared/types/api.types";

function RootLayout() {
	const { location } = useRouterState();
	const isEditor = location.pathname.endsWith("/edit");

	return (
		<div className="flex min-h-screen flex-col bg-bg">
			<Header />
			<div className="flex flex-1 flex-col">
				<Outlet />
			</div>
			{!isEditor && <Footer />}
		</div>
	);
}

export const Route = createRootRoute({
	beforeLoad: async ({ location }) => {
		if (isPublicPath(location.pathname)) {
			return;
		}

		if (!isLoggedInPersisted()) {
			throw redirect({ to: "/landing" });
		}

		try {
			await queryClient.ensureQueryData({
				queryKey: ["me"],
				queryFn: () => ENV_AUTH_ADAPTER.getMe(),
				staleTime: 1000 * 60 * 5,
			});
		} catch (error) {
			if (error instanceof ApiError && error.code === "UNAUTHORIZED") {
				window.localStorage.removeItem(LOGGED_IN_KEY);
				throw redirect({ to: "/landing" });
			}
			throw error;
		}
	},
	component: RootLayout,
});
