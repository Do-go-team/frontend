import { useParams } from "@tanstack/react-router";
import { Lock, PanelLeftClose, PanelLeftOpen, Unlock } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { floorplanParserAdapter } from "@/features/layout-editor/floorplan-parser.adapter";
import { useLayout } from "@/features/layout-editor/LayoutContext";
import {
	getFixtureHeight,
	MIN_FIXTURE_SIZE,
	scalePolygonToBox,
} from "@/features/layout-editor/layout-transform";
import { addPerfEntry } from "@/features/perf/perf-log";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";
import { PhotosTab } from "./-photos-tab";
import { ZonesTab } from "./-zones-tab";

type PanelTab = "Floor" | "Fixtures" | "Photos" | "Zones" | "Pdf";
type UploadStatus = "idle" | "uploading" | "done" | "error";

const TABS: PanelTab[] = ["Floor", "Fixtures", "Photos", "Zones", "Pdf"];

export function EditorPanel({
	collapsed,
	exportDisabled,
	exportMsg,
	floorplanPreviewUrl,
	isSavingFloorSize,
	layoutName,
	onCollapsedChange,
	onExportPdf,
	onGoToLayoutList,
	onSaveFloorSize,
}: {
	collapsed: boolean;
	exportDisabled?: boolean;
	exportMsg?: string | null;
	floorplanPreviewUrl?: string | null;
	isSavingFloorSize?: boolean;
	layoutName: string;
	onCollapsedChange: (collapsed: boolean) => void;
	onExportPdf?: () => void;
	onGoToLayoutList?: () => void;
	onSaveFloorSize?: (
		floorWidth: number,
		floorHeight: number,
	) => Promise<boolean>;
}) {
	const { t } = useTranslation();
	const {
		selectedIndex,
		pendingBinding,
		cancelBinding,
		activePanelTab,
		setActivePanelTab,
	} = useLayout();
	const [activeTab, setActiveTab] = useState<PanelTab>("Floor");
	const [prevSelectedIndex, setPrevSelectedIndex] = useState<number | null>(
		null,
	);

	if (activePanelTab && activePanelTab !== activeTab) {
		setActiveTab(activePanelTab);
		setActivePanelTab(null);
	} else if (selectedIndex !== prevSelectedIndex) {
		setPrevSelectedIndex(selectedIndex);
		if (selectedIndex !== null && !pendingBinding) {
			setActiveTab("Fixtures");
		}
	}

	return (
		<aside
			className={cn(
				"absolute bottom-0 left-0 top-0 z-20 m-3 flex min-w-0 flex-col overflow-x-hidden rounded-xl bg-bg shadow-sm transition-[width] duration-200 break-keep",
				collapsed ? "w-12 items-center gap-2 p-2" : "w-[280px] gap-3 p-3",
			)}
		>
			<div
				className={cn(
					"flex shrink-0 items-center border-b border-border/60 pb-2",
					collapsed ? "justify-center border-b-0 pb-0" : "gap-2",
				)}
			>
				<button
					type="button"
					onClick={() => onCollapsedChange(!collapsed)}
					aria-label={collapsed ? "편집 패널 펼치기" : "편집 패널 접기"}
					title={collapsed ? "편집 패널 펼치기" : "편집 패널 접기"}
					className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-white text-text shadow-sm transition-colors hover:bg-gray-50"
				>
					{collapsed ? (
						<PanelLeftOpen size={16} />
					) : (
						<PanelLeftClose size={16} />
					)}
				</button>
				{!collapsed && (
					<div className="min-w-0 flex-1">
						<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
							Layout
						</p>
						<button
							type="button"
							onClick={onGoToLayoutList}
							title="레이아웃 목록으로 이동"
							className="group flex max-w-full items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-gray-100 disabled:cursor-default disabled:hover:bg-transparent"
							disabled={!onGoToLayoutList}
						>
							<span className="truncate text-sm font-semibold text-text group-hover:text-primary">
								{layoutName}
							</span>
							<span className="shrink-0 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
								목록으로
							</span>
						</button>
					</div>
				)}
			</div>
			{collapsed ? (
				<button
					type="button"
					onClick={onGoToLayoutList}
					title="레이아웃 목록으로 이동"
					className="mt-1 flex flex-1 items-center justify-center rounded text-[11px] font-semibold text-muted-foreground transition-colors [writing-mode:vertical-rl] hover:bg-gray-100 hover:text-primary disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
					disabled={!onGoToLayoutList}
				>
					{layoutName}
				</button>
			) : (
				<>
					{pendingBinding && (
						<div className="flex flex-col gap-1 rounded-md border border-yellow-300 bg-yellow-50 px-2 py-1.5 text-[11px] text-yellow-800">
							<span className="font-semibold">
								{t("editor.binding.active", {
									category: pendingBinding.category,
								})}
							</span>
							<span>{t("editor.binding.instruction")}</span>
							<button
								type="button"
								onClick={cancelBinding}
								className="mt-0.5 self-start rounded border border-yellow-400 px-1.5 py-0.5 text-[10px] text-yellow-700 hover:bg-yellow-100"
							>
								{t("editor.binding.cancel")}
							</button>
						</div>
					)}
					<TabsBar
						activeTab={activeTab}
						setActiveTab={(tab) => {
							setActiveTab(tab);
							setActivePanelTab(null);
						}}
					/>

					<div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden">
						{activeTab === "Floor" && (
							<FloorPlanTab
								floorplanPreviewUrl={floorplanPreviewUrl}
								isSavingFloorSize={isSavingFloorSize}
								onSaveFloorSize={onSaveFloorSize}
							/>
						)}
						{activeTab === "Fixtures" && <FixturesTab />}
						{activeTab === "Photos" && <PhotosTab />}
						{activeTab === "Zones" && <ZonesTab />}
						{activeTab === "Pdf" && (
							<PdfTab
								disabled={exportDisabled}
								exportMsg={exportMsg}
								onExportPdf={onExportPdf}
							/>
						)}
					</div>
				</>
			)}
		</aside>
	);
}

