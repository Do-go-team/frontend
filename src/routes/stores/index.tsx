import { ErrorBoundary, Suspense } from "@suspensive/react";
import { createFileRoute } from "@tanstack/react-router";
import {
	StoreListError,
	StoreListPage,
	StoreListSkeleton,
} from "./-store-list-page";

export const Route = createFileRoute("/stores/")({
	component: () => (
		<ErrorBoundary fallback={<StoreListError />}>
			<Suspense fallback={<StoreListSkeleton />}>
				<StoreListPage />
			</Suspense>
		</ErrorBoundary>
	),
});
