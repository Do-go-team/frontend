import type { Fixture } from "../layout.types";

export type FixtureBounds = {
	left: number;
	top: number;
	right: number;
	bottom: number;
	width: number;
	height: number;
	centerX: number;
	centerY: number;
};

export function getFixtureBounds(fixture: Fixture): FixtureBounds {
	const width = Math.max(1, fixture.width);
	const height = Math.max(1, fixture.height);
	const rotation = (((fixture.rotation ?? 0) % 360) + 360) % 360;

	if (fixture.shape === "polygon" && fixture.polygon?.length) {
		const xs = fixture.polygon.map(([x]) => x);
		const ys = fixture.polygon.map(([, y]) => y);
		const left = Math.min(...xs);
		const top = Math.min(...ys);
		const right = Math.max(...xs);
		const bottom = Math.max(...ys);
		return {
			left,
			top,
			right,
			bottom,
			width: Math.max(1, right - left),
			height: Math.max(1, bottom - top),
			centerX: (left + right) / 2,
			centerY: (top + bottom) / 2,
		};
	}

	if (rotation === 0) {
		return {
			left: fixture.x,
			top: fixture.y,
			right: fixture.x + width,
			bottom: fixture.y + height,
			width,
			height,
			centerX: fixture.x + width / 2,
			centerY: fixture.y + height / 2,
		};
	}

	const centerX = fixture.x + width / 2;
	const centerY = fixture.y + height / 2;
	const rad = (rotation * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	const corners = [
		[-width / 2, -height / 2],
		[width / 2, -height / 2],
		[width / 2, height / 2],
		[-width / 2, height / 2],
	].map(([x, y]) => [centerX + x * cos - y * sin, centerY + x * sin + y * cos]);
	const xs = corners.map(([x]) => x);
	const ys = corners.map(([, y]) => y);
	const left = Math.min(...xs);
	const top = Math.min(...ys);
	const right = Math.max(...xs);
	const bottom = Math.max(...ys);
	return {
		left,
		top,
		right,
		bottom,
		width: Math.max(1, right - left),
		height: Math.max(1, bottom - top),
		centerX,
		centerY,
	};
}

export function clampFixtureByBounds(
	fixture: Fixture,
	bounds: FixtureBounds,
	floorWidth: number,
	floorHeight: number,
): Fixture {
	let dx = 0;
	let dy = 0;
	if (bounds.left < 0) dx = -bounds.left;
	else if (bounds.right > floorWidth) dx = floorWidth - bounds.right;
	if (bounds.top < 0) dy = -bounds.top;
	else if (bounds.bottom > floorHeight) dy = floorHeight - bounds.bottom;
	return translateFixture(fixture, dx, dy);
}

export function translateFixture(
	fixture: Fixture,
	dx: number,
	dy: number,
): Fixture {
	return {
		...fixture,
		x: fixture.x + dx,
		y: fixture.y + dy,
		polygon:
			fixture.shape === "polygon" && fixture.polygon
				? fixture.polygon.map(([x, y]) => [x + dx, y + dy])
				: fixture.polygon,
	};
}

export function clampFixturePosition(
	fixture: Fixture,
	floorWidth: number,
	floorHeight: number,
) {
	const maxX = Math.max(0, floorWidth - Math.max(1, fixture.width));
	const maxY = Math.max(0, floorHeight - Math.max(1, fixture.height));
	return {
		x: Math.min(Math.max(0, fixture.x), maxX),
		y: Math.min(Math.max(0, fixture.y), maxY),
	};
}