function TabsBar({
	activeTab,
	setActiveTab,
}: {
	activeTab: PanelTab;
	setActiveTab: (tab: PanelTab) => void;
}) {
	const { t } = useTranslation();
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const [canScrollLeft, setCanScrollLeft] = useState(false);
	const [canScrollRight, setCanScrollRight] = useState(false);

	const updateScrollState = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		setCanScrollLeft(el.scrollLeft > 1);
		setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
	}, []);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		updateScrollState();
		const observer = new ResizeObserver(updateScrollState);
		observer.observe(el);
		el.addEventListener("scroll", updateScrollState, { passive: true });
		return () => {
			observer.disconnect();
			el.removeEventListener("scroll", updateScrollState);
		};
	}, [updateScrollState]);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const activeBtn = el.querySelector<HTMLButtonElement>(
			`[data-tab="${activeTab}"]`,
		);
		activeBtn?.scrollIntoView({
			behavior: "smooth",
			block: "nearest",
			inline: "nearest",
		});
	}, [activeTab]);

	function scrollBy(direction: "left" | "right") {
		const el = scrollRef.current;
		if (!el) return;
		const amount = el.clientWidth * 0.6;
		el.scrollBy({
			left: direction === "left" ? -amount : amount,
			behavior: "smooth",
		});
	}

	return (
		<div className="relative">
			<div
				ref={scrollRef}
				className="flex gap-1 overflow-x-auto rounded-md bg-gray-300 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{TABS.map((tab) => (
					<button
						key={tab}
						type="button"
						data-tab={tab}
						onClick={() => setActiveTab(tab)}
						className={cn(
							"flex-shrink-0 whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium transition-colors",
							activeTab === tab
								? "bg-primary text-white shadow-sm"
								: "bg-transparent text-text hover:bg-gray-400",
						)}
					>
						{t(`editor.tabs.${tab}`)}
					</button>
				))}
			</div>
			{canScrollLeft && (
				<button
					type="button"
					aria-label="이전 탭"
					onClick={() => scrollBy("left")}
					className="absolute left-0 top-0 flex h-full w-7 items-center justify-start rounded-l-md bg-gradient-to-r from-gray-300 via-gray-300/95 to-transparent pl-1 text-sm font-bold text-text"
				>
					‹
				</button>
			)}
			{canScrollRight && (
				<button
					type="button"
					aria-label="다음 탭"
					onClick={() => scrollBy("right")}
					className="absolute right-0 top-0 flex h-full w-7 items-center justify-end rounded-r-md bg-gradient-to-l from-gray-300 via-gray-300/95 to-transparent pr-1 text-sm font-bold text-text"
				>
					›
				</button>
			)}
		</div>
	);
}

