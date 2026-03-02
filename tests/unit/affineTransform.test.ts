/**
 * Affine Transform Tests
 *
 * TDD approach: Tests for computing and applying affine transformations.
 * Used for mapping triangular regions in perspective warp.
 */
import { describe, it, expect } from "vitest";

// Type definitions
interface Point {
	x: number;
	y: number;
}

interface AffineTransform {
	a: number;
	b: number;
	c: number;
	d: number;
	e: number;
	f: number;
}

/**
 * Computes a 2D affine transform from 3 source points to 3 destination points.
 * An affine transform can represent translation, rotation, scaling, and shearing.
 *
 * The transform maps: (x', y') = (ax + by + c, dx + ey + f)
 *
 * @returns null if the source triangle is degenerate (collinear points)
 */
function computeAffineTransform(
	s0: Point,
	s1: Point,
	s2: Point,
	d0: Point,
	d1: Point,
	d2: Point,
): AffineTransform | null {
	// Cramer's rule to solve the system of linear equations
	const det = (s0.x - s2.x) * (s1.y - s2.y) - (s1.x - s2.x) * (s0.y - s2.y);
	if (Math.abs(det) < 0.0001) {
		// Degenerate triangle - points are collinear
		return null;
	}

	const a =
		((d0.x - d2.x) * (s1.y - s2.y) - (d1.x - d2.x) * (s0.y - s2.y)) / det;
	const b =
		((s0.x - s2.x) * (d1.x - d2.x) - (s1.x - s2.x) * (d0.x - d2.x)) / det;
	const c = d0.x - a * s0.x - b * s0.y;

	const d =
		((d0.y - d2.y) * (s1.y - s2.y) - (d1.y - d2.y) * (s0.y - s2.y)) / det;
	const e =
		((s0.x - s2.x) * (d1.y - d2.y) - (s1.x - s2.x) * (d0.y - d2.y)) / det;
	const f = d0.y - d * s0.x - e * s0.y;

	return { a, b, c, d, e, f };
}

/**
 * Applies an affine transform to a point.
 */
function applyTransform(transform: AffineTransform, point: Point): Point {
	return {
		x: transform.a * point.x + transform.b * point.y + transform.c,
		y: transform.d * point.x + transform.e * point.y + transform.f,
	};
}

