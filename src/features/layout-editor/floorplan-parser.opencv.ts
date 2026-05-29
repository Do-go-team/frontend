/**
 * Browser-side floorplan parser using OpenCV.js (WebAssembly).
 * Ports the Python `draft.py` contour-detection pipeline to TypeScript.
 */

import _opencvModule from "@techstark/opencv-js";
import type { Fixture, LayoutJSON } from "./layout.types";

// ---------------------------------------------------------------------------
// OpenCV.js initializer
// Static import so Vite bundles it into the worker chunk at build time,
// avoiding the dev-mode dynamic-import hanging issue.
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noExplicitAny: OpenCV.js types are complex and handled via any for build stability
type CV = any;

let _cv: CV | null = null;

async function getCV(): Promise<CV> {
	if (_cv) return _cv;
	const OpenCV =
		(_opencvModule as unknown as { default: CV }).default ??
		(_opencvModule as CV);
	console.log("[OpenCV] WASM 초기화 대기...");

	await new Promise<void>((resolve, reject) => {
		if (OpenCV.Mat) {
			resolve();
			return;
		}
		OpenCV.onRuntimeInitialized = resolve;
		// race condition: 콜백이 이미 fire됐을 수 있으므로 폴링 백업
		const poll = setInterval(() => {
			if (OpenCV.Mat) {
				clearInterval(poll);
				resolve();
			}
		}, 100);
		setTimeout(() => {
			clearInterval(poll);
			reject(new Error("OpenCV WASM 초기화 타임아웃 (60s)"));
		}, 60_000);
	});

	console.log("[OpenCV] WASM 초기화 완료");
	_cv = OpenCV;
	return _cv;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Bbox = [number, number, number, number]; // [x, y, w, h]

interface Candidate {
	bbox: Bbox;
	shape: "rect" | "polygon";
	polygon: [number, number][] | null;
	type: string;
	label: string;
	confidence: number;
	fillRatio: number;
	solidity: number;
}

// ---------------------------------------------------------------------------
// Image loading helpers (Worker-safe: no HTMLImageElement / document)
// ---------------------------------------------------------------------------

async function fileToImageBitmap(file: File): Promise<ImageBitmap> {
	// createImageBitmap can hang for certain formats in some browsers/workers.
	// Re-wrap as Blob to ensure the MIME type is clean, and add a 30s timeout.
	const blob = new Blob([await file.arrayBuffer()], {
		type: file.type || "image/png",
	});
	return new Promise<ImageBitmap>((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error("createImageBitmap 타임아웃 (30s)")),
			30_000,
		);
		createImageBitmap(blob)
			.then((bmp) => {
				clearTimeout(timer);
				resolve(bmp);
			})
			.catch((err) => {
				clearTimeout(timer);
				reject(err);
			});
	});
}

// ---------------------------------------------------------------------------
// 1. remove_annotations
//    Erase small red/orange color blobs (annotation overlays) → white pixels.
// ---------------------------------------------------------------------------

function removeAnnotations(cv: CV, src: CV["Mat"]): CV["Mat"] {
	const hsv = new cv.Mat();
	cv.cvtColor(src, hsv, cv.COLOR_BGR2HSV);

	// Red (two HSV ranges) + orange — annotation colors typical in floor plans
	const r1 = new cv.Mat();
	const r2 = new cv.Mat();
	const o = new cv.Mat();
	cv.inRange(hsv, new cv.Scalar(0, 70, 70), new cv.Scalar(15, 255, 255), r1);
	cv.inRange(hsv, new cv.Scalar(160, 70, 70), new cv.Scalar(180, 255, 255), r2);
	cv.inRange(hsv, new cv.Scalar(10, 70, 70), new cv.Scalar(30, 255, 255), o);
	hsv.delete();

	const colorMask = new cv.Mat();
	cv.bitwise_or(r1, r2, colorMask);
	cv.bitwise_or(colorMask, o, colorMask);
	r1.delete();
	r2.delete();
	o.delete();

	// Dilate the color mask slightly to cover anti-aliased edges, then
	// erase matched pixels to white — all WASM ops, no JS pixel loops.
	const dilateK = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
	cv.dilate(colorMask, colorMask, dilateK);
	dilateK.delete();

	const cleaned = src.clone();
	const white = new cv.Mat(
		cleaned.rows,
		cleaned.cols,
		cleaned.type(),
		new cv.Scalar(255, 255, 255),
	);
	white.copyTo(cleaned, colorMask);
	white.delete();
	colorMask.delete();

	return cleaned;
}

