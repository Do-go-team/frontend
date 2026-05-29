import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";

const DEMO_IMAGES = {
	floorplan: "/demo/floorplan.jpg",
	placement: "/demo/fixture-placement.jpg",
};

const DEMO_STEPS = [
	{
		label: "STEP 01",
		title: "도면 업로드",
		description:
			"매장 도면 이미지를 올려 공간의 기준이 되는 평면도를 준비합니다.",
		image: DEMO_IMAGES.floorplan,
		imageAlt: "여성 신발 매장 도면",
		metrics: ["4031×2339 도면", "평면 구조 확인", "편집 기준 생성"],
	},
	{
		label: "STEP 02",
		title: "집기 배치 설계",
		description:
			"신발 진열대와 동선을 보며 집기 위치를 조정하고 매장 흐름을 잡습니다.",
		image: DEMO_IMAGES.placement,
		imageAlt: "신발 집기 배치 예시",
		metrics: ["진열 집기 배치", "통로 흐름 점검", "VMD 구역 설계"],
	},
	{
		label: "STEP 03",
		title: "Do-Go 에디터로 확장",
		description:
			"실제 에디터에서는 집기를 드래그하고 상품 사진을 촬영해 탐지 결과까지 이어갑니다.",
		image: "/do-go-layout.png",
		imageAlt: "Do-Go 레이아웃 에디터 화면",
		metrics: ["2D 편집", "상품 탐지", "PDF 내보내기"],
	},
] as const;

function DemoStageCard({
	step,
	active,
	onClick,
}: {
	step: (typeof DEMO_STEPS)[number];
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`group rounded-2xl border p-4 text-left transition-all duration-300 ${
				active
					? "border-sky-300 bg-white shadow-lg shadow-sky-950/10"
					: "border-white/50 bg-white/60 hover:border-slate-300 hover:bg-white"
			}`}
		>
			<div className="mb-3 flex items-center justify-between gap-3">
				<span
					className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.18em] ${
						active
							? "bg-sky-600 text-white"
							: "bg-slate-200 text-slate-600 group-hover:bg-slate-300"
					}`}
				>
					{step.label}
				</span>
				<span className="text-lg text-slate-300">→</span>
			</div>
			<h3 className="text-base font-bold text-slate-950">{step.title}</h3>
			<p className="mt-2 text-sm leading-6 text-slate-600">
				{step.description}
			</p>
		</button>
	);
}

export const Route = createFileRoute("/demo")({
	component: DemoPage,
});

function DemoPage() {
	const [activeIndex, setActiveIndex] = useState(0);
	const activeStep = DEMO_STEPS[activeIndex];
	const progressWidth = useMemo(
		() => `${((activeIndex + 1) / DEMO_STEPS.length) * 100}%`,
		[activeIndex],
	);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "ArrowRight") {
				setActiveIndex((index) => Math.min(index + 1, DEMO_STEPS.length - 1));
			}
			if (event.key === "ArrowLeft") {
				setActiveIndex((index) => Math.max(index - 1, 0));
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	return (
		<main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#f8fafc_34%,#eef2ff_100%)] text-slate-950">
			<section className="relative mx-auto flex max-w-7xl flex-col gap-10 px-5 py-12 md:px-8 lg:py-16">
				<div className="pointer-events-none absolute -right-36 top-10 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl" />
				<div className="pointer-events-none absolute -left-36 bottom-10 h-80 w-80 rounded-full bg-indigo-300/30 blur-3xl" />

				<div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
					<div className="max-w-3xl">
						<div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-sky-700 shadow-sm backdrop-blur">
							<span className="h-2 w-2 rounded-full bg-emerald-500" />
							Do-Go Demo
						</div>
						<h1 className="text-4xl font-black tracking-tight text-slate-950 md:text-6xl">
							처음 매장 도면을 열고,
							<br />
							Do-Go와 함께 배치해보기
						</h1>
						<p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
							여성 신발 매장 예시를 따라가며 도면 확인, 집기 배치, 에디터
							활용까지 자연스럽게 익히는 온보딩 데모입니다.
						</p>
					</div>
					<div className="flex flex-wrap gap-3">
						<Button
							asChild
							className="bg-slate-950 text-white hover:bg-slate-800"
						>
							<Link to="/landing">랜딩으로 돌아가기</Link>
						</Button>
						<Button asChild variant="outline" className="bg-white/70">
							<Link to="/stores">실제 매장 보기</Link>
						</Button>
					</div>
				</div>

				<div className="relative z-10 grid gap-6 lg:grid-cols-[360px_1fr]">
					<aside className="flex flex-col gap-4">
						{DEMO_STEPS.map((step, index) => (
							<DemoStageCard
								key={step.title}
								step={step}
								active={index === activeIndex}
								onClick={() => setActiveIndex(index)}
							/>
						))}
						<div className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-xs leading-6 text-slate-500 shadow-sm backdrop-blur">
							키보드 <b>←</b> / <b>→</b> 로 단계 전환 가능
						</div>
					</aside>

					<section className="overflow-hidden rounded-[28px] border border-slate-300 bg-slate-950 shadow-2xl shadow-slate-950/25">
						<div className="flex items-center gap-2 border-b border-slate-700 bg-slate-900 px-4 py-3">
							<div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-500 text-xs font-black text-white">
								D
							</div>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-semibold text-white">
									{activeStep.title}
								</p>
								<p className="truncate text-xs text-slate-400">
									{activeStep.label}
								</p>
							</div>
							<div className="flex items-center gap-1 text-slate-400">
								<span className="flex h-7 w-9 items-center justify-center rounded hover:bg-slate-800">
									—
								</span>
								<span className="flex h-7 w-9 items-center justify-center rounded text-xs hover:bg-slate-800">
									□
								</span>
								<span className="flex h-7 w-9 items-center justify-center rounded hover:bg-red-500 hover:text-white">
									×
								</span>
							</div>
						</div>

						<div className="bg-slate-100 p-3 md:p-5">
							<div className="relative overflow-hidden rounded-2xl border border-slate-300 bg-white">
								<img
									src={activeStep.image}
									alt={activeStep.imageAlt}
									className="h-[56vh] min-h-[420px] w-full object-contain"
								/>
								<div className="absolute left-4 top-4 rounded-full bg-slate-950/80 px-3 py-1 text-xs font-bold text-white backdrop-blur">
									{activeStep.label} · {activeStep.title}
								</div>
							</div>

							<div className="mt-4 grid gap-3 md:grid-cols-3">
								{activeStep.metrics.map((metric) => (
									<div
										key={metric}
										className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
									>
										{metric}
									</div>
								))}
							</div>

							<div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200">
								<div
									className="h-full rounded-full bg-sky-600 transition-all duration-500"
									style={{ width: progressWidth }}
								/>
							</div>

							<div className="mt-5 flex flex-wrap justify-between gap-3">
								<Button
									type="button"
									variant="outline"
									onClick={() =>
										setActiveIndex((index) => Math.max(index - 1, 0))
									}
									disabled={activeIndex === 0}
								>
									이전
								</Button>
								<Button
									type="button"
									onClick={() =>
										setActiveIndex((index) =>
											Math.min(index + 1, DEMO_STEPS.length - 1),
										)
									}
									disabled={activeIndex === DEMO_STEPS.length - 1}
									className="bg-sky-600 text-white hover:bg-sky-700"
								>
									다음
								</Button>
							</div>
						</div>
					</section>
				</div>
			</section>
		</main>
	);
}
