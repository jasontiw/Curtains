import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Fabric } from './FabricPicker';

export type Point = { x: number; y: number }; // normalized 0-1

type Props = {
  fabric: Fabric;
  onComposite: (dataUrl: string | undefined) => void;
  onPhotoChange: (url: string | undefined) => void;
};

const defaultPoints = (): Point[] => [
  { x: 0.3, y: 0.25 },
  { x: 0.7, y: 0.27 },
  { x: 0.72, y: 0.72 },
  { x: 0.28, y: 0.7 }
];

const GRID_FULL = 36;
const GRID_FAST = 10; // lower during drag for speed

const UploadStage: React.FC<Props> = ({ fabric, onComposite, onPhotoChange }) => {
  const [photoUrl, setPhotoUrl] = useState<string>();
  const [photoImage, setPhotoImage] = useState<HTMLImageElement>();
  const [points, setPoints] = useState<Point[]>(defaultPoints());
  const [placingIndex, setPlacingIndex] = useState<number>(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragPoly, setDragPoly] = useState<{ start: Point; points: Point[] } | null>(null);
  const [fabricImg, setFabricImg] = useState<HTMLImageElement>();
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const pointsRef = useRef<Point[]>(points);
  pointsRef.current = points;

  // Load fabric texture for 2D warp.
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = fabric.textureUrl;
    img.onload = () => setFabricImg(img);
  }, [fabric.textureUrl]);

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        setPhotoUrl(url);
        onPhotoChange(url);
      };
      reader.readAsDataURL(file);
    },
    [onPhotoChange]
  );

  // Load image element when url changes.
  useEffect(() => {
    if (!photoUrl) return;
    const img = new Image();
    img.onload = () => {
      setPhotoImage(img);
      setPoints(defaultPoints());
      setPlacingIndex(0);
    };
    img.src = photoUrl;
  }, [photoUrl]);

  // Helper: convert normalized point to pixel.
  const toPixel = useCallback((p: Point, w: number, h: number) => ({ x: p.x * w, y: p.y * h }), []);

  const clamp01 = useCallback((v: number) => Math.min(1, Math.max(0, v)), []);

  const clampPoint = useCallback(
    (p: Point) => ({ x: clamp01(p.x), y: clamp01(p.y) }),
    [clamp01]
  );

  const renderWarp = useCallback(
    (targetCanvas: HTMLCanvasElement, gridSize: number, exportPng: boolean) => {
      if (!photoImage || !fabricImg) {
        if (exportPng) onComposite(undefined);
        return;
      }
      const maxW = 1200;
      const scale = photoImage.width > maxW ? maxW / photoImage.width : 1;
      const w = Math.round(photoImage.width * scale);
      const h = Math.round(photoImage.height * scale);
      targetCanvas.width = w;
      targetCanvas.height = h;
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(photoImage, 0, 0, w, h);

      const currentPoints = pointsRef.current;
      const [p0, p1, p2, p3] = currentPoints.map((p) => toPixel(p, w, h));
      const sw = fabricImg.width;
      const sh = fabricImg.height;
      const stepU = 1 / gridSize;
      const stepV = 1 / gridSize;

      for (let iu = 0; iu < gridSize; iu += 1) {
        for (let iv = 0; iv < gridSize; iv += 1) {
          const u0 = iu * stepU;
          const u1 = (iu + 1) * stepU;
          const v0 = iv * stepV;
          const v1 = (iv + 1) * stepV;

          const q00 = bilerp(p0, p1, p2, p3, u0, v0);
          const q10 = bilerp(p0, p1, p2, p3, u1, v0);
          const q11 = bilerp(p0, p1, p2, p3, u1, v1);
          const q01 = bilerp(p0, p1, p2, p3, u0, v1);

          const sx0 = u0 * sw;
          const sx1 = u1 * sw;
          const sy0 = v0 * sh;
          const sy1 = v1 * sh;

          drawTexturedTri(
            ctx,
            fabricImg,
            { x: sx0, y: sy0 },
            { x: sx1, y: sy0 },
            { x: sx1, y: sy1 },
            q00,
            q10,
            q11,
            fabric.translucency
          );

          drawTexturedTri(
            ctx,
            fabricImg,
            { x: sx0, y: sy0 },
            { x: sx1, y: sy1 },
            { x: sx0, y: sy1 },
            q00,
            q11,
            q01,
            fabric.translucency
          );
        }
      }

      if (exportPng) {
        onComposite(targetCanvas.toDataURL('image/png'));
      }
    },
    [fabricImg, fabric.translucency, onComposite, photoImage, toPixel]
  );

  const scheduleLivePreview = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const canvas = previewCanvasRef.current ?? canvasRef.current;
      if (canvas) renderWarp(canvas, GRID_FAST, false);
    });
  }, [renderWarp]);

  const exportFinalComposite = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) renderWarp(canvas, GRID_FULL, true);
  }, [renderWarp]);

  // Full quality export when points change and NOT dragging
  useEffect(() => {
    if (!isDragging) {
      exportFinalComposite();
    }
  }, [isDragging, exportFinalComposite, points]);

  // Fast preview while dragging
  useEffect(() => {
    if (isDragging) {
      scheduleLivePreview();
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isDragging, points, scheduleLivePreview]);

  const setPointAtPos = useCallback(
    (clientX: number, clientY: number, idx: number) => {
      if (!overlayRef.current) return;
      const rect = overlayRef.current.getBoundingClientRect();
      const x = clamp01((clientX - rect.left) / rect.width);
      const y = clamp01((clientY - rect.top) / rect.height);
      setPoints((prev) => {
        const next = [...prev];
        next[idx] = { x, y };
        return next;
      });
    },
    [clamp01]
  );

  const onClickImage = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Click ya no mueve puntos; solo arrastre.
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragIndex !== null) {
        e.preventDefault();
        setPointAtPos(e.clientX, e.clientY, dragIndex);
        return;
      }
      if (dragPoly) {
        e.preventDefault();
        if (!overlayRef.current) return;
        const rect = overlayRef.current.getBoundingClientRect();
        const x = clamp01((e.clientX - rect.left) / rect.width);
        const y = clamp01((e.clientY - rect.top) / rect.height);
        const dx = x - dragPoly.start.x;
        const dy = y - dragPoly.start.y;
        const moved = dragPoly.points.map((p) => clampPoint({ x: p.x + dx, y: p.y + dy }));
        // Update start position to avoid drift
        setDragPoly({ start: { x, y }, points: moved });
        setPoints(moved);
        return;
      }
    },
    [clamp01, clampPoint, dragIndex, dragPoly, setPointAtPos]
  );

  const stopDrag = useCallback(() => {
    setDragIndex(null);
    setDragPoly(null);
    setIsDragging(false);
  }, []);

  const isInsidePolygon = useCallback((pt: Point, poly: Point[]) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x;
      const yi = poly[i].y;
      const xj = poly[j].x;
      const yj = poly[j].y;
      const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }, []);

  const instructions = useMemo(() => {
    const names = ['Esquina superior izquierda', 'Esquina superior derecha', 'Esquina inferior derecha', 'Esquina inferior izquierda'];
    return names[placingIndex];
  }, [placingIndex]);

  return (
    <div className="surface" style={{ padding: 16 }}>
      <div className="section-header">
        <h2>Sube tu espacio</h2>
        <span className="pill">Warp en 2D</span>
      </div>
      <div className="overlay-stage">
        <div>
          <label htmlFor="photo-input" className="upload-drop" style={{ display: 'block', cursor: 'pointer' }}>
            <input
              id="photo-input"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <div className="card-title">Arrastra o haz click</div>
            <div className="card-copy">PNG/JPG, hasta 8MB. Marca las 4 esquinas de la ventana.</div>
          </label>
          {photoUrl && (
            <p className="point-label">Coloca el siguiente punto: {instructions}</p>
          )}
        </div>
        <div>
          {photoUrl ? (
            <div
              ref={overlayRef}
              onClick={onClickImage}
              onPointerMove={onPointerMove}
              onPointerUp={stopDrag}
              onPointerLeave={stopDrag}
              onPointerDown={(e) => {
                if (!overlayRef.current) return;
                if (!photoUrl) return;
                const rect = overlayRef.current.getBoundingClientRect();
                const x = clamp01((e.clientX - rect.left) / rect.width);
                const y = clamp01((e.clientY - rect.top) / rect.height);
                const p = { x, y };
                const currentPts = pointsRef.current;
                const overHandle = currentPts.some((pt) => {
                  const dx = pt.x - p.x;
                  const dy = pt.y - p.y;
                  return dx * dx + dy * dy < 0.004;
                });
                if (!overHandle && isInsidePolygon(p, currentPts)) {
                  setIsDragging(true);
                  setDragPoly({ start: p, points: currentPts.slice() });
                }
              }}
              style={{
                position: 'relative',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: 'var(--shadow)',
                touchAction: 'none',
                willChange: isDragging ? 'transform' : 'auto'
              }}
            >
              <img src={photoUrl} alt="Tu espacio" style={{ display: 'block', width: '100%' }} />
              <svg
                style={{ position: 'absolute', inset: 0 }}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {points.length === 4 && (
                  <polygon
                    points={points
                      .map((p) => `${p.x * 100},${p.y * 100}`)
                      .join(' ')}
                    fill="rgba(77,124,245,0.15)"
                    stroke="rgba(77,124,245,0.9)"
                    strokeWidth={0.6}
                  />
                )}
                {points.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x * 100}
                    cy={p.y * 100}
                    r={2.4}
                    fill={idx === placingIndex ? '#4d7cf5' : '#ffffff'}
                    stroke="#4d7cf5"
                    strokeWidth={0.8}
                    style={{ cursor: 'grab', touchAction: 'none' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.target as HTMLElement).setPointerCapture(e.pointerId);
                      setIsDragging(true);
                      setDragIndex(idx);
                    }}
                  />
                ))}
              </svg>
            </div>
          ) : (
            <div className="upload-drop">Sube una imagen para empezar.</div>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden />
    </div>
  );
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function bilerp(p0: Point, p1: Point, p2: Point, p3: Point, u: number, v: number): Point {
  // Bilinear interpolation over the quad: p0 (TL), p1 (TR), p2 (BR), p3 (BL)
  const x =
    p0.x * (1 - u) * (1 - v) +
    p1.x * u * (1 - v) +
    p2.x * u * v +
    p3.x * (1 - u) * v;
  const y =
    p0.y * (1 - u) * (1 - v) +
    p1.y * u * (1 - v) +
    p2.y * u * v +
    p3.y * (1 - u) * v;
  return { x, y };
}

function drawTexturedTri(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  s0: Point,
  s1: Point,
  s2: Point,
  d0: Point,
  d1: Point,
  d2: Point,
  alpha: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();

  const m = computeAffineFromTri(s0, s1, s2, d0, d1, d2);
  ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function computeAffineFromTri(s0: Point, s1: Point, s2: Point, d0: Point, d1: Point, d2: Point) {
  const denom = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);

  const a =
    (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) /
    denom;
  const b =
    (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) /
    denom;
  const c =
    (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) /
    denom;
  const d =
    (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) /
    denom;
  const e =
    (d0.x * (s1.x * s2.y - s2.x * s1.y) +
      d1.x * (s2.x * s0.y - s0.x * s2.y) +
      d2.x * (s0.x * s1.y - s1.x * s0.y)) /
    denom;
  const f =
    (d0.y * (s1.x * s2.y - s2.x * s1.y) +
      d1.y * (s2.x * s0.y - s0.x * s2.y) +
      d2.y * (s0.x * s1.y - s1.x * s0.y)) /
    denom;

  return { a, b, c, d, e, f };
}

export default UploadStage;