// ---------------------------------------------------------------------------
// 2. threshold_floorplan  →  adaptive Gaussian binary inversion
// ---------------------------------------------------------------------------

function thresholdFloorplan(cv: CV, image: CV["Mat"]): CV["Mat"] {
	const gray = new cv.Mat();
	cv.cvtColor(image, gray, cv.COLOR_BGR2GRAY);
	const blurred = new cv.Mat();
	cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
	gray.delete();
	const binary = new cv.Mat();
	cv.adaptiveThreshold(
		blurred,
		binary,
		255,
		cv.ADAPTIVE_THRESH_GAUSSIAN_C,
		cv.THRESH_BINARY_INV,
		31,
		7,
	);
	blurred.delete();
	return binary;
}

// ---------------------------------------------------------------------------
// 3. suppress_small_components  →  drop text/noise blobs
// ---------------------------------------------------------------------------

function suppressSmallComponents(
	cv: CV,
	binary: CV["Mat"],
	floorW: number,
	floorH: number,
): CV["Mat"] {
	const floorArea = floorW * floorH;
	const minArea = Math.max(18, Math.floor(floorArea * 0.00008));
	// morphological OPEN removes blobs smaller than kernelDim×kernelDim — all WASM, no JS pixel loop
	const kernelDim = Math.max(3, Math.round(Math.sqrt(minArea) * 0.7));
	const openK = cv.getStructuringElement(
		cv.MORPH_RECT,
		new cv.Size(kernelDim, kernelDim),
	);
	const filtered = new cv.Mat();
	cv.morphologyEx(binary, filtered, cv.MORPH_OPEN, openK);
	openK.delete();
	return filtered;
}

// ---------------------------------------------------------------------------
// 4. extract_structural_mask  →  morphological horizontal + vertical lines
// ---------------------------------------------------------------------------

function extractStructuralMask(
	cv: CV,
	binary: CV["Mat"],
	floorW: number,
	floorH: number,
): CV["Mat"] {
	const hKernelW = Math.max(18, Math.floor(floorW * 0.035));
	const vKernelH = Math.max(18, Math.floor(floorH * 0.035));

	const hK = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(hKernelW, 1));
	const vK = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, vKernelH));

	const hLines = new cv.Mat();
	const vLines = new cv.Mat();
	cv.morphologyEx(binary, hLines, cv.MORPH_OPEN, hK);
	cv.morphologyEx(binary, vLines, cv.MORPH_OPEN, vK);
	hK.delete();
	vK.delete();

	const structure = new cv.Mat();
	cv.bitwise_or(hLines, vLines, structure);
	hLines.delete();
	vLines.delete();

	return structure;
}

// ---------------------------------------------------------------------------
// 5. preprocess_floorplan  →  full pipeline → candidateMask + structureMask
// ---------------------------------------------------------------------------

interface Preprocessed {
	candidateMask: CV["Mat"];
	structureMask: CV["Mat"];
}

function preprocessFloorplan(cv: CV, image: CV["Mat"]): Preprocessed {
	const cleaned = removeAnnotations(cv, image);
	const floorH = cleaned.rows;
	const floorW = cleaned.cols;

	const binary = thresholdFloorplan(cv, cleaned);
	cleaned.delete();

	const denoised = suppressSmallComponents(cv, binary, floorW, floorH);
	binary.delete();

	const structure = extractStructuralMask(cv, denoised, floorW, floorH);

	const candidateMask = new cv.Mat();
	cv.bitwise_or(denoised, structure, candidateMask);
	denoised.delete();

	const closeK = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
	const openK = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
	cv.morphologyEx(
		candidateMask,
		candidateMask,
		cv.MORPH_CLOSE,
		closeK,
		new cv.Point(-1, -1),
		2,
	);
	cv.morphologyEx(
		candidateMask,
		candidateMask,
		cv.MORPH_OPEN,
		openK,
		new cv.Point(-1, -1),
		1,
	);
	closeK.delete();
	openK.delete();

	return { candidateMask, structureMask: structure };
}

