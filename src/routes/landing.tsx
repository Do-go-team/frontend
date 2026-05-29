import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { Button } from "@/shared/components/ui/button";
import { useFadeIn } from "@/shared/hooks/useFadeIn";

// ─── 숫자 카운터 애니메이션 ───────────────────────────────────────────────────
function AnimatedCounter({
	target,
	suffix = "",
	duration = 1800,
}: {
	target: number;
	suffix?: string;
	duration?: number;
}) {
	const [count, setCount] = useState(0);
	const { ref, visible } = useFadeIn(0.3);

	useEffect(() => {
		if (!visible) return;
		const start = performance.now();
		const tick = (now: number) => {
			const elapsed = now - start;
			const progress = Math.min(elapsed / duration, 1);
			const eased = 1 - (1 - progress) ** 3;
			setCount(Math.round(eased * target));
			if (progress < 1) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	}, [visible, target, duration]);

	return (
		<div ref={ref}>
			<span>
				{count.toLocaleString()}
				{suffix}
			</span>
		</div>
	);
}

// ─── CTA 버튼 ─────────────────────────────────────────────────────────────────
function CtaButtons() {
	const { isLoggedIn } = useAuth();

	if (isLoggedIn) {
		return (
			<Button asChild size="lg" className="bg-sub text-white hover:bg-sub/90">
				<Link to="/">내 매장 보기</Link>
			</Button>
		);
	}

	return (
		<div className="flex flex-wrap justify-center gap-3">
			<Button asChild size="lg" className="bg-sub text-white hover:bg-sub/90">
				<Link to="/register">무료로 시작하기</Link>
			</Button>
			<Button
				asChild
				size="lg"
				variant="outline"
				className="border-white bg-white text-gray-900 hover:bg-white/90"
			>
				<Link to="/demo">데모 보러가기</Link>
			</Button>
			<Button
				asChild
				size="lg"
				variant="outline"
				className="border-white/40 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white"
			>
				<Link to="/login">로그인</Link>
			</Button>
		</div>
	);
}

// ─── 피처 카드 ────────────────────────────────────────────────────────────────
const FEATURES = [
	{
		tag: "편집",
		title: "2D 레이아웃 에디터",
		description:
			"드래그앤드롭으로 집기를 자유롭게 배치하고 빠르게 동선을 설계하세요.",
		accent: "bg-indigo-500",
		border: "hover:border-indigo-300",
	},
	{
		tag: "관리",
		title: "매장 통합 관리",
		description:
			"여러 매장을 한 곳에서 등록하고 레이아웃을 체계적으로 관리하세요.",
		accent: "bg-emerald-500",
		border: "hover:border-emerald-300",
	},
	{
		tag: "AI",
		title: "AI 기반 VMD 최적화",
		description:
			"AI가 VMD 원칙에 맞는 최적의 레이아웃을 분석하고 제안해 드립니다.",
		accent: "bg-violet-500",
		border: "hover:border-violet-300",
	},
];

function FeatureCard({
	tag,
	title,
	description,
	accent,
	border,
	delay,
}: (typeof FEATURES)[0] & { delay: number }) {
	const { ref, visible } = useFadeIn();

	return (
		<div
			ref={ref}
			className={`rounded-2xl border bg-white p-7 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-lg ${border} ${
				visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
			}`}
			style={{ transitionDelay: `${delay}ms` }}
		>
			<div
				className={`mb-4 inline-block rounded-md px-2 py-1 text-xs font-semibold text-white ${accent}`}
			>
				{tag}
			</div>
			<h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
			<p className="text-sm leading-relaxed text-gray-500">{description}</p>
		</div>
	);
}

// ─── 스텝 ─────────────────────────────────────────────────────────────────────
const STEPS = [
	{
		step: "01",
		label: "매장 등록",
		desc: "매장 정보와 크기를 입력하세요.",
	},
	{
		step: "02",
		label: "도면 업로드",
		desc: "도면 이미지를 올리면 자동으로 집기를 인식합니다.",
	},
	{
		step: "03",
		label: "레이아웃 설계",
		desc: "에디터에서 집기를 배치하고 동선을 빠르게 검토하세요.",
	},
	{
		step: "04",
		label: "PDF 내보내기",
		desc: "완성된 레이아웃을 PDF로 저장해 팀과 공유하세요.",
	},
];

function StepItem({
	step,
	label,
	desc,
	delay,
}: {
	step: string;
	label: string;
	desc: string;
	delay: number;
}) {
	const { ref, visible } = useFadeIn();
	return (
		<div
			ref={ref}
			className={`relative flex flex-col items-center text-center transition-all duration-500 ${
				visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
			}`}
			style={{ transitionDelay: `${delay}ms` }}
		>
			<div className="relative z-10 mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-lg">
				{step}
			</div>
			<h3 className="mb-2 font-semibold text-gray-900">{label}</h3>
			<p className="text-xs leading-relaxed text-gray-400">{desc}</p>
		</div>
	);
}

// ─── 통계 ─────────────────────────────────────────────────────────────────────
const STATS = [
	{ target: 20, suffix: "+", label: "에디터 편집 기능" },
	{ target: 98, suffix: "%+", label: "도면 인식 정확도" },
	{ target: 3, suffix: "분", label: "평균 설계 시간" },
	{ target: 1, suffix: "Click", label: "AI 3D 자동 변환" },
];

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
function HomePage() {
	const { ref: showcaseRef, visible: showcaseVisible } = useFadeIn(0.1);

	return (
		<>
			<style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .gradient-text {
          background: linear-gradient(90deg, #fff 0%, #a5c8ff 50%, #fff 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
      `}</style>

			<div className="flex flex-col">
				{/* ── Hero — 배너를 배경으로 블러 처리 ──────────────────────── */}
				<section className="relative overflow-hidden px-4 pb-28 pt-28 text-center text-white">
					{/* 블러 배경 배너 */}
					<div className="absolute inset-0 z-0">
						<img
							src="/banner.png"
							alt=""
							aria-hidden="true"
							className="h-full w-full object-cover"
							style={{ filter: "blur(2px)", transform: "scale(1.05)" }}
						/>
						{/* 어두운 오버레이 */}
						<div className="absolute inset-0 bg-[#0d1b2e]/75" />
					</div>

					{/* 콘텐츠 */}
					<div className="relative z-10 mx-auto max-w-3xl">
						<div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white/80 backdrop-blur">
							<span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
							AI 기반 VMD 레이아웃 플랫폼
						</div>

						<h1 className="gradient-text mb-6 text-5xl font-bold leading-tight tracking-tight md:text-6xl">
							AI로 완성하는
							<br />
							매장 레이아웃 디자인
						</h1>

						<p className="mb-10 text-lg leading-relaxed text-white/70">
							do-go와 함께 매장 레이아웃을 손쉽게 기획하고,
							<br />
							2D 화면에서 빠르게 시각화하세요.
						</p>

						<CtaButtons />
					</div>
				</section>

				{/* ── 통계 ──────────────────────────────────────────────────── */}
				<section className="bg-gray-950 px-4 py-16 text-white">
					<div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 md:grid-cols-4">
						{STATS.map(({ target, suffix, label }) => (
							<div key={label} className="text-center">
								<div className="mb-1 text-4xl font-bold text-sub">
									<AnimatedCounter target={target} suffix={suffix} />
								</div>
								<p className="text-sm text-white/50">{label}</p>
							</div>
						))}
					</div>
				</section>

				{/* ── 에디터 쇼케이스 ───────────────────────────────────────── */}
				<section className="bg-gray-50 px-4 py-24">
					<div className="mx-auto flex max-w-5xl flex-col items-center gap-12 md:flex-row">
						<div className="flex-1">
							<div className="mb-3 text-sm font-semibold uppercase tracking-widest text-sub">
								레이아웃 에디터
							</div>
							<h2 className="mb-4 text-3xl font-bold leading-snug text-gray-900 md:text-4xl">
								직관적인 2D
								<br />
								레이아웃 편집기
							</h2>
							<p className="mb-6 leading-relaxed text-gray-500">
								드래그앤드롭으로 집기를 배치하고, 실시간으로 배치 결과를
								확인하세요. 도면 이미지를 업로드하면 집기 위치를 자동으로
								인식합니다.
							</p>
							<ul className="space-y-2 text-sm text-gray-600">
								{[
									"도면 이미지 자동 파싱",
									"2D 편집 실시간 반영",
									"GLB 파일 import",
									"PDF 내보내기",
								].map((item) => (
									<li key={item} className="flex items-center gap-2">
										<span className="h-1.5 w-1.5 rounded-full bg-sub" />
										{item}
									</li>
								))}
							</ul>
						</div>

						{/* 스크린샷 플로팅 카드 */}
						<div
							ref={showcaseRef}
							className={`flex-1 transition-all duration-700 ${
								showcaseVisible
									? "translate-x-0 opacity-100"
									: "translate-x-12 opacity-0"
							}`}
						>
							<div className="animate-float overflow-hidden rounded-xl border border-slate-300 bg-slate-100 shadow-2xl shadow-slate-900/20">
								<div className="flex items-center gap-2 border-b border-slate-300 bg-slate-200 px-3 py-2">
									<div className="flex flex-1 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1 text-[11px] text-slate-500 shadow-inner">
										<span className="h-2 w-2 rounded-full bg-emerald-500" />
										do-go.app/stores/1/layouts/1/edit
									</div>
									<div className="ml-2 flex items-center gap-1">
										<div className="flex h-7 w-9 items-center justify-center rounded-sm text-slate-500 hover:bg-slate-300">
											—
										</div>
										<div className="flex h-7 w-9 items-center justify-center rounded-sm text-xs text-slate-600 hover:bg-slate-300">
											□
										</div>
										<div className="flex h-7 w-9 items-center justify-center rounded-sm text-slate-600 hover:bg-red-500 hover:text-white">
											×
										</div>
									</div>
								</div>
								<div className="bg-white p-2">
									<img
										src="/do-go-layout.png"
										alt="do-go 에디터 화면"
										className="aspect-[16/10] w-full rounded-lg border border-slate-200 object-cover object-top"
									/>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* ── 피처 카드 ─────────────────────────────────────────────── */}
				<section className="px-4 py-24">
					<div className="mx-auto max-w-5xl">
						<div className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-sub">
							기능 소개
						</div>
						<h2 className="mb-14 text-center text-3xl font-bold text-gray-900 md:text-4xl">
							do-go가 특별한 이유
						</h2>
						<div className="grid gap-6 sm:grid-cols-3">
							{FEATURES.map((feature, i) => (
								<FeatureCard key={feature.title} {...feature} delay={i * 120} />
							))}
						</div>
					</div>
				</section>

				{/* ── 사용 방법 ─────────────────────────────────────────────── */}
				<section className="bg-white px-4 py-24">
					<div className="mx-auto max-w-4xl">
						<div className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-sub">
							사용 방법
						</div>
						<h2 className="mb-16 text-center text-3xl font-bold text-gray-900 md:text-4xl">
							이렇게 시작하세요
						</h2>

						<div className="relative grid gap-10 sm:grid-cols-4">
							<div className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent sm:block" />

							{STEPS.map((s, i) => (
								<StepItem key={s.step} {...s} delay={i * 150} />
							))}
						</div>
					</div>
				</section>
				<section className="relative overflow-hidden bg-[#0d1b2e] px-4 py-28 text-center text-white">
					<div className="pointer-events-none absolute inset-0">
						<div className="absolute left-1/4 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-blue-600/20 blur-[80px]" />
						<div className="absolute right-1/4 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-violet-600/20 blur-[80px]" />
					</div>
					<div className="relative mx-auto max-w-2xl">
						<h2 className="mb-4 text-4xl font-bold leading-snug">
							지금 바로 매장 레이아웃을
							<br />
							시작하세요
						</h2>
						<p className="mb-10 text-white/50">
							do-go는 누구나 쉽게 전문적인 VMD 레이아웃을 만들 수 있도록
							돕습니다.
						</p>
						<CtaButtons />
					</div>
				</section>
			</div>
		</>
	);
}

export const Route = createFileRoute("/landing")({
	component: HomePage,
});
