import { ErrorBoundary, Suspense } from "@suspensive/react";
import { createFileRoute } from "@tanstack/react-router";
import {
	StoreListError,
	StoreListPage,
	StoreListSkeleton,
} from "./stores/-store-list-page";

export const Route = createFileRoute("/")({
	component: () => (
		<ErrorBoundary fallback={<StoreListError />}>
			<Suspense fallback={<StoreListSkeleton />}>
				<StoreListPage />
			</Suspense>
		</ErrorBoundary>
	),
});
