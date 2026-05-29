import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pdf")({
	component: () => <div>PDF Page</div>,
});
