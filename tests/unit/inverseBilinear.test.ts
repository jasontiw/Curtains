/**
 * Inverse Bilinear Interpolation Tests
 *
 * TDD approach: Tests for Newton-Raphson based inverse bilinear interpolation.
 * This function finds the (u,v) parameters for a given point in a quad.
 */
import { describe, it, expect } from "vitest";

// Type definitions
interface Point {
	x: number;
	y: number;
}

/**
 * Forward bilinear interpolation - for validation
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

/**
 * Inverse bilinear interpolation using Newton-Raphson method.
 * Given a point p and a quadrilateral, finds the (u,v) parameters
 * such that bilinearInterp(TL, TR, BR, BL, u, v) ≈ p.
 *
 * @returns {u, v} coordinates in [0,1] range, or null if point is outside quad
 */
function inverseBilinear(
	p: Point,
	pTL: Point,
	pTR: Point,
	pBR: Point,
	pBL: Point,
): { u: number; v: number } | null {
	let u = 0.5;
	let v = 0.5;

	for (let iter = 0; iter < 10; iter++) {
		const topX = pTL.x + (pTR.x - pTL.x) * u;
		const topY = pTL.y + (pTR.y - pTL.y) * u;
		const botX = pBL.x + (pBR.x - pBL.x) * u;
		const botY = pBL.y + (pBR.y - pBL.y) * u;
		const qx = topX + (botX - topX) * v;
		const qy = topY + (botY - topY) * v;

		const ex = p.x - qx;
		const ey = p.y - qy;

		if (Math.abs(ex) < 0.01 && Math.abs(ey) < 0.01) {
			return { u, v };
		}

		const dxdu = (pTR.x - pTL.x) * (1 - v) + (pBR.x - pBL.x) * v;
		const dxdv = pBL.x - pTL.x + (pBR.x - pBL.x - pTR.x + pTL.x) * u;
		const dydu = (pTR.y - pTL.y) * (1 - v) + (pBR.y - pBL.y) * v;
		const dydv = pBL.y - pTL.y + (pBR.y - pBL.y - pTR.y + pTL.y) * u;

		const det = dxdu * dydv - dxdv * dydu;
		if (Math.abs(det) < 0.0001) break;

		const du = (ex * dydv - ey * dxdv) / det;
		const dv = (dxdu * ey - dydu * ex) / det;

		u += du;
		v += dv;
	}

	if (u >= -0.001 && u <= 1.001 && v >= -0.001 && v <= 1.001) {
		return { u: Math.max(0, Math.min(1, u)), v: Math.max(0, Math.min(1, v)) };
	}

	return null;
}