// ---------------------------------------------------------------------------
// Geometry helpers (pure JS)
// ---------------------------------------------------------------------------

function bboxArea(b: Bbox): number {
	return Math.max(b[2], 0) * Math.max(b[3], 0);
}

function bboxRight(b: Bbox): number {
	return b[0] + b[2];
}

function bboxBottom(b: Bbox): number {
	return b[1] + b[3];
}

function bboxCenter(b: Bbox): [number, number] {
	return [b[0] + b[2] / 2, b[1] + b[3] / 2];
}

function pointInside(b: Bbox, px: number, py: number): boolean {
	return px >= b[0] && px <= bboxRight(b) && py >= b[1] && py <= bboxBottom(b);
}

function polygonBbox(pts: [number, number][]): Bbox {
	const xs = pts.map((p) => p[0]);
	const ys = pts.map((p) => p[1]);
	const minX = Math.min(...xs);
	const maxX = Math.max(...xs);
	const minY = Math.min(...ys);
	const maxY = Math.max(...ys);
	return [minX, minY, maxX - minX, maxY - minY];
}

// ---------------------------------------------------------------------------
// 6. Contour metrics
// ---------------------------------------------------------------------------

interface ContourMetrics {
	bbox: Bbox;
	bboxArea: number;
	contourArea: number;
	fillRatio: number;
	solidity: number;
	polygon: [number, number][];
	polygonPoints: number;
}

function contourMetrics(cv: CV, contour: CV["Mat"]): ContourMetrics {
	const rect = cv.boundingRect(contour);
	const bbox: Bbox = [rect.x, rect.y, rect.width, rect.height];
	const cArea = cv.contourArea(contour);
	const hull = new cv.Mat();
	cv.convexHull(contour, hull, false, true);
	const hullArea = cv.contourArea(hull) || 1.0;
	hull.delete();

	const boxArea = Math.max(rect.width * rect.height, 1);
	const perimeter = cv.arcLength(contour, true);
	const approx = new cv.Mat();
	cv.approxPolyDP(contour, approx, 0.022 * perimeter, true);

	const seen = new Set<string>();
	const polygon: [number, number][] = [];
	for (let i = 0; i < approx.rows; i++) {
		const px = approx.data32S[i * 2];
		const py = approx.data32S[i * 2 + 1];
		const key = `${px},${py}`;
		if (!seen.has(key)) {
			seen.add(key);
			polygon.push([px, py]);
		}
	}
	approx.delete();

	return {
		bbox,
		bboxArea: boxArea,
		contourArea: cArea,
		fillRatio: cArea / boxArea,
		solidity: cArea / hullArea,
		polygon,
		polygonPoints: polygon.length,
	};
}

// ---------------------------------------------------------------------------
// 7. Candidate filters
// ---------------------------------------------------------------------------

function isRectCandidate(
	m: ContourMetrics,
	floorW: number,
	floorH: number,
): boolean {
	const [x, y, w, h] = m.bbox;
	const fa = floorW * floorH;
	if (
		w < Math.max(24, Math.floor(floorW * 0.03)) ||
		h < Math.max(24, Math.floor(floorH * 0.03))
	)
		return false;
	if (m.bboxArea < fa * 0.0012 || m.bboxArea > fa * 0.24) return false;
	if (m.polygonPoints !== 4) return false;
	if (m.fillRatio < 0.14 || m.solidity < 0.35) return false;
	if (x <= 3 || y <= 3 || x + w >= floorW - 3 || y + h >= floorH - 3)
		return false;
	return true;
}

