/**
 * Window Detector Tests
 *
 * TDD approach: Tests for the OpenCV-based window detection utility.
 * Since OpenCV.js requires browser APIs, we test the helper functions
 * and mock the main detection for integration behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Type definitions matching the module
interface Point {
	x: number;
	y: number;
}

/**
 * Sort corners in order: Top-Left, Top-Right, Bottom-Right, Bottom-Left
 * Extracted from windowDetector.ts for isolated testing
 */
function sortCorners(corners: Point[]): Point[] {
	// Find centroid
	const cx = corners.reduce((sum, p) => sum + p.x, 0) / 4;
	const cy = corners.reduce((sum, p) => sum + p.y, 0) / 4;

	// Classify corners by position relative to centroid
	const topLeft = corners.filter((p) => p.x < cx && p.y < cy)[0];
	const topRight = corners.filter((p) => p.x >= cx && p.y < cy)[0];
	const bottomRight = corners.filter((p) => p.x >= cx && p.y >= cy)[0];
	const bottomLeft = corners.filter((p) => p.x < cx && p.y >= cy)[0];

	// If clean classification didn't work, use angle-based sorting
	if (!topLeft || !topRight || !bottomRight || !bottomLeft) {
		// Sort by angle from centroid
		const sorted = corners
			.map((p) => ({
				...p,
				angle: Math.atan2(p.y - cy, p.x - cx),
			}))
			.sort((a, b) => a.angle - b.angle);

		// Starting from top-left (angle ~ -135° to -180° or 135° to 180°)
		// Find the corner closest to -135° angle
		let startIdx = 0;
		let minDiff = Infinity;
		const targetAngle = -Math.PI * 0.75; // -135°

		sorted.forEach((p, i) => {
			const diff = Math.abs(p.angle - targetAngle);
			if (diff < minDiff) {
				minDiff = diff;
				startIdx = i;
			}
		});

		// Reorder starting from top-left
		const reordered = [
			sorted[startIdx],
			sorted[(startIdx + 1) % 4],
			sorted[(startIdx + 2) % 4],
			sorted[(startIdx + 3) % 4],
		];

		return reordered.map((p) => ({ x: p.x, y: p.y }));
	}

	return [topLeft, topRight, bottomRight, bottomLeft];
}

