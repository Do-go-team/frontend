import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAcceptInvitation } from "@/features/invite/hooks/useAcceptInvitation";
import { ApiError } from "@/shared/types/api.types";

export const Route = createFileRoute("/invite")({
	validateSearch: (s) => ({ token: String(s.token ?? "") }),
	component: InvitePage,
});

function InvitePage() {
	const { isLoggedIn } = useAuth();
	const navigate = useNavigate();
	const { token } = Route.useSearch();
	const acceptInvitation = useAcceptInvitation();
	const mutateRef = useRef(acceptInvitation.mutate);

	useEffect(() => {
		mutateRef.current = acceptInvitation.mutate;
	});

	useEffect(() => {
		if (!isLoggedIn) {
			navigate({ to: "/login" });
			return;
		}
		if (!token) return;
		mutateRef.current({ invite_token: token });
	}, [isLoggedIn, token, navigate]);

	if (!isLoggedIn) {
		return null;
	}

	if (!token) {
		return (
			<main className="flex flex-1 items-center justify-center">
				<p className="text-gray-400">유효하지 않은 초대 링크입니다.</p>
			</main>
		);
	}

	if (acceptInvitation.isPending) {
		return (
			<main className="flex flex-1 items-center justify-center">
				<p className="text-gray-500">초대를 수락하는 중...</p>
			</main>
		);
	}

	if (acceptInvitation.isError) {
		const error = acceptInvitation.error;
		const message =
			error instanceof ApiError
				? error.message
				: "초대 수락 중 오류가 발생했습니다.";
		return (
			<main className="flex flex-1 items-center justify-center">
				<p className="text-red-500">{message}</p>
			</main>
		);
	}

	return null;
}
