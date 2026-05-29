import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Input } from "@/shared/components/ui";

const emailSchema = z.object({
	email: z
		.string()
		.min(1, "이메일을 입력해주세요.")
		.check(z.email("올바른 이메일 형식이 아닙니다.")),
});

type EmailFormData = z.infer<typeof emailSchema>;

interface Props {
	email: string;
	onEmailChange: (email: string) => void;
	onSubmit: () => void;
	isPending: boolean;
	error: string | null;
}

export function RegisterEmailStep({
	email,
	onEmailChange,
	onSubmit,
	isPending,
	error,
}: Props) {
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<EmailFormData>({
		// biome-ignore lint/suspicious/noExplicitAny: Zod v4/@hookform/resolvers type mismatch
		resolver: zodResolver(emailSchema as any),
		defaultValues: { email },
	});

	const { onChange: rhfOnChange, ...restRegister } = register("email");

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
			<div className="flex flex-col gap-1.5">
				<label htmlFor="reg-email" className="text-sm font-medium text-text">
					이메일
				</label>
				<div className="flex gap-2">
					<Input
						id="reg-email"
						type="email"
						placeholder="이메일을 입력하세요"
						onChange={(e) => {
							rhfOnChange(e);
							onEmailChange(e.target.value);
						}}
						{...restRegister}
					/>
					<Button type="submit" disabled={isPending} className="shrink-0">
						{isPending ? "발송 중..." : "인증번호 발송"}
					</Button>
				</div>
				{errors.email && (
					<p className="text-xs text-destructive">{errors.email.message}</p>
				)}
			</div>
			{error && <p className="text-xs text-destructive">{error}</p>}
		</form>
	);
}
