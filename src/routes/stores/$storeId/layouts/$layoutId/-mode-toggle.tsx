import { cn } from "@/shared/lib/utils";

export type ViewMode = "2D" | "3D";

interface ModeToggleProps {
	value: ViewMode;
	onChange: (mode: ViewMode) => void;
}

const MODES: ViewMode[] = ["2D", "3D"];

export function ModeToggle({ value, onChange }: ModeToggleProps) {
	return (
		<div className="flex w-fit items-center gap-1 rounded-full border border-border bg-white/95 p-1 shadow-sm backdrop-blur">
			{MODES.map((mode) => {
				const isDisabled = mode === "3D";
				return (
					<button
						key={mode}
						type="button"
						data-track="view-mode"
						data-track-value={mode}
						onClick={() => onChange(mode)}
						disabled={isDisabled}
						className={cn(
							"rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45",
							value === mode
								? "bg-primary text-white shadow-sm"
								: "bg-transparent text-text hover:bg-gray-100",
						)}
					>
						{mode}
					</button>
				);
			})}
		</div>
	);
}