describe("inverseBilinear", () => {
	describe("unit square (axis-aligned rectangle)", () => {
		const unitSquare = {
			TL: { x: 0, y: 0 },
			TR: { x: 100, y: 0 },
			BR: { x: 100, y: 100 },
			BL: { x: 0, y: 100 },
		};

		it("should find (0,0) for top-left corner", () => {
			const tl = inverseBilinear(
				{ x: 0, y: 0 },
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
			);
			expect(tl).not.toBeNull();
			expect(tl!.u).toBeCloseTo(0);
			expect(tl!.v).toBeCloseTo(0);
		});

		it("should find (1,0) for top-right corner", () => {
			const tr = inverseBilinear(
				{ x: 100, y: 0 },
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
			);
			expect(tr).not.toBeNull();
			expect(tr!.u).toBeCloseTo(1);
			expect(tr!.v).toBeCloseTo(0);
		});

		it("should find (1,1) for bottom-right corner", () => {
			const br = inverseBilinear(
				{ x: 100, y: 100 },
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
			);
			expect(br).not.toBeNull();
			expect(br!.u).toBeCloseTo(1);
			expect(br!.v).toBeCloseTo(1);
		});

		it("should find (0,1) for bottom-left corner", () => {
			const bl = inverseBilinear(
				{ x: 0, y: 100 },
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
			);
			expect(bl).not.toBeNull();
			expect(bl!.u).toBeCloseTo(0);
			expect(bl!.v).toBeCloseTo(1);
		});

		it("should find (0.5, 0.5) for center point", () => {
			const center = inverseBilinear(
				{ x: 50, y: 50 },
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
			);
			expect(center).not.toBeNull();
			expect(center!.u).toBeCloseTo(0.5);
			expect(center!.v).toBeCloseTo(0.5);
		});

		it("should find correct (u,v) for edge midpoints", () => {
			// Top edge midpoint
			const topMid = inverseBilinear(
				{ x: 50, y: 0 },
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
			);
			expect(topMid).not.toBeNull();
			expect(topMid!.u).toBeCloseTo(0.5);
			expect(topMid!.v).toBeCloseTo(0);

			// Right edge midpoint
			const rightMid = inverseBilinear(
				{ x: 100, y: 50 },
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
			);
			expect(rightMid).not.toBeNull();
			expect(rightMid!.u).toBeCloseTo(1);
			expect(rightMid!.v).toBeCloseTo(0.5);
		});
	});

	describe("points outside the quad", () => {
		const unitSquare = {
			TL: { x: 0, y: 0 },
			TR: { x: 100, y: 0 },
			BR: { x: 100, y: 100 },
			BL: { x: 0, y: 100 },
		};

		it("should return null or out-of-bounds for point far outside", () => {
			const outside = inverseBilinear(
				{ x: -100, y: 50 },
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
			);

			// Either null or u out of range
			if (outside !== null) {
				expect(
					outside.u < 0 || outside.u > 1 || outside.v < 0 || outside.v > 1,
				).toBe(true);
			}
		});

		it("should return null for point above the quad", () => {
			const above = inverseBilinear(
				{ x: 50, y: -50 },
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
			);

			if (above !== null) {
				expect(above.v < 0).toBe(true);
			}
		});

		it("should return null for point below the quad", () => {
			const below = inverseBilinear(
				{ x: 50, y: 150 },
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
			);

			if (below !== null) {
				expect(below.v > 1).toBe(true);
			}
		});
	});

	describe("round-trip validation", () => {
		const unitSquare = {
			TL: { x: 0, y: 0 },
			TR: { x: 100, y: 0 },
			BR: { x: 100, y: 100 },
			BL: { x: 0, y: 100 },
		};

		it("should round-trip with bilinearInterp for various points", () => {
			const testPoints = [
				{ u: 0.25, v: 0.25 },
				{ u: 0.75, v: 0.25 },
				{ u: 0.25, v: 0.75 },
				{ u: 0.75, v: 0.75 },
				{ u: 0.3, v: 0.7 },
				{ u: 0.1, v: 0.9 },
				{ u: 0.9, v: 0.1 },
			];

			for (const { u, v } of testPoints) {
				const p = bilinearInterp(
					unitSquare.TL,
					unitSquare.TR,
					unitSquare.BR,
					unitSquare.BL,
					u,
					v,
				);
				const result = inverseBilinear(
					p,
					unitSquare.TL,
					unitSquare.TR,
					unitSquare.BR,
					unitSquare.BL,
				);
				expect(result).not.toBeNull();
				expect(result!.u).toBeCloseTo(u, 2);
				expect(result!.v).toBeCloseTo(v, 2);
			}
		});

		it("should converge quickly for points near the center", () => {
			const p = bilinearInterp(
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
				0.5,
				0.5,
			);
			const result = inverseBilinear(
				p,
				unitSquare.TL,
				unitSquare.TR,
				unitSquare.BR,
				unitSquare.BL,
			);
			expect(result).not.toBeNull();
			expect(result!.u).toBeCloseTo(0.5, 4); // Higher precision near center
			expect(result!.v).toBeCloseTo(0.5, 4);
		});
	});

	describe("real-world perspective trapezoid", () => {
		// Simulating a window viewed with perspective
		const trapezoid = {
			TL: { x: 38, y: 3 },
			TR: { x: 302, y: 17 },
			BR: { x: 299, y: 90 },
			BL: { x: 32, y: 88 },
		};

		it("should find (0,0) for top-left corner", () => {
			const tl = inverseBilinear(
				trapezoid.TL,
				trapezoid.TL,
				trapezoid.TR,
				trapezoid.BR,
				trapezoid.BL,
			);
			expect(tl).not.toBeNull();
			expect(tl!.u).toBeCloseTo(0, 1);
			expect(tl!.v).toBeCloseTo(0, 1);
		});

		it("should find (1,1) for bottom-right corner", () => {
			const br = inverseBilinear(
				trapezoid.BR,
				trapezoid.TL,
				trapezoid.TR,
				trapezoid.BR,
				trapezoid.BL,
			);
			expect(br).not.toBeNull();
			expect(br!.u).toBeCloseTo(1, 1);
			expect(br!.v).toBeCloseTo(1, 1);
		});

		it("should find (0.5, 0.5) for center of trapezoid", () => {
			const centerP = bilinearInterp(
				trapezoid.TL,
				trapezoid.TR,
				trapezoid.BR,
				trapezoid.BL,
				0.5,
				0.5,
			);
			const centerResult = inverseBilinear(
				centerP,
				trapezoid.TL,
				trapezoid.TR,
				trapezoid.BR,
				trapezoid.BL,
			);
			expect(centerResult).not.toBeNull();
			expect(centerResult!.u).toBeCloseTo(0.5, 1);
			expect(centerResult!.v).toBeCloseTo(0.5, 1);
		});

		it("should round-trip correctly for multiple points in trapezoid", () => {
			const testPoints = [
				{ u: 0.2, v: 0.3 },
				{ u: 0.8, v: 0.2 },
				{ u: 0.3, v: 0.8 },
				{ u: 0.7, v: 0.6 },
			];

			for (const { u, v } of testPoints) {
				const p = bilinearInterp(
					trapezoid.TL,
					trapezoid.TR,
					trapezoid.BR,
					trapezoid.BL,
					u,
					v,
				);
				const result = inverseBilinear(
					p,
					trapezoid.TL,
					trapezoid.TR,
					trapezoid.BR,
					trapezoid.BL,
				);
				expect(result).not.toBeNull();
				expect(result!.u).toBeCloseTo(u, 1);
				expect(result!.v).toBeCloseTo(v, 1);
			}
		});
	});

	describe("convergence edge cases", () => {
		it("should handle very flat quad (nearly horizontal line)", () => {
			const flatQuad = {
				TL: { x: 0, y: 0 },
				TR: { x: 100, y: 0 },
				BR: { x: 100, y: 5 }, // Very short in Y
				BL: { x: 0, y: 5 },
			};

			const center = inverseBilinear(
				{ x: 50, y: 2.5 },
				flatQuad.TL,
				flatQuad.TR,
				flatQuad.BR,
				flatQuad.BL,
			);
			expect(center).not.toBeNull();
			expect(center!.u).toBeCloseTo(0.5, 1);
			expect(center!.v).toBeCloseTo(0.5, 1);
		});

		it("should handle very narrow quad (nearly vertical line)", () => {
			const narrowQuad = {
				TL: { x: 0, y: 0 },
				TR: { x: 5, y: 0 }, // Very short in X
				BR: { x: 5, y: 100 },
				BL: { x: 0, y: 100 },
			};

			const center = inverseBilinear(
				{ x: 2.5, y: 50 },
				narrowQuad.TL,
				narrowQuad.TR,
				narrowQuad.BR,
				narrowQuad.BL,
			);
			expect(center).not.toBeNull();
			expect(center!.u).toBeCloseTo(0.5, 1);
			expect(center!.v).toBeCloseTo(0.5, 1);
		});

		it("should handle strongly skewed parallelogram", () => {
			const skewed = {
				TL: { x: 50, y: 0 },
				TR: { x: 150, y: 0 },
				BR: { x: 100, y: 100 }, // Skewed right
				BL: { x: 0, y: 100 },
			};

			const center = bilinearInterp(
				skewed.TL,
				skewed.TR,
				skewed.BR,
				skewed.BL,
				0.5,
				0.5,
			);
			const result = inverseBilinear(
				center,
				skewed.TL,
				skewed.TR,
				skewed.BR,
				skewed.BL,
			);
			expect(result).not.toBeNull();
			expect(result!.u).toBeCloseTo(0.5, 1);
			expect(result!.v).toBeCloseTo(0.5, 1);
		});
	});

	describe("numerical stability", () => {
		it("should handle coordinates with floating point precision", () => {
			const preciseQuad = {
				TL: { x: 38.00913384693921, y: 2.934783609970916 },
				TR: { x: 302.3250300955609, y: 17.12618368332801 },
				BR: { x: 299.4665100612569, y: 89.99824696574946 },
				BL: { x: 31.956465658512712, y: 88.14562706688241 },
			};

			// Test all corners
			const tl = inverseBilinear(
				preciseQuad.TL,
				preciseQuad.TL,
				preciseQuad.TR,
				preciseQuad.BR,
				preciseQuad.BL,
			);
			expect(tl).not.toBeNull();
			expect(tl!.u).toBeCloseTo(0, 2);
			expect(tl!.v).toBeCloseTo(0, 2);

			const br = inverseBilinear(
				preciseQuad.BR,
				preciseQuad.TL,
				preciseQuad.TR,
				preciseQuad.BR,
				preciseQuad.BL,
			);
			expect(br).not.toBeNull();
			expect(br!.u).toBeCloseTo(1, 2);
			expect(br!.v).toBeCloseTo(1, 2);
		});

		it("should handle points very slightly outside bounds", () => {
			const square = {
				TL: { x: 0, y: 0 },
				TR: { x: 100, y: 0 },
				BR: { x: 100, y: 100 },
				BL: { x: 0, y: 100 },
			};

			// Point very slightly outside (due to numerical precision)
			const slightlyOff = { x: -0.0001, y: 50 };
			const result = inverseBilinear(
				slightlyOff,
				square.TL,
				square.TR,
				square.BR,
				square.BL,
			);

			// May return null (outside bounds) or very small negative u
			// The actual warp code will filter these with: uv.u < 0 check
			if (result !== null) {
				// u should be very close to 0 (negative due to slight offset)
				expect(result.u).toBeCloseTo(0, 3);
				expect(result.v).toBeCloseTo(0.5, 2);
			}
		});
	});
});
