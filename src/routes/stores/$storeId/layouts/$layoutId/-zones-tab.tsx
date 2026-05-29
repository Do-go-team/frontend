import { useState } from "react";
import {
	ZONE_CATEGORY_COLOR,
	ZONE_CATEGORY_LABEL,
	ZONE_TO_ASSET_TYPES,
} from "@/features/layout-editor/asset-defaults";
import { useLayout } from "@/features/layout-editor/LayoutContext";
import type { Zone, ZoneCategory } from "@/features/layout-editor/layout.types";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";

const CATEGORIES: ZoneCategory[] = [
	"shoe",
	"apparel",
	"fitting",
	"checkout",
	"common",
];

export function ZonesTab() {
	const {
		layout,
		addZone,
		updateZone,
		deleteZone,
		zoneDraftCategory,
		beginZoneDraft,
		cancelZoneDraft,
	} = useLayout();
	const zones = layout?.zones ?? [];
	const floorWidth = layout?.floorWidth ?? 0;
	const floorHeight = layout?.floorHeight ?? 0;

	const [draftCategory, setDraftCategory] = useState<ZoneCategory>("shoe");

	function quickAdd() {
		if (!layout) return;
		const id = `zone-${Date.now().toString(36)}`;
		const w = Math.round(floorWidth * 0.3);
		const h = Math.round(floorHeight * 0.3);
		const z: Zone = {
			id,
			name: ZONE_CATEGORY_LABEL[draftCategory],
			category: draftCategory,
			x: Math.round(floorWidth * 0.1),
			y: Math.round(floorHeight * 0.1),
			width: w,
			height: h,
		};
		addZone(z);
	}

	return (
		<>
			<section className="flex flex-col gap-2 rounded-lg bg-white p-4">
				<h3 className="text-xs font-semibold text-text">Zone 추가</h3>
				<p className="text-[11px] text-muted-foreground">
					매장의 구역을 표시하면 자동 매칭이 그 구역의 카테고리에 맞는 자산만
					후보로 사용합니다.
				</p>
				<div className="grid grid-cols-2 gap-1">
					{CATEGORIES.map((cat) => (
						<button
							key={cat}
							type="button"
							onClick={() => setDraftCategory(cat)}
							className={cn(
								"rounded border px-2 py-1 text-[11px] font-medium transition-colors",
								draftCategory === cat
									? "border-primary bg-primary/10 text-primary"
									: "border-border bg-white text-muted-foreground hover:border-primary/40",
							)}
							style={{
								borderLeftWidth: 4,
								borderLeftColor: ZONE_CATEGORY_COLOR[cat],
							}}
						>
							{ZONE_CATEGORY_LABEL[cat]}
						</button>
					))}
				</div>
				<div className="flex gap-1">
					<button
						type="button"
						onClick={() => beginZoneDraft(draftCategory)}
						disabled={!layout}
						className={cn(
							"flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
							zoneDraftCategory
								? "bg-amber-500 text-white"
								: "bg-emerald-600 text-white hover:bg-emerald-700",
							"disabled:opacity-60",
						)}
					>
						{zoneDraftCategory
							? `드래그 중: ${ZONE_CATEGORY_LABEL[zoneDraftCategory]} (취소하려면 도면 우클릭/Esc)`
							: `${ZONE_CATEGORY_LABEL[draftCategory]} 드래그로 그리기`}
					</button>
					<button
						type="button"
						onClick={quickAdd}
						disabled={!layout}
						className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-60"
						title="도면 좌상단 30% 위치에 사각형 영역을 빠르게 추가"
					>
						빠른 추가
					</button>
				</div>
				{zoneDraftCategory && (
					<button
						type="button"
						onClick={cancelZoneDraft}
						className="text-left text-[10px] text-amber-700 underline"
					>
						그리기 모드 취소
					</button>
				)}
				<p className="text-[10px] text-muted-foreground">
					"드래그로 그리기" 클릭 후 도면 빈 공간에서 마우스 드래그 → 사각형
					영역이 생성됩니다.
				</p>
			</section>

			<section className="flex flex-col gap-2 rounded-lg bg-white p-4">
				<div className="flex items-center justify-between">
					<h3 className="text-xs font-semibold text-text">현재 구역</h3>
					<span className="text-[11px] text-muted-foreground">
						{zones.length}개
					</span>
				</div>
				{zones.length === 0 && (
					<p className="text-[11px] text-muted-foreground">
						아직 영역이 없습니다.
					</p>
				)}
				<div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
					{zones.map((z) => (
						<ZoneCard
							key={z.id}
							zone={z}
							onUpdate={(patch) => updateZone(z.id, patch)}
							onDelete={() => deleteZone(z.id)}
						/>
					))}
				</div>
			</section>
		</>
	);
}

function ZoneCard({
	zone,
	onUpdate,
	onDelete,
}: {
	zone: Zone;
	onUpdate: (patch: Partial<Zone>) => void;
	onDelete: () => void;
}) {
	const allowed = ZONE_TO_ASSET_TYPES[zone.category];
	return (
		<div
			className="flex flex-col gap-1.5 rounded-md border border-border/80 bg-white p-2 text-[11px]"
			style={{
				borderLeftWidth: 4,
				borderLeftColor: ZONE_CATEGORY_COLOR[zone.category],
			}}
		>
			<div className="flex items-center justify-between gap-1">
				<Input
					value={zone.name}
					onChange={(e) => onUpdate({ name: e.target.value })}
					className="h-7 flex-1 text-xs"
				/>
				<button
					type="button"
					onClick={onDelete}
					className="rounded border border-border px-1.5 py-0.5 text-[10px] text-red-500 hover:bg-red-50"
				>
					삭제
				</button>
			</div>
			<select
				value={zone.category}
				onChange={(e) => onUpdate({ category: e.target.value as ZoneCategory })}
				className="h-7 rounded border border-border bg-white px-1.5 text-[11px]"
			>
				{CATEGORIES.map((c) => (
					<option key={c} value={c}>
						{ZONE_CATEGORY_LABEL[c]}
					</option>
				))}
			</select>
			<div className="grid grid-cols-4 gap-1">
				{(["x", "y", "width", "height"] as const).map((k) => (
					<div key={k} className="flex flex-col">
						<label
							htmlFor={`zone-${zone.id}-${k}`}
							className="text-[9px] text-muted-foreground"
						>
							{k}
						</label>
						<Input
							id={`zone-${zone.id}-${k}`}
							type="number"
							value={zone[k]}
							onChange={(e) => onUpdate({ [k]: Number(e.target.value) })}
							className="h-6 text-[11px]"
						/>
					</div>
				))}
			</div>
			<p className="text-[10px] text-muted-foreground/80">
				허용 자산: {allowed.length === 0 ? "모두" : `${allowed.length}종`}
			</p>
		</div>
	);
}
