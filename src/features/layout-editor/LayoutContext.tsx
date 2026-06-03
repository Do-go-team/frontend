import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { defaultHeightForAssetType } from "./asset-defaults";
import {
	clampFixtureByBounds,
	clampFixturePosition,
	getFixtureBounds,
	translateFixture,
} from "./domain/fixture-geometry";
import type {
	Fixture,
	FixtureAssetType,
	LayoutJSON,
	Zone,
	ZoneCategory,
} from "./layout.types";
import { isContainerFixture } from "./layout-transform";

const STORAGE_KEY = "dogo-layout-draft";

let _clipboard: Fixture[] = [];

export interface PendingBinding {
	photoId: string;
	detectionId: string;
	category: string;
	assetType?: FixtureAssetType;
	dominantColor?: string | null;
}

export interface BatchBindingItem {
	photoId: string;
	detectionId: string;
	assetType?: FixtureAssetType;
	dominantColor?: string | null;
	fixtureIndex: number;
}

interface LayoutContextValue {
	layout: LayoutJSON | null;
	selectedIndex: number | null;
	selectedIndices: number[];
	selectedDetectionItemId: number | null;
	layoutVersion: number;
	pendingBinding: PendingBinding | null;
	setLayout: (layout: LayoutJSON) => void;
	syncLayout: (layout: LayoutJSON) => void;
	setFloorImage: (url: string, width: number, height: number) => void;
	updateFixture: (index: number, patch: Partial<Fixture>) => void;
	updateFixtures: (indices: number[], patch: Partial<Fixture>) => void;
	/** Apply a different patch to each fixture in one state update. */
	updateFixturesBatch: (
		updates: { index: number; patch: Partial<Fixture> }[],
	) => void;
	setSelectedFixture: (index: number | null) => void;
	setSelectedDetectionItem: (detectionItemId: number | null) => void;
	activePanelTab: "Floor" | "Fixtures" | "Photos" | "Zones" | null;
	setActivePanelTab: (
		tab: "Floor" | "Fixtures" | "Photos" | "Zones" | null,
	) => void;
	toggleFixtureSelection: (index: number) => void;
	setSelectedIndicesBatch: (indices: number[], replace?: boolean) => void;
	clearSelection: () => void;
	addFixture: (fixture?: Partial<Fixture>) => number;
	deleteFixtures: (indices: number[]) => void;
	duplicateFixtures: (indices: number[]) => number[];
	copyFixtures: (indices: number[]) => void;
	pasteFixtures: () => number[];
	resolveOverlaps: () => { resolved: number; iterations: number };
	/** Remove fixtures whose AABB encloses ≥80% of the other fixtures
	 *  (typically a stray "outer wall" rectangle imported from the floorplan). */
	removeWrappingFixtures: () => { removed: number };
	/** Per-row or per-column anchored alignment.
	 *  - top/v-center/bottom: cluster by Y (rows). Anchor = row's leftmost.
	 *    All in row align Y per mode + pack X tight to right of anchor.
	 *  - left/h-center/right: cluster by X (columns). Anchor = column's topmost.
	 *    All in column align X per mode + pack Y tight below anchor.
	 *  Rows do not interfere with each other (independent processing).
	 */
	alignFixtures: (
		indices: number[],
		mode:
			| "top"
			| "v-center"
			| "bottom"
			| "left"
			| "h-center"
			| "right"
			| "grid",
	) => void;
	undo: () => void;
	redo: () => void;
	canUndo: boolean;
	canRedo: boolean;
	beginBinding: (binding: PendingBinding) => void;
	cancelBinding: () => void;
	applyBindingToFixture: (fixtureIndex: number) => void;
	applyBindingsBatch: (items: BatchBindingItem[]) => void;
	unbindFixture: (fixtureIndex: number) => void;
	addZone: (zone: Zone) => void;
	updateZone: (zoneId: string, patch: Partial<Zone>) => void;
	deleteZone: (zoneId: string) => void;
	zoneDraftCategory: ZoneCategory | null;
	beginZoneDraft: (category: ZoneCategory) => void;
	cancelZoneDraft: () => void;
	// Camera placement draft — when a photoId is set, Canvas2D captures
	// 1st click as camera position then 2nd click as direction.
	cameraDraftPhotoId: string | null;
	beginCameraDraft: (photoId: string) => void;
	cancelCameraDraft: () => void;
	saveLayoutDraft: () => boolean;
	restoreLayoutDraft: () => boolean;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
	const [layout, setLayoutState] = useState<LayoutJSON | null>(null);
	const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
	const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
	const [selectedDetectionItemId, setSelectedDetectionItemId] = useState<
		number | null
	>(null);
	const [activePanelTab, setActivePanelTab] = useState<
		"Floor" | "Fixtures" | "Photos" | "Zones" | null
	>(null);
	const [layoutVersion, setLayoutVersion] = useState(0);
	const [pendingBinding, setPendingBinding] = useState<PendingBinding | null>(
		null,
	);
	const [zoneDraftCategory, setZoneDraftCategory] =
		useState<ZoneCategory | null>(null);
	const [cameraDraftPhotoId, setCameraDraftPhotoId] = useState<string | null>(
		null,
	);