function isPolygonCandidate(
	m: ContourMetrics,
	floorW: number,
	floorH: number,
): boolean {
	const [x, y, w, h] = m.bbox;
	const fa = floorW * floorH;
	const aspect = Math.max(w / Math.max(h, 1), h / Math.max(w, 1));
	if (
		w < Math.max(28, Math.floor(floorW * 0.028)) ||
		h < Math.max(28, Math.floor(floorH * 0.028))
	)
		return false;
	if (m.bboxArea < fa * 0.0014 || m.bboxArea > fa * 0.2) return false;
	if (m.polygonPoints < 5 || m.polygonPoints > 10) return false;
	if (m.fillRatio < 0.1 || m.solidity < 0.42) return false;
	if (aspect > 5.5) return false;
	if (x <= 3 || y <= 3 || x + w >= floorW - 3 || y + h >= floorH - 3)
		return false;
	return true;
}

// ---------------------------------------------------------------------------
// 8. Type inference + confidence
// ---------------------------------------------------------------------------

function inferFixtureType(
	w: number,
	h: number,
	fillRatio: number,
	shape: "rect" | "polygon",
): [string, string] {
	const aspect = h > 0 ? w / h : 1;
	const area = w * h;
	void fillRatio;
	if (shape === "polygon")
		return area >= 25000
			? ["display", "Display"]
			: ["generic_fixture", "Fixture"];
	if (aspect >= 1.8 && area >= 20000) return ["bathtub", "Tub"];
	if (aspect >= 0.55 && aspect <= 0.95 && area >= 9000)
		return ["toilet", "Toilet"];
	if (aspect >= 1.1 && aspect <= 1.8 && fillRatio >= 0.55)
		return ["sink", "Sink"];
	return ["generic_fixture", "Fixture"];
}

function calcConfidence(
	w: number,
	h: number,
	fillRatio: number,
	shape: "rect" | "polygon",
	solidity: number,
): number {
	const aScore = Math.min((w * h) / 30000, 1);
	const fScore = Math.min(Math.max(fillRatio, 0), 1);
	const sScore = Math.min(Math.max(solidity, 0), 1);
	let c = 0.42 + 0.22 * aScore + 0.18 * fScore + 0.14 * sScore;
	if (shape === "polygon") c -= 0.03;
	return Math.round(Math.min(Math.max(c, 0.25), 0.98) * 100) / 100;
}

function buildCandidate(
	m: ContourMetrics,
	shape: "rect" | "polygon",
): Candidate {
	const [x, y, w, h] = m.bbox;
	const [type, label] = inferFixtureType(w, h, m.fillRatio, shape);
	return {
		bbox: [x, y, w, h],
		shape,
		polygon: shape === "polygon" ? m.polygon : null,
		type,
		label,
		confidence: calcConfidence(w, h, m.fillRatio, shape, m.solidity),
		fillRatio: m.fillRatio,
		solidity: m.solidity,
	};
}

function detectRectCandidates(
	cv: CV,
	contours: CV["MatVector"],
	floorW: number,
	floorH: number,
): Candidate[] {
	const result: Candidate[] = [];
	const size = contours.size();
	for (let i = 0; i < size; i++) {
		const m = contourMetrics(cv, contours.get(i));
		if (isRectCandidate(m, floorW, floorH))
			result.push(buildCandidate(m, "rect"));
	}
	return result;
}

function detectPolygonCandidates(
	cv: CV,
	contours: CV["MatVector"],
	floorW: number,
	floorH: number,
): Candidate[] {
	const result: Candidate[] = [];
	const size = contours.size();
	for (let i = 0; i < size; i++) {
		const m = contourMetrics(cv, contours.get(i));
		if (isPolygonCandidate(m, floorW, floorH))
			result.push(buildCandidate(m, "polygon"));
	}
	return result;
}

// ---------------------------------------------------------------------------
// 9. Overlap resolution (dedupe → seam-clip → partial-overlap removal)
// ---------------------------------------------------------------------------

interface OM {
	ia: number;
	iw: number;
	ih: number;
	iou: number;
	cr: number;
	aox: number;
	aoy: number;
}

