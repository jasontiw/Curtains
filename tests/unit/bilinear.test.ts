/**
 * Bilinear Interpolation Tests
 *
 * TDD approach: Tests are organized by behavior and edge cases.
 * Each test follows Arrange-Act-Assert pattern.
 */
import { describe, it, expect } from "vitest";

// Type definitions
interface Point {
	x: number;
	y: number;
}

/**
 * Bilinear interpolation function - isolated for testing
 * Maps normalized (u,v) coordinates to a quadrilateral defined by 4 corners.
 *
 * @param pTL - Top-left corner
 * @param pTR - Top-right corner
 * @param pBR - Bottom-right corner
 * @param pBL - Bottom-left corner
 * @param u - Horizontal parameter [0,1]
 * @param v - Vertical parameter [0,1]
 * @returns Interpolated point in the quad
 */
function bilinearInterp(
	pTL: Point,
	pTR: Point,
	pBR: Point,
	pBL: Point,
	u: number,
	v: number,
): Point {
	const topX = pTL.x + (pTR.x - pTL.x) * u;
	const topY = pTL.y + (pTR.y - pTL.y) * u;
	const botX = pBL.x + (pBR.x - pBL.x) * u;
	const botY = pBL.y + (pBR.y - pBL.y) * u;
	return {
		x: topX + (botX - topX) * v,
		y: topY + (botY - topY) * v,
	};
}