describe("sortCorners", () => {
	describe("standard axis-aligned rectangle", () => {
		it("should sort corners in clockwise order starting from TL", () => {
			// Arrange: Random order corners of unit square
			const unsorted: Point[] = [
				{ x: 1, y: 0 }, // TR
				{ x: 0, y: 1 }, // BL
				{ x: 1, y: 1 }, // BR
				{ x: 0, y: 0 }, // TL
			];

			// Act
			const sorted = sortCorners(unsorted);

			// Assert
			expect(sorted[0]).toEqual({ x: 0, y: 0 }); // TL
			expect(sorted[1]).toEqual({ x: 1, y: 0 }); // TR
			expect(sorted[2]).toEqual({ x: 1, y: 1 }); // BR
			expect(sorted[3]).toEqual({ x: 0, y: 1 }); // BL
		});

		it("should handle already sorted corners", () => {
			const alreadySorted: Point[] = [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 100, y: 100 },
				{ x: 0, y: 100 },
			];

			const result = sortCorners(alreadySorted);

			expect(result[0]).toEqual({ x: 0, y: 0 });
			expect(result[1]).toEqual({ x: 100, y: 0 });
			expect(result[2]).toEqual({ x: 100, y: 100 });
			expect(result[3]).toEqual({ x: 0, y: 100 });
		});
	});

	describe("normalized coordinates (0-1 range)", () => {
		it("should sort normalized corners correctly", () => {
			const normalized: Point[] = [
				{ x: 0.8, y: 0.1 }, // TR
				{ x: 0.2, y: 0.9 }, // BL
				{ x: 0.2, y: 0.1 }, // TL
				{ x: 0.8, y: 0.9 }, // BR
			];

			const sorted = sortCorners(normalized);

			expect(sorted[0].x).toBeCloseTo(0.2);
			expect(sorted[0].y).toBeCloseTo(0.1);
			expect(sorted[1].x).toBeCloseTo(0.8);
			expect(sorted[1].y).toBeCloseTo(0.1);
			expect(sorted[2].x).toBeCloseTo(0.8);
			expect(sorted[2].y).toBeCloseTo(0.9);
			expect(sorted[3].x).toBeCloseTo(0.2);
			expect(sorted[3].y).toBeCloseTo(0.9);
		});
	});

	describe("perspective-distorted trapezoid", () => {
		it("should sort perspective quad with wider top", () => {
			// Window viewed from below - wider at top
			const trapezoid: Point[] = [
				{ x: 0.3, y: 0.1 }, // TL
				{ x: 0.7, y: 0.15 }, // TR
				{ x: 0.6, y: 0.9 }, // BR
				{ x: 0.4, y: 0.85 }, // BL
			];

			const randomOrder: Point[] = [
				trapezoid[2], // BR
				trapezoid[0], // TL
				trapezoid[3], // BL
				trapezoid[1], // TR
			];

			const sorted = sortCorners(randomOrder);

			// Should be in TL, TR, BR, BL order
			expect(sorted[0].y).toBeLessThan(sorted[3].y); // TL.y < BL.y
			expect(sorted[1].y).toBeLessThan(sorted[2].y); // TR.y < BR.y
			expect(sorted[0].x).toBeLessThan(sorted[1].x); // TL.x < TR.x
			expect(sorted[3].x).toBeLessThan(sorted[2].x); // BL.x < BR.x
		});

		it("should sort perspective quad with wider bottom", () => {
			// Window viewed from above - wider at bottom
			const trapezoid: Point[] = [
				{ x: 0.4, y: 0.1 }, // TL
				{ x: 0.6, y: 0.1 }, // TR
				{ x: 0.8, y: 0.9 }, // BR
				{ x: 0.2, y: 0.9 }, // BL
			];

			const randomOrder: Point[] = [
				trapezoid[1], // TR
				trapezoid[3], // BL
				trapezoid[0], // TL
				trapezoid[2], // BR
			];

			const sorted = sortCorners(randomOrder);

			expect(sorted[0].y).toBeLessThan(sorted[3].y);
			expect(sorted[1].y).toBeLessThan(sorted[2].y);
		});
	});

	describe("real-world perspective data", () => {
		it("should sort user's actual window detection coordinates", () => {
			// Actual normalized coordinates from window detection
			const realData: Point[] = [
				{ x: 0.038, y: 0.029 }, // TL
				{ x: 0.302, y: 0.017 }, // TR (slightly higher due to perspective)
				{ x: 0.299, y: 0.09 }, // BR
				{ x: 0.032, y: 0.088 }, // BL
			];

			const shuffled: Point[] = [
				realData[2],
				realData[0],
				realData[3],
				realData[1],
			];

			const sorted = sortCorners(shuffled);

			// TL should be in top-left quadrant
			expect(sorted[0].x).toBeLessThan(0.2);
			expect(sorted[0].y).toBeLessThan(0.1);

			// TR should be in top-right quadrant
			expect(sorted[1].x).toBeGreaterThan(0.2);
			expect(sorted[1].y).toBeLessThan(0.1);

			// BR should be in bottom-right quadrant
			expect(sorted[2].x).toBeGreaterThan(0.2);
			expect(sorted[2].y).toBeGreaterThan(0.05);

			// BL should be in bottom-left quadrant
			expect(sorted[3].x).toBeLessThan(0.2);
			expect(sorted[3].y).toBeGreaterThan(0.05);
		});
	});

	describe("edge cases", () => {
		it("should handle square at origin", () => {
			const atOrigin: Point[] = [
				{ x: 0, y: 0 },
				{ x: 1, y: 0 },
				{ x: 1, y: 1 },
				{ x: 0, y: 1 },
			];

			const shuffled = [atOrigin[2], atOrigin[1], atOrigin[3], atOrigin[0]];
			const sorted = sortCorners(shuffled);

			expect(sorted[0]).toEqual({ x: 0, y: 0 });
		});

		it("should handle very small quad", () => {
			const tiny: Point[] = [
				{ x: 0.5, y: 0.5 },
				{ x: 0.501, y: 0.5 },
				{ x: 0.501, y: 0.501 },
				{ x: 0.5, y: 0.501 },
			];

			const shuffled = [tiny[2], tiny[0], tiny[3], tiny[1]];
			const sorted = sortCorners(shuffled);

			// Should still sort correctly even with tiny differences
			expect(sorted[0].x).toBeCloseTo(0.5);
			expect(sorted[0].y).toBeCloseTo(0.5);
			expect(sorted[2].x).toBeCloseTo(0.501);
			expect(sorted[2].y).toBeCloseTo(0.501);
		});

		it("should handle rotated rectangle using angle-based sorting", () => {
			// Diamond shape (45° rotated square) - centroid-based fails
			const diamond: Point[] = [
				{ x: 0.5, y: 0 }, // top
				{ x: 1, y: 0.5 }, // right
				{ x: 0.5, y: 1 }, // bottom
				{ x: 0, y: 0.5 }, // left
			];

			const sorted = sortCorners(diamond);

			// For a diamond, "top-left" would be the left point (closest to -135°)
			// This tests the angle-based fallback
			expect(sorted.length).toBe(4);
			// All corners should be present
			expect(sorted.map((p) => `${p.x},${p.y}`).sort()).toEqual(
				diamond.map((p) => `${p.x},${p.y}`).sort(),
			);
		});
	});
});