function PdfTab({
	disabled,
	exportMsg,
	onExportPdf,
}: {
	disabled?: boolean;
	exportMsg?: string | null;
	onExportPdf?: () => void;
}) {
	return (
		<section className="flex flex-col gap-3 rounded-lg bg-white p-4">
			<div className="flex flex-col gap-1">
				<h3 className="text-xs font-semibold text-text">PDF 내보내기</h3>
				<p className="text-[11px] leading-relaxed text-muted-foreground">
					현재 저장된 레이아웃을 백엔드 PDF 생성 API로 내보냅니다.
				</p>
			</div>
			<button
				type="button"
				onClick={onExportPdf}
				disabled={disabled || !onExportPdf}
				className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				PDF 생성
			</button>
			{exportMsg && (
				<div className="rounded-md bg-blue-50 px-2.5 py-1.5 text-[11px] font-medium text-blue-700">
					{exportMsg}
				</div>
			)}
		</section>
	);
}

function FixturesTab() {
	const { t } = useTranslation();
	const {
		layout,
		selectedIndex,
		selectedIndices,
		setSelectedFixture,
		pendingBinding,
		applyBindingToFixture,
	} = useLayout();
	const fixtures = layout?.fixtures ?? [];

	const handleFixtureClick = (index: number) => {
		if (pendingBinding) {
			applyBindingToFixture(index);
			return;
		}
		setSelectedFixture(index);
	};

	return (
		<>
			<section className="flex flex-col gap-2 rounded-lg bg-white p-4">
				<div className="flex items-center justify-between">
					<h3 className="text-xs font-semibold text-text">
						{t("editor.fixturesList.title")}
					</h3>
					<span className="text-[11px] text-muted-foreground">
						{t("editor.fixturesList.count", { count: fixtures.length })}
					</span>
				</div>
				<div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
					{fixtures.length === 0 && (
						<p className="text-xs text-muted-foreground">
							{t("editor.fixturesList.empty")}
						</p>
					)}
					{fixtures.map((fixture, index) => {
						const isBound = Boolean(fixture.photoBindingId);
						const isLocked = fixture.locked === true;
						const isSelected = selectedIndices.includes(index);
						const swatch = fixture.material?.baseColor;
						const heightCm = fixture.model3d?.height;
						return (
							<button
								key={fixture.id}
								type="button"
								onClick={() => handleFixtureClick(index)}
								className={cn(
									"rounded-lg border px-3 py-2 text-left transition-colors",
									isSelected
										? "border-primary bg-primary/5"
										: pendingBinding
											? "border-yellow-300 bg-yellow-50/40 hover:border-yellow-400"
											: "border-border bg-white hover:border-primary/40",
								)}
							>
								<p className="flex items-center gap-1 truncate text-xs font-medium text-text">
									{isBound && <span className="text-emerald-600">📷</span>}
									{isLocked && (
										<Lock
											size={12}
											className="shrink-0 text-amber-600"
											aria-label="잠금됨"
										/>
									)}
									{swatch && (
										<span
											className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm border border-border/60"
											style={{ backgroundColor: swatch }}
											title={swatch}
										/>
									)}
									{fixture.label}
								</p>
								<p className="truncate text-[11px] text-muted-foreground">
									{fixture.type} / {fixture.shape}
									{fixture.assetType && ` · ${fixture.assetType}`}
									{heightCm && ` · ${heightCm}cm`}
								</p>
							</button>
						);
					})}
				</div>
			</section>

			<FixtureEditorCard
				selectedIndex={selectedIndex}
				selectedIndices={selectedIndices}
			/>
		</>
	);
}