	// === Undo/Redo infrastructure ===
	// Snapshots are captured automatically on each layoutVersion bump.
	// skipHistoryRef = true while applying an undo/redo (prevents recursion).
	const HISTORY_LIMIT = 50;
	const [undoStack, setUndoStack] = useState<LayoutJSON[]>([]);
	const [redoStack, setRedoStack] = useState<LayoutJSON[]>([]);
	const lastLayoutRef = useRef<LayoutJSON | null>(null);
	const lastVersionRef = useRef(0);
	const skipHistoryRef = useRef(false);

	useEffect(() => {
		if (layoutVersion !== lastVersionRef.current) {
			// Layout changed — snapshot the previous state.
			if (!skipHistoryRef.current && lastLayoutRef.current !== null) {
				const snapshot = structuredClone(lastLayoutRef.current) as LayoutJSON;
				setUndoStack((s) => {
					const next = [...s, snapshot];
					return next.length > HISTORY_LIMIT
						? next.slice(-HISTORY_LIMIT)
						: next;
				});
				setRedoStack([]);
			}
			skipHistoryRef.current = false;
			lastVersionRef.current = layoutVersion;
		}
		lastLayoutRef.current = layout;
	}, [layout, layoutVersion]);

	const undo = useCallback(() => {
		setUndoStack((stack) => {
			if (stack.length === 0) return stack;
			const target = stack[stack.length - 1];
			const cur = lastLayoutRef.current;
			skipHistoryRef.current = true;
			if (cur) {
				const snap = structuredClone(cur) as LayoutJSON;
				setRedoStack((r) => {
					const next = [...r, snap];
					return next.length > HISTORY_LIMIT
						? next.slice(-HISTORY_LIMIT)
						: next;
				});
			}
			setLayoutState(target);
			setSelectedIndex(null);
			setSelectedIndices([]);
			setLayoutVersion((v) => v + 1);
			return stack.slice(0, -1);
		});
	}, []);

	const redo = useCallback(() => {
		setRedoStack((stack) => {
			if (stack.length === 0) return stack;
			const target = stack[stack.length - 1];
			const cur = lastLayoutRef.current;
			skipHistoryRef.current = true;
			if (cur) {
				const snap = structuredClone(cur) as LayoutJSON;
				setUndoStack((s) => {
					const next = [...s, snap];
					return next.length > HISTORY_LIMIT
						? next.slice(-HISTORY_LIMIT)
						: next;
				});
			}
			setLayoutState(target);
			setSelectedIndex(null);
			setSelectedIndices([]);
			setLayoutVersion((v) => v + 1);
			return stack.slice(0, -1);
		});
	}, []);

	const setLayout = useCallback((next: LayoutJSON) => {
		setLayoutState(next);
		setSelectedIndex(null);
		setLayoutVersion((v) => v + 1);
	}, []);

	const syncLayout = useCallback((next: LayoutJSON) => {
		setLayoutState(next);
	}, []);

	const setFloorImage = useCallback(
		(url: string, width: number, height: number) => {
			setLayoutState((prev) => {
				if (prev) {
					return { ...prev, floorImageUrl: url };
				}
				return {
					floorWidth: width,
					floorHeight: height,
					floorImageUrl: url,
					fixtures: [],
					products: [],
				};
			});
			setLayoutVersion((v) => v + 1);
		},
		[],
	);

	const updateFixture = useCallback(
		(index: number, patch: Partial<Fixture>) => {
			setLayoutState((prev) => {
				if (!prev?.fixtures?.[index]) return prev;
				const fixtures = [...prev.fixtures];
				fixtures[index] = { ...fixtures[index], ...patch };
				return { ...prev, fixtures };
			});
			setLayoutVersion((v) => v + 1);
		},
		[],
	);

	const setSelectedFixture = useCallback((index: number | null) => {
		const idx = typeof index === "number" ? index : null;
		setSelectedIndex(idx);
		setSelectedIndices(idx === null ? [] : [idx]);
		setSelectedDetectionItemId(null);
	}, []);

	const setSelectedDetectionItem = useCallback(
		(detectionItemId: number | null) => {
			setSelectedDetectionItemId(detectionItemId);
			if (detectionItemId !== null) setActivePanelTab("Photos");
		},
		[],
	);

