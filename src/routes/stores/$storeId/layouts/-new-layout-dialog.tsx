import { zodResolver } from "@hookform/resolvers/zod";
import { type SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateLayout } from "@/features/layout/hooks/useCreateLayout";
import { Button, Input } from "@/shared/components/ui";
import { ApiError } from "@/shared/types/api.types";

interface NewLayoutDialogProps {
	storeId: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const createLayoutSchema = z.object({
	name: z.string().min(1, "레이아웃 이름을 입력해주세요."),
	comment: z.string().optional(),
	is_active: z.boolean().optional(),
});

type CreateLayoutFormData = z.infer<typeof createLayoutSchema>;

export function NewLayoutDialog({
	storeId,
	open,
	onOpenChange,
}: NewLayoutDialogProps) {
	const { mutate: createLayout, isPending, error } = useCreateLayout(storeId);

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<CreateLayoutFormData>({
		// biome-ignore lint/suspicious/noExplicitAny: Zod v4/@hookform/resolvers type mismatch
		resolver: zodResolver(createLayoutSchema as any),
		defaultValues: { name: "", comment: "", is_active: false },
	});

	const apiErrorMessage = error
		? error instanceof ApiError
			? error.message
			: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
		: null;

	const onValid: SubmitHandler<CreateLayoutFormData> = (data) => {
		console.log("[NewLayoutDialog] Submitting layout creation:", data);
		createLayout(
			{
				name: data.name,
				comment: data.comment || undefined,
				is_active: data.is_active,
			},
			{
				onSuccess: () => {
					console.log("[NewLayoutDialog] Layout created successfully");
					reset();
					onOpenChange(false);
				},
				onError: (err) => {
					console.error("[NewLayoutDialog] Failed to create layout:", err);
				},
			},
		);
	};

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
				<div className="mb-6 flex flex-col gap-1">
					<h2 className="text-xl font-bold text-text">레이아웃 만들기</h2>
					<p className="text-sm text-gray-400">
						새 레이아웃 정보를 입력해주세요.
					</p>
				</div>

				<form
					onSubmit={handleSubmit(onValid)}
					className="flex flex-col gap-4"
					noValidate
				>
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="layout-name"
							className="text-sm font-medium text-text"
						>
							레이아웃 이름
						</label>
						<Input
							id="layout-name"
							type="text"
							placeholder="예) 봄 시즌 레이아웃"
							{...register("name")}
						/>
						{errors.name && (
							<p className="text-xs text-destructive">{errors.name.message}</p>
						)}
					</div>

					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="layout-comment"
							className="text-sm font-medium text-text"
						>
							코멘트
						</label>
						<Input
							id="layout-comment"
							type="text"
							placeholder="선택 사항"
							{...register("comment")}
						/>
						{errors.comment && (
							<p className="text-xs text-destructive">
								{errors.comment.message}
							</p>
						)}
					</div>

					<div className="flex items-center gap-2">
						<input
							id="layout-is-active"
							type="checkbox"
							className="h-4 w-4 rounded border-gray-300 accent-primary"
							{...register("is_active")}
						/>
						<label
							htmlFor="layout-is-active"
							className="text-sm font-medium text-text"
						>
							즉시 적용
						</label>
					</div>

					{apiErrorMessage && (
						<p className="text-xs text-destructive">{apiErrorMessage}</p>
					)}

					<div className="mt-2 flex gap-2">
						<Button
							type="button"
							variant="outline"
							className="flex-1"
							onClick={() => {
								reset();
								onOpenChange(false);
							}}
							disabled={isPending}
						>
							취소
						</Button>
						<Button type="submit" className="flex-1" disabled={isPending}>
							{isPending ? "생성 중..." : "만들기"}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}