function FixtureEditorCard({
	selectedIndex,
	selectedIndices,
}: {
	selectedIndex: number | null;
	selectedIndices: number[];
}) {
	const { layout, updateFixture, updateFixtures } = useLayout();
	const fixture =
		selectedIndex !== null ? (layout?.fixtures?.[selectedIndex] ?? null) : null;
	const selectedFixtures = selectedIndices
		.map((index) => layout?.fixtures?.[index] ?? null)
		.filter((item): item is NonNullable<typeof fixture> => item !== null);
	const [prevFixture, setPrevFixture] = useState<typeof fixture>(null);
	const [widthInput, setWidthInput] = useState("");
	const [depthInput, setDepthInput] = useState("");
	const [height3DInput, setHeight3DInput] = useState("");

	if (fixture !== prevFixture) {
		setPrevFixture(fixture);
		if (!fixture) {
			setWidthInput("");
			setDepthInput("");
			setHeight3DInput("");
		} else {
			setWidthInput(String(fixture.width));
			setDepthInput(String(fixture.height));
			setHeight3DInput(String(getFixtureHeight(fixture)));
		}
	}

	function applyFixtureSize() {
		if (selectedIndex === null || !fixture) return;

		const width = Math.max(MIN_FIXTURE_SIZE, Number(widthInput));
		const depth = Math.max(MIN_FIXTURE_SIZE, Number(depthInput));
		const height3D = Math.max(MIN_FIXTURE_SIZE, Number(height3DInput));
		if (
			!Number.isFinite(width) ||
			!Number.isFinite(depth) ||
			!Number.isFinite(height3D)
		) {
			return;
		}

		const patch = {
			width,
			height: depth,
			model3d: {
				...(fixture.model3d ?? {}),
				height: height3D,
			},
		};

		if (fixture.polygon?.length) {
			updateFixture(selectedIndex, {
				...patch,
				polygon: scalePolygonToBox(fixture, {
					x: fixture.x,
					y: fixture.y,
					width,
					height: depth,
				}),
			});
			return;
		}

		updateFixture(selectedIndex, patch);
	}

	const { t } = useTranslation();
	const isMultiSelection = selectedIndices.length > 1;

	if (isMultiSelection) {
		const lockedCount = selectedFixtures.filter(
			(item) => item.locked === true,
		).length;
		const allLocked =
			selectedFixtures.length > 0 && lockedCount === selectedFixtures.length;
		const allUnlocked = lockedCount === 0;

		return (
			<section className="flex flex-col gap-3 rounded-lg bg-white p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="flex flex-col gap-1">
						<h3 className="text-xs font-semibold text-text">선택한 집기</h3>
						<p className="text-xs text-muted-foreground">
							{selectedFixtures.length}개 선택됨
						</p>
					</div>
					<span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] text-muted-foreground">
						잠금 {lockedCount} / 해제 {selectedFixtures.length - lockedCount}
					</span>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<button
						type="button"
						data-track="fixture-lock-multi"
						data-track-value="lock"
						onClick={() => updateFixtures(selectedIndices, { locked: true })}
						disabled={allLocked}
						className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Lock size={14} />
						선택 항목 잠금
					</button>
					<button
						type="button"
						data-track="fixture-lock-multi"
						data-track-value="unlock"
						onClick={() => updateFixtures(selectedIndices, { locked: false })}
						disabled={allUnlocked}
						className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Unlock size={14} />
						선택 항목 잠금 해제
					</button>
				</div>
				<p className="text-[11px] text-muted-foreground">
					크기, 라벨 편집은 단일 선택일 때만 가능합니다.
				</p>
			</section>
		);
	}

	if (!fixture) {
		return (
			<section className="rounded-lg bg-white p-4">
				<h3 className="text-xs font-semibold text-text">
					{t("editor.fixtureEditor.title")}
				</h3>
				<p className="mt-2 text-xs text-muted-foreground">
					{t("editor.fixtureEditor.emptyHint")}
				</p>
			</section>
		);
	}

	return (
		<section className="flex flex-col gap-3 rounded-lg bg-white p-4">
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-xs font-semibold text-text">
					{t("editor.fixtureEditor.title")}
				</h3>
				<div className="flex w-fit items-center gap-1 rounded-[32px] border border-border bg-white/95 p-1 shadow-sm">
					{[
						{ locked: false, label: "해제", Icon: Unlock },
						{ locked: true, label: "잠금", Icon: Lock },
					].map(({ locked, label, Icon }) => (
						<button
							key={label}
							type="button"
							role="switch"
							data-track="fixture-lock-toggle"
							data-track-value={locked ? "lock" : "unlock"}
							aria-checked={fixture.locked === locked}
							aria-label={`집기 ${label}`}
							onClick={() => {
								if (selectedIndex === null) return;
								updateFixture(selectedIndex, { locked });
							}}
							className={cn(
								"inline-flex items-center gap-1 rounded-[32px] px-2.5 py-1.5 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
								fixture.locked === locked
									? "bg-primary text-white shadow-sm"
									: "bg-transparent text-text hover:bg-gray-100",
							)}
						>
							<Icon size={13} />
							{label}
						</button>
					))}
				</div>
			</div>

			<div className="flex min-w-0 flex-col gap-1">
				<input
					className="h-7 rounded-md border border-input bg-background px-2 text-xs text-text"
					value={fixture.label}
					onChange={(e) => {
						if (selectedIndex === null) return;
						updateFixture(selectedIndex, { label: e.target.value });
					}}
					placeholder="집기 이름"
				/>
				<p className="text-[11px] text-muted-foreground">{fixture.type}</p>
			</div>

			{/* 3D 에셋 선택 */}
			<div className="flex flex-col gap-1">
				<label
					htmlFor="fixture-asset-type"
					className="text-xs text-muted-foreground"
				>
					{t("editor.fixtureEditor.asset3d")}
				</label>
				<select
					id="fixture-asset-type"
					className="h-8 rounded-md border border-input bg-background px-2 text-xs text-text"
					value={fixture.assetType ?? ""}
					onChange={(e) => {
						if (selectedIndex === null) return;
						updateFixture(selectedIndex, {
							assetType:
								(e.target
									.value as import("@/features/layout-editor/layout.types").FixtureAssetType) ||
								undefined,
						});
					}}
				>
					<option value="">{t("editor.fixtureEditor.defaultBox")}</option>
					<option value="apparel_rack">
						{t("editor.fixtureEditor.assets.apparel_rack")}
					</option>
					<option value="apparel_rack_round">
						{t("editor.fixtureEditor.assets.apparel_rack_round")}
					</option>
					<option value="apparel_rack_wall">
						{t("editor.fixtureEditor.assets.apparel_rack_wall")}
					</option>
					<option value="apparel_rack_double">
						{t("editor.fixtureEditor.assets.apparel_rack_double")}
					</option>
					<option value="apparel_island">
						{t("editor.fixtureEditor.assets.apparel_island")}
					</option>
					<option value="apparel_stack_table">
						{t("editor.fixtureEditor.assets.apparel_stack_table")}
					</option>
					<option value="shoe_wall">
						{t("editor.fixtureEditor.assets.shoe_wall")}
					</option>
					<option value="shoe_gondola">
						{t("editor.fixtureEditor.assets.shoe_gondola")}
					</option>
					<option value="shoe_pyramid">
						{t("editor.fixtureEditor.assets.shoe_pyramid")}
					</option>
					<option value="shoe_island">
						{t("editor.fixtureEditor.assets.shoe_island")}
					</option>
					<option value="display_table">
						{t("editor.fixtureEditor.assets.display_table")}
					</option>
					<option value="mannequin">
						{t("editor.fixtureEditor.assets.mannequin")}
					</option>
					<option value="counter">
						{t("editor.fixtureEditor.assets.counter")}
					</option>
					<option value="fitting_room">
						{t("editor.fixtureEditor.assets.fitting_room")}
					</option>
					<option value="bench">
						{t("editor.fixtureEditor.assets.bench")}
					</option>
					<option value="cafe_counter">
						{t("editor.fixtureEditor.assets.cafe_counter")}
					</option>
					<option value="cafe_table">
						{t("editor.fixtureEditor.assets.cafe_table")}
					</option>
					<option value="cafe_seat_round">
						{t("editor.fixtureEditor.assets.cafe_seat_round")}
					</option>
					<option value="pastry_display">
						{t("editor.fixtureEditor.assets.pastry_display")}
					</option>
					<option value="coffee_machine">
						{t("editor.fixtureEditor.assets.coffee_machine")}
					</option>
					<option value="generic">
						{t("editor.fixtureEditor.assets.generic")}
					</option>
				</select>
			</div>

			<div className="grid grid-cols-2 gap-2">
				<div className="flex flex-col gap-1">
					<label
						htmlFor="fixture-width"
						className="text-xs text-muted-foreground"
					>
						{t("editor.fixtureEditor.width")}
					</label>
					<Input
						id="fixture-width"
						type="number"
						min={MIN_FIXTURE_SIZE}
						className="h-8 text-xs"
						value={widthInput}
						onChange={(event) => setWidthInput(event.target.value)}
						onBlur={applyFixtureSize}
					/>
				</div>
				<div className="flex flex-col gap-1">
					<label
						htmlFor="fixture-depth"
						className="text-xs text-muted-foreground"
					>
						{t("editor.fixtureEditor.depth")}
					</label>
					<Input
						id="fixture-depth"
						type="number"
						min={MIN_FIXTURE_SIZE}
						className="h-8 text-xs"
						value={depthInput}
						onChange={(event) => setDepthInput(event.target.value)}
						onBlur={applyFixtureSize}
					/>
				</div>
			</div>
			<div className="flex flex-col gap-1">
				<label
					htmlFor="fixture-height-3d"
					className="text-xs text-muted-foreground"
				>
					{t("editor.fixtureEditor.height3d")}
				</label>
				<Input
					id="fixture-height-3d"
					type="number"
					min={MIN_FIXTURE_SIZE}
					className="h-8 text-xs"
					value={height3DInput}
					onChange={(event) => setHeight3DInput(event.target.value)}
					onBlur={applyFixtureSize}
				/>
			</div>
		</section>
	);
}