	const setSelectedIndicesBatch = useCallback(
		(indices: number[], replace = true) => {
			setSelectedIndices((prev) => {
				const merged = replace
					? Array.from(new Set(indices))
					: Array.from(new Set([...prev, ...indices]));
				setSelectedIndex(merged.length > 0 ? merged[merged.length - 1] : null);
				return merged;
			});
		},
		[],
	);

	const toggleFixtureSelection = useCallback((index: number) => {
		setSelectedIndices((prev) => {
			const has = prev.includes(index);
			const next = has ? prev.filter((i) => i !== index) : [...prev, index];
			setSelectedIndex(next.length > 0 ? next[next.length - 1] : null);
			return next;
		});
	}, []);

	const clearSelection = useCallback(() => {
		setSelectedIndex(null);
		setSelectedIndices([]);
	}, []);

	const updateFixtures = useCallback(
		(indices: number[], patch: Partial<Fixture>) => {
			setLayoutState((prev) => {
				if (!prev?.fixtures) return prev;
				const set = new Set(indices);
				const fixtures = prev.fixtures.map((fx, idx) =>
					set.has(idx) ? { ...fx, ...patch } : fx,
				);
				return { ...prev, fixtures };
			});
			setLayoutVersion((v) => v + 1);
		},
		[],
	);

	const updateFixturesBatch = useCallback(
		(updates: { index: number; patch: Partial<Fixture> }[]) => {
			if (updates.length === 0) return;
			setLayoutState((prev) => {
				if (!prev?.fixtures) return prev;
				const map = new Map(updates.map((u) => [u.index, u.patch]));
				const fixtures = prev.fixtures.map((fx, idx) => {
					const p = map.get(idx);
					return p ? { ...fx, ...p } : fx;
				});
				return { ...prev, fixtures };
			});
			setLayoutVersion((v) => v + 1);
		},
		[],
	);

	const addFixture = useCallback((fixture?: Partial<Fixture>): number => {
		let newIdx = -1;
		setLayoutState((prev) => {
			if (!prev) return prev;
			const cx = (prev.floorWidth ?? 800) / 2;
			const cy = (prev.floorHeight ?? 600) / 2;
			const w = fixture?.width ?? 100;
			const h = fixture?.height ?? 60;
			const nextId = `fx-${Date.now().toString(36)}`;
			const nextFixture: Fixture = {
				id: fixture?.id ?? nextId,
				type: fixture?.type ?? "generic_fixture",
				label: fixture?.label ?? `Fixture ${prev.fixtures.length + 1}`,
				shape: fixture?.shape ?? "rect",
				x: fixture?.x ?? Math.round(cx - w / 2),
				y: fixture?.y ?? Math.round(cy - h / 2),
				width: w,
				height: h,
				rotation: fixture?.rotation ?? 0,
				confidence: fixture?.confidence,
				polygon: fixture?.polygon ?? null,
				assetType: fixture?.assetType,
				material: fixture?.material,
				model3d: fixture?.model3d,
				photoBindingId: fixture?.photoBindingId,
				locked: fixture?.locked ?? false,
				layoutFixtureId: fixture?.layoutFixtureId ?? null,
				fixtureVersionId: fixture?.fixtureVersionId ?? null,
				fixtureId: fixture?.fixtureId ?? null,
				detectionPreview: fixture?.detectionPreview ?? null,
				apiMeta: fixture?.apiMeta
					? { ...fixture.apiMeta }
					: fixture?.layoutFixtureId || fixture?.fixtureVersionId
						? {
								layoutFixtureId: fixture?.layoutFixtureId ?? undefined,
								fixtureVersionId: fixture?.fixtureVersionId ?? undefined,
							}
						: undefined,
			};
			newIdx = prev.fixtures.length;
			return { ...prev, fixtures: [...prev.fixtures, nextFixture] };
		});
		setLayoutVersion((v) => v + 1);
		return newIdx;
	}, []);

	const deleteFixtures = useCallback((indices: number[]) => {
		setLayoutState((prev) => {
			if (!prev?.fixtures) return prev;
			const remove = new Set(indices);
			return {
				...prev,
				fixtures: prev.fixtures.filter((_, idx) => !remove.has(idx)),
			};
		});
		setSelectedIndices([]);
		setSelectedIndex(null);
		setLayoutVersion((v) => v + 1);
	}, []);

	const removeWrappingFixtures = useCallback(() => {
		let removedCount = 0;
		setLayoutState((prev) => {
			if (!prev?.fixtures || prev.fixtures.length < 2) return prev;
			const fixtures = prev.fixtures;
			// Use the same predicate as the canvas's red "⚠ 외곽" indicator
			// so what users see is exactly what gets removed.
			const wrappingIdx = new Set<number>();
			fixtures.forEach((f, i) => {
				if (isContainerFixture(f, fixtures, i)) wrappingIdx.add(i);
			});
			if (wrappingIdx.size === 0) return prev;
			removedCount = wrappingIdx.size;
			return {
				...prev,
				fixtures: fixtures.filter((_, idx) => !wrappingIdx.has(idx)),
			};
		});
		setSelectedIndices([]);
		setSelectedIndex(null);
		if (removedCount > 0) setLayoutVersion((v) => v + 1);
		return { removed: removedCount };
	}, []);

