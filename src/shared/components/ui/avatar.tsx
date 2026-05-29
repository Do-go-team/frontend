import { cn } from "@/shared/lib/utils";

interface AvatarProps {
	src: string;
	alt?: string;
	className?: string;
}

export function Avatar({ src, alt, className }: AvatarProps) {
	return (
		<img
			src={src}
			alt={alt ?? "profile"}
			className={cn("h-9 w-9 rounded-full object-cover", className)}
		/>
	);
}