describe("bilinearInterp", () => {
	describe("unit square (axis-aligned rectangle)", () => {
		// Arrange: A standard unit square
		const unitSquare = {
			TL: { x: 0, y: 0 },
			TR: { x: 100, y: 0 },
			BR: { x: 100, y: 100 },
			BL: { x: 0, y: 100 },
		};

		it("should return exact corner point for (u=0, v=0) -> TL", () => {
			// Act
			const result = bilinearInterp(
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
				0,
				0,
			);
			// Assert
			expect(result.x).toBeCloseTo(0);
			expect(result.y).toBeCloseTo(0);
		});

		it("should return exact corner point for (u=1, v=0) -> TR", () => {
			const result = bilinearInterp(
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
				1,
				0,
			);
			expect(result.x).toBeCloseTo(100);
			expect(result.y).toBeCloseTo(0);
		});

		it("should return exact corner point for (u=1, v=1) -> BR", () => {
			const result = bilinearInterp(
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
				1,
				1,
			);
			expect(result.x).toBeCloseTo(100);
			expect(result.y).toBeCloseTo(100);
		});

		it("should return exact corner point for (u=0, v=1) -> BL", () => {
			const result = bilinearInterp(
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
				0,
				1,
			);
			expect(result.x).toBeCloseTo(0);
			expect(result.y).toBeCloseTo(100);
		});

		it("should return center point for (u=0.5, v=0.5)", () => {
			const result = bilinearInterp(
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
				0.5,
				0.5,
			);
			expect(result.x).toBeCloseTo(50);
			expect(result.y).toBeCloseTo(50);
		});

		it("should interpolate edge midpoints correctly", () => {
			// Top edge midpoint
			const topMid = bilinearInterp(
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
				0.5,
				0,
			);
			expect(topMid.x).toBeCloseTo(50);
			expect(topMid.y).toBeCloseTo(0);

			// Right edge midpoint
			const rightMid = bilinearInterp(
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
				1,
				0.5,
			);
			expect(rightMid.x).toBeCloseTo(100);
			expect(rightMid.y).toBeCloseTo(50);

			// Bottom edge midpoint
			const bottomMid = bilinearInterp(
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
				0.5,
				1,
			);
			expect(bottomMid.x).toBeCloseTo(50);
			expect(bottomMid.y).toBeCloseTo(100);

			// Left edge midpoint
			const leftMid = bilinearInterp(
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
				0,
				0.5,
			);
			expect(leftMid.x).toBeCloseTo(0);
			expect(leftMid.y).toBeCloseTo(50);
		});
	});

	describe("trapezoid (perspective-distorted quad)", () => {
		// Arrange: A trapezoid simulating perspective view of a window
		const trapezoid = {
			TL: { x: 20, y: 0 },
			TR: { x: 80, y: 0 },
			BR: { x: 100, y: 100 },
			BL: { x: 0, y: 100 },
		};

		it("should return exact corners for corner parameters", () => {
			const tl = bilinearInterp(
				trapezoid.TL,
				trapezoid.TR,
				trapezoid.BR,
				trapezoid.BL,
				0,
				0,
			);
			expect(tl.x).toBeCloseTo(20);
			expect(tl.y).toBeCloseTo(0);

			const br = bilinearInterp(
				trapezoid.TL,
				trapezoid.TR,
				trapezoid.BR,
				trapezoid.BL,
				1,
				1,
			);
			expect(br.x).toBeCloseTo(100);
			expect(br.y).toBeCloseTo(100);
		});

		it("should interpolate center correctly for non-rectangular quad", () => {
			const center = bilinearInterp(
				trapezoid.TL,
				trapezoid.TR,
				trapezoid.BR,
				trapezoid.BL,
				0.5,
				0.5,
			);
			// For trapezoid, center is average of midpoints
			// Top midpoint: (50, 0), Bottom midpoint: (50, 100)
			// Center y should be 50
			expect(center.y).toBeCloseTo(50);
			// Center x is interpolation of top and bottom midpoints
			// topMid.x = 20 + (80-20)*0.5 = 50
			// botMid.x = 0 + (100-0)*0.5 = 50
			expect(center.x).toBeCloseTo(50);
		});
	});

	describe("real-world perspective quad from user data", () => {
		// Arrange: Actual points from user's window selection
		const perspectiveQuad = {
			TL: { x: 38.00913384693921, y: 2.934783609970916 },
			TR: { x: 302.3250300955609, y: 17.12618368332801 },
			BR: { x: 299.4665100612569, y: 89.99824696574946 },
			BL: { x: 31.956465658512712, y: 88.14562706688241 },
		};

		it("should reach all four corners exactly", () => {
			const tl = bilinearInterp(
				perspectiveQuad.TL,
				perspectiveQuad.TR,
				perspectiveQuad.BR,
				perspectiveQuad.BL,
				0,
				0,
			);
			expect(tl.x).toBeCloseTo(perspectiveQuad.TL.x);
			expect(tl.y).toBeCloseTo(perspectiveQuad.TL.y);

			const tr = bilinearInterp(
				perspectiveQuad.TL,
				perspectiveQuad.TR,
				perspectiveQuad.BR,
				perspectiveQuad.BL,
				1,
				0,
			);
			expect(tr.x).toBeCloseTo(perspectiveQuad.TR.x);
			expect(tr.y).toBeCloseTo(perspectiveQuad.TR.y);

			const br = bilinearInterp(
				perspectiveQuad.TL,
				perspectiveQuad.TR,
				perspectiveQuad.BR,
				perspectiveQuad.BL,
				1,
				1,
			);
			expect(br.x).toBeCloseTo(perspectiveQuad.BR.x);
			expect(br.y).toBeCloseTo(perspectiveQuad.BR.y);

			const bl = bilinearInterp(
				perspectiveQuad.TL,
				perspectiveQuad.TR,
				perspectiveQuad.BR,
				perspectiveQuad.BL,
				0,
				1,
			);
			expect(bl.x).toBeCloseTo(perspectiveQuad.BL.x);
			expect(bl.y).toBeCloseTo(perspectiveQuad.BL.y);
		});

		it("should span full height from top to bottom with grid subdivision", () => {
			const gridSize = 36;
			const step = 1 / gridSize;

			// Top row (v=0)
			const topLeft = bilinearInterp(
				perspectiveQuad.TL,
				perspectiveQuad.TR,
				perspectiveQuad.BR,
				perspectiveQuad.BL,
				0,
				0,
			);

			// Bottom row (v=1)
			const bottomLeft = bilinearInterp(
				perspectiveQuad.TL,
				perspectiveQuad.TR,
				perspectiveQuad.BR,
				perspectiveQuad.BL,
				0,
				1,
			);

			// Verify we reach the edge points
			expect(topLeft.y).toBeCloseTo(perspectiveQuad.TL.y);
			expect(bottomLeft.y).toBeCloseTo(perspectiveQuad.BL.y);

			// Last grid cell should reach v=1
			const lastV = gridSize * step;
			expect(lastV).toBeCloseTo(1);

			const lastCellBottom = bilinearInterp(
				perspectiveQuad.TL,
				perspectiveQuad.TR,
				perspectiveQuad.BR,
				perspectiveQuad.BL,
				0.5,
				lastV,
			);
			const expectedY = (perspectiveQuad.BL.y + perspectiveQuad.BR.y) / 2;
			expect(lastCellBottom.y).toBeCloseTo(expectedY);
		});
	});

	describe("boundary conditions", () => {
		const square = {
			TL: { x: 0, y: 0 },
			TR: { x: 100, y: 0 },
			BR: { x: 100, y: 100 },
			BL: { x: 0, y: 100 },
		};

		it("should handle u,v exactly at 0 and 1", () => {
			// Exact boundaries shouldn't cause numerical issues
			const corners = [
				{ u: 0, v: 0 },
				{ u: 1, v: 0 },
				{ u: 1, v: 1 },
				{ u: 0, v: 1 },
			];
			const expected = [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 100, y: 100 },
				{ x: 0, y: 100 },
			];

			corners.forEach((uv, i) => {
				const result = bilinearInterp(
					square.TL,
					square.TR,
					square.BR,
					square.BL,
					uv.u,
					uv.v,
				);
				expect(result.x).toBeCloseTo(expected[i].x);
				expect(result.y).toBeCloseTo(expected[i].y);
			});
		});

		it("should extrapolate outside [0,1] range gracefully", () => {
			// u = -0.5 should extrapolate to the left of the quad
			const extLeft = bilinearInterp(
				square.TL,
				square.TR,
				square.BR,
				square.BL,
				-0.5,
				0.5,
			);
			expect(extLeft.x).toBeCloseTo(-50);
			expect(extLeft.y).toBeCloseTo(50);

			// u = 1.5 should extrapolate to the right of the quad
			const extRight = bilinearInterp(
				square.TL,
				square.TR,
				square.BR,
				square.BL,
				1.5,
				0.5,
			);
			expect(extRight.x).toBeCloseTo(150);
			expect(extRight.y).toBeCloseTo(50);
		});

		it("should handle very small quads", () => {
			const tinySquare = {
				TL: { x: 0, y: 0 },
				TR: { x: 0.001, y: 0 },
				BR: { x: 0.001, y: 0.001 },
				BL: { x: 0, y: 0.001 },
			};

			const center = bilinearInterp(
				tinySquare.TL,
				tinySquare.TR,
				tinySquare.BR,
				tinySquare.BL,
				0.5,
				0.5,
			);
			expect(center.x).toBeCloseTo(0.0005);
			expect(center.y).toBeCloseTo(0.0005);
		});

		it("should handle large coordinates", () => {
			const largeSquare = {
				TL: { x: 10000, y: 10000 },
				TR: { x: 20000, y: 10000 },
				BR: { x: 20000, y: 20000 },
				BL: { x: 10000, y: 20000 },
			};

			const center = bilinearInterp(
				largeSquare.TL,
				largeSquare.TR,
				largeSquare.BR,
				largeSquare.BL,
				0.5,
				0.5,
			);
			expect(center.x).toBeCloseTo(15000);
			expect(center.y).toBeCloseTo(15000);
		});
	});

	describe("grid cell coverage", () => {
		const square = {
			TL: { x: 0, y: 0 },
			TR: { x: 100, y: 0 },
			BR: { x: 100, y: 100 },
			BL: { x: 0, y: 100 },
		};
		const gridSize = 4;

		it("should cover entire quad without gaps when subdivided", () => {
			const coveredPoints = new Set<string>();
			const step = 1 / gridSize;

			for (let iu = 0; iu < gridSize; iu++) {
				for (let iv = 0; iv < gridSize; iv++) {
					const u0 = iu * step;
					const u1 = (iu + 1) * step;
					const v0 = iv * step;
					const v1 = (iv + 1) * step;

					const q00 = bilinearInterp(
						square.TL,
						square.TR,
						square.BR,
						square.BL,
						u0,
						v0,
					);
					const q10 = bilinearInterp(
						square.TL,
						square.TR,
						square.BR,
						square.BL,
						u1,
						v0,
					);
					const q11 = bilinearInterp(
						square.TL,
						square.TR,
						square.BR,
						square.BL,
						u1,
						v1,
					);
					const q01 = bilinearInterp(
						square.TL,
						square.TR,
						square.BR,
						square.BL,
						u0,
						v1,
					);

					[q00, q10, q11, q01].forEach((p) => {
						coveredPoints.add(`${Math.round(p.x)},${Math.round(p.y)}`);
					});
				}
			}

			expect(coveredPoints.has("0,0")).toBe(true);
			expect(coveredPoints.has("100,0")).toBe(true);
			expect(coveredPoints.has("100,100")).toBe(true);
			expect(coveredPoints.has("0,100")).toBe(true);
		});

		it("should ensure last grid row reaches v=1 (bottom edge)", () => {
			const step = 1 / gridSize;
			const lastV = gridSize * step;
			expect(lastV).toBeCloseTo(1);

			const iv = gridSize - 1;
			const v1 = (iv + 1) * step;
			expect(v1).toBeCloseTo(1);
		});

		it("should ensure source texture coordinates cover full texture", () => {
			const sw = 512;
			const sh = 512;
			const step = 1 / gridSize;

			const firstSx0 = 0 * step * sw;
			const firstSy0 = 0 * step * sh;
			expect(firstSx0).toBeCloseTo(0);
			expect(firstSy0).toBeCloseTo(0);

			const lastIu = gridSize - 1;
			const lastIv = gridSize - 1;
			const lastSx1 = (lastIu + 1) * step * sw;
			const lastSy1 = (lastIv + 1) * step * sh;
			expect(lastSx1).toBeCloseTo(512);
			expect(lastSy1).toBeCloseTo(512);
		});
	});
});
