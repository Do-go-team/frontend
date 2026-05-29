import { Link } from "@tanstack/react-router";
import type { LayoutItem } from "@/features/layout/layout.types";
import { Button } from "@/shared/components/ui";

interface LayoutItemCardProps {
	layout: LayoutItem;
	storeId: number;
	onDelete: (layoutId: number) => void;
}

export function LayoutItemCard({
	layout,
	storeId,
	onDelete,
}: LayoutItemCardProps) {
	const formattedDate = new Date(layout.created_at).toLocaleDateString(
		"ko-KR",
		{
			year: "numeric",
			month: "long",
			day: "numeric",
		},
	);

	return (
		<div className="relative flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
			<Link
				to="/stores/$storeId/layouts/$layoutId/edit"
				params={{
					storeId: String(storeId),
					layoutId: String(layout.layout_id),
				}}
				className="flex flex-col gap-3"
			>
				<div className="flex items-start justify-between gap-2">
					<span className="text-base font-bold text-text">{layout.name}</span>
					{layout.is_active ? (
						<span className="shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
							적용 중
						</span>
					) : (
						<span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
							시안
						</span>
					)}
				</div>
				{layout.comment && (
					<p className="text-sm text-gray-400">{layout.comment}</p>
				)}
				<p className="text-xs text-gray-300">{formattedDate}</p>
			</Link>
			{!layout.is_active && (
				<div className="flex justify-end">
					<Button
						variant="destructive"
						size="sm"
						onClick={() => onDelete(layout.layout_id)}
					>
						삭제
					</Button>
				</div>
			)}
		</div>
	);
}
