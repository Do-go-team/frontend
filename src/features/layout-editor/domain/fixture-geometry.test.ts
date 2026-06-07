import { describe, expect, it } from "vitest";
import type { Fixture } from "../layout.types";
import {
	clampFixtureByBounds,
	clampFixturePosition,
	getFixtureBounds,
	translateFixture,
} from "./fixture-geometry";

function createFixture(overrides: Partial<Fixture> = {}): Fixture {
	return {
		id: "fixture-1",
		type: "generic_fixture",
		label: "Fixture 1",
		shape: "rect",
		x: 10,
		y: 20,
		width: 100,
		height: 50,
		rotation: 0,
		polygon: null,
		...overrides,
	};
}

describe("fixture geometry", () => {
	it("calculates bounds for a rectangle fixture", () => {
		const bounds = getFixtureBounds(createFixture());

		expect(bounds).toEqual({
			left: 10,
			top: 20,
			right: 110,
			bottom: 70,
			width: 100,
			height: 50,
			centerX: 60,
			centerY: 45,
		});
	});

	it("calculates bounds from polygon points", () => {
		const bounds = getFixtureBounds(
			createFixture({
				shape: "polygon",
				polygon: [
					[5, 10],
					[45, 20],
					[25, 70],
				],
			}),
		);

		expect(bounds).toEqual({
			left: 5,
			top: 10,
			right: 45,
			bottom: 70,
			width: 40,
			height: 60,
			centerX: 25,
			centerY: 40,
		});
	});

	it("translates a fixture without mutating the original", () => {
		const fixture = createFixture({
			shape: "polygon",
			polygon: [
				[10, 20],
				[30, 40],
			],
		});

		const translated = translateFixture(fixture, 5, -10);

		expect(translated).toEqual({
			...fixture,
			x: 15,
			y: 10,
			polygon: [
				[15, 10],
				[35, 30],
			],
		});
		expect(fixture.x).toBe(10);
		expect(fixture.y).toBe(20);
		expect(fixture.polygon).toEqual([
			[10, 20],
			[30, 40],
		]);
	});

	it("returns a clamped position for rectangle fixtures", () => {
		const position = clampFixturePosition(
			createFixture({ x: 180, y: -20, width: 50, height: 40 }),
			200,
			100,
		);

		expect(position).toEqual({ x: 150, y: 0 });
	});

	it("clamps by bounds without mutating the original", () => {
		const fixture = createFixture({
			x: -10,
			y: 20,
			shape: "polygon",
			polygon: [
				[-10, 20],
				[30, 40],
			],
		});

		const clamped = clampFixtureByBounds(
			fixture,
			getFixtureBounds(fixture),
			100,
			100,
		);

		expect(clamped.x).toBe(0);
		expect(clamped.y).toBe(20);
		expect(clamped.polygon).toEqual([
			[0, 20],
			[40, 40],
		]);
		expect(fixture.x).toBe(-10);
		expect(fixture.polygon).toEqual([
			[-10, 20],
			[30, 40],
		]);
	});
});