function overlapMetrics(a: Candidate, b: Candidate): OM {
	const [ax, ay, aw, ah] = a.bbox;
	const [bx, by, bw, bh] = b.bbox;
	const left = Math.max(ax, bx);
	const top = Math.max(ay, by);
	const right = Math.min(ax + aw, bx + bw);
	const bottom = Math.min(ay + ah, by + bh);
	if (right <= left || bottom <= top)
		return { ia: 0, iw: 0, ih: 0, iou: 0, cr: 0, aox: 0, aoy: 0 };
	const iw = right - left;
	const ih = bottom - top;
	const ia = iw * ih;
	const aA = bboxArea(a.bbox);
	const bA = bboxArea(b.bbox);
	const smaller = Math.min(aA, bA);
	const union = aA + bA - ia;
	return {
		ia,
		iw,
		ih,
		iou: union > 0 ? ia / union : 0,
		cr: smaller > 0 ? ia / smaller : 0,
		aox: Math.min(aw, bw) > 0 ? iw / Math.min(aw, bw) : 0,
		aoy: Math.min(ah, bh) > 0 ? ih / Math.min(ah, bh) : 0,
	};
}

function isContained(a: Candidate, b: Candidate, om: OM): boolean {
	if (om.cr < 0.92) return false;
	const [smaller, larger] =
		bboxArea(a.bbox) <= bboxArea(b.bbox) ? [a, b] : [b, a];
	const [cx, cy] = bboxCenter(smaller.bbox);
	return pointInside(larger.bbox, cx, cy);
}

function isTouching(om: OM): boolean {
	if (!om.ia) return false;
	return Math.max(om.aox, om.aoy) >= 0.9 && Math.min(om.aox, om.aoy) <= 0.015;
}

function isSeamOverlap(om: OM): boolean {
	if (!om.ia) return false;
	const major = Math.max(om.aox, om.aoy);
	const minor = Math.min(om.aox, om.aoy);
	return major >= 0.92 && minor > 0.015 && minor <= 0.22;
}

function isPartialOverlap(a: Candidate, b: Candidate, om: OM): boolean {
	if (!om.ia) return false;
	if (isContained(a, b, om) || isTouching(om) || isSeamOverlap(om))
		return false;
	const major = Math.max(om.aox, om.aoy);
	const minor = Math.min(om.aox, om.aoy);
	return om.cr >= 0.18 || om.iou >= 0.08 || (major >= 0.85 && minor >= 0.18);
}

function dedupeCandidates(candidates: Candidate[]): Candidate[] {
	const sorted = [...candidates].sort(
		(a, b) => bboxArea(b.bbox) - bboxArea(a.bbox),
	);
	const kept: Candidate[] = [];
	for (const c of sorted) {
		const hit = kept.findIndex((k) => overlapMetrics(c, k).iou >= 0.58);
		if (hit < 0) {
			kept.push(c);
		} else if (c.shape === "polygon" && kept[hit].shape === "rect") {
			kept[hit] = c;
		}
	}
	return kept;
}

function clipSeamPair(a: Candidate, b: Candidate): void {
	if (a.shape !== "rect" || b.shape !== "rect") return;
	const om = overlapMetrics(a, b);
	if (!isSeamOverlap(om)) return;

	if (om.aoy >= om.aox) {
		// vertical seam
		const [L, R] =
			bboxCenter(a.bbox)[0] <= bboxCenter(b.bbox)[0] ? [a, b] : [b, a];
		const oL = Math.max(L.bbox[0], R.bbox[0]);
		const oR = Math.min(bboxRight(L.bbox), bboxRight(R.bbox));
		const mid = Math.round((oL + oR) / 2);
		L.bbox = [L.bbox[0], L.bbox[1], Math.max(mid - L.bbox[0], 1), L.bbox[3]];
		const rEdge = R.bbox[0] + R.bbox[2];
		R.bbox = [mid, R.bbox[1], Math.max(rEdge - mid, 1), R.bbox[3]];
	} else {
		// horizontal seam
		const [T, B] =
			bboxCenter(a.bbox)[1] <= bboxCenter(b.bbox)[1] ? [a, b] : [b, a];
		const oT = Math.max(T.bbox[1], B.bbox[1]);
		const oB = Math.min(bboxBottom(T.bbox), bboxBottom(B.bbox));
		const mid = Math.round((oT + oB) / 2);
		T.bbox = [T.bbox[0], T.bbox[1], T.bbox[2], Math.max(mid - T.bbox[1], 1)];
		const bEdge = B.bbox[1] + B.bbox[3];
		B.bbox = [B.bbox[0], mid, B.bbox[2], Math.max(bEdge - mid, 1)];
	}
}