	const alignFixtures = useCallback(
		(
			indices: number[],
			mode:
				| "top"
				| "v-center"
				| "bottom"
				| "left"
				| "h-center"
				| "right"
				| "grid",
		) => {
			setLayoutState((prev) => {
				if (!prev?.fixtures) return prev;
				const targets = indices
					.map((i) => prev.fixtures[i])
					.filter((f): f is Fixture => Boolean(f));
				if (targets.length < 2) return prev;

				const GAP = 0.1;
				const floorW = prev.floorWidth ?? 1000;
				const floorH = prev.floorHeight ?? 1000;

				type Item = { fixture: Fixture; idx: number };
				const items: Item[] = indices
					.map((idx) => ({ fixture: prev.fixtures[idx], idx }))
					.filter((it): it is Item => Boolean(it.fixture));

				// === GRID MODE: 2D snap (column X + row Y simultaneously) ===
				if (mode === "grid") {
					// Helper: cluster items along an axis with proximity tolerance.
					function clusterAxis(
						sorted: Item[],
						getCenter: (f: Fixture) => number,
						getSize: (f: Fixture) => number,
					): Item[][] {
						const out: Item[][] = [];
						for (const it of sorted) {
							const c = getCenter(it.fixture);
							const sz = getSize(it.fixture);
							let placed = false;
							if (out.length > 0) {
								const last = out[out.length - 1];
								const lastAvgC =
									last.reduce((s, x) => s + getCenter(x.fixture), 0) /
									last.length;
								const lastAvgSz =
									last.reduce((s, x) => s + getSize(x.fixture), 0) /
									last.length;
								const tol = Math.max(sz, lastAvgSz) * 0.5;
								if (Math.abs(c - lastAvgC) <= tol) {
									last.push(it);
									placed = true;
								}
							}
							if (!placed) out.push([it]);
						}
						return out;
					}

					const xSorted = [...items].sort(
						(a, b) =>
							a.fixture.x +
							a.fixture.width / 2 -
							(b.fixture.x + b.fixture.width / 2),
					);
					const ySorted = [...items].sort(
						(a, b) =>
							a.fixture.y +
							a.fixture.height / 2 -
							(b.fixture.y + b.fixture.height / 2),
					);
					const xClusters = clusterAxis(
						xSorted,
						(f) => f.x + f.width / 2,
						(f) => f.width,
					);
					const yClusters = clusterAxis(
						ySorted,
						(f) => f.y + f.height / 2,
						(f) => f.height,
					);

					// Anchor X per column: topmost fixture's X (most likely the user's intended X).
					const colXOf = new Map<number, number>();
					const colOf = new Map<number, number>();
					xClusters.forEach((col, i) => {
						const sorted = [...col].sort((a, b) => a.fixture.y - b.fixture.y);
						colXOf.set(i, sorted[0].fixture.x);
						for (const it of col) colOf.set(it.idx, i);
					});

					// Anchor Y per row: leftmost fixture's Y (most likely the user's intended Y).
					const rowYOf = new Map<number, number>();
					const rowOf = new Map<number, number>();
					yClusters.forEach((row, j) => {
						const sorted = [...row].sort((a, b) => a.fixture.x - b.fixture.x);
						rowYOf.set(j, sorted[0].fixture.y);
						for (const it of row) rowOf.set(it.idx, j);
					});

					const newPos = new Map<number, { x: number; y: number }>();
					for (const it of items) {
						const ci = colOf.get(it.idx);
						const ri = rowOf.get(it.idx);
						let newX = it.fixture.x;
						let newY = it.fixture.y;
						if (ci !== undefined) newX = colXOf.get(ci) ?? newX;
						if (ri !== undefined) newY = rowYOf.get(ri) ?? newY;
						newX = Math.max(0, Math.min(floorW - it.fixture.width, newX));
						newY = Math.max(0, Math.min(floorH - it.fixture.height, newY));
						newPos.set(it.idx, { x: Math.round(newX), y: Math.round(newY) });
					}

					const fixtures = prev.fixtures.map((f, i) => {
						const p = newPos.get(i);
						if (!p) return f;
						return { ...f, x: p.x, y: p.y };
					});
					return { ...prev, fixtures };
				}

				const isRowMode =
					mode === "top" || mode === "v-center" || mode === "bottom";

				// === Step 1: cluster by Y (rows) for row-modes, or by X (columns) ===
				const sortedByCluster = [...items].sort((a, b) => {
					if (isRowMode) {
						return (
							a.fixture.y +
							a.fixture.height / 2 -
							(b.fixture.y + b.fixture.height / 2)
						);
					}
					return (
						a.fixture.x +
						a.fixture.width / 2 -
						(b.fixture.x + b.fixture.width / 2)
					);
				});

				const clusters: Item[][] = [];
				for (const it of sortedByCluster) {
					const c = isRowMode
						? it.fixture.y + it.fixture.height / 2
						: it.fixture.x + it.fixture.width / 2;
					const sz = isRowMode ? it.fixture.height : it.fixture.width;
					let placed = false;
					if (clusters.length > 0) {
						const last = clusters[clusters.length - 1];
						const lastAvgC =
							last.reduce(
								(s, x) =>
									s +
									(isRowMode
										? x.fixture.y + x.fixture.height / 2
										: x.fixture.x + x.fixture.width / 2),
								0,
							) / last.length;
						const lastAvgSz =
							last.reduce(
								(s, x) => s + (isRowMode ? x.fixture.height : x.fixture.width),
								0,
							) / last.length;
						const tol = Math.max(sz, lastAvgSz) * 0.5;
						if (Math.abs(c - lastAvgC) <= tol) {
							last.push(it);
							placed = true;
						}
					}
					if (!placed) clusters.push([it]);
				}

				// === Step 2: per cluster, anchor + align + pack along perpendicular axis ===
				const newPos = new Map<number, { x: number; y: number }>();
				for (const cluster of clusters) {
					// Sort within cluster by perpendicular axis:
					//   - row mode: sort by X (left → right), anchor = leftmost
					//   - column mode: sort by Y (top → bottom), anchor = topmost
					const sorted = [...cluster].sort((a, b) =>
						isRowMode ? a.fixture.x - b.fixture.x : a.fixture.y - b.fixture.y,
					);
					const anchor = sorted[0];

					if (isRowMode) {
						// Row mode: align Y only. KEEP each fixture's original X.
						// Only push right if it would overlap the previous one in the row.
						const anchorY = anchor.fixture.y;
						const anchorH = anchor.fixture.height;
						const refTop = anchorY;
						const refCenter = anchorY + anchorH / 2;
						const refBottom = anchorY + anchorH;

						newPos.set(anchor.idx, {
							x: anchor.fixture.x,
							y: anchor.fixture.y,
						});
						let prevEnd = anchor.fixture.x + anchor.fixture.width;

						for (let i = 1; i < sorted.length; i++) {
							const f = sorted[i].fixture;
							let newY = f.y;
							switch (mode) {
								case "top":
									newY = refTop;
									break;
								case "v-center":
									newY = refCenter - f.height / 2;
									break;
								case "bottom":
									newY = refBottom - f.height;
									break;
							}
							// X preserved unless it would overlap predecessor.
							let newX = f.x;
							if (newX < prevEnd + GAP) {
								newX = prevEnd + GAP;
							}
							newX = Math.max(0, Math.min(floorW - f.width, newX));
							newY = Math.max(0, Math.min(floorH - f.height, newY));
							newPos.set(sorted[i].idx, {
								x: Math.round(newX),
								y: Math.round(newY),
							});
							prevEnd = newX + f.width;
						}
					} else {
						// Column mode: align X only. KEEP each fixture's original Y.
						// Only push down if it would overlap the previous one in the column.
						const anchorX = anchor.fixture.x;
						const anchorW = anchor.fixture.width;
						const refLeft = anchorX;
						const refCenter = anchorX + anchorW / 2;
						const refRight = anchorX + anchorW;

						newPos.set(anchor.idx, {
							x: anchor.fixture.x,
							y: anchor.fixture.y,
						});
						let prevEnd = anchor.fixture.y + anchor.fixture.height;

						for (let i = 1; i < sorted.length; i++) {
							const f = sorted[i].fixture;
							let newX = f.x;
							switch (mode) {
								case "left":
									newX = refLeft;
									break;
								case "h-center":
									newX = refCenter - f.width / 2;
									break;
								case "right":
									newX = refRight - f.width;
									break;
							}
							// Y preserved unless it would overlap predecessor.
							let newY = f.y;
							if (newY < prevEnd + GAP) {
								newY = prevEnd + GAP;
							}
							newX = Math.max(0, Math.min(floorW - f.width, newX));
							newY = Math.max(0, Math.min(floorH - f.height, newY));
							newPos.set(sorted[i].idx, {
								x: Math.round(newX),
								y: Math.round(newY),
							});
							prevEnd = newY + f.height;
						}
					}
				}

				const fixtures = prev.fixtures.map((f, i) => {
					const p = newPos.get(i);
					if (!p) return f;
					return { ...f, x: p.x, y: p.y };
				});
				return { ...prev, fixtures };
			});
			setLayoutVersion((v) => v + 1);
		},
		[],
	);

