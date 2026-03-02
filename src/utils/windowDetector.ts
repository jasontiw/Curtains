import { Point } from "../components/UploadStage";

// OpenCV.js types (simplified)
interface CV {
	Mat: new () => CVMat;
	MatVector: new () => CVMatVector;
	Size: new (w: number, h: number) => CVSize;
	imread: (canvas: HTMLCanvasElement) => CVMat;
	cvtColor: (src: CVMat, dst: CVMat, code: number) => void;
	GaussianBlur: (src: CVMat, dst: CVMat, ksize: CVSize, sigma: number) => void;
	Canny: (
		src: CVMat,
		dst: CVMat,
		threshold1: number,
		threshold2: number,
	) => void;
	dilate: (src: CVMat, dst: CVMat, kernel: CVMat) => void;
	getStructuringElement: (shape: number, size: CVSize) => CVMat;
	findContours: (
		src: CVMat,
		contours: CVMatVector,
		hierarchy: CVMat,
		mode: number,
		method: number,
	) => void;
	contourArea: (contour: CVMat) => number;
	arcLength: (contour: CVMat, closed: boolean) => number;
	approxPolyDP: (
		src: CVMat,
		dst: CVMat,
		epsilon: number,
		closed: boolean,
	) => void;
	HoughLinesP: (
		src: CVMat,
		lines: CVMat,
		rho: number,
		theta: number,
		threshold: number,
		minLen: number,
		maxGap: number,
	) => void;
	COLOR_RGBA2GRAY: number;
	MORPH_RECT: number;
	RETR_EXTERNAL: number;
	CHAIN_APPROX_SIMPLE: number;
}

interface CVMat {
	rows: number;
	data32S: Int32Array;
	delete: () => void;
}

interface CVMatVector {
	size: () => number;
	get: (i: number) => CVMat;
	delete: () => void;
}

interface CVSize {}

// Extend window for OpenCV
declare global {
	interface Window {
		cv: CV;
		Module: { onRuntimeInitialized: () => void };
	}
}

let cvReady = false;
let cvPromise: Promise<void> | null = null;

/**
 * Load OpenCV.js from CDN (only once)
 */
export async function loadOpenCV(): Promise<void> {
	if (cvReady) return Promise.resolve();

	if (cvPromise) return cvPromise;

	cvPromise = new Promise((resolve, reject) => {
		// Check if already loaded
		if (window.cv && window.cv.Mat) {
			cvReady = true;
			resolve();
			return;
		}

		const script = document.createElement("script");
		script.src = "https://docs.opencv.org/4.x/opencv.js";
		script.async = true;

		script.onload = () => {
			// OpenCV uses Module.onRuntimeInitialized
			const checkReady = () => {
				if (window.cv && window.cv.Mat) {
					cvReady = true;
					resolve();
				} else {
					setTimeout(checkReady, 50);
				}
			};

			// Set up the callback if Module exists
			if (window.Module) {
				const originalCallback = window.Module.onRuntimeInitialized;
				window.Module.onRuntimeInitialized = () => {
					if (originalCallback) originalCallback();
					cvReady = true;
					resolve();
				};
			}

			// Also poll in case callback doesn't fire
			checkReady();
		};

		script.onerror = () => {
			reject(new Error("Failed to load OpenCV.js"));
		};

		document.head.appendChild(script);
	});

	return cvPromise;
}

/**
 * Detect the largest rectangular region in an image (likely a window)
 * Returns normalized coordinates (0-1)
 */