function clampBox(c: Candidate, floorW: number, floorH: number): boolean {
	const [x, y, w, h] = c.bbox;
	const cx = Math.max(0, Math.min(x, floorW - 1));
	const cy = Math.max(0, Math.min(y, floorH - 1));
	const cw = Math.max(1, Math.min(w, floorW - cx));
	const ch = Math.max(1, Math.min(h, floorH - cy));
	if (c.shape === "polygon" && c.polygon) {
		const sx = cx - x;
		const sy = cy - y;
		if (sx || sy) {
			c.polygon = c.polygon.map(([px, py]) => [
				Math.max(0, Math.min(px + sx, floorW - 1)),
				Math.max(0, Math.min(py + sy, floorH - 1)),
			]);
		}
		c.bbox = polygonBbox(c.polygon);
	} else {
		c.bbox = [cx, cy, cw, ch];
	}
	return c.bbox[2] >= 18 && c.bbox[3] >= 18;
}

function applySeamClipping(
	cands: Candidate[],
	floorW: number,
	floorH: number,
): Candidate[] {
	let working = cands.map((c) => ({ ...c, bbox: [...c.bbox] as Bbox }));
	for (let iter = 0; iter < 3; iter++) {
		let changed = false;
		for (let i = 0; i < working.length; i++) {
			for (let j = i + 1; j < working.length; j++) {
				const prevA = [...working[i].bbox] as Bbox;
				const prevB = [...working[j].bbox] as Bbox;
				clipSeamPair(working[i], working[j]);
				if (
					working[i].bbox.some((v, k) => v !== prevA[k]) ||
					working[j].bbox.some((v, k) => v !== prevB[k])
				) {
					changed = true;
				}
			}
		}
		working = working.filter((c) => clampBox(c, floorW, floorH));
		if (!changed) break;
	}
	return working;
}

function removePartialOverlaps(
	cands: Candidate[],
	floorW: number,
	floorH: number,
): Candidate[] {
	const working = cands.map((c) => ({ ...c, bbox: [...c.bbox] as Bbox }));

	for (;;) {
		// child counts
		const childCounts = new Array<number>(working.length).fill(0);
		for (let i = 0; i < working.length; i++) {
			for (let j = i + 1; j < working.length; j++) {
				const om = overlapMetrics(working[i], working[j]);
				if (isContained(working[i], working[j], om)) {
					const largerIdx =
						bboxArea(working[i].bbox) >= bboxArea(working[j].bbox) ? i : j;
					childCounts[largerIdx]++;
				}
			}
		}

		// partial conflicts
		const conflicts: Array<[number, number, OM]> = [];
		const conflictCounts = new Array<number>(working.length).fill(0);
		for (let i = 0; i < working.length; i++) {
			for (let j = i + 1; j < working.length; j++) {
				const om = overlapMetrics(working[i], working[j]);
				if (isPartialOverlap(working[i], working[j], om)) {
					conflicts.push([i, j, om]);
					conflictCounts[i]++;
					conflictCounts[j]++;
				}
			}
		}

		if (!conflicts.length) return working;

		// worst conflict
		const [idxA, idxB] = conflicts.reduce((best, cur) => {
			const bom = best[2];
			const com = cur[2];
			return com.cr > bom.cr || (com.cr === bom.cr && com.iou > bom.iou)
				? cur
				: best;
		}, conflicts[0]);

		const keepScore = (idx: number) => {
			const c = working[idx];
			let score = c.confidence;
			score += childCounts[idx] * 0.03;
			score -= conflictCounts[idx] * 0.08;
			const dist = Math.min(
				c.bbox[0],
				c.bbox[1],
				floorW - bboxRight(c.bbox),
				floorH - bboxBottom(c.bbox),
			);
			if (dist < Math.min(floorW, floorH) * 0.03) score -= 0.05;
			const [, , w, h] = c.bbox;
			const minSide = Math.min(w, h);
			if (minSide > 0 && Math.max(w / h, h / w) > 6) score -= 0.04;
			if (c.shape === "polygon") score += 0.01;
			return score;
		};

		const sA = keepScore(idxA);
		const sB = keepScore(idxB);
		let dropIdx: number;
		if (sA < sB) dropIdx = idxA;
		else if (sB < sA) dropIdx = idxB;
		else if (conflictCounts[idxA] > conflictCounts[idxB]) dropIdx = idxA;
		else if (conflictCounts[idxB] > conflictCounts[idxA]) dropIdx = idxB;
		else
			dropIdx =
				bboxArea(working[idxA].bbox) >= bboxArea(working[idxB].bbox)
					? idxA
					: idxB;

		working.splice(dropIdx, 1);
	}
}