	const resolveOverlaps = useCallback(() => {
		let resolvedCount = 0;
		let totalIters = 0;
		let changedAny = false;
		setLayoutState((prev) => {
			if (!prev?.fixtures || prev.fixtures.length < 2) return prev;
			const floorW = prev.floorWidth ?? 1000;
			const floorH = prev.floorHeight ?? 1000;
			const work: Fixture[] = prev.fixtures.map((f) => ({
				...f,
				x: f.x,
				y: f.y,
				polygon: f.polygon
					? f.polygon.map(([x, y]) => [x, y] as [number, number])
					: null,
			}));
			const MAX_ITER = 120;
			const TOLERANCE = 1;
			for (let iter = 0; iter < MAX_ITER; iter++) {
				totalIters = iter + 1;
				let changed = false;
				for (let i = 0; i < work.length; i++) {
					for (let j = i + 1; j < work.length; j++) {
						const a = work[i];
						const b = work[j];
						const aBounds = getFixtureBounds(a);
						const bBounds = getFixtureBounds(b);
						const ox =
							Math.min(aBounds.right, bBounds.right) -
							Math.max(aBounds.left, bBounds.left);
						const oy =
							Math.min(aBounds.bottom, bBounds.bottom) -
							Math.max(aBounds.top, bBounds.top);
						if (ox > TOLERANCE && oy > TOLERANCE) {
							resolvedCount += 1;
							changed = true;
							changedAny = true;
							if (ox <= oy) {
								const push = (ox + TOLERANCE) / 2;
								if (aBounds.centerX < bBounds.centerX) {
									work[i] = translateFixture(a, -push, 0);
									work[j] = translateFixture(b, push, 0);
								} else {
									work[i] = translateFixture(a, push, 0);
									work[j] = translateFixture(b, -push, 0);
								}
							} else {
								const push = (oy + TOLERANCE) / 2;
								if (aBounds.centerY < bBounds.centerY) {
									work[i] = translateFixture(a, 0, -push);
									work[j] = translateFixture(b, 0, push);
								} else {
									work[i] = translateFixture(a, 0, push);
									work[j] = translateFixture(b, 0, -push);
								}
							}
						}
					}
				}
				for (let idx = 0; idx < work.length; idx += 1) {
					const fixture = work[idx];
					work[idx] = clampFixtureByBounds(
						fixture,
						getFixtureBounds(fixture),
						floorW,
						floorH,
					);
				}
				if (!changed) break;
			}
			if (!changedAny) return prev;
			const fixtures = work.map((f) => ({
				...f,
				x: Math.round(f.x),
				y: Math.round(f.y),
				polygon: f.polygon
					? f.polygon.map(
							([x, y]) => [Math.round(x), Math.round(y)] as [number, number],
						)
					: null,
			}));
			return { ...prev, fixtures };
		});
		if (changedAny) setLayoutVersion((v) => v + 1);
		return { resolved: resolvedCount, iterations: totalIters };
	}, []);

