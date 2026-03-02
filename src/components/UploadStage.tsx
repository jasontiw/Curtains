import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Fabric } from './FabricPicker';

export type Point = { x: number; y: number }; // normalized 0-1

type Props = {
  fabric: Fabric;
  onPhotoChange: (url: string | undefined) => void;
  onPointsChange: (points: Point[]) => void;
};

const defaultPoints = (): Point[] => [
  { x: 0.3, y: 0.25 },
  { x: 0.7, y: 0.27 },
  { x: 0.72, y: 0.72 },
  { x: 0.28, y: 0.7 }
];

const UploadStage: React.FC<Props> = ({ fabric, onPhotoChange, onPointsChange }) => {
  const [photoUrl, setPhotoUrl] = useState<string>();
  const [photoImage, setPhotoImage] = useState<HTMLImageElement>();
  const [points, setPoints] = useState<Point[]>(defaultPoints());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragPoly, setDragPoly] = useState<{ start: Point; points: Point[] } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const pointsRef = useRef<Point[]>(points);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  pointsRef.current = points;

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

  const startCamera = useCallback(async () => {
    setCameraError(undefined);
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setCameraError('No se pudo acceder a la cámara. Verifica los permisos.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
    setCameraError(undefined);
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setPhotoUrl(dataUrl);
      onPhotoChange(dataUrl);
    }
    stopCamera();
  }, [onPhotoChange, stopCamera]);

  // Load image element when url changes.
  useEffect(() => {
    if (!photoUrl) return;
    const img = new Image();
    img.onload = () => {
      setPhotoImage(img);
      setPoints(defaultPoints());
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
    (targetCanvas: HTMLCanvasElement) => {
      if (!photoImage || !overlayRef.current) {
        return;
      }
      
      // Use displayed container dimensions for preview
      const rect = overlayRef.current.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      
      targetCanvas.width = w;
      targetCanvas.height = h;
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, w, h);

      const currentPoints = pointsRef.current;
      // Points: TL(0), TR(1), BR(2), BL(3)
      const [pTL, pTR, pBR, pBL] = currentPoints.map((p) => toPixel(p, w, h));
      
      // Simply draw a semi-transparent colored polygon for selection area
      ctx.beginPath();
      ctx.moveTo(pTL.x, pTL.y);
      ctx.lineTo(pTR.x, pTR.y);
      ctx.lineTo(pBR.x, pBR.y);
      ctx.lineTo(pBL.x, pBL.y);
      ctx.closePath();
      
      // Use fabric tint color with low opacity
      ctx.fillStyle = `${fabric.tint}40`; // 25% opacity hex
      ctx.fill();
    },
    [fabric.tint, photoImage, toPixel]
  );

  const scheduleLivePreview = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const canvas = canvasRef.current;
      if (canvas) renderWarp(canvas);
    });
  }, [renderWarp]);

  // Re-render when points change or dragging stops
  useEffect(() => {
    scheduleLivePreview();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scheduleLivePreview, points, isDragging, fabric.tint]);
  
  // Notify parent of points changes
  useEffect(() => {
    onPointsChange(points);
  }, [points, onPointsChange]);

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

  return (
    <div className="surface" style={{ padding: 16 }}>
      <div className="section-header">
        <h2>Sube tu espacio</h2>
        <span className="pill">Warp en 2D</span>
      </div>
      <div className="overlay-stage">
        <div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label htmlFor="photo-input" className="upload-drop" style={{ flex: 1, minWidth: 140, cursor: 'pointer' }}>
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
              <div style={{ fontSize: 24, marginBottom: 4 }}>📁</div>
              <div className="card-title">Subir foto</div>
              <div className="card-copy">PNG/JPG, hasta 8MB</div>
            </label>
            <button
              type="button"
              className="upload-drop"
              style={{ flex: 1, minWidth: 140, cursor: 'pointer', background: 'transparent' }}
              onClick={startCamera}
            >
              <div style={{ fontSize: 24, marginBottom: 4 }}>📷</div>
              <div className="card-title">Tomar foto</div>
              <div className="card-copy">Usa la cámara</div>
            </button>
          </div>
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
                    fill="#ffffff"
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

      {/* Camera Modal */}
      {showCamera && (
        <div className="fullscreen-overlay" onClick={stopCamera}>
          <button className="fullscreen-close" onClick={stopCamera}>✕</button>
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: 16,
              maxWidth: '90vw',
              maxHeight: '90vh'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {cameraError ? (
              <div style={{ 
                background: 'rgba(255,255,255,0.1)', 
                padding: 32, 
                borderRadius: 12,
                color: '#fff',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                <p>{cameraError}</p>
                <button className="btn" onClick={stopCamera} style={{ marginTop: 16 }}>Cerrar</button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '70vh', 
                    borderRadius: 12,
                    background: '#000'
                  }}
                />
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn secondary" onClick={stopCamera}>Cancelar</button>
                  <button className="btn" onClick={capturePhoto}>📸 Capturar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadStage;
