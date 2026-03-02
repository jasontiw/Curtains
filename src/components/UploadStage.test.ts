import { describe, it, expect } from "vitest";

// Types and functions to test (reimplemented here for isolated testing)
type Point = { x: number; y: number };

function bilinearInterp(
	pTL: Point,
	pTR: Point,
	pBR: Point,
	pBL: Point,
	u: number,
	v: number,
): Point {
	// Top edge: interpolate between TL and TR
	const topX = pTL.x + (pTR.x - pTL.x) * u;
	const topY = pTL.y + (pTR.y - pTL.y) * u;
	// Bottom edge: interpolate between BL and BR
	const botX = pBL.x + (pBR.x - pBL.x) * u;
	const botY = pBL.y + (pBR.y - pBL.y) * u;
	// Vertical interpolation
	return {
		x: topX + (botX - topX) * v,
		y: topY + (botY - topY) * v,
	};
}

// Affine transform computation (same as in UploadStage)
function computeAffineTransform(
	s0: Point,
	s1: Point,
	s2: Point,
	d0: Point,
	d1: Point,
	d2: Point,
) {
	const denom = (s0.x - s2.x) * (s1.y - s2.y) - (s1.x - s2.x) * (s0.y - s2.y);

	if (Math.abs(denom) < 0.0001) {
		return null;
	}

	const a =
		((d0.x - d2.x) * (s1.y - s2.y) - (d1.x - d2.x) * (s0.y - s2.y)) / denom;
	const b =
		((d0.y - d2.y) * (s1.y - s2.y) - (d1.y - d2.y) * (s0.y - s2.y)) / denom;
	const c =
		((d1.x - d2.x) * (s0.x - s2.x) - (d0.x - d2.x) * (s1.x - s2.x)) / denom;
	const d =
		((d1.y - d2.y) * (s0.x - s2.x) - (d0.y - d2.y) * (s1.x - s2.x)) / denom;
	const e = d2.x - a * s2.x - c * s2.y;
	const f = d2.y - b * s2.x - d * s2.y;

	return { a, b, c, d, e, f };
}

// Apply transform to a point
function applyTransform(
	transform: {
		a: number;
		b: number;
		c: number;
		d: number;
		e: number;
		f: number;
	},
	p: Point,
): Point {
	return {
		x: transform.a * p.x + transform.c * p.y + transform.e,
		y: transform.b * p.x + transform.d * p.y + transform.f,
	};
}