	const duplicateFixtures = useCallback((indices: number[]): number[] => {
		const current = lastLayoutRef.current;
		if (!current?.fixtures) return [];

		const offset = 30; // floor units (~30cm)
		const now = Date.now().toString(36);
		const clones: Fixture[] = [];
		const newIdxs: number[] = [];
		for (const i of indices) {
			const src = current.fixtures[i];
			if (!src) continue;
			const draft = { ...src, x: src.x + offset, y: src.y + offset };
			const nextPos = clampFixturePosition(
				draft,
				current.floorWidth,
				current.floorHeight,
			);
			const dx = nextPos.x - src.x;
			const dy = nextPos.y - src.y;
			const clone: Fixture = {
				...src,
				id: `${src.id}-copy-${now}-${i}`,
				label: `${src.label} (copy)`,
				x: nextPos.x,
				y: nextPos.y,
				polygon: src.polygon
					? src.polygon.map(([px, py]) => [px + dx, py + dy])
					: null,
				photoBindingId: undefined, // copies aren't bound
				layoutFixtureId: null,
				fixtureVersionId:
					src.fixtureVersionId ?? src.apiMeta?.fixtureVersionId ?? null,
				apiMeta: undefined,
				detectionPreview: null,
			};
			clones.push(clone);
			newIdxs.push(current.fixtures.length + clones.length - 1);
		}

		if (clones.length === 0) return [];
		setLayoutState({
			...current,
			fixtures: [...current.fixtures, ...clones],
		});
		setLayoutVersion((v) => v + 1);
		return newIdxs;
	}, []);

	const copyFixtures = useCallback((indices: number[]) => {
		const all = lastLayoutRef.current?.fixtures ?? [];
		_clipboard = indices
			.map((i) => all[i])
			.filter(Boolean)
			.map((f) => structuredClone(f));
	}, []);