function FloorPlanTab({
	floorplanPreviewUrl,
	isSavingFloorSize,
	onSaveFloorSize,
}: {
	floorplanPreviewUrl?: string | null;
	isSavingFloorSize?: boolean;
	onSaveFloorSize?: (
		floorWidth: number,
		floorHeight: number,
	) => Promise<boolean>;
}) {
	return (
		<>
			<FloorUploadCard floorplanPreviewUrl={floorplanPreviewUrl} />
			<FloorSizeCard
				isSavingFloorSize={isSavingFloorSize}
				onSaveFloorSize={onSaveFloorSize}
			/>
		</>
	);
}

function FloorUploadCard({
	floorplanPreviewUrl,
}: {
	floorplanPreviewUrl?: string | null;
}) {
	const { t } = useTranslation();
	const { storeId, layoutId } = useParams({
		from: "/stores/$storeId/layouts/$layoutId/edit",
	});
	const { layout, setLayout, setFloorImage } = useLayout();
	const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
	const [isDragOver, setIsDragOver] = useState(false);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const displayPreviewUrl = previewUrl ?? floorplanPreviewUrl ?? null;
	const [parseMeta, setParseMeta] = useState<string | null>(null);
	const [parseMs, setParseMs] = useState<number | null>(null);

	async function resolveImageSize(file: File) {
		return new Promise<{ width: number; height: number }>((resolve) => {
			const img = new Image();
			const objectUrl = URL.createObjectURL(file);
			img.onload = () => {
				resolve({
					width: img.naturalWidth,
					height: img.naturalHeight,
				});
				URL.revokeObjectURL(objectUrl);
			};
			img.src = objectUrl;
		});
	}

	async function handleFile(file: File) {
		if (!file.type.startsWith("image/")) return;

		const dims = await resolveImageSize(file);
		const nextPreviewUrl = URL.createObjectURL(file);
		setPreviewUrl(nextPreviewUrl);
		setParseMeta(null);
		setParseMs(null);
		setUploadStatus("uploading");

		const t0 = performance.now();
		try {
			const parsed = await floorplanParserAdapter.parse(file, Number(layoutId));
			const elapsed = Math.round(performance.now() - t0);
			setParseMs(elapsed);
			const fixtureCount = parsed.layout.fixtures?.length ?? 0;
			addPerfEntry({
				category: "parse",
				label: `도면 파싱 — ${file.name}`,
				ms: elapsed,
				meta: { fixtureCount, fileName: file.name, fileSize: file.size },
			});
			window.dataLayer = window.dataLayer || [];
			window.dataLayer.push({
				event: "upload_floorplan",
				store_id: Number(storeId),
				file_type: file.type,
				status: "success",
				elapsed_ms: elapsed,
			});
			setPreviewUrl(parsed.floorplanImageUrl ?? nextPreviewUrl);
			setLayout({
				...parsed.layout,
				floorWidth:
					layout?.floorWidth ?? parsed.layout.floorWidth ?? dims.width,
				floorHeight:
					layout?.floorHeight ?? parsed.layout.floorHeight ?? dims.height,
				// 도면 이미지는 왼쪽 패널 미리보기에서만 표시한다.
				floorImageUrl: null,
				fixtures: (parsed.layout.fixtures ?? []).map((f) => ({
					...f,
					locked: true,
				})),
				products: parsed.layout.products ?? [],
			});
			setParseMeta(
				[`매장 ${storeId}`, `집기 ${fixtureCount}개`, parsed.parsedAt ?? null]
					.filter(Boolean)
					.join(" / "),
			);
			setUploadStatus("done");
		} catch (error) {
			const elapsed = Math.round(performance.now() - t0);
			setParseMs(elapsed);
			addPerfEntry({
				category: "parse",
				label: `도면 파싱 실패 — ${file.name}`,
				ms: elapsed,
				meta: {
					error: error instanceof Error ? error.message : String(error),
					fileName: file.name,
				},
			});
			setFloorImage(nextPreviewUrl, dims.width, dims.height);
			// OpenCV.js throws integers/objects, not always Error instances
			const errMsg =
				error instanceof Error
					? error.message
					: typeof error === "object" && error !== null && "message" in error
						? String((error as { message: unknown }).message)
						: typeof error === "number"
							? `OpenCV 오류 코드 ${error}`
							: String(error);
			console.error("[Parser] 파싱 실패:", error);
			setParseMeta(errMsg || "파싱 실패");
			setUploadStatus("error");
			window.dataLayer = window.dataLayer || [];
			window.dataLayer.push({
				event: "upload_floorplan",
				store_id: Number(storeId),
				file_type: file.type,
				status: "fail",
				error_message: errMsg || "파싱 실패",
			});
		}
	}

	function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (file) void handleFile(file);
		event.target.value = "";
	}

	function onDrop(event: React.DragEvent) {
		event.preventDefault();
		setIsDragOver(false);
		const file = event.dataTransfer.files[0];
		if (file) void handleFile(file);
	}

	return (
		<section className="flex flex-col gap-2 rounded-lg bg-white p-4">
			<h3 className="text-xs font-semibold text-text">
				{t("editor.floorImage.title")}
			</h3>

			{/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop zone with an <input type="file"> child */}
			<div
				className={cn(
					"relative flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition-colors",
					isDragOver
						? "border-primary bg-primary/5"
						: "border-border hover:border-primary/50",
				)}
				onDragOver={(event) => {
					event.preventDefault();
					setIsDragOver(true);
				}}
				onDragLeave={() => setIsDragOver(false)}
				onDrop={onDrop}
			>
				<input
					type="file"
					accept=".jpg,.jpeg,.png"
					className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
					onChange={onFileChange}
				/>
				{displayPreviewUrl ? (
					<img
						src={displayPreviewUrl}
						alt="Floorplan preview"
						className="pointer-events-none h-24 w-full rounded object-contain"
					/>
				) : (
					<div className="pointer-events-none flex flex-col items-center gap-2">
						<svg
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							className="text-muted-foreground"
							aria-hidden="true"
						>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="17 8 12 3 7 8" />
							<line x1="12" y1="3" x2="12" y2="15" />
						</svg>
						<p className="text-center text-[11px] text-muted-foreground">
							{t("editor.floorImage.dropzone")}
						</p>
						<p className="text-[10px] text-muted-foreground/60">
							{t("editor.floorImage.format")}
						</p>
					</div>
				)}
			</div>

			{uploadStatus === "uploading" && (
				<p className="text-[11px] text-muted-foreground">
					{t("editor.floorImage.parsing")}
				</p>
			)}
			{uploadStatus === "done" && (
				<p className="text-[11px] text-sub">{t("editor.floorImage.done")}</p>
			)}
			{uploadStatus === "error" && (
				<p className="text-[11px] text-red-500">
					{t("editor.floorImage.error")}
				</p>
			)}
			{parseMs !== null && (
				<p className="text-[10px] text-muted-foreground/70">
					{t("editor.floorImage.parseTime", { ms: parseMs })}
				</p>
			)}
			{parseMeta && (
				<p className="text-[11px] text-muted-foreground">{parseMeta}</p>
			)}
		</section>
	);
}

