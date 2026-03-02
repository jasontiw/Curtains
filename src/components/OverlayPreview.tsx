import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Fabric } from './FabricPicker';
import { Point } from './UploadStage';

type Props = {
  photoUrl?: string;
  points?: Point[];
  fabric: Fabric;
};

const OverlayPreview: React.FC<Props> = ({ photoUrl, points, fabric }) => {
  const [breezeEnabled, setBreezeEnabled] = useState(false);
  const [pleatsEnabled, setPleatsEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [photoImage, setPhotoImage] = useState<HTMLImageElement>();
  const [fabricImg, setFabricImg] = useState<HTMLCanvasElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const breezeRef = useRef<number | null>(null);
  const fullscreenSyncRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);

  // Load photo image
  useEffect(() => {
    if (!photoUrl) {
      setPhotoImage(undefined);
      return;
    }
    const img = new Image();
    img.onload = () => setPhotoImage(img);
    img.src = photoUrl;
  }, [photoUrl]);

  // Load fabric texture
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = fabric.textureUrl;
    img.onload = () => {
      const texSize = 512;
      const offscreen = document.createElement('canvas');
      offscreen.width = texSize;
      offscreen.height = texSize;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, texSize, texSize);
      }
      setFabricImg(offscreen);
    };
  }, [fabric.textureUrl]);

  const toPixel = useCallback((p: Point, w: number, h: number) => ({ x: p.x * w, y: p.y * h }), []);

  const renderWarp = useCallback(
    (time: number, showPleats: boolean, animateBreeze: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas || !photoImage || !fabricImg || !points || points.length < 4) return;

      // Use larger preview dimensions
      const w = 600;
      const h = Math.round((photoImage.naturalHeight / photoImage.naturalWidth) * 600);
      
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw background image
      ctx.drawImage(photoImage, 0, 0, w, h);

      const [pTL, pTR, pBR, pBL] = points.map((p) => toPixel(p, w, h));
      
      const fabricCtx = fabricImg.getContext('2d');
      if (!fabricCtx) return;
      const fabricData = fabricCtx.getImageData(0, 0, fabricImg.width, fabricImg.height);
      const sw = fabricImg.width;
      const sh = fabricImg.height;

      const minX = Math.floor(Math.min(pTL.x, pTR.x, pBR.x, pBL.x));
      const maxX = Math.ceil(Math.max(pTL.x, pTR.x, pBR.x, pBL.x));
      const minY = Math.floor(Math.min(pTL.y, pTR.y, pBR.y, pBL.y));
      const maxY = Math.ceil(Math.max(pTL.y, pTR.y, pBR.y, pBL.y));

      const destData = ctx.getImageData(minX, minY, maxX - minX, maxY - minY);
      const destW = maxX - minX;
      
      const alpha = fabric.translucency;
      const numPleats = 8;

      for (let py = minY; py < maxY; py++) {
        for (let px = minX; px < maxX; px++) {
          const p = { x: px, y: py };
          
          if (!isPointInQuad(p, pTL, pTR, pBR, pBL)) continue;
          
          let uv = inverseBilinear(p, pTL, pTR, pBR, pBL);
          if (!uv || uv.u < 0 || uv.u > 1 || uv.v < 0 || uv.v > 1) {
            uv = inverseBilinearNewton(p, pTL, pTR, pBR, pBL);
          }
          if (!uv || uv.u < 0 || uv.u > 1 || uv.v < 0 || uv.v > 1) continue;
          
          const srcX = Math.floor(uv.u * (sw - 1));
          const srcY = Math.floor(uv.v * (sh - 1));
          const srcIdx = (srcY * sw + srcX) * 4;
          
          let r = fabricData.data[srcIdx];
          let g = fabricData.data[srcIdx + 1];
          let b = fabricData.data[srcIdx + 2];
          const a = fabricData.data[srcIdx + 3];
          
          // Apply pleats and/or breeze effects based on flags
          if (showPleats || animateBreeze) {
            // Use animated time for breeze, static (0) for just pleats
            const effectTime = animateBreeze ? time : 0;
            const breezeOffset = effectTime * 2;
            const breezeWave = animateBreeze 
              ? 0.3 * Math.sin(uv.v * 3 + effectTime) * Math.sin(uv.u * 5 + effectTime * 0.7)
              : 0;
            const pleatPhase = uv.u * numPleats * Math.PI * 2 + breezeOffset + breezeWave;
            const pleatFactor = 0.90 + 0.10 * Math.sin(pleatPhase);
            
            const edgeDistance = Math.min(uv.u, 1 - uv.u) * 2;
            const shadowFactor = 0.7 + 0.3 * Math.pow(edgeDistance, 0.5);
            
            const lightFactor = pleatFactor * shadowFactor;
            r = Math.round(r * lightFactor);
            g = Math.round(g * lightFactor);
            b = Math.round(b * lightFactor);
          }
          
          const destIdx = ((py - minY) * destW + (px - minX)) * 4;
          const srcAlpha = (a / 255) * alpha;
          const invAlpha = 1 - srcAlpha;
          
          destData.data[destIdx] = Math.round(r * srcAlpha + destData.data[destIdx] * invAlpha);
          destData.data[destIdx + 1] = Math.round(g * srcAlpha + destData.data[destIdx + 1] * invAlpha);
          destData.data[destIdx + 2] = Math.round(b * srcAlpha + destData.data[destIdx + 2] * invAlpha);
          destData.data[destIdx + 3] = 255;
        }
      }
      
      ctx.putImageData(destData, minX, minY);

      // === REALISM: Curtain Rod (follows top edge angle) ===
      const rodHeight = Math.max(6, (pBL.y - pTL.y) * 0.02);
      const rodExtend = rodHeight * 1.5;
      
      // Calculate angle of top edge
      const topDx = pTR.x - pTL.x;
      const topDy = pTR.y - pTL.y;
      const topAngle = Math.atan2(topDy, topDx);
      const topLength = Math.sqrt(topDx * topDx + topDy * topDy);
      
      // Rod center point (slightly above the top edge midpoint)
      const rodMidX = (pTL.x + pTR.x) / 2;
      const rodMidY = (pTL.y + pTR.y) / 2 - rodHeight;
      
      // Total rod length including extensions
      const rodTotalLength = topLength + rodExtend * 2;
      
      ctx.save();
      ctx.translate(rodMidX, rodMidY);
      ctx.rotate(topAngle);
      
      // Rod gradient (metallic look) - vertical gradient relative to rod
      const rodGradient = ctx.createLinearGradient(0, -rodHeight/2, 0, rodHeight/2);
      rodGradient.addColorStop(0, '#8B8B8B');
      rodGradient.addColorStop(0.3, '#E8E8E8');
      rodGradient.addColorStop(0.5, '#FFFFFF');
      rodGradient.addColorStop(0.7, '#C0C0C0');
      rodGradient.addColorStop(1, '#6B6B6B');
      
      // Draw rod (centered at origin after transform)
      ctx.fillStyle = rodGradient;
      ctx.beginPath();
      ctx.roundRect(-rodTotalLength/2, -rodHeight/2, rodTotalLength, rodHeight, rodHeight/2);
      ctx.fill();
      
      // Rod shadow
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(0, rodHeight * 0.8, rodTotalLength / 2, rodHeight * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Finials (end caps)
      const finialRadius = rodHeight * 0.8;
      [-rodTotalLength/2, rodTotalLength/2].forEach((fx) => {
        const finialGrad = ctx.createRadialGradient(fx - finialRadius*0.3, -finialRadius*0.3, 0, fx, 0, finialRadius);
        finialGrad.addColorStop(0, '#FFFFFF');
        finialGrad.addColorStop(0.5, '#C0C0C0');
        finialGrad.addColorStop(1, '#707070');
        ctx.fillStyle = finialGrad;
        ctx.beginPath();
        ctx.arc(fx, 0, finialRadius, 0, Math.PI * 2);
        ctx.fill();
      });
      
      ctx.restore();

      // === REALISM: Curtain Rings (follow top edge) ===
      const numRings = 7;
      const ringRadius = rodHeight * 0.6;
      for (let i = 0; i < numRings; i++) {
        const t = (i + 0.5) / numRings;
        // Ring position on the fabric top edge
        const fabricX = pTL.x + topDx * t;
        const fabricY = pTL.y + topDy * t;
        // Ring position on the rod (slightly above)
        const ringX = fabricX;
        const ringY = fabricY - rodHeight;
        
        // Ring body
        ctx.strokeStyle = '#A0A0A0';
        ctx.lineWidth = ringRadius * 0.3;
        ctx.beginPath();
        ctx.arc(ringX, ringY, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Ring highlight
        ctx.strokeStyle = '#E0E0E0';
        ctx.lineWidth = ringRadius * 0.15;
        ctx.beginPath();
        ctx.arc(ringX, ringY, ringRadius, -Math.PI * 0.7 + topAngle, -Math.PI * 0.3 + topAngle);
        ctx.stroke();
        
        // Clip connecting to fabric
        ctx.strokeStyle = '#909090';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ringX, ringY + ringRadius);
        ctx.lineTo(fabricX, fabricY);
        ctx.stroke();
      }

      // === REALISM: Weighted Hem ===
      const hemHeight = Math.max(4, (pBL.y - pTL.y) * 0.015);
      
      // Hem shadow (below the fabric)
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.moveTo(pBL.x + 2, pBL.y + hemHeight);
      ctx.lineTo(pBR.x + 2, pBR.y + hemHeight);
      ctx.lineTo(pBR.x + 2, pBR.y + hemHeight * 2);
      ctx.lineTo(pBL.x + 2, pBL.y + hemHeight * 2);
      ctx.closePath();
      ctx.fill();
      
      // Hem line (darker fold)
      const hemGradient = ctx.createLinearGradient(0, pBL.y - hemHeight, 0, pBL.y);
      hemGradient.addColorStop(0, 'rgba(0,0,0,0)');
      hemGradient.addColorStop(0.6, 'rgba(0,0,0,0.15)');
      hemGradient.addColorStop(1, 'rgba(0,0,0,0.25)');
      
      ctx.fillStyle = hemGradient;
      ctx.beginPath();
      ctx.moveTo(pBL.x, pBL.y - hemHeight * 2);
      ctx.lineTo(pBR.x, pBR.y - hemHeight * 2);
      ctx.lineTo(pBR.x, pBR.y);
      ctx.lineTo(pBL.x, pBL.y);
      ctx.closePath();
      ctx.fill();
      
      // Hem stitch line
      ctx.strokeStyle = 'rgba(100,100,100,0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pBL.x + 5, pBL.y - hemHeight);
      ctx.lineTo(pBR.x - 5, pBR.y - hemHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    },
    [photoImage, fabricImg, points, fabric.translucency, toPixel]
  );

  // Render static frame when not animating
  useEffect(() => {
    if (!breezeEnabled && photoImage && fabricImg && points) {
      renderWarp(0, pleatsEnabled, false);
    }
  }, [breezeEnabled, pleatsEnabled, photoImage, fabricImg, points, renderWarp]);

  // Breeze animation loop
  useEffect(() => {
    if (!breezeEnabled || !photoImage || !fabricImg || !points || points.length < 4) {
      if (breezeRef.current) {
        cancelAnimationFrame(breezeRef.current);
        breezeRef.current = null;
      }
      return;
    }
    
    let lastTime = performance.now();
    
    const animate = (currentTime: number) => {
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      timeRef.current += delta * 0.5;
      
      renderWarp(timeRef.current, pleatsEnabled, true);
      breezeRef.current = requestAnimationFrame(animate);
    };
    
    breezeRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (breezeRef.current) {
        cancelAnimationFrame(breezeRef.current);
        breezeRef.current = null;
      }
    };
  }, [breezeEnabled, pleatsEnabled, photoImage, fabricImg, points, renderWarp]);

  const hasPreview = photoUrl && points && points.length >= 4;

  // Close fullscreen on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    if (isFullscreen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  // Sync fullscreen canvas with main canvas
  useEffect(() => {
    if (!isFullscreen) {
      if (fullscreenSyncRef.current) {
        cancelAnimationFrame(fullscreenSyncRef.current);
        fullscreenSyncRef.current = null;
      }
      return;
    }

    const syncFullscreen = () => {
      const src = canvasRef.current;
      const dest = fullscreenCanvasRef.current;
      if (src && dest) {
        const maxW = window.innerWidth * 0.92;
        const maxH = window.innerHeight * 0.88;
        const scale = Math.min(maxW / src.width, maxH / src.height, 2);
        const newW = Math.round(src.width * scale);
        const newH = Math.round(src.height * scale);
        
        if (dest.width !== newW || dest.height !== newH) {
          dest.width = newW;
          dest.height = newH;
        }
        
        const ctx = dest.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(src, 0, 0, newW, newH);
        }
      }
      fullscreenSyncRef.current = requestAnimationFrame(syncFullscreen);
    };

    fullscreenSyncRef.current = requestAnimationFrame(syncFullscreen);

    return () => {
      if (fullscreenSyncRef.current) {
        cancelAnimationFrame(fullscreenSyncRef.current);
        fullscreenSyncRef.current = null;
      }
    };
  }, [isFullscreen]);

  return (
    <div className="surface" style={{ padding: 16 }}>
      <div className="section-header">
        <h2>Previsualización</h2>
        <span className="pill">En vivo</span>
      </div>
      {!photoUrl && <p className="card-copy">Sube una foto para ver el montaje.</p>}
      {photoUrl && (!points || points.length < 4) && <p className="card-copy">Ajusta los 4 puntos para ver el resultado.</p>}
      {hasPreview && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div className="card-title">Vista previa con cortina</div>
            <button
              className={`selector-chip ${pleatsEnabled ? 'active' : ''}`}
              onClick={() => setPleatsEnabled(!pleatsEnabled)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 16 }}>〰️</span>
              {pleatsEnabled ? 'Ondulado' : 'Sin ondulado'}
            </button>
            <button
              className={`selector-chip ${breezeEnabled ? 'active' : ''}`}
              onClick={() => setBreezeEnabled(!breezeEnabled)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 16 }}>🌬️</span>
              {breezeEnabled ? 'Brisa activa' : 'Activar brisa'}
            </button>
            <button
              className="selector-chip"
              onClick={() => setIsFullscreen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}
            >
              <span style={{ fontSize: 16 }}>⛶</span>
              Ampliar
            </button>
          </div>
          <canvas
            ref={canvasRef}
            style={{ 
              maxWidth: '100%', 
              borderRadius: 8, 
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              cursor: 'pointer'
            }}
            onClick={() => setIsFullscreen(true)}
          />
        </div>
      )}

      {/* Fullscreen modal */}
      {isFullscreen && hasPreview && (
        <div className="fullscreen-overlay" onClick={() => setIsFullscreen(false)}>
          <button className="fullscreen-close" onClick={() => setIsFullscreen(false)}>✕</button>
          <canvas
            ref={fullscreenCanvasRef}
            style={{ borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

// Utility functions for perspective warp
type Pt = { x: number; y: number };

function isPointInQuad(p: Pt, tl: Pt, tr: Pt, br: Pt, bl: Pt): boolean {
  const cross = (a: Pt, b: Pt, c: Pt) => 
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  
  const d1 = cross(tl, tr, p);
  const d2 = cross(tr, br, p);
  const d3 = cross(br, bl, p);
  const d4 = cross(bl, tl, p);
  
  const eps = 1.0;
  const hasNeg = (d1 < -eps) || (d2 < -eps) || (d3 < -eps) || (d4 < -eps);
  const hasPos = (d1 > eps) || (d2 > eps) || (d3 > eps) || (d4 > eps);
  
  return !(hasNeg && hasPos);
}

function inverseBilinear(p: Pt, pTL: Pt, pTR: Pt, pBR: Pt, pBL: Pt): { u: number; v: number } | null {
  const ax = pTL.x, ay = pTL.y;
  const bx = pTR.x - pTL.x, by = pTR.y - pTL.y;
  const cx = pBL.x - pTL.x, cy = pBL.y - pTL.y;
  const dx = pTL.x - pTR.x + pBR.x - pBL.x;
  const dy = pTL.y - pTR.y + pBR.y - pBL.y;
  
  const ex = p.x - ax;
  const ey = p.y - ay;
  
  const cross = bx * cy - by * cx;
  const crossD = bx * dy - by * dx;
  
  const qa = crossD;
  const qb = cross + ex * dy - ey * dx;
  const qc = ex * by - ey * bx;
  
  let v: number;
  
  if (Math.abs(qa) < 1e-10) {
    if (Math.abs(qb) < 1e-10) return null;
    v = -qc / qb;
  } else {
    const disc = qb * qb - 4 * qa * qc;
    if (disc < 0) return null;
    
    const sqrtDisc = Math.sqrt(disc);
    const v1 = (-qb + sqrtDisc) / (2 * qa);
    const v2 = (-qb - sqrtDisc) / (2 * qa);
    
    if (v1 >= 0 && v1 <= 1) {
      v = v1;
    } else if (v2 >= 0 && v2 <= 1) {
      v = v2;
    } else {
      const d1 = Math.min(Math.abs(v1), Math.abs(v1 - 1));
      const d2 = Math.min(Math.abs(v2), Math.abs(v2 - 1));
      v = d1 < d2 ? v1 : v2;
    }
  }
  
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
  
  const tolerance = 0.05;
  if (u >= -tolerance && u <= 1 + tolerance && v >= -tolerance && v <= 1 + tolerance) {
    return { 
      u: Math.max(0, Math.min(1, u)), 
      v: Math.max(0, Math.min(1, v)) 
    };
  }
  
  return null;
}

function inverseBilinearNewton(p: Pt, pTL: Pt, pTR: Pt, pBR: Pt, pBL: Pt): { u: number; v: number } | null {
  const minX = Math.min(pTL.x, pTR.x, pBR.x, pBL.x);
  const maxX = Math.max(pTL.x, pTR.x, pBR.x, pBL.x);
  const minY = Math.min(pTL.y, pTR.y, pBR.y, pBL.y);
  const maxY = Math.max(pTL.y, pTR.y, pBR.y, pBL.y);
  
  let u = (p.x - minX) / (maxX - minX);
  let v = (p.y - minY) / (maxY - minY);
  
  u = Math.max(0, Math.min(1, u));
  v = Math.max(0, Math.min(1, v));
  
  for (let iter = 0; iter < 20; iter++) {
    const topX = pTL.x + (pTR.x - pTL.x) * u;
    const topY = pTL.y + (pTR.y - pTL.y) * u;
    const botX = pBL.x + (pBR.x - pBL.x) * u;
    const botY = pBL.y + (pBR.y - pBL.y) * u;
    const qx = topX + (botX - topX) * v;
    const qy = topY + (botY - topY) * v;
    
    const ex = p.x - qx;
    const ey = p.y - qy;
    
    if (Math.abs(ex) < 0.5 && Math.abs(ey) < 0.5) {
      if (u >= -0.01 && u <= 1.01 && v >= -0.01 && v <= 1.01) {
        return { 
          u: Math.max(0, Math.min(1, u)), 
          v: Math.max(0, Math.min(1, v)) 
        };
      }
    }
    
    const dxdu = (pTR.x - pTL.x) * (1 - v) + (pBR.x - pBL.x) * v;
    const dxdv = (botX - topX);
    const dydu = (pTR.y - pTL.y) * (1 - v) + (pBR.y - pBL.y) * v;
    const dydv = (botY - topY);
    
    const det = dxdu * dydv - dxdv * dydu;
    if (Math.abs(det) < 1e-10) {
      u += 0.01;
      v += 0.01;
      continue;
    }
    
    const du = (ex * dydv - ey * dxdv) / det;
    const dv = (dxdu * ey - dydu * ex) / det;
    
    const damping = 0.8;
    u += du * damping;
    v += dv * damping;
    
    u = Math.max(-0.1, Math.min(1.1, u));
    v = Math.max(-0.1, Math.min(1.1, v));
  }
  
  if (u >= -0.01 && u <= 1.01 && v >= -0.01 && v <= 1.01) {
    return { 
      u: Math.max(0, Math.min(1, u)), 
      v: Math.max(0, Math.min(1, v)) 
    };
  }
  
  return null;
}

export default OverlayPreview;