	const pasteFixtures = useCallback((): number[] => {
		if (_clipboard.length === 0) return [];
		const OFFSET = 30;
		let newIdxs: number[] = [];
		setLayoutState((prev) => {
			if (!prev?.fixtures) return prev;
			const clones: Fixture[] = _clipboard.map((f, i) => {
				const draft = { ...f, x: f.x + OFFSET, y: f.y + OFFSET };
				const nextPos = clampFixturePosition(
					draft,
					prev.floorWidth,
					prev.floorHeight,
				);
				const dx = nextPos.x - f.x;
				const dy = nextPos.y - f.y;
				return {
					...structuredClone(f),
					id: `${f.id}-paste-${Date.now().toString(36)}-${i}`,
					label: `${f.label} (복사)`,
					x: nextPos.x,
					y: nextPos.y,
					polygon: f.polygon
						? f.polygon.map(([px, py]): [number, number] => [px + dx, py + dy])
						: null,
					photoBindingId: undefined,
					layoutFixtureId: null,
					fixtureVersionId:
						f.fixtureVersionId ?? f.apiMeta?.fixtureVersionId ?? null,
					apiMeta: undefined,
					detectionPreview: null,
				};
			});
			newIdxs = clones.map((_, i) => prev.fixtures.length + i);
			return { ...prev, fixtures: [...prev.fixtures, ...clones] };
		});
		setLayoutVersion((v) => v + 1);
		return newIdxs;
	}, []);

	const beginBinding = useCallback((binding: PendingBinding) => {
		setPendingBinding(binding);
	}, []);

	const cancelBinding = useCallback(() => {
		setPendingBinding(null);
	}, []);

	const applyBindingToFixture = useCallback((fixtureIndex: number) => {
		setPendingBinding((current) => {
			if (!current) return current;
			const bindingId = `${current.photoId}:${current.detectionId}`;
			const nextAssetType = current.assetType;
			const inheritedHeight = nextAssetType
				? defaultHeightForAssetType(nextAssetType)
				: undefined;

			setLayoutState((prev) => {
				if (!prev?.fixtures?.[fixtureIndex]) return prev;
				const fixtures = prev.fixtures.map((fx, idx) => {
					if (idx === fixtureIndex) {
						const nextMaterial = current.dominantColor
							? { ...(fx.material ?? {}), baseColor: current.dominantColor }
							: fx.material;
						const nextModel3d = inheritedHeight
							? {
									...(fx.model3d ?? {}),
									height: fx.model3d?.height ?? inheritedHeight,
								}
							: fx.model3d;
						return {
							...fx,
							photoBindingId: bindingId,
							assetType: nextAssetType ?? fx.assetType,
							material: nextMaterial,
							model3d: nextModel3d,
						};
					}
					if (fx.photoBindingId === bindingId) {
						const { photoBindingId: _, ...rest } = fx;
						return rest;
					}
					return fx;
				});
				return { ...prev, fixtures };
			});
			setLayoutVersion((v) => v + 1);
			setSelectedIndex(fixtureIndex);
			return null;
		});
	}, []);

	const applyBindingsBatch = useCallback((items: BatchBindingItem[]) => {
		if (items.length === 0) return;
		setLayoutState((prev) => {
			if (!prev?.fixtures) return prev;
			const newBindingIds = new Set(
				items.map((m) => `${m.photoId}:${m.detectionId}`),
			);
			let fixtures = prev.fixtures.map((fx) => {
				if (fx.photoBindingId && newBindingIds.has(fx.photoBindingId)) {
					const { photoBindingId: _, ...rest } = fx;
					return rest;
				}
				return fx;
			});
			fixtures = fixtures.map((fx, idx) => {
				const match = items.find((m) => m.fixtureIndex === idx);
				if (!match) return fx;
				const bindingId = `${match.photoId}:${match.detectionId}`;
				const inheritedHeight = match.assetType
					? defaultHeightForAssetType(match.assetType)
					: undefined;
				const nextMaterial = match.dominantColor
					? { ...(fx.material ?? {}), baseColor: match.dominantColor }
					: fx.material;
				const nextModel3d = inheritedHeight
					? {
							...(fx.model3d ?? {}),
							height: fx.model3d?.height ?? inheritedHeight,
						}
					: fx.model3d;
				return {
					...fx,
					photoBindingId: bindingId,
					assetType: match.assetType ?? fx.assetType,
					material: nextMaterial,
					model3d: nextModel3d,
				};
			});
			return { ...prev, fixtures };
		});
		setLayoutVersion((v) => v + 1);
		setPendingBinding(null);
	}, []);

	const addZone = useCallback((zone: Zone) => {
		setLayoutState((prev) => {
			if (!prev) return prev;
			const zones = prev.zones ? [...prev.zones, zone] : [zone];
			return { ...prev, zones };
		});
		setLayoutVersion((v) => v + 1);
	}, []);

