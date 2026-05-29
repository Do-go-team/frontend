import { StickyNote } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type MemoMode = "view" | "edit";

interface MemoProps {
	defaultValue?: string;
	onSave?: (value: string) => void;
}

export function Memo({ defaultValue = "", onSave }: MemoProps) {
	const [open, setOpen] = useState(false);
	const [savedValue, setSavedValue] = useState(defaultValue);
	const [value, setValue] = useState(defaultValue);
	const [mode, setMode] = useState<MemoMode>("edit");
	const [toastVisible, setToastVisible] = useState(false);
	const hasContent = savedValue.trim().length > 0;

	const handleOpenChange = (next: boolean) => {
		if (next) {
			setValue(savedValue);
			setMode(hasContent ? "view" : "edit");
		}
		setOpen(next);
	};

	const handleSave = () => {
		setSavedValue(value);
		onSave?.(value);
		setOpen(false);
		setToastVisible(true);
	};

	useEffect(() => {
		if (!toastVisible) return;
		const timer = setTimeout(() => setToastVisible(false), 2000);
		return () => clearTimeout(timer);
	}, [toastVisible]);

	return (
		<>
			<Popover open={open} onOpenChange={handleOpenChange}>
				<PopoverTrigger asChild>
					<button
						type="button"
						className={cn(
							"flex h-6 w-6 items-center justify-center rounded transition-colors",
							"text-sub hover:bg-gray-100",
						)}
					>
						<StickyNote
							className="h-4 w-4"
							fill={hasContent ? "currentColor" : "none"}
						/>
					</button>
				</PopoverTrigger>
				<PopoverContent className="w-[240px]">
					<div className="flex flex-col gap-3">
						<p className="text-xs font-semibold text-text">메모</p>
						{mode === "view" ? (
							<>
								<p className="min-h-[80px] whitespace-pre-wrap text-xs text-text">
									{savedValue}
								</p>
								<Button
									size="sm"
									variant="outline"
									className="self-end"
									onClick={() => setMode("edit")}
								>
									수정
								</Button>
							</>
						) : (
							<>
								<textarea
									value={value}
									onChange={(e) => setValue(e.target.value)}
									placeholder="메모를 입력하세요"
									className="h-[120px] w-full resize-none rounded-md border border-border bg-bg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
								/>
								<Button size="sm" className="self-end" onClick={handleSave}>
									저장
								</Button>
							</>
						)}
					</div>
				</PopoverContent>
			</Popover>
			{toastVisible && (
				<div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-primary px-4 py-2 text-xs text-white shadow-lg">
					메모가 저장되었습니다
				</div>
			)}
		</>
	);
}
