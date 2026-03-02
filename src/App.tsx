import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import CurtainScene from './components/CurtainScene';
import FabricPicker, { Fabric } from './components/FabricPicker';
import UploadStage, { Point } from './components/UploadStage';
import OverlayPreview from './components/OverlayPreview';

const fabrics: Fabric[] = [
  {
    id: 'sheer-soft',
    name: 'Sheer Soft White',
    description: 'Luz filtrada, textura mínima',
    textureUrl: '/fabrics/sheer-soft.svg',
    tint: '#f1f5ff',
    translucency: 0.62,
    category: 'transparentes'
  },
  {
    id: 'sheer-warm',
    name: 'Sheer Marfil',
    description: 'Calidez ligera con brisa',
    textureUrl: '/fabrics/sheer-warm.svg',
    tint: '#f8eddc',
    translucency: 0.66,
    category: 'transparentes'
  },
  {
    id: 'sheer-gray',
    name: 'Sheer Gris Perla',
    description: 'Tono neutro elegante',
    textureUrl: '/fabrics/sheer-gray.svg',
    tint: '#e2e6ef',
    translucency: 0.58,
    category: 'transparentes'
  },
  {
    id: 'linen-natural',
    name: 'Lino Natural',
    description: 'Textura rústica con fibras visibles',
    textureUrl: '/fabrics/linen-natural.svg',
    tint: '#e8e0d0',
    translucency: 0.85,
    category: 'opacos'
  },
  {
    id: 'blackout-elegant',
    name: 'Blackout Elegante',
    description: 'Opaco con acabado satinado',
    textureUrl: '/fabrics/blackout-elegant.svg',
    tint: '#3a3a45',
    translucency: 0.95,
    category: 'opacos'
  },
  {
    id: 'lace-romantic',
    name: 'Encaje Romántico',
    description: 'Patrón floral delicado',
    textureUrl: '/fabrics/lace-romantic.svg',
    tint: '#f8f4f0',
    translucency: 0.55,
    category: 'decorativos'
  },
  {
    id: 'stripes-modern',
    name: 'Rayas Modernas',
    description: 'Líneas horizontales sutiles',
    textureUrl: '/fabrics/stripes-modern.svg',
    tint: '#e8eaed',
    translucency: 0.75,
    category: 'decorativos'
  }
];

function App() {
  const [activeId, setActiveId] = useState<string>('sheer-soft');
  const [photoUrl, setPhotoUrl] = useState<string>();
  const [points, setPoints] = useState<Point[]>();

  const activeFabric = useMemo(() => fabrics.find((f) => f.id === activeId) ?? fabrics[0], [activeId]);

  return (
    <div className="main-shell">
      <motion.div
        className="panel hero"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div>
          <div className="pill" style={{ display: 'inline-flex', marginBottom: 10 }}>
            ✨ Visualizador de cortinas
          </div>
          <h1>Visualiza tus cortinas antes de comprar</h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, marginBottom: 16, color: 'var(--ink)', opacity: 0.85 }}>
            Sube una foto de tu ventana, selecciona la tela que más te guste y ve cómo lucirían las cortinas 
            en tu espacio real — con efectos de pliegues, brisa animada y acabados decorativos.
          </p>
          
          <div style={{ 
            display: 'flex', 
            gap: 12, 
            marginBottom: 20,
            flexWrap: 'wrap'
          }}>
            {[
              { num: '1', text: 'Sube foto de tu ventana', icon: '📷' },
              { num: '2', text: 'Ajusta el área de cortina', icon: '✏️' },
              { num: '3', text: 'Elige tela y accesorios', icon: '🎨' }
            ].map((step) => (
              <div 
                key={step.num}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8,
                  background: 'rgba(77,124,245,0.08)',
                  padding: '8px 14px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 500
                }}
              >
                <span style={{ 
                  background: 'var(--accent)', 
                  color: '#fff', 
                  width: 22, 
                  height: 22, 
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700
                }}>
                  {step.num}
                </span>
                <span>{step.icon} {step.text}</span>
              </div>
            ))}
          </div>
          
          <div className="badge-row">
            <span className="badge">7 estilos de tela</span>
            <span className="badge">5 materiales de barra</span>
            <span className="badge">Brisa animada</span>
            <span className="badge">Cenefa opcional</span>
          </div>
        </div>
        <CurtainScene fabric={activeFabric} />
      </motion.div>

      <section style={{ marginTop: 20 }}>
        <div className="surface" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>Tela:</span>
            <FabricPicker fabrics={fabrics} activeId={activeId} onSelect={setActiveId} />
          </div>
        </div>
      </section>

      <section className="editor-grid" style={{ marginTop: 20, gap: 18 }}>
        <UploadStage fabric={activeFabric} onPhotoChange={setPhotoUrl} onPointsChange={setPoints} />
        <OverlayPreview photoUrl={photoUrl} points={points} fabric={activeFabric} />
      </section>

      <footer className="footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <span>Desarrollado por</span>
        <a 
          href="https://twitter.com/jasontiw" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ color: 'var(--accent)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: 'middle' }}>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          @jasontiw
        </a>
      </footer>
    </div>
  );
}

export default App;