	const updateZone = useCallback((zoneId: string, patch: Partial<Zone>) => {
		setLayoutState((prev) => {
			if (!prev?.zones) return prev;
			const zones = prev.zones.map((z) =>
				z.id === zoneId ? { ...z, ...patch } : z,
			);
			return { ...prev, zones };
		});
		setLayoutVersion((v) => v + 1);
	}, []);

	const beginZoneDraft = useCallback((category: ZoneCategory) => {
		setZoneDraftCategory(category);
	}, []);

	const cancelZoneDraft = useCallback(() => {
		setZoneDraftCategory(null);
	}, []);

	const beginCameraDraft = useCallback((photoId: string) => {
		setCameraDraftPhotoId(photoId);
	}, []);

	const cancelCameraDraft = useCallback(() => {
		setCameraDraftPhotoId(null);
	}, []);

	const deleteZone = useCallback((zoneId: string) => {
		setLayoutState((prev) => {
			if (!prev?.zones) return prev;
			return { ...prev, zones: prev.zones.filter((z) => z.id !== zoneId) };
		});
		setLayoutVersion((v) => v + 1);
	}, []);

	const unbindFixture = useCallback((fixtureIndex: number) => {
		setLayoutState((prev) => {
			if (!prev?.fixtures?.[fixtureIndex]) return prev;
			const fixtures = prev.fixtures.map((fx, idx) => {
				if (idx !== fixtureIndex) return fx;
				const { photoBindingId: _, ...rest } = fx;
				return rest;
			});
			return { ...prev, fixtures };
		});
		setLayoutVersion((v) => v + 1);
	}, []);

	const saveLayoutDraft = useCallback(() => {
		if (!layout) return false;
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ layout }));
		return true;
	}, [layout]);

	const restoreLayoutDraft = useCallback(() => {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return false;
		try {
			const parsed = JSON.parse(raw) as { layout?: LayoutJSON };
			if (!parsed?.layout) return false;
			setLayout(parsed.layout);
			return true;
		} catch {
			return false;
		}
	}, [setLayout]);

	const value = useMemo(
		() => ({
			layout,
			selectedIndex,
			selectedIndices,
			selectedDetectionItemId,
			activePanelTab,
			layoutVersion,
			pendingBinding,
			setLayout,
			syncLayout,
			setFloorImage,
			updateFixture,
			updateFixtures,
			updateFixturesBatch,
			setSelectedFixture,
			setSelectedDetectionItem,
			setActivePanelTab,
			toggleFixtureSelection,
			setSelectedIndicesBatch,
			clearSelection,
			addFixture,
			deleteFixtures,
			duplicateFixtures,
			copyFixtures,
			pasteFixtures,
			resolveOverlaps,
			removeWrappingFixtures,
			alignFixtures,
			undo,
			redo,
			canUndo: undoStack.length > 0,
			canRedo: redoStack.length > 0,
			beginBinding,
			cancelBinding,
			applyBindingToFixture,
			applyBindingsBatch,
			unbindFixture,
			addZone,
			updateZone,
			deleteZone,
			zoneDraftCategory,
			beginZoneDraft,
			cancelZoneDraft,
			cameraDraftPhotoId,
			beginCameraDraft,
			cancelCameraDraft,
			saveLayoutDraft,
			restoreLayoutDraft,
		}),
		[
			layout,
			selectedIndex,
			selectedIndices,
			selectedDetectionItemId,
			activePanelTab,
			layoutVersion,
			pendingBinding,
			setLayout,
			syncLayout,
			setFloorImage,
			updateFixture,
			updateFixtures,
			updateFixturesBatch,
			setSelectedFixture,
			setSelectedDetectionItem,
			toggleFixtureSelection,
			setSelectedIndicesBatch,
			clearSelection,
			addFixture,
			deleteFixtures,
			duplicateFixtures,
			copyFixtures,
			pasteFixtures,
			resolveOverlaps,
			removeWrappingFixtures,
			alignFixtures,
			undo,
			redo,
			undoStack,
			redoStack,
			beginBinding,
			cancelBinding,
			applyBindingToFixture,
			applyBindingsBatch,
			unbindFixture,
			addZone,
			updateZone,
			deleteZone,
			zoneDraftCategory,
			beginZoneDraft,
			cancelZoneDraft,
			cameraDraftPhotoId,
			beginCameraDraft,
			cancelCameraDraft,
			saveLayoutDraft,
			restoreLayoutDraft,
		],
	);

	return <LayoutContext value={value}>{children}</LayoutContext>;
}

export function useLayout() {
	const ctx = useContext(LayoutContext);
	if (!ctx) throw new Error("useLayout must be used within LayoutProvider");
	return ctx;
}
