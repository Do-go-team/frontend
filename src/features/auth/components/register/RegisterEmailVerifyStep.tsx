import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useCountdown } from "@/features/auth/hooks/useCountdown";
import { Button, Input } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";

const VERIFY_CODE_LENGTH = 6;

const verifySchema = z.object({
	code: z
		.string()
		.length(VERIFY_CODE_LENGTH, `인증번호는 ${VERIFY_CODE_LENGTH}자리입니다.`),
});

type VerifyFormData = z.infer<typeof verifySchema>;

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
		.toString()
		.padStart(2, "0");
	const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
	return `${minutes}:${remainingSeconds}`;
}

interface Props {
	email: string;
	initialTimeLeft: number;
	onSubmit: (code: string) => void;
	isPending: boolean;
	error: string | null;
	onResend: () => void;
	onBack: () => void;
}

export function RegisterEmailVerifyStep({
	email,
	initialTimeLeft,
	onSubmit,
	isPending,
	error,
	onResend,
	onBack,
}: Props) {
	const { timeLeft, start, clear } = useCountdown();

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<VerifyFormData>({
		// biome-ignore lint/suspicious/noExplicitAny: Zod v4/@hookform/resolvers type mismatch
		resolver: zodResolver(verifySchema as any),
	});

	useEffect(() => {
		start(initialTimeLeft);
		return () => clear();
	}, [initialTimeLeft, start, clear]);

	return (
		<form
			onSubmit={handleSubmit(({ code }) => onSubmit(code))}
			className="flex flex-col gap-4"
		>
			<p className="text-sm text-gray-400 text-center">
				{email}으로 인증번호를 발송했습니다.
			</p>
			<div className="flex flex-col gap-1.5">
				<div className="flex items-center justify-between">
					<label htmlFor="code" className="text-sm font-medium text-text">
						인증번호
					</label>
					<span
						className={cn(
							"text-xs font-medium tabular-nums",
							timeLeft <= 30 ? "text-destructive" : "text-sub",
						)}
					>
						{formatTime(timeLeft)}
					</span>
				</div>
				<div className="flex gap-2">
					<Input
						id="code"
						type="text"
						placeholder={`${VERIFY_CODE_LENGTH}자리 인증번호`}
						maxLength={VERIFY_CODE_LENGTH}
						{...register("code")}
					/>
					<Button
						type="submit"
						disabled={isPending || timeLeft === 0}
						className="shrink-0"
					>
						{isPending ? "확인 중..." : "확인"}
					</Button>
				</div>
				{errors.code && (
					<p className="text-xs text-destructive">{errors.code.message}</p>
				)}
			</div>
			{error && <p className="text-xs text-destructive">{error}</p>}
			<div className="flex justify-between">
				<button
					type="button"
					className="text-xs text-gray-400 underline cursor-pointer"
					onClick={onBack}
				>
					이메일 재입력
				</button>
				<button
					type="button"
					className="text-xs text-gray-400 underline cursor-pointer"
					onClick={() => {
						start(initialTimeLeft);
						onResend();
					}}
				>
					재전송
				</button>
			</div>
		</form>
	);
}
