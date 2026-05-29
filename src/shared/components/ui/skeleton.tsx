import { cn } from "@/shared/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("animate-pulse rounded-md bg-gray-200", className)}
			{...props}
		/>
	);
}
