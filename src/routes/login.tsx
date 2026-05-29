import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { useLogin } from "@/features/auth/hooks/useLogin";
import { Button, Input } from "@/shared/components/ui";
import { ApiError } from "@/shared/types/api.types";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

const loginSchema = z.object({
	email: z
		.string()
		.min(1, "이메일을 입력해주세요.")
		.check(z.email("올바른 이메일 형식이 아닙니다.")),
	password: z.string().min(1, "비밀번호를 입력해주세요."),
});

type LoginFormData = z.infer<typeof loginSchema>;

const ERROR_MESSAGES: Record<string, string> = {
	INVALID_CREDENTIALS: "이메일 또는 비밀번호가 올바르지 않습니다.",
	ACCOUNT_NOT_CONFIRMED: "이메일 인증이 완료되지 않았습니다.",
	DELETED_ACCOUNT: "탈퇴된 계정입니다.",
	USER_NOT_FOUND: "가입되지 않은 이메일입니다.",
	TOO_MANY_REQUESTS:
		"로그인 시도 횟수를 초과했습니다. 5분 후 다시 시도해 주세요.",
};

declare global {
	interface Window {
		dataLayer: Record<string, unknown>[];
	}
}

function LoginPage() {
	const navigate = useNavigate();
	const { mutate: login, isPending, error } = useLogin();
	const [showPassword, setShowPassword] = useState(false);

	const {
		register,
		handleSubmit,
		formState: { errors },
		// biome-ignore lint/suspicious/noExplicitAny: Zod v4/@hookform/resolvers type mismatch
	} = useForm<LoginFormData>({ resolver: zodResolver(loginSchema as any) });

	const apiErrorMessage = error
		? error instanceof ApiError
			? (ERROR_MESSAGES[error.code] ?? error.message)
			: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
		: null;

	const onValid: SubmitHandler<LoginFormData> = ({ email, password }) => {
		login(
			{ email, password },
			{
				onSuccess: (res) => {
					window.dataLayer = window.dataLayer || [];
					window.dataLayer.push({
						event: "user_info",
						worker_name: res.user.name,
						user_role: res.user.role,
					});
					navigate({ to: "/" });
				},
			},
		);
	};

	return (
		<main className="flex flex-1 items-center justify-center py-16">
			<div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
				<div className="mb-8 flex flex-col items-center gap-2">
					<img src="/favicon.svg" alt="Do-go" className="h-10 w-10" />
					<h1 className="text-xl font-bold text-text">Do-go</h1>
				</div>

				<form
					onSubmit={handleSubmit(onValid)}
					className="flex flex-col gap-4"
					noValidate
				>
					<div className="flex flex-col gap-1.5">
						<label htmlFor="email" className="text-sm font-medium text-text">
							이메일
						</label>
						<Input
							id="email"
							type="email"
							placeholder="이메일을 입력하세요"
							{...register("email")}
						/>
						{errors.email && (
							<p className="text-xs text-destructive">{errors.email.message}</p>
						)}
					</div>

					<div className="flex flex-col gap-1.5">
						<label htmlFor="password" className="text-sm font-medium text-text">
							비밀번호
						</label>
						<div className="relative">
							<Input
								id="password"
								type={showPassword ? "text" : "password"}
								placeholder="비밀번호를 입력하세요"
								className="pr-10"
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
							<p className="text-xs text-destructive">
								{errors.password.message}
							</p>
						)}
					</div>

					{apiErrorMessage && (
						<div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
							<AlertCircle size={16} className="shrink-0 text-destructive" />
							<p className="text-xs font-medium leading-tight text-destructive">
								{apiErrorMessage}
							</p>
						</div>
					)}

					<Button type="submit" className="mt-2 w-full" disabled={isPending}>
						{isPending ? "로그인 중..." : "로그인"}
					</Button>
				</form>

				<p className="mt-6 text-center text-xs text-gray-400">
					계정이 없으신가요?{" "}
					<Link to="/register" className="font-medium text-sub hover:underline">
						회원가입
					</Link>
				</p>
			</div>
		</main>
	);
}