function sortCandidates(cands: Candidate[]): Candidate[] {
	return [...cands].sort(
		(a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0],
	);
}

function resolveCandidateOverlaps(
	cands: Candidate[],
	floorW: number,
	floorH: number,
): Candidate[] {
	const d1 = dedupeCandidates(cands);
	const c1 = applySeamClipping(d1, floorW, floorH);
	const f1 = removePartialOverlaps(c1, floorW, floorH);
	const c2 = applySeamClipping(f1, floorW, floorH);
	return sortCandidates(dedupeCandidates(c2));
}

// ---------------------------------------------------------------------------
// 10. Fixture creation
// ---------------------------------------------------------------------------

function createFixture(c: Candidate, index: number): Fixture {
	const [x, y, w, h] = c.bbox;
	return {
		id: `fx-${String(index).padStart(3, "0")}`,
		type: c.type,
		label: `${c.label} ${index}`,
		shape: c.shape,
		x: Math.round(x),
		y: Math.round(y),
		width: Math.round(w),
		height: Math.round(h),
		rotation: 0,
		confidence: c.confidence,
		polygon: c.polygon as [number, number][] | null,
	};
}

// ---------------------------------------------------------------------------
// 11. Filter wrapping fixtures (outer-wall blobs)
// ---------------------------------------------------------------------------