describe("computeAffineTransform", () => {
	describe("identity transform", () => {
		it("should compute identity when source and destination triangles are equal", () => {
			// Arrange
			const triangle = [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 50, y: 100 },
			];

			// Act
			const transform = computeAffineTransform(
				triangle[0],
				triangle[1],
				triangle[2],
				triangle[0],
				triangle[1],
				triangle[2],
			);

			// Assert
			expect(transform).not.toBeNull();
			expect(transform!.a).toBeCloseTo(1);
			expect(transform!.e).toBeCloseTo(1);
			expect(transform!.b).toBeCloseTo(0);
			expect(transform!.d).toBeCloseTo(0);
			expect(transform!.c).toBeCloseTo(0);
			expect(transform!.f).toBeCloseTo(0);
		});
	});

	describe("translation transform", () => {
		it("should compute pure translation when triangles are offset", () => {
			// Arrange: Triangle translated by (10, 20)
			const source = [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 50, y: 100 },
			];
			const destination = [
				{ x: 10, y: 20 },
				{ x: 110, y: 20 },
				{ x: 60, y: 120 },
			];

			// Act
			const transform = computeAffineTransform(
				source[0],
				source[1],
				source[2],
				destination[0],
				destination[1],
				destination[2],
			);

			// Assert
			expect(transform).not.toBeNull();
			expect(transform!.a).toBeCloseTo(1); // No scale in x
			expect(transform!.e).toBeCloseTo(1); // No scale in y
			expect(transform!.b).toBeCloseTo(0); // No shear
			expect(transform!.d).toBeCloseTo(0); // No shear
			expect(transform!.c).toBeCloseTo(10); // Translation x
			expect(transform!.f).toBeCloseTo(20); // Translation y
		});
	});

	describe("scaling transform", () => {
		it("should compute uniform scaling when destination is scaled up", () => {
			// Arrange: Triangle scaled by 2x
			const source = [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 50, y: 100 },
			];
			const destination = [
				{ x: 0, y: 0 },
				{ x: 200, y: 0 },
				{ x: 100, y: 200 },
			];

			// Act
			const transform = computeAffineTransform(
				source[0],
				source[1],
				source[2],
				destination[0],
				destination[1],
				destination[2],
			);

			// Assert
			expect(transform).not.toBeNull();
			expect(transform!.a).toBeCloseTo(2); // Scale x by 2
			expect(transform!.e).toBeCloseTo(2); // Scale y by 2
		});

		it("should compute non-uniform scaling correctly", () => {
			// Arrange: Triangle scaled by 2x in x, 0.5x in y
			const source = [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 0, y: 100 },
			];
			const destination = [
				{ x: 0, y: 0 },
				{ x: 200, y: 0 },
				{ x: 0, y: 50 },
			];

			// Act
			const transform = computeAffineTransform(
				source[0],
				source[1],
				source[2],
				destination[0],
				destination[1],
				destination[2],
			);

			// Assert
			expect(transform).not.toBeNull();
			expect(transform!.a).toBeCloseTo(2); // Scale x by 2
			expect(transform!.e).toBeCloseTo(0.5); // Scale y by 0.5
		});
	});

	describe("rotation transform", () => {
		it("should compute 90-degree rotation correctly", () => {
			// Arrange: Triangle rotated 90 degrees CCW around origin
			const source = [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 0, y: 100 },
			];
			const destination = [
				{ x: 0, y: 0 },
				{ x: 0, y: 100 },
				{ x: -100, y: 0 },
			];

			// Act
			const transform = computeAffineTransform(
				source[0],
				source[1],
				source[2],
				destination[0],
				destination[1],
				destination[2],
			);

			// Assert
			expect(transform).not.toBeNull();
			// For 90° CCW rotation: a=0, b=-1, d=1, e=0
			expect(transform!.a).toBeCloseTo(0);
			expect(transform!.b).toBeCloseTo(-1);
			expect(transform!.d).toBeCloseTo(1);
			expect(transform!.e).toBeCloseTo(0);
		});
	});

	describe("degenerate triangles", () => {
		it("should return null for collinear points", () => {
			// Arrange: All points on a line (degenerate triangle)
			const s0 = { x: 0, y: 0 };
			const s1 = { x: 50, y: 0 };
			const s2 = { x: 100, y: 0 };

			const d0 = { x: 0, y: 0 };
			const d1 = { x: 50, y: 50 };
			const d2 = { x: 100, y: 100 };

			// Act
			const transform = computeAffineTransform(s0, s1, s2, d0, d1, d2);

			// Assert
			expect(transform).toBeNull();
		});

		it("should return null for coincident points", () => {
			// Arrange: Two points are the same
			const s0 = { x: 0, y: 0 };
			const s1 = { x: 0, y: 0 }; // Same as s0
			const s2 = { x: 100, y: 0 };

			const d0 = { x: 0, y: 0 };
			const d1 = { x: 50, y: 50 };
			const d2 = { x: 100, y: 100 };

			// Act
			const transform = computeAffineTransform(s0, s1, s2, d0, d1, d2);

			// Assert
			expect(transform).toBeNull();
		});
	});
});

