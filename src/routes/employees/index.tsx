import { ErrorBoundary, Suspense } from "@suspensive/react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { StoreRole } from "@/features/employee/employee.types";
import { useGetMembers } from "@/features/employee/hooks/useGetMembers";
import { useUpdateMemberRole } from "@/features/employee/hooks/useUpdateMemberRole";
import { useCreateInvitation } from "@/features/invite/hooks/useCreateInvitation";
import type { CreateInvitationRequest } from "@/features/invite/invite.types";
import { Button, Input, Skeleton } from "@/shared/components/ui";
import { ApiError } from "@/shared/types/api.types";

export const Route = createFileRoute("/employees/")({
	validateSearch: (s) => ({ storeId: Number(s.storeId ?? 0) }),
	component: EmployeesRoute,
});

const ROLE_LABEL: Record<StoreRole, string> = {
	OWNER: "오너",
	MANAGER: "매니저",
	VMD: "VMD",
	STAFF: "스태프",
};

const ASSIGNABLE_ROLES: Exclude<StoreRole, "OWNER">[] = [
	"MANAGER",
	"VMD",
	"STAFF",
];

function EmployeesRoute() {
	const { storeId } = Route.useSearch();

	if (storeId === 0) {
		return (
			<main className="flex flex-1 items-center justify-center">
				<p className="text-gray-400">매장 정보가 없습니다.</p>
			</main>
		);
	}

	return (
		<ErrorBoundary fallback={<EmployeeListError />}>
			<Suspense fallback={<EmployeeListSkeleton />}>
				<EmployeeListPage storeId={storeId} />
			</Suspense>
		</ErrorBoundary>
	);
}

function EmployeeListPage({ storeId }: { storeId: number }) {
	const { data } = useGetMembers(storeId);
	const updateRole = useUpdateMemberRole(storeId);
	const createInvitation = useCreateInvitation(storeId);

	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] =
		useState<CreateInvitationRequest["target_role"]>("STAFF");
	const [inviteLink, setInviteLink] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		if (!inviteLink) return;
		navigator.clipboard.writeText(inviteLink).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	};

	const handleRoleChange = (
		userId: number,
		role: Exclude<StoreRole, "OWNER">,
	) => {
		updateRole.mutate({ userId, req: { role } });
	};

	const handleInvite = () => {
		if (!inviteEmail.trim()) return;
		createInvitation.mutate(
			{ invite_email: inviteEmail.trim(), target_role: inviteRole },
			{
				onSuccess: (res) => {
					setInviteLink(res.invite_link);
					setInviteEmail("");
				},
			},
		);
	};

	return (
		<main className="flex flex-1 flex-col">
			<div className="mx-auto w-full max-w-4xl px-6 py-10">
				{/* 헤더 */}
				<div className="mb-8 flex items-center justify-between">
					<h1 className="text-2xl font-bold text-text">직원 관리</h1>
					<span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
						관리자: {data.admin_quota.current}/{data.admin_quota.max}
					</span>
				</div>

				{/* 멤버 목록 */}
				<div className="mb-10 flex flex-col gap-3">
					{data.members.map((member) => {
						const isOwner = member.role === "OWNER";

						return (
							<div
								key={member.user_id}
								className="flex items-center justify-between rounded-2xl bg-white p-5 shadow-sm"
							>
								<div className="flex flex-col gap-0.5">
									<span className="font-semibold text-text">{member.name}</span>
									<span className="text-sm text-gray-400">{member.email}</span>
								</div>
								<div className="flex items-center gap-3">
									{isOwner ? (
										<span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
											{ROLE_LABEL[member.role]}
										</span>
									) : (
										<select
											className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
											value={member.role}
											disabled={updateRole.isPending}
											onChange={(e) =>
												handleRoleChange(
													member.user_id,
													e.target.value as Exclude<StoreRole, "OWNER">,
												)
											}
										>
											{ASSIGNABLE_ROLES.map((r) => (
												<option key={r} value={r}>
													{ROLE_LABEL[r]}
												</option>
											))}
										</select>
									)}
								</div>
							</div>
						);
					})}
				</div>

				{/* 초대 폼 */}
				<div className="rounded-2xl bg-white p-6 shadow-sm">
					<h2 className="mb-4 text-lg font-semibold text-text">직원 초대</h2>
					<div className="flex flex-col gap-3 sm:flex-row">
						<Input
							type="email"
							placeholder="초대할 이메일 주소"
							value={inviteEmail}
							onChange={(e) => setInviteEmail(e.target.value)}
							className="flex-1"
						/>
						<select
							className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
							value={inviteRole}
							onChange={(e) =>
								setInviteRole(
									e.target.value as CreateInvitationRequest["target_role"],
								)
							}
						>
							{ASSIGNABLE_ROLES.map((r) => (
								<option key={r} value={r}>
									{ROLE_LABEL[r]}
								</option>
							))}
						</select>
						<Button
							onClick={handleInvite}
							disabled={createInvitation.isPending || !inviteEmail.trim()}
						>
							{createInvitation.isPending ? "초대 중..." : "초대"}
						</Button>
					</div>
					{inviteLink && (
						<div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
							<p className="mb-2 font-medium">초대 링크가 생성되었습니다.</p>
							<div className="flex items-center gap-2">
								<span className="flex-1 break-all text-primary">
									{inviteLink}
								</span>
								<Button
									type="button"
									variant="outline"
									className="shrink-0"
									onClick={handleCopy}
								>
									{copied ? "복사됨!" : "복사"}
								</Button>
							</div>
						</div>
					)}
					{createInvitation.isError && (
						<p className="mt-2 text-sm text-red-500">
							{createInvitation.error instanceof ApiError
								? createInvitation.error.message
								: "초대 중 오류가 발생했습니다."}
						</p>
					)}
				</div>
			</div>
		</main>
	);
}

function EmployeeListError() {
	return (
		<main className="flex flex-1 items-center justify-center">
			<div className="flex flex-col items-center gap-4 text-center">
				<p className="text-gray-400">직원 목록을 불러오지 못했습니다.</p>
				<Button onClick={() => window.location.reload()}>다시 시도</Button>
			</div>
		</main>
	);
}

function EmployeeListSkeleton() {
	return (
		<main className="flex flex-1 flex-col">
			<div className="mx-auto w-full max-w-4xl px-6 py-10">
				<div className="mb-8 flex items-center justify-between">
					<Skeleton className="h-8 w-24" />
					<Skeleton className="h-7 w-20 rounded-full" />
				</div>
				<div className="flex flex-col gap-3">
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-20 rounded-2xl" />
					))}
				</div>
			</div>
		</main>
	);
}