function filterWrappingFixtures(
	fixtures: Fixture[],
	floorW: number,
	floorH: number,
): Fixture[] {
	const n = fixtures.length;
	if (n < 2) return fixtures;
	const floorArea = Math.max(1, floorW * floorH);
	const drop = new Set<number>();
	for (let i = 0; i < n; i++) {
		const a = fixtures[i];
		if ((a.width * a.height) / floorArea < 0.6) continue;
		const ax2 = a.x + a.width;
		const ay2 = a.y + a.height;
		let contained = 0;
		for (let j = 0; j < n; j++) {
			if (i === j) continue;
			const b = fixtures[j];
			if (
				b.x >= a.x &&
				b.y >= a.y &&
				b.x + b.width <= ax2 &&
				b.y + b.height <= ay2
			)
				contained++;
		}
		if (contained >= Math.max(1, Math.floor((n - 1) * 0.8))) drop.add(i);
	}
	return fixtures.filter((_, i) => !drop.has(i));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Max processing resolution — large images are downscaled before CV ops
// and bbox coordinates are scaled back up. 4x fewer pixels = ~4x faster.
const MAX_PROC_SIZE = 800; // 1200→800: 55% fewer pixels → ~2× faster WASM ops

function cvErrToString(e: unknown): string {
	if (e instanceof Error) return e.message;
	if (typeof e === "number") return `OpenCV error code ${e}`;
	if (typeof e === "object" && e !== null && "message" in e)
		return String((e as { message: unknown }).message);
	return String(e);
}

/** 에디터 마운트 시 미리 호출 → 업로드 시점엔 이미 초기화 완료 */
export function preloadOpenCV(): void {
	getCV().catch(() => {
		// 프리로드 실패는 무시 — 실제 파싱 시점에 재시도
	});
}

export async function parseFloorplanWithOpenCV(
	file: File,
): Promise<LayoutJSON> {
	console.log("[OpenCV] 파서 시작:", file.name);
	let cv: CV;
	try {
		cv = await getCV();
		console.log("[OpenCV] 초기화 완료");
	} catch (e) {
		throw new Error(`OpenCV 초기화 실패: ${cvErrToString(e)}`);
	}

	const bitmap = await fileToImageBitmap(file);
	const origW = bitmap.width;
	const origH = bitmap.height;
	console.log(`[OpenCV] 이미지 크기: ${origW}x${origH}`);

	// Downscale for processing if image is too large
	const scale = Math.min(1, MAX_PROC_SIZE / Math.max(origW, origH));
	const procW = Math.round(origW * scale);
	const procH = Math.round(origH * scale);

	// Use OffscreenCanvas — works in both main thread and Web Worker
	const canvas = new OffscreenCanvas(procW, procH);
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("OffscreenCanvas 2D context 획득 실패");
	ctx.drawImage(bitmap, 0, 0, procW, procH);
	bitmap.close();

	// Use original dimensions for the final layout (floor size in pixels)
	const floorW = origW;
	const floorH = origH;

	// Load RGBA from canvas, convert to BGR
	let rgba: CV["Mat"];
	let src: CV["Mat"];
	try {
		const imageData = ctx.getImageData(0, 0, procW, procH);
		rgba = cv.matFromImageData(imageData);
		src = new cv.Mat();
		cv.cvtColor(rgba, src, cv.COLOR_RGBA2BGR);
		rgba.delete();
		console.log("[OpenCV] matFromImageData → BGR 변환 완료");
	} catch (e) {
		throw new Error(`이미지 로드 실패: ${cvErrToString(e)}`);
	}

	// Preprocess
	let candidateMask: CV["Mat"];
	let structureMask: CV["Mat"];
	try {
		const r = preprocessFloorplan(cv, src);
		candidateMask = r.candidateMask;
		structureMask = r.structureMask;
		src.delete();
		structureMask.delete();
		console.log("[OpenCV] 전처리 완료");
	} catch (e) {
		throw new Error(`전처리 실패: ${cvErrToString(e)}`);
	}

	// Find contours
	const contours = new cv.MatVector();
	const hierarchy = new cv.Mat();
	try {
		cv.findContours(
			candidateMask,
			contours,
			hierarchy,
			cv.RETR_TREE,
			cv.CHAIN_APPROX_SIMPLE,
		);
		candidateMask.delete();
		hierarchy.delete();
		console.log(`[OpenCV] 윤곽선 탐지: ${contours.size()}개`);
	} catch (e) {
		throw new Error(`윤곽선 탐지 실패: ${cvErrToString(e)}`);
	}

	// Detect candidates (in proc-resolution coords)
	let rectCands: Candidate[];
	let polyCands: Candidate[];
	try {
		rectCands = detectRectCandidates(cv, contours, procW, procH);
		polyCands = detectPolygonCandidates(cv, contours, procW, procH);
		contours.delete();
		console.log(
			`[OpenCV] 후보 탐지: rect ${rectCands.length}개, poly ${polyCands.length}개`,
		);
	} catch (e) {
		throw new Error(`후보 탐지 실패: ${cvErrToString(e)}`);
	}

	// Resolve overlaps (in proc coords)
	const resolved = resolveCandidateOverlaps(
		[...rectCands, ...polyCands],
		procW,
		procH,
	);

	// Scale bbox + polygon points back to original image coordinate space
	const invScale = scale === 1 ? 1 : 1 / scale;
	const scaledResolved: Candidate[] = resolved.map((c) => {
		const [bx, by, bw, bh] = c.bbox;
		return {
			...c,
			bbox: [
				Math.round(bx * invScale),
				Math.round(by * invScale),
				Math.round(bw * invScale),
				Math.round(bh * invScale),
			] as Bbox,
			polygon: c.polygon
				? c.polygon.map(
						([px, py]) =>
							[Math.round(px * invScale), Math.round(py * invScale)] as [
								number,
								number,
							],
					)
				: null,
		};
	});

	// Build + filter fixtures
	let fixtures: Fixture[] = scaledResolved.map((c, i) =>
		createFixture(c, i + 1),
	);
	fixtures = filterWrappingFixtures(fixtures, floorW, floorH);

	// Re-id
	fixtures = fixtures.map((fx, i) => ({
		...fx,
		id: `fx-${String(i + 1).padStart(3, "0")}`,
	}));

	return {
		floorWidth: floorW,
		floorHeight: floorH,
		floorImageUrl: null,
		fixtures,
		products: [],
		zones: [],
	};
}