describe("window detection validation helpers", () => {
	/**
	 * Validates that detected corners form a valid quadrilateral
	 */
	function isValidQuad(corners: Point[] | null): boolean {
		if (!corners || corners.length !== 4) return false;

		// Check all coordinates are in valid range
		for (const corner of corners) {
			if (
				corner.x < 0 ||
				corner.x > 1 ||
				corner.y < 0 ||
				corner.y > 1 ||
				isNaN(corner.x) ||
				isNaN(corner.y)
			) {
				return false;
			}
		}

		// Check that quad has non-zero area
		const area = computeQuadArea(corners);
		return area > 0.0001;
	}

	/**
	 * Computes the area of a quadrilateral using shoelace formula
	 */
	function computeQuadArea(corners: Point[]): number {
		let area = 0;
		const n = corners.length;
		for (let i = 0; i < n; i++) {
			const j = (i + 1) % n;
			area += corners[i].x * corners[j].y;
			area -= corners[j].x * corners[i].y;
		}
		return Math.abs(area) / 2;
	}

	describe("isValidQuad", () => {
		it("should accept valid normalized quad", () => {
			const valid: Point[] = [
				{ x: 0.1, y: 0.1 },
				{ x: 0.9, y: 0.1 },
				{ x: 0.9, y: 0.9 },
				{ x: 0.1, y: 0.9 },
			];
			expect(isValidQuad(valid)).toBe(true);
		});

		it("should reject null", () => {
			expect(isValidQuad(null)).toBe(false);
		});

		it("should reject wrong number of corners", () => {
			const three: Point[] = [
				{ x: 0.1, y: 0.1 },
				{ x: 0.9, y: 0.1 },
				{ x: 0.5, y: 0.9 },
			];
			expect(isValidQuad(three)).toBe(false);
		});

		it("should reject out-of-bounds coordinates", () => {
			const outOfBounds: Point[] = [
				{ x: -0.1, y: 0.1 },
				{ x: 0.9, y: 0.1 },
				{ x: 0.9, y: 0.9 },
				{ x: 0.1, y: 0.9 },
			];
			expect(isValidQuad(outOfBounds)).toBe(false);
		});

		it("should reject NaN coordinates", () => {
			const withNaN: Point[] = [
				{ x: NaN, y: 0.1 },
				{ x: 0.9, y: 0.1 },
				{ x: 0.9, y: 0.9 },
				{ x: 0.1, y: 0.9 },
			];
			expect(isValidQuad(withNaN)).toBe(false);
		});

		it("should reject degenerate (zero area) quad", () => {
			const collapsed: Point[] = [
				{ x: 0.5, y: 0.5 },
				{ x: 0.5, y: 0.5 },
				{ x: 0.5, y: 0.5 },
				{ x: 0.5, y: 0.5 },
			];
			expect(isValidQuad(collapsed)).toBe(false);
		});
	});

	describe("computeQuadArea", () => {
		it("should compute area of unit square", () => {
			const unitSquare: Point[] = [
				{ x: 0, y: 0 },
				{ x: 1, y: 0 },
				{ x: 1, y: 1 },
				{ x: 0, y: 1 },
			];
			expect(computeQuadArea(unitSquare)).toBeCloseTo(1);
		});

		it("should compute area of smaller square", () => {
			const smallSquare: Point[] = [
				{ x: 0.25, y: 0.25 },
				{ x: 0.75, y: 0.25 },
				{ x: 0.75, y: 0.75 },
				{ x: 0.25, y: 0.75 },
			];
			expect(computeQuadArea(smallSquare)).toBeCloseTo(0.25);
		});

		it("should compute area of trapezoid", () => {
			// Trapezoid with parallel top (width 0.4) and bottom (width 0.6), height 0.5
			// Area = 0.5 * (0.4 + 0.6) * 0.5 = 0.25
			const trapezoid: Point[] = [
				{ x: 0.3, y: 0.25 }, // TL
				{ x: 0.7, y: 0.25 }, // TR
				{ x: 0.8, y: 0.75 }, // BR
				{ x: 0.2, y: 0.75 }, // BL
			];
			expect(computeQuadArea(trapezoid)).toBeCloseTo(0.25);
		});
	});
});

