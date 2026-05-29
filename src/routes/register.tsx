import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { RegisterEmailStep } from "@/features/auth/components/register/RegisterEmailStep";
import { RegisterEmailVerifyStep } from "@/features/auth/components/register/RegisterEmailVerifyStep";
import { RegisterSignupStep } from "@/features/auth/components/register/RegisterSignupStep";
import {
	useLogin,
	useSendEmailCode,
	useSignup,
	useVerifyEmail,
} from "@/features/auth/hooks";
import { cn } from "@/shared/lib/utils";
import { getErrorMessage } from "@/shared/utils/error";

export const Route = createFileRoute("/register")({
	component: RegisterPage,
});

type Step = 1 | 2 | 3;
const REGISTER_STEPS: Step[] = [1, 2, 3];

function RegisterPage() {
	const navigate = useNavigate();
	const [step, setStep] = useState<Step>(1);
	const [email, setEmail] = useState("");
	const [verificationToken, setVerificationToken] = useState("");

	const {
		mutate: signup,
		isPending: isSigningUp,
		error: signupError,
	} = useSignup();
	const { mutate: login, isPending: isLoggingIn } = useLogin();
	const {
		mutate: sendEmailCode,
		isPending: isSendingCode,
		error: sendCodeError,
	} = useSendEmailCode();
	const {
		mutate: verifyEmail,
		isPending: isVerifying,
		error: verifyError,
	} = useVerifyEmail();

	return (
		<main className="flex flex-1 items-center justify-center py-16">
			<div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
				<div className="mb-8 flex flex-col items-center gap-2">
					<img src="/favicon.svg" alt="Do-go Logo" className="h-10 w-10" />
					<h1 className="text-xl font-bold text-text">회원가입</h1>
					{/* Progress Bar */}
					<div className="mt-1 flex gap-1.5">
						{REGISTER_STEPS.map((stepItem) => (
							<span
								key={stepItem}
								className={cn(
									"h-1.5 w-6 rounded-full transition-colors",
									stepItem <= step ? "bg-sub" : "bg-gray-200",
								)}
							/>
						))}
					</div>
				</div>

				{step === 1 && (
					<RegisterEmailStep
						email={email}
						onEmailChange={setEmail}
						onSubmit={() =>
							sendEmailCode({ email }, { onSuccess: () => setStep(2) })
						}
						isPending={isSendingCode}
						error={getErrorMessage(sendCodeError)}
					/>
				)}
				{step === 2 && (
					<RegisterEmailVerifyStep
						email={email}
						initialTimeLeft={180}
						onResend={() => sendEmailCode({ email })}
						onBack={() => setStep(1)}
						onSubmit={(code) =>
							verifyEmail(
								{ email, code },
								{
									onSuccess: ({ verification_token }) => {
										setVerificationToken(verification_token);
										setStep(3);
									},
								},
							)
						}
						isPending={isVerifying}
						error={getErrorMessage(verifyError)}
					/>
				)}
				{step === 3 && (
					<RegisterSignupStep
						email={email}
						onSubmit={({ name, password, passwordConfirm }) =>
							signup(
								{
									email,
									password,
									password_confirm: passwordConfirm,
									name,
									verification_token: verificationToken,
								},
								{
									onSuccess: () =>
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
													navigate({ to: "/stores/new" });
												},
											},
										),
								},
							)
						}
						isPending={isSigningUp || isLoggingIn}
						error={getErrorMessage(signupError)}
					/>
				)}

				<p className="mt-6 text-center text-xs text-gray-400">
					이미 계정이 있으신가요?{" "}
					<Link to="/login" className="font-medium text-sub hover:underline">
						로그인
					</Link>
				</p>
			</div>
		</main>
	);
}