describe("bilinearInterp", () => {
	// Test with axis-aligned unit square
	const unitSquare = {
		TL: { x: 0, y: 0 },
		TR: { x: 100, y: 0 },
		BR: { x: 100, y: 100 },
		BL: { x: 0, y: 100 },
	};

	it("returns TL at u=0, v=0", () => {
		const result = bilinearInterp(
			unitSquare.TL,
			unitSquare.TR,
			unitSquare.BR,
			unitSquare.BL,
			0,
			0,
		);
		expect(result.x).toBeCloseTo(0);
		expect(result.y).toBeCloseTo(0);
	});

	it("returns TR at u=1, v=0", () => {
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

	it("returns BR at u=1, v=1", () => {
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

	it("returns BL at u=0, v=1", () => {
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

	it("returns center at u=0.5, v=0.5", () => {
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

	// Test with a perspective-like quad (trapezoid)
	const trapezoid = {
		TL: { x: 20, y: 10 },
		TR: { x: 80, y: 10 },
		BR: { x: 90, y: 90 },
		BL: { x: 10, y: 90 },
	};

	it("returns trapezoid corners correctly", () => {
		const tl = bilinearInterp(
			trapezoid.TL,
			trapezoid.TR,
			trapezoid.BR,
			trapezoid.BL,
			0,
			0,
		);
		expect(tl.x).toBeCloseTo(20);
		expect(tl.y).toBeCloseTo(10);

		const tr = bilinearInterp(
			trapezoid.TL,
			trapezoid.TR,
			trapezoid.BR,
			trapezoid.BL,
			1,
			0,
		);
		expect(tr.x).toBeCloseTo(80);
		expect(tr.y).toBeCloseTo(10);

		const br = bilinearInterp(
			trapezoid.TL,
			trapezoid.TR,
			trapezoid.BR,
			trapezoid.BL,
			1,
			1,
		);
		expect(br.x).toBeCloseTo(90);
		expect(br.y).toBeCloseTo(90);

		const bl = bilinearInterp(
			trapezoid.TL,
			trapezoid.TR,
			trapezoid.BR,
			trapezoid.BL,
			0,
			1,
		);
		expect(bl.x).toBeCloseTo(10);
		expect(bl.y).toBeCloseTo(90);
	});

	it("interpolates mid-edges correctly for trapezoid", () => {
		// Top edge midpoint
		const topMid = bilinearInterp(
			trapezoid.TL,
			trapezoid.TR,
			trapezoid.BR,
			trapezoid.BL,
			0.5,
			0,
		);
		expect(topMid.x).toBeCloseTo(50);
		expect(topMid.y).toBeCloseTo(10);

		// Bottom edge midpoint
		const botMid = bilinearInterp(
			trapezoid.TL,
			trapezoid.TR,
			trapezoid.BR,
			trapezoid.BL,
			0.5,
			1,
		);
		expect(botMid.x).toBeCloseTo(50); // (10 + 90) / 2
		expect(botMid.y).toBeCloseTo(90);

		// Left edge midpoint
		const leftMid = bilinearInterp(
			trapezoid.TL,
			trapezoid.TR,
			trapezoid.BR,
			trapezoid.BL,
			0,
			0.5,
		);
		expect(leftMid.x).toBeCloseTo(15); // (20 + 10) / 2
		expect(leftMid.y).toBeCloseTo(50); // (10 + 90) / 2

		// Right edge midpoint
		const rightMid = bilinearInterp(
			trapezoid.TL,
			trapezoid.TR,
			trapezoid.BR,
			trapezoid.BL,
			1,
			0.5,
		);
		expect(rightMid.x).toBeCloseTo(85); // (80 + 90) / 2
		expect(rightMid.y).toBeCloseTo(50);
	});
});

describe("computeAffineTransform", () => {
	it("creates identity-like transform for matching triangles", () => {
		const s0 = { x: 0, y: 0 };
		const s1 = { x: 100, y: 0 };
		const s2 = { x: 0, y: 100 };

		const transform = computeAffineTransform(s0, s1, s2, s0, s1, s2);
		expect(transform).not.toBeNull();

		if (transform) {
			// Check that points map to themselves
			const p0 = applyTransform(transform, s0);
			const p1 = applyTransform(transform, s1);
			const p2 = applyTransform(transform, s2);

			expect(p0.x).toBeCloseTo(s0.x);
			expect(p0.y).toBeCloseTo(s0.y);
			expect(p1.x).toBeCloseTo(s1.x);
			expect(p1.y).toBeCloseTo(s1.y);
			expect(p2.x).toBeCloseTo(s2.x);
			expect(p2.y).toBeCloseTo(s2.y);
		}
	});

	it("transforms source triangle to destination triangle", () => {
		// Source: unit triangle at origin
		const s0 = { x: 0, y: 0 };
		const s1 = { x: 100, y: 0 };
		const s2 = { x: 0, y: 100 };

		// Destination: scaled and translated
		const d0 = { x: 50, y: 50 };
		const d1 = { x: 150, y: 60 };
		const d2 = { x: 40, y: 150 };

		const transform = computeAffineTransform(s0, s1, s2, d0, d1, d2);
		expect(transform).not.toBeNull();

		if (transform) {
			const p0 = applyTransform(transform, s0);
			const p1 = applyTransform(transform, s1);
			const p2 = applyTransform(transform, s2);

			expect(p0.x).toBeCloseTo(d0.x);
			expect(p0.y).toBeCloseTo(d0.y);
			expect(p1.x).toBeCloseTo(d1.x);
			expect(p1.y).toBeCloseTo(d1.y);
			expect(p2.x).toBeCloseTo(d2.x);
			expect(p2.y).toBeCloseTo(d2.y);
		}
	});

	it("handles degenerate triangles gracefully", () => {
		// Collinear points = degenerate triangle
		const s0 = { x: 0, y: 0 };
		const s1 = { x: 50, y: 0 };
		const s2 = { x: 100, y: 0 };

		const d0 = { x: 0, y: 0 };
		const d1 = { x: 50, y: 50 };
		const d2 = { x: 100, y: 100 };

		const transform = computeAffineTransform(s0, s1, s2, d0, d1, d2);
		expect(transform).toBeNull();
	});
});

describe("grid cell coverage", () => {
	// Simulate what happens when we subdivide a quad into grid cells
	const gridSize = 4;

	it("grid cells cover entire quad without gaps", () => {
		const pTL = { x: 0, y: 0 };
		const pTR = { x: 100, y: 0 };
		const pBR = { x: 100, y: 100 };
		const pBL = { x: 0, y: 100 };

		const coveredPoints = new Set<string>();
		const step = 1 / gridSize;

		for (let iu = 0; iu < gridSize; iu++) {
			for (let iv = 0; iv < gridSize; iv++) {
				const u0 = iu * step;
				const u1 = (iu + 1) * step;
				const v0 = iv * step;
				const v1 = (iv + 1) * step;

				const q00 = bilinearInterp(pTL, pTR, pBR, pBL, u0, v0);
				const q10 = bilinearInterp(pTL, pTR, pBR, pBL, u1, v0);
				const q11 = bilinearInterp(pTL, pTR, pBR, pBL, u1, v1);
				const q01 = bilinearInterp(pTL, pTR, pBR, pBL, u0, v1);

				// Mark corners as covered
				[q00, q10, q11, q01].forEach((p) => {
					coveredPoints.add(`${Math.round(p.x)},${Math.round(p.y)}`);
				});
			}
		}

		// Check that all four outer corners are covered
		expect(coveredPoints.has("0,0")).toBe(true);
		expect(coveredPoints.has("100,0")).toBe(true);
		expect(coveredPoints.has("100,100")).toBe(true);
		expect(coveredPoints.has("0,100")).toBe(true);
	});

	it("last grid row reaches v=1 (bottom edge)", () => {
		const step = 1 / gridSize;
		const lastV = gridSize * step;
		expect(lastV).toBeCloseTo(1);

		// Check that the last cell's bottom edge is at v=1
		const iv = gridSize - 1;
		const v1 = (iv + 1) * step;
		expect(v1).toBeCloseTo(1);
	});

	it("source texture coordinates cover full texture", () => {
		const sw = 512;
		const sh = 512;
		const step = 1 / gridSize;

		// Check first cell
		const firstSx0 = 0 * step * sw;
		const firstSy0 = 0 * step * sh;
		expect(firstSx0).toBeCloseTo(0);
		expect(firstSy0).toBeCloseTo(0);

		// Check last cell
		const lastIu = gridSize - 1;
		const lastIv = gridSize - 1;
		const lastSx1 = (lastIu + 1) * step * sw;
		const lastSy1 = (lastIv + 1) * step * sh;
		expect(lastSx1).toBeCloseTo(512);
		expect(lastSy1).toBeCloseTo(512);
	});
});

describe("triangle splitting for quad", () => {
	it("two triangles cover entire quad area", () => {
		// For a unit square, the two triangles should cover the full area
		const q00 = { x: 0, y: 0 }; // TL
		const q10 = { x: 100, y: 0 }; // TR
		const q11 = { x: 100, y: 100 }; // BR
		const q01 = { x: 0, y: 100 }; // BL

		// Triangle 1: TL, TR, BR (upper-right)
		// Triangle 2: TL, BR, BL (lower-left)
		// Both share the TL-BR diagonal

		// Test that a point in the center is covered by exactly one triangle
		const center = { x: 50, y: 50 };

		// Point in upper-right triangle
		const upperRight = { x: 75, y: 25 };

		// Point in lower-left triangle
		const lowerLeft = { x: 25, y: 75 };

		// Helper to check if point is in triangle
		function isInTriangle(p: Point, t0: Point, t1: Point, t2: Point): boolean {
			const sign = (p1: Point, p2: Point, p3: Point) =>
				(p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);

			const d1 = sign(p, t0, t1);
			const d2 = sign(p, t1, t2);
			const d3 = sign(p, t2, t0);

			const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
			const hasPos = d1 > 0 || d2 > 0 || d3 > 0;

			return !(hasNeg && hasPos);
		}

		// Upper-right triangle (TL, TR, BR)
		const inTri1_center = isInTriangle(center, q00, q10, q11);
		const inTri1_ur = isInTriangle(upperRight, q00, q10, q11);
		const inTri1_ll = isInTriangle(lowerLeft, q00, q10, q11);

		// Lower-left triangle (TL, BR, BL)
		const inTri2_center = isInTriangle(center, q00, q11, q01);
		const inTri2_ur = isInTriangle(upperRight, q00, q11, q01);
		const inTri2_ll = isInTriangle(lowerLeft, q00, q11, q01);

		// Center is on the diagonal, should be in both
		expect(inTri1_center || inTri2_center).toBe(true);

		// Upper-right point should be in triangle 1
		expect(inTri1_ur).toBe(true);
		expect(inTri2_ur).toBe(false);

		// Lower-left point should be in triangle 2
		expect(inTri1_ll).toBe(false);
		expect(inTri2_ll).toBe(true);
	});
});

describe("real-world quad from user debug", () => {
	// Actual points from user's debug output
	const pTL = { x: 38.00913384693921, y: 2.934783609970916 };
	const pTR = { x: 302.3250300955609, y: 17.12618368332801 };
	const pBR = { x: 299.4665100612569, y: 89.99824696574946 };
	const pBL = { x: 31.956465658512712, y: 88.14562706688241 };

	it("bilinear interpolation reaches all four corners", () => {
		const result_TL = bilinearInterp(pTL, pTR, pBR, pBL, 0, 0);
		expect(result_TL.x).toBeCloseTo(pTL.x);
		expect(result_TL.y).toBeCloseTo(pTL.y);

		const result_TR = bilinearInterp(pTL, pTR, pBR, pBL, 1, 0);
		expect(result_TR.x).toBeCloseTo(pTR.x);
		expect(result_TR.y).toBeCloseTo(pTR.y);

		const result_BR = bilinearInterp(pTL, pTR, pBR, pBL, 1, 1);
		expect(result_BR.x).toBeCloseTo(pBR.x);
		expect(result_BR.y).toBeCloseTo(pBR.y);

		const result_BL = bilinearInterp(pTL, pTR, pBR, pBL, 0, 1);
		expect(result_BL.x).toBeCloseTo(pBL.x);
		expect(result_BL.y).toBeCloseTo(pBL.y);
	});

	it("grid spans full height from top to bottom", () => {
		const gridSize = 36;
		const step = 1 / gridSize;

		// Top row (v=0)
		const topLeft = bilinearInterp(pTL, pTR, pBR, pBL, 0, 0);
		const topRight = bilinearInterp(pTL, pTR, pBR, pBL, 1, 0);

		// Bottom row (v=1)
		const bottomLeft = bilinearInterp(pTL, pTR, pBR, pBL, 0, 1);
		const bottomRight = bilinearInterp(pTL, pTR, pBR, pBL, 1, 1);

		// Verify we reach the edge points
		expect(topLeft.y).toBeCloseTo(pTL.y);
		expect(bottomLeft.y).toBeCloseTo(pBL.y);

		// Last grid cell should reach v=1
		const lastV = gridSize * step;
		expect(lastV).toBeCloseTo(1);

		const lastCellBottom = bilinearInterp(pTL, pTR, pBR, pBL, 0.5, lastV);
		const expectedY = (pBL.y + pBR.y) / 2;
		expect(lastCellBottom.y).toBeCloseTo(expectedY);
	});
});

// Inverse bilinear interpolation using Newton-Raphson
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
	const unitSquare = {
		TL: { x: 0, y: 0 },
		TR: { x: 100, y: 0 },
		BR: { x: 100, y: 100 },
		BL: { x: 0, y: 100 },
	};

	it("finds correct (u,v) for corners of unit square", () => {
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

	it("finds center of unit square", () => {
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

	it("returns out-of-bounds u/v for points outside quad", () => {
		// Points outside the quad will converge to u/v values outside [0,1]
		// The actual warp code filters these with: uv.u < 0 || uv.u > 1 || uv.v < 0 || uv.v > 1
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

	it("round-trips with bilinearInterp", () => {
		const testPoints = [
			{ u: 0.25, v: 0.25 },
			{ u: 0.75, v: 0.25 },
			{ u: 0.25, v: 0.75 },
			{ u: 0.75, v: 0.75 },
			{ u: 0.3, v: 0.7 },
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

	const trapezoid = {
		TL: { x: 38, y: 3 },
		TR: { x: 302, y: 17 },
		BR: { x: 299, y: 90 },
		BL: { x: 32, y: 88 },
	};

	it("works with real-world trapezoid", () => {
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
});