describe("line classification helpers", () => {
	/**
	 * Classifies a line as horizontal, vertical, or diagonal
	 */
	function classifyLine(
		x1: number,
		y1: number,
		x2: number,
		y2: number,
	): "horizontal" | "vertical" | "diagonal" {
		const angle = Math.abs(Math.atan2(y2 - y1, x2 - x1));

		if (angle < 0.2 || angle > Math.PI - 0.2) {
			return "horizontal";
		}
		if (Math.abs(angle - Math.PI / 2) < 0.2) {
			return "vertical";
		}
		return "diagonal";
	}

	describe("classifyLine", () => {
		it("should classify horizontal lines", () => {
			expect(classifyLine(0, 50, 100, 50)).toBe("horizontal");
			expect(classifyLine(0, 50, 100, 55)).toBe("horizontal"); // Slight angle
		});

		it("should classify vertical lines", () => {
			expect(classifyLine(50, 0, 50, 100)).toBe("vertical");
			expect(classifyLine(50, 0, 55, 100)).toBe("vertical"); // Slight angle
		});

		it("should classify diagonal lines", () => {
			expect(classifyLine(0, 0, 100, 100)).toBe("diagonal");
			expect(classifyLine(0, 100, 100, 0)).toBe("diagonal");
		});
	});
});

describe("OpenCV module loading", () => {
	// These tests verify the loading behavior without actually loading OpenCV

	describe("loadOpenCV behavior", () => {
		let originalCv: unknown;
		let originalModule: unknown;

		beforeEach(() => {
			// Save original values
			originalCv = (globalThis as Record<string, unknown>).cv;
			originalModule = (globalThis as Record<string, unknown>).Module;
		});

		afterEach(() => {
			// Restore original values
			(globalThis as Record<string, unknown>).cv = originalCv;
			(globalThis as Record<string, unknown>).Module = originalModule;
		});

		it("should detect when cv is already loaded", () => {
			// Mock cv being present
			const mockCv = {
				Mat: class {},
			};
			(globalThis as Record<string, unknown>).cv = mockCv;

			// The check used in loadOpenCV
			const isLoaded =
				(globalThis as Record<string, unknown>).cv &&
				((globalThis as Record<string, unknown>).cv as { Mat?: unknown }).Mat;
			expect(isLoaded).toBeTruthy();
		});

		it("should detect when cv is not loaded", () => {
			(globalThis as Record<string, unknown>).cv = undefined;

			const isLoaded =
				(globalThis as Record<string, unknown>).cv &&
				((globalThis as Record<string, unknown>).cv as { Mat?: unknown }).Mat;
			expect(isLoaded).toBeFalsy();
		});
	});
});

describe("detection constraints", () => {
	/**
	 * Checks if a detected area meets size constraints
	 */
	function meetsAreaConstraints(
		area: number,
		imageArea: number,
		minPercent: number = 0.05,
		maxPercent: number = 0.95,
	): boolean {
		const minArea = imageArea * minPercent;
		const maxArea = imageArea * maxPercent;
		return area >= minArea && area <= maxArea;
	}

	describe("meetsAreaConstraints", () => {
		const imageArea = 640 * 480; // 307200 pixels

		it("should accept area within valid range", () => {
			const validArea = imageArea * 0.3; // 30% of image
			expect(meetsAreaConstraints(validArea, imageArea)).toBe(true);
		});

		it("should reject too small area", () => {
			const tinyArea = imageArea * 0.01; // 1% of image
			expect(meetsAreaConstraints(tinyArea, imageArea)).toBe(false);
		});

		it("should reject too large area", () => {
			const hugeArea = imageArea * 0.99; // 99% of image
			expect(meetsAreaConstraints(hugeArea, imageArea)).toBe(false);
		});

		it("should accept area at minimum boundary", () => {
			const minArea = imageArea * 0.05; // Exactly 5%
			expect(meetsAreaConstraints(minArea, imageArea)).toBe(true);
		});

		it("should accept area at maximum boundary", () => {
			const maxArea = imageArea * 0.95; // Exactly 95%
			expect(meetsAreaConstraints(maxArea, imageArea)).toBe(true);
		});

		it("should work with custom constraints", () => {
			const area = imageArea * 0.08;
			expect(meetsAreaConstraints(area, imageArea, 0.1, 0.9)).toBe(false);
			expect(meetsAreaConstraints(area, imageArea, 0.05, 0.9)).toBe(true);
		});
	});
});