function FloorSizeCard({
	isSavingFloorSize,
	onSaveFloorSize,
}: {
	isSavingFloorSize?: boolean;
	onSaveFloorSize?: (
		floorWidth: number,
		floorHeight: number,
	) => Promise<boolean>;
}) {
	const { layout, setLayout } = useLayout();
	const [saveError, setSaveError] = useState<string | null>(null);
	const [prevFloorWidth, setPrevFloorWidth] = useState<number | undefined>(
		layout?.floorWidth,
	);
	const [prevFloorHeight, setPrevFloorHeight] = useState<number | undefined>(
		layout?.floorHeight,
	);
	const [widthInput, setWidthInput] = useState(
		String(layout?.floorWidth ?? ""),
	);
	const [heightInput, setHeightInput] = useState(
		String(layout?.floorHeight ?? ""),
	);

	if (layout?.floorWidth !== prevFloorWidth) {
		setPrevFloorWidth(layout?.floorWidth);
		setWidthInput(String(layout?.floorWidth ?? ""));
	}
	if (layout?.floorHeight !== prevFloorHeight) {
		setPrevFloorHeight(layout?.floorHeight);
		setHeightInput(String(layout?.floorHeight ?? ""));
	}

	function getValidSize() {
		const width = Number(widthInput);
		const height = Number(heightInput);
		if (!width || !height || width <= 0 || height <= 0) return null;
		return { width, height };
	}

	function applySize() {
		const nextSize = getValidSize();
		if (!nextSize) return null;

		if (layout) {
			setLayout({
				...layout,
				floorWidth: nextSize.width,
				floorHeight: nextSize.height,
			});
			return nextSize;
		}

		setLayout({
			floorWidth: nextSize.width,
			floorHeight: nextSize.height,
			fixtures: [],
			products: [],
		});
		return nextSize;
	}

	async function handleSaveSize() {
		const nextSize = applySize();
		if (!nextSize) {
			setSaveError("올바른 도면 크기를 입력해주세요.");
			return;
		}
		setSaveError(null);
		await onSaveFloorSize?.(nextSize.width, nextSize.height);
	}

	const { t } = useTranslation();

	return (
		<section className="flex flex-col gap-3 rounded-lg bg-white p-4">
			<h3 className="text-xs font-semibold text-text">
				{t("editor.floorSize.title")}
			</h3>
			<div className="grid grid-cols-2 gap-2">
				<div className="flex flex-col gap-1">
					<label
						htmlFor="store-width"
						className="text-xs text-muted-foreground"
					>
						{t("editor.floorSize.width")}
					</label>
					<Input
						id="store-width"
						type="number"
						placeholder="0"
						className="h-8 text-xs"
						value={widthInput}
						onChange={(event) => setWidthInput(event.target.value)}
						onBlur={applySize}
					/>
				</div>
				<div className="flex flex-col gap-1">
					<label
						htmlFor="store-height"
						className="text-xs text-muted-foreground"
					>
						{t("editor.floorSize.height")}
					</label>
					<Input
						id="store-height"
						type="number"
						placeholder="0"
						className="h-8 text-xs"
						value={heightInput}
						onChange={(event) => setHeightInput(event.target.value)}
						onBlur={applySize}
					/>
				</div>
			</div>
			<button
				type="button"
				onClick={() => void handleSaveSize()}
				disabled={isSavingFloorSize || !onSaveFloorSize}
				className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isSavingFloorSize ? "저장 중..." : "도면 크기 저장"}
			</button>
			{saveError && <p className="text-[11px] text-rose-500">{saveError}</p>}
		</section>
	);
}
