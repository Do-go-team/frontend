import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button, Input } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";

const MAX_NAME_LENGTH = 20;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 20;

const signupSchema = z
	.object({
		name: z
			.string()
			.min(1, "이름을 입력해주세요.")
			.max(MAX_NAME_LENGTH, `이름은 ${MAX_NAME_LENGTH}자 이하여야 합니다.`),
		password: z
			.string()
			.min(MIN_PASSWORD_LENGTH, "비밀번호는 8자 이상이어야 합니다.")
			.max(MAX_PASSWORD_LENGTH, "비밀번호는 20자 이하여야 합니다.")
			.regex(/[0-9]/, "숫자를 1자 이상 포함해야 합니다.")
			.regex(/[^A-Za-z0-9]/, "특수문자를 1자 이상 포함해야 합니다."),
		passwordConfirm: z.string(),
	})
	.refine((data) => data.password === data.passwordConfirm, {
		message: "비밀번호가 일치하지 않습니다.",
		path: ["passwordConfirm"],
	});

type SignupFormData = z.infer<typeof signupSchema>;

interface Props {
	email: string;
	onSubmit: (data: {
		name: string;
		password: string;
		passwordConfirm: string;
	}) => void;
	isPending: boolean;
	error: string | null;
}

export function RegisterSignupStep({
	email,
	onSubmit,
	isPending,
	error,
}: Props) {
	const [showPassword, setShowPassword] = useState(false);
	const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

	const {
		register,
		handleSubmit,
		control,
		formState: { errors },
	} = useForm<SignupFormData>({
		// biome-ignore lint/suspicious/noExplicitAny: Zod v4/@hookform/resolvers type mismatch
		resolver: zodResolver(signupSchema as any),
		mode: "onChange",
	});

	const nameValue = useWatch({ control, name: "name" }) ?? "";
	const passwordValue = useWatch({ control, name: "password" }) ?? "";

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
			<div className="flex flex-col gap-1.5">
				<p className="text-sm font-medium text-text">이메일</p>
				<p className="rounded-md border border-border bg-gray-50 px-3 py-2 text-sm text-gray-400">
					{email}
				</p>
			</div>

			<div className="flex flex-col gap-1.5">
				<div className="flex items-center justify-between">
					<label htmlFor="name" className="text-sm font-medium text-text">
						이름
					</label>
					<span
						className={cn(
							"text-xs tabular-nums",
							nameValue.length > MAX_NAME_LENGTH
								? "text-destructive"
								: "text-gray-400",
						)}
					>
						{nameValue.length}/{MAX_NAME_LENGTH}
					</span>
				</div>
				<Input
					id="name"
					type="text"
					placeholder="이름을 입력하세요"
					maxLength={MAX_NAME_LENGTH}
					{...register("name")}
				/>
				{errors.name && (
					<p className="text-xs text-destructive">{errors.name.message}</p>
				)}
			</div>

			<div className="flex flex-col gap-1.5">
				<div className="flex items-center justify-between">
					<label
						htmlFor="reg-password"
						className="text-sm font-medium text-text"
					>
						비밀번호
					</label>
					<span
						className={cn(
							"text-xs tabular-nums",
							passwordValue.length > 0 &&
								passwordValue.length < MIN_PASSWORD_LENGTH
								? "text-destructive"
								: "text-gray-400",
						)}
					>
						{passwordValue.length}/{MAX_PASSWORD_LENGTH}
					</span>
				</div>
				<div className="relative">
					<Input
						id="reg-password"
						type={showPassword ? "text" : "password"}
						placeholder="비밀번호를 입력하세요"
						className="pr-10"
						maxLength={MAX_PASSWORD_LENGTH}
						{...register("password")}
					/>
					<button
						type="button"
						onClick={() => setShowPassword((v) => !v)}
						className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
						aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
					>
						{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
					</button>
				</div>
				{errors.password && (
					<p className="text-xs text-destructive">{errors.password.message}</p>
				)}
			</div>

			<div className="flex flex-col gap-1.5">
				<label
					htmlFor="password-confirm"
					className="text-sm font-medium text-text"
				>
					비밀번호 확인
				</label>
				<div className="relative">
					<Input
						id="password-confirm"
						type={showPasswordConfirm ? "text" : "password"}
						placeholder="비밀번호를 다시 입력하세요"
						className="pr-10"
						maxLength={MAX_PASSWORD_LENGTH}
						{...register("passwordConfirm")}
					/>
					<button
						type="button"
						onClick={() => setShowPasswordConfirm((v) => !v)}
						className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
						aria-label={
							showPasswordConfirm ? "비밀번호 숨기기" : "비밀번호 보기"
						}
					>
						{showPasswordConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
					</button>
				</div>
				{errors.passwordConfirm && (
					<p className="text-xs text-destructive">
						{errors.passwordConfirm.message}
					</p>
				)}
			</div>

			{error && <p className="text-xs text-destructive">{error}</p>}

			<Button type="submit" className="mt-2 w-full" disabled={isPending}>
				{isPending ? "처리 중..." : "가입하기"}
			</Button>
		</form>
	);
}
