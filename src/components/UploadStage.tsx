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

const UploadStage: React.FC<Props> = ({ fabric, onComposite, onPhotoChange }) => {
  const [photoUrl, setPhotoUrl] = useState<string>();
  const [photoImage, setPhotoImage] = useState<HTMLImageElement>();
  const [points, setPoints] = useState<Point[]>(defaultPoints());
  const [placingIndex, setPlacingIndex] = useState<number>(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragPoly, setDragPoly] = useState<{ start: Point; points: Point[] } | null>(null);
  const [fabricImg, setFabricImg] = useState<HTMLCanvasElement | HTMLImageElement>();
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const pointsRef = useRef<Point[]>(points);
  pointsRef.current = points;

  // Load fabric texture for 2D warp - rasterize SVG to canvas for consistent dimensions
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = fabric.textureUrl;
    img.onload = () => {
      // Rasterize to a fixed-size canvas to avoid SVG dimension issues
      const texSize = 512;
      const offscreen = document.createElement('canvas');
      offscreen.width = texSize;
      offscreen.height = texSize;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, texSize, texSize);
      }
      // Use the canvas as image source (it implements CanvasImageSource)
      setFabricImg(offscreen);
    };
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
    (targetCanvas: HTMLCanvasElement, exportPng: boolean) => {
      if (!photoImage || !fabricImg) {
        if (exportPng) onComposite(undefined);
        return;
      }
      
      // For export use natural dimensions, for preview use displayed container dimensions
      let w: number, h: number;
      if (exportPng) {
        w = photoImage.naturalWidth || photoImage.width;
        h = photoImage.naturalHeight || photoImage.height;
      } else if (overlayRef.current) {
        const rect = overlayRef.current.getBoundingClientRect();
        w = Math.round(rect.width);
        h = Math.round(rect.height);
      } else {
        w = photoImage.naturalWidth || photoImage.width;
        h = photoImage.naturalHeight || photoImage.height;
      }
      
      targetCanvas.width = w;
      targetCanvas.height = h;
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas - don't draw background since image is below
      ctx.clearRect(0, 0, w, h);
      
      // For export, draw the background image
      if (exportPng) {
        ctx.drawImage(photoImage, 0, 0, w, h);
      }

      const currentPoints = pointsRef.current;
      // Points: TL(0), TR(1), BR(2), BL(3)
      const [pTL, pTR, pBR, pBL] = currentPoints.map((p) => toPixel(p, w, h));
      
      // Get fabric pixel data for direct sampling
      const fabricCanvas = fabricImg as HTMLCanvasElement;
      const fabricCtx = fabricCanvas.getContext('2d');
      if (!fabricCtx) return;
      const fabricData = fabricCtx.getImageData(0, 0, fabricCanvas.width, fabricCanvas.height);
      const sw = fabricCanvas.width;
      const sh = fabricCanvas.height;

      // Get bounding box of destination quad
      const minX = Math.floor(Math.min(pTL.x, pTR.x, pBR.x, pBL.x));
      const maxX = Math.ceil(Math.max(pTL.x, pTR.x, pBR.x, pBL.x));
      const minY = Math.floor(Math.min(pTL.y, pTR.y, pBR.y, pBL.y));
      const maxY = Math.ceil(Math.max(pTL.y, pTR.y, pBR.y, pBL.y));

      // Get current image data for the bounding box region
      const destData = ctx.getImageData(minX, minY, maxX - minX, maxY - minY);
      const destW = maxX - minX;
      
      const alpha = fabric.translucency;

      // For each pixel in bounding box, check if inside quad and sample texture
      for (let py = minY; py < maxY; py++) {
        for (let px = minX; px < maxX; px++) {
          // Convert to normalized coords and check if inside quad
          const p = { x: px, y: py };
          
          // First check if point is inside quad
          if (!isPointInQuad(p, pTL, pTR, pBR, pBL)) {
            continue;
          }
          
          // Compute inverse bilinear to find (u,v) for this pixel
          let uv = inverseBilinear(p, pTL, pTR, pBR, pBL);
          
          // If analytical solution failed, use Newton-Raphson fallback
          if (!uv || uv.u < 0 || uv.u > 1 || uv.v < 0 || uv.v > 1) {
            uv = inverseBilinearNewton(p, pTL, pTR, pBR, pBL);
          }
          
          if (!uv || uv.u < 0 || uv.u > 1 || uv.v < 0 || uv.v > 1) {
            continue;
          }
          
          // Sample fabric texture at (u,v)
          const srcX = Math.floor(uv.u * (sw - 1));
          const srcY = Math.floor(uv.v * (sh - 1));
          const srcIdx = (srcY * sw + srcX) * 4;
          
          const r = fabricData.data[srcIdx];
          const g = fabricData.data[srcIdx + 1];
          const b = fabricData.data[srcIdx + 2];
          const a = fabricData.data[srcIdx + 3];
          
          // Blend with destination
          const destIdx = ((py - minY) * destW + (px - minX)) * 4;
          const srcAlpha = (a / 255) * alpha;
          const invSrcAlpha = 1 - srcAlpha;
          
          destData.data[destIdx] = Math.round(r * srcAlpha + destData.data[destIdx] * invSrcAlpha);
          destData.data[destIdx + 1] = Math.round(g * srcAlpha + destData.data[destIdx + 1] * invSrcAlpha);
          destData.data[destIdx + 2] = Math.round(b * srcAlpha + destData.data[destIdx + 2] * invSrcAlpha);
          destData.data[destIdx + 3] = 255;
        }
      }
      
      ctx.putImageData(destData, minX, minY);

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
      const canvas = canvasRef.current;
      if (canvas) renderWarp(canvas, false);
    });
  }, [renderWarp]);

  const exportFinalComposite = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) renderWarp(canvas, true);
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
    (clientX: number, clientY: number, idx: number, offset: Point) => {
      if (!overlayRef.current) return;
      const rect = overlayRef.current.getBoundingClientRect();
      const rawX = (clientX - rect.left) / rect.width;
      const rawY = (clientY - rect.top) / rect.height;
      const x = clamp01(rawX - offset.x);
      const y = clamp01(rawY - offset.y);
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
        setPointAtPos(e.clientX, e.clientY, dragIndex, dragOffset);
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
    [clamp01, clampPoint, dragIndex, dragOffset, dragPoly, setPointAtPos]
  );

  const stopDrag = useCallback(() => {
    setDragIndex(null);
    setDragOffset({ x: 0, y: 0 });
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
              {/* Show warp result directly on top of the image */}
              <canvas 
                ref={canvasRef}
                style={{ 
                  position: 'absolute', 
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none'
                }} 
              />
              <svg
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
              >
                {points.length === 4 && (
                  <polygon
                    points={points
                      .map((p) => `${p.x},${p.y}`)
                      .join(' ')}
                    fill="rgba(77,124,245,0.08)"
                    stroke="rgba(77,124,245,0.6)"
                    strokeWidth={0.004}
                  />
                )}
                {points.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r={0.024}
                    fill={idx === placingIndex ? '#4d7cf5' : '#ffffff'}
                    stroke="#4d7cf5"
                    strokeWidth={0.008}
                    style={{ cursor: 'grab', touchAction: 'none' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.target as HTMLElement).setPointerCapture(e.pointerId);
                      if (!overlayRef.current) return;
                      const rect = overlayRef.current.getBoundingClientRect();
                      const clickX = (e.clientX - rect.left) / rect.width;
                      const clickY = (e.clientY - rect.top) / rect.height;
                      const currentPt = pointsRef.current[idx];
                      // Store offset between click and point so it doesn't jump
                      setDragOffset({ x: clickX - currentPt.x, y: clickY - currentPt.y });
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
      {!photoUrl && <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden />}
    </div>
  );
};

// Check if a point is inside a quad using cross product signs
// With tolerance for edge pixels
function isPointInQuad(p: Point, tl: Point, tr: Point, br: Point, bl: Point): boolean {
  const cross = (a: Point, b: Point, c: Point) => 
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  
  const d1 = cross(tl, tr, p);
  const d2 = cross(tr, br, p);
  const d3 = cross(br, bl, p);
  const d4 = cross(bl, tl, p);
  
  // Use small tolerance to include edge pixels
  const eps = 1.0;
  const hasNeg = (d1 < -eps) || (d2 < -eps) || (d3 < -eps) || (d4 < -eps);
  const hasPos = (d1 > eps) || (d2 > eps) || (d3 > eps) || (d4 > eps);
  
  return !(hasNeg && hasPos);
}

// Inverse bilinear interpolation: given a point p and quad corners, find (u,v)
// Uses analytical solution with quadratic formula for robustness
function inverseBilinear(
  p: Point,
  pTL: Point,
  pTR: Point,
  pBR: Point,
  pBL: Point
): { u: number; v: number } | null {
  // Express bilinear as: P = A + B*u + C*v + D*u*v
  // where A = pTL, B = pTR - pTL, C = pBL - pTL, D = pTL - pTR + pBR - pBL
  const ax = pTL.x, ay = pTL.y;
  const bx = pTR.x - pTL.x, by = pTR.y - pTL.y;
  const cx = pBL.x - pTL.x, cy = pBL.y - pTL.y;
  const dx = pTL.x - pTR.x + pBR.x - pBL.x;
  const dy = pTL.y - pTR.y + pBR.y - pBL.y;
  
  // Target point relative to A
  const ex = p.x - ax;
  const ey = p.y - ay;
  
  // Solve the system by elimination - get quadratic in v
  // From P = A + Bu + Cv + Duv, we have:
  // ex = bx*u + cx*v + dx*u*v
  // ey = by*u + cy*v + dy*u*v
  
  // Cross-multiply to eliminate u:
  // ex*(by + dy*v) = ey*(bx + dx*v) + (cx*(by + dy*v) - cy*(bx + dx*v))*v
  // This gives: A*v^2 + B*v + C = 0
  
  const cross = bx * cy - by * cx;
  const crossD = bx * dy - by * dx;
  const crossC = cx * dy - cy * dx;
  
  // Coefficients of quadratic in v
  const qa = crossD;
  const qb = cross + ex * dy - ey * dx;
  const qc = ex * by - ey * bx;
  
  let v: number;
  
  if (Math.abs(qa) < 1e-10) {
    // Linear case
    if (Math.abs(qb) < 1e-10) return null;
    v = -qc / qb;
  } else {
    // Quadratic case
    const disc = qb * qb - 4 * qa * qc;
    if (disc < 0) return null;
    
    const sqrtDisc = Math.sqrt(disc);
    const v1 = (-qb + sqrtDisc) / (2 * qa);
    const v2 = (-qb - sqrtDisc) / (2 * qa);
    
    // Pick the v that's in [0, 1], or closest to it
    if (v1 >= 0 && v1 <= 1) {
      v = v1;
    } else if (v2 >= 0 && v2 <= 1) {
      v = v2;
    } else {
      // Pick whichever is closer to [0,1]
      const d1 = Math.min(Math.abs(v1), Math.abs(v1 - 1));
      const d2 = Math.min(Math.abs(v2), Math.abs(v2 - 1));
      v = d1 < d2 ? v1 : v2;
    }
  }
  
  // Now solve for u
  const denomU = bx + dx * v;
  const denomUy = by + dy * v;
  
  let u: number;
  if (Math.abs(denomU) > Math.abs(denomUy)) {
    u = (ex - cx * v) / denomU;
  } else if (Math.abs(denomUy) > 1e-10) {
    u = (ey - cy * v) / denomUy;
  } else {
    return null;
  }
  
  // Clamp and validate - be generous with tolerance
  const tolerance = 0.05;
  if (u >= -tolerance && u <= 1 + tolerance && v >= -tolerance && v <= 1 + tolerance) {
    return { 
      u: Math.max(0, Math.min(1, u)), 
      v: Math.max(0, Math.min(1, v)) 
    };
  }
  
  return null;
}

// Newton-Raphson fallback for inverse bilinear interpolation
function inverseBilinearNewton(
  p: Point,
  pTL: Point,
  pTR: Point,
  pBR: Point,
  pBL: Point
): { u: number; v: number } | null {
  // Start with initial guess based on normalized position in bounding box
  const minX = Math.min(pTL.x, pTR.x, pBR.x, pBL.x);
  const maxX = Math.max(pTL.x, pTR.x, pBR.x, pBL.x);
  const minY = Math.min(pTL.y, pTR.y, pBR.y, pBL.y);
  const maxY = Math.max(pTL.y, pTR.y, pBR.y, pBL.y);
  
  let u = (p.x - minX) / (maxX - minX);
  let v = (p.y - minY) / (maxY - minY);
  
  // Clamp initial guess to [0,1]
  u = Math.max(0, Math.min(1, u));
  v = Math.max(0, Math.min(1, v));
  
  for (let iter = 0; iter < 20; iter++) {
    // Current interpolated position using bilinear formula
    const topX = pTL.x + (pTR.x - pTL.x) * u;
    const topY = pTL.y + (pTR.y - pTL.y) * u;
    const botX = pBL.x + (pBR.x - pBL.x) * u;
    const botY = pBL.y + (pBR.y - pBL.y) * u;
    const qx = topX + (botX - topX) * v;
    const qy = topY + (botY - topY) * v;
    
    // Error
    const ex = p.x - qx;
    const ey = p.y - qy;
    
    // Check convergence
    if (Math.abs(ex) < 0.5 && Math.abs(ey) < 0.5) {
      if (u >= -0.01 && u <= 1.01 && v >= -0.01 && v <= 1.01) {
        return { 
          u: Math.max(0, Math.min(1, u)), 
          v: Math.max(0, Math.min(1, v)) 
        };
      }
    }
    
    // Jacobian partial derivatives
    const dxdu = (pTR.x - pTL.x) * (1 - v) + (pBR.x - pBL.x) * v;
    const dxdv = (botX - topX);
    const dydu = (pTR.y - pTL.y) * (1 - v) + (pBR.y - pBL.y) * v;
    const dydv = (botY - topY);
    
    // Solve 2x2 system using Cramer's rule
    const det = dxdu * dydv - dxdv * dydu;
    if (Math.abs(det) < 1e-10) {
      // Try small perturbation
      u += 0.01;
      v += 0.01;
      continue;
    }
    
    const du = (ex * dydv - ey * dxdv) / det;
    const dv = (dxdu * ey - dydu * ex) / det;
    
    // Damped update to prevent overshooting
    const damping = 0.8;
    u += du * damping;
    v += dv * damping;
    
    // Keep in reasonable bounds
    u = Math.max(-0.1, Math.min(1.1, u));
    v = Math.max(-0.1, Math.min(1.1, v));
  }
  
  // Final check
  if (u >= -0.01 && u <= 1.01 && v >= -0.01 && v <= 1.01) {
    return { 
      u: Math.max(0, Math.min(1, u)), 
      v: Math.max(0, Math.min(1, v)) 
    };
  }
  
  return null;
}

export default UploadStage;
