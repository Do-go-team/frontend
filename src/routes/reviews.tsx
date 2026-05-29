import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/reviews")({
	component: () => <div>Review History Page</div>,
});