describe("applyTransform", () => {
	describe("basic transformations", () => {
		it("should apply identity transform without changing point", () => {
			// Arrange
			const identity: AffineTransform = { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 };
			const point = { x: 50, y: 75 };

			// Act
			const result = applyTransform(identity, point);

			// Assert
			expect(result.x).toBeCloseTo(50);
			expect(result.y).toBeCloseTo(75);
		});

		it("should apply translation correctly", () => {
			// Arrange
			const translation: AffineTransform = {
				a: 1,
				b: 0,
				c: 10,
				d: 0,
				e: 1,
				f: 20,
			};
			const point = { x: 50, y: 75 };

			// Act
			const result = applyTransform(translation, point);

			// Assert
			expect(result.x).toBeCloseTo(60);
			expect(result.y).toBeCloseTo(95);
		});

		it("should apply scaling correctly", () => {
			// Arrange
			const scaling: AffineTransform = { a: 2, b: 0, c: 0, d: 0, e: 0.5, f: 0 };
			const point = { x: 50, y: 100 };

			// Act
			const result = applyTransform(scaling, point);

			// Assert
			expect(result.x).toBeCloseTo(100);
			expect(result.y).toBeCloseTo(50);
		});
	});

	describe("round-trip through computeAffineTransform", () => {
		it("should map source triangle vertices to destination triangle", () => {
			// Arrange
			const s0 = { x: 50, y: 50 };
			const s1 = { x: 150, y: 50 };
			const s2 = { x: 100, y: 150 };

			const d0 = { x: 200, y: 100 };
			const d1 = { x: 300, y: 120 };
			const d2 = { x: 250, y: 200 };

			// Act
			const transform = computeAffineTransform(s0, s1, s2, d0, d1, d2);
			expect(transform).not.toBeNull();

			const p0 = applyTransform(transform!, s0);
			const p1 = applyTransform(transform!, s1);
			const p2 = applyTransform(transform!, s2);

			// Assert
			expect(p0.x).toBeCloseTo(d0.x);
			expect(p0.y).toBeCloseTo(d0.y);
			expect(p1.x).toBeCloseTo(d1.x);
			expect(p1.y).toBeCloseTo(d1.y);
			expect(p2.x).toBeCloseTo(d2.x);
			expect(p2.y).toBeCloseTo(d2.y);
		});

		it("should map points inside the triangle correctly", () => {
			// Arrange
			const s0 = { x: 0, y: 0 };
			const s1 = { x: 100, y: 0 };
			const s2 = { x: 50, y: 100 };

			const d0 = { x: 100, y: 100 };
			const d1 = { x: 200, y: 100 };
			const d2 = { x: 150, y: 200 };

			// Act
			const transform = computeAffineTransform(s0, s1, s2, d0, d1, d2);
			expect(transform).not.toBeNull();

			// Test centroid of source triangle
			const centroidSrc = {
				x: (s0.x + s1.x + s2.x) / 3,
				y: (s0.y + s1.y + s2.y) / 3,
			};
			const centroidResult = applyTransform(transform!, centroidSrc);

			// Expected centroid of destination
			const centroidDst = {
				x: (d0.x + d1.x + d2.x) / 3,
				y: (d0.y + d1.y + d2.y) / 3,
			};

			// Assert
			expect(centroidResult.x).toBeCloseTo(centroidDst.x);
			expect(centroidResult.y).toBeCloseTo(centroidDst.y);
		});
	});
});

describe("triangle splitting for quad coverage", () => {
	interface Point {
		x: number;
		y: number;
	}

	/**
	 * Checks if a point is inside a triangle using barycentric coordinates
	 */
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

	it("should split quad into two triangles covering entire area", () => {
		// Arrange: A unit square
		const q00 = { x: 0, y: 0 }; // TL
		const q10 = { x: 100, y: 0 }; // TR
		const q11 = { x: 100, y: 100 }; // BR
		const q01 = { x: 0, y: 100 }; // BL

		// Triangle 1: TL, TR, BR (upper-right)
		// Triangle 2: TL, BR, BL (lower-left)

		// Test points
		const center = { x: 50, y: 50 };
		const upperRight = { x: 75, y: 25 };
		const lowerLeft = { x: 25, y: 75 };

		// Act
		const inTri1_center = isInTriangle(center, q00, q10, q11);
		const inTri1_ur = isInTriangle(upperRight, q00, q10, q11);
		const inTri1_ll = isInTriangle(lowerLeft, q00, q10, q11);

		const inTri2_center = isInTriangle(center, q00, q11, q01);
		const inTri2_ur = isInTriangle(upperRight, q00, q11, q01);
		const inTri2_ll = isInTriangle(lowerLeft, q00, q11, q01);

		// Assert
		// Center is on the diagonal, should be in at least one triangle
		expect(inTri1_center || inTri2_center).toBe(true);

		// Upper-right point should be in triangle 1 only
		expect(inTri1_ur).toBe(true);
		expect(inTri2_ur).toBe(false);

		// Lower-left point should be in triangle 2 only
		expect(inTri1_ll).toBe(false);
		expect(inTri2_ll).toBe(true);
	});

	it("should handle points exactly on edges", () => {
		const q00 = { x: 0, y: 0 };
		const q10 = { x: 100, y: 0 };
		const q11 = { x: 100, y: 100 };
		const q01 = { x: 0, y: 100 };

		// Point on top edge
		const topEdge = { x: 50, y: 0 };
		const onTop = isInTriangle(topEdge, q00, q10, q11);
		expect(onTop).toBe(true); // Should be in Triangle 1

		// Point on left edge
		const leftEdge = { x: 0, y: 50 };
		const onLeft = isInTriangle(leftEdge, q00, q11, q01);
		expect(onLeft).toBe(true); // Should be in Triangle 2

		// Point on diagonal
		const diag = { x: 50, y: 50 };
		const inTri1 = isInTriangle(diag, q00, q10, q11);
		const inTri2 = isInTriangle(diag, q00, q11, q01);
		expect(inTri1 || inTri2).toBe(true);
	});
});
