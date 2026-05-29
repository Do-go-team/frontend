import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateStore } from "@/features/store/hooks/useCreateStore";
import { Button, Input } from "@/shared/components/ui";
import { ApiError } from "@/shared/types/api.types";

export const Route = createFileRoute("/stores/new")({
	component: StoreNewPage,
});

const createStoreSchema = z.object({
	name: z.string().min(1, "매장 이름을 입력해주세요."),
	address: z.string().min(1, "매장 주소를 입력해주세요."),
	width: z.coerce
		.number({ error: "숫자를 입력해주세요." })
		.positive("0보다 큰 값을 입력해주세요."),
	height: z.coerce
		.number({ error: "숫자를 입력해주세요." })
		.positive("0보다 큰 값을 입력해주세요."),
	depth: z.coerce
		.number({ error: "숫자를 입력해주세요." })
		.positive("0보다 큰 값을 입력해주세요."),
	floorplan_image_url: z.string().optional(),
	actual_photo_url: z.string().optional(),
});

type CreateStoreFormData = z.infer<typeof createStoreSchema>;

function StoreNewPage() {
	const navigate = useNavigate();
	const { mutate: createStore, isPending, error } = useCreateStore();

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<CreateStoreFormData>({
		// biome-ignore lint/suspicious/noExplicitAny: Zod v4/@hookform/resolvers type mismatch
		resolver: zodResolver(createStoreSchema as any),
		defaultValues: { width: 4000, height: 2000, depth: 2000 },
	});

	const apiErrorMessage = error
		? error instanceof ApiError
			? error.message
			: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
		: null;

	const onValid: SubmitHandler<CreateStoreFormData> = (data) => {
		createStore(
			{
				name: data.name,
				address: data.address,
				width: data.width,
				height: data.height,
				depth: data.depth,
				floorplan_image_url: data.floorplan_image_url || undefined,
				actual_photo_url: data.actual_photo_url || undefined,
			},
			{ onSuccess: () => navigate({ to: "/" }) },
		);
	};

	return (
		<main className="flex flex-1 items-center justify-center py-16">
			<div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
				<div className="mb-8 flex flex-col items-center gap-2">
					<img src="/favicon.svg" alt="Do-go" className="h-10 w-10" />
					<h1 className="text-xl font-bold text-text">매장 등록</h1>
					<p className="text-center text-sm text-gray-400">
						가상 공간을 생성할 매장 정보를 입력해주세요.
					</p>
				</div>

				<form
					onSubmit={handleSubmit(onValid)}
					className="flex flex-col gap-4"
					noValidate
				>
					<div className="flex flex-col gap-1.5">
						<label htmlFor="name" className="text-sm font-medium text-text">
							매장 이름
						</label>
						<Input
							id="name"
							type="text"
							placeholder="예) DO-GO 홍대 본점"
							{...register("name")}
						/>
						{errors.name && (
							<p className="text-xs text-destructive">{errors.name.message}</p>
						)}
					</div>

					<div className="flex flex-col gap-1.5">
						<label htmlFor="address" className="text-sm font-medium text-text">
							매장 주소
						</label>
						<Input
							id="address"
							type="text"
							placeholder="예) 서울 마포구 홍대로 123"
							{...register("address")}
						/>
						{errors.address && (
							<p className="text-xs text-destructive">
								{errors.address.message}
							</p>
						)}
					</div>

					<div className="flex flex-col gap-1.5">
						<p className="text-sm font-medium text-text">가상 공간 크기 (cm)</p>
						<div className="grid grid-cols-3 gap-2">
							<div className="flex flex-col gap-1">
								<label htmlFor="width" className="text-xs text-gray-500">
									가로 (cm)
								</label>
								<Input
									id="width"
									type="number"
									placeholder="6000"
									data-track="store-size-input"
									data-track-value="width"
									{...register("width")}
								/>
								{errors.width && (
									<p className="text-xs text-destructive">
										{errors.width.message}
									</p>
								)}
							</div>
							<div className="flex flex-col gap-1">
								<label htmlFor="depth" className="text-xs text-gray-500">
									세로 (cm)
								</label>
								<Input
									id="depth"
									type="number"
									placeholder="5000"
									data-track="store-size-input"
									data-track-value="depth"
									{...register("depth")}
								/>
								{errors.depth && (
									<p className="text-xs text-destructive">
										{errors.depth.message}
									</p>
								)}
							</div>
							<div className="flex flex-col gap-1">
								<label htmlFor="height" className="text-xs text-gray-500">
									높이 (cm)
								</label>
								<Input
									id="height"
									type="number"
									placeholder="3500"
									data-track="store-size-input"
									data-track-value="height"
									{...register("height")}
								/>
								{errors.height && (
									<p className="text-xs text-destructive">
										{errors.height.message}
									</p>
								)}
							</div>
						</div>
					</div>

					{apiErrorMessage && (
						<p className="text-xs text-destructive">{apiErrorMessage}</p>
					)}

					<Button
						type="submit"
						className="mt-2 w-full"
						disabled={isPending}
						data-track="store-register-submit"
						data-track-value="submit"
					>
						{isPending ? "생성 중..." : "매장 등록"}
					</Button>
				</form>
			</div>
		</main>
	);
}