export async function detectWindowCorners(
	imageElement: HTMLImageElement,
): Promise<Point[] | null> {
	await loadOpenCV();

	const cv = window.cv;
	if (!cv) return null;

	// Create canvas to get image data
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;

	// Scale down for faster processing
	const maxDim = 800;
	const scale = Math.min(
		maxDim / imageElement.naturalWidth,
		maxDim / imageElement.naturalHeight,
		1,
	);
	const w = Math.round(imageElement.naturalWidth * scale);
	const h = Math.round(imageElement.naturalHeight * scale);

	canvas.width = w;
	canvas.height = h;
	ctx.drawImage(imageElement, 0, 0, w, h);

	try {
		// Read image into OpenCV Mat
		const src = cv.imread(canvas);
		const gray = new cv.Mat();
		const blurred = new cv.Mat();
		const edges = new cv.Mat();

		// Convert to grayscale
		cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

		// Apply Gaussian blur to reduce noise
		const ksize = new cv.Size(5, 5);
		cv.GaussianBlur(gray, blurred, ksize, 0);

		// Detect edges with Canny
		cv.Canny(blurred, edges, 50, 150);

		// Dilate edges to connect nearby lines
		const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
		cv.dilate(edges, edges, kernel);

		// Find contours
		const contours = new cv.MatVector();
		const hierarchy = new cv.Mat();
		cv.findContours(
			edges,
			contours,
			hierarchy,
			cv.RETR_EXTERNAL,
			cv.CHAIN_APPROX_SIMPLE,
		);

		let bestQuad: Point[] | null = null;
		let bestArea = 0;
		const minArea = w * h * 0.05; // At least 5% of image
		const maxArea = w * h * 0.95; // At most 95% of image

		// Find the largest quadrilateral
		for (let i = 0; i < contours.size(); i++) {
			const contour = contours.get(i);
			const area = cv.contourArea(contour);

			if (area < minArea || area > maxArea) continue;

			// Approximate contour to polygon
			const epsilon = 0.02 * cv.arcLength(contour, true);
			const approx = new cv.Mat();
			cv.approxPolyDP(contour, approx, epsilon, true);

			// Check if it's a quadrilateral
			if (approx.rows === 4) {
				if (area > bestArea) {
					bestArea = area;

					// Extract the 4 corners
					const corners: Point[] = [];
					for (let j = 0; j < 4; j++) {
						corners.push({
							x: approx.data32S[j * 2] / w,
							y: approx.data32S[j * 2 + 1] / h,
						});
					}

					// Sort corners: TL, TR, BR, BL
					bestQuad = sortCorners(corners);
				}
			}

			approx.delete();
		}

		// If no quad found, try to detect lines and form a rectangle
		if (!bestQuad) {
			bestQuad = detectRectangleFromLines(edges, w, h, cv);
		}

		// Cleanup
		src.delete();
		gray.delete();
		blurred.delete();
		edges.delete();
		kernel.delete();
		contours.delete();
		hierarchy.delete();

		return bestQuad;
	} catch (err) {
		console.error("OpenCV detection error:", err);
		return null;
	}
}

/**
 * Sort corners in order: Top-Left, Top-Right, Bottom-Right, Bottom-Left
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

/**
 * Fallback: detect rectangle from Hough lines
 */
function detectRectangleFromLines(
	edges: CVMat,
	w: number,
	h: number,
	cv: CV,
): Point[] | null {
	const lines = new cv.Mat();

	// Detect lines using Probabilistic Hough Transform
	cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 50, 50, 10);

	if (lines.rows === 0) {
		lines.delete();
		return null;
	}

	// Separate horizontal and vertical lines
	const horizontals: { y: number; x1: number; x2: number }[] = [];
	const verticals: { x: number; y1: number; y2: number }[] = [];

	for (let i = 0; i < lines.rows; i++) {
		const x1 = lines.data32S[i * 4];
		const y1 = lines.data32S[i * 4 + 1];
		const x2 = lines.data32S[i * 4 + 2];
		const y2 = lines.data32S[i * 4 + 3];

		const angle = Math.abs(Math.atan2(y2 - y1, x2 - x1));
		const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

		if (length < 30) continue; // Skip short lines

		// Horizontal (angle near 0 or π)
		if (angle < 0.2 || angle > Math.PI - 0.2) {
			horizontals.push({
				y: (y1 + y2) / 2,
				x1: Math.min(x1, x2),
				x2: Math.max(x1, x2),
			});
		}
		// Vertical (angle near π/2)
		else if (Math.abs(angle - Math.PI / 2) < 0.2) {
			verticals.push({
				x: (x1 + x2) / 2,
				y1: Math.min(y1, y2),
				y2: Math.max(y1, y2),
			});
		}
	}

	lines.delete();

	if (horizontals.length < 2 || verticals.length < 2) {
		return null;
	}

	// Sort lines by position
	horizontals.sort((a, b) => a.y - b.y);
	verticals.sort((a, b) => a.x - b.x);

	// Find prominent top/bottom horizontal and left/right vertical lines
	const topLine = horizontals[0];
	const bottomLine = horizontals[horizontals.length - 1];
	const leftLine = verticals[0];
	const rightLine = verticals[verticals.length - 1];

	// Check if lines form a reasonable rectangle
	const rectWidth = rightLine.x - leftLine.x;
	const rectHeight = bottomLine.y - topLine.y;

	if (rectWidth < w * 0.1 || rectHeight < h * 0.1) {
		return null; // Too small
	}

	// Return normalized corners
	return [
		{ x: leftLine.x / w, y: topLine.y / h }, // TL
		{ x: rightLine.x / w, y: topLine.y / h }, // TR
		{ x: rightLine.x / w, y: bottomLine.y / h }, // BR
		{ x: leftLine.x / w, y: bottomLine.y / h }, // BL
	];
}
