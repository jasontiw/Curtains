import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import CurtainScene from './components/CurtainScene';
import FabricPicker, { Fabric } from './components/FabricPicker';
import UploadStage from './components/UploadStage';
import OverlayPreview from './components/OverlayPreview';

const fabrics: Fabric[] = [
  {
    id: 'sheer-soft',
    name: 'Sheer Soft White',
    description: 'Luz filtrada, textura mínima',
    textureUrl: '/fabrics/sheer-soft.svg',
    tint: '#f1f5ff',
    translucency: 0.62
  },
  {
    id: 'sheer-warm',
    name: 'Sheer Marfil',
    description: 'Calidez ligera con brisa',
    textureUrl: '/fabrics/sheer-warm.svg',
    tint: '#f8eddc',
    translucency: 0.66
  },
  {
    id: 'sheer-gray',
    name: 'Sheer Gris Perla',
    description: 'Tono neutro elegante',
    textureUrl: '/fabrics/sheer-gray.svg',
    tint: '#e2e6ef',
    translucency: 0.58
  },
  {
    id: 'linen-natural',
    name: 'Lino Natural',
    description: 'Textura rústica con fibras visibles',
    textureUrl: '/fabrics/linen-natural.svg',
    tint: '#e8e0d0',
    translucency: 0.85
  },
  {
    id: 'blackout-elegant',
    name: 'Blackout Elegante',
    description: 'Opaco con acabado satinado',
    textureUrl: '/fabrics/blackout-elegant.svg',
    tint: '#3a3a45',
    translucency: 0.95
  },
  {
    id: 'lace-romantic',
    name: 'Encaje Romántico',
    description: 'Patrón floral delicado',
    textureUrl: '/fabrics/lace-romantic.svg',
    tint: '#f8f4f0',
    translucency: 0.55
  },
  {
    id: 'stripes-modern',
    name: 'Rayas Modernas',
    description: 'Líneas horizontales sutiles',
    textureUrl: '/fabrics/stripes-modern.svg',
    tint: '#e8eaed',
    translucency: 0.75
  }
];

function App() {
  const [activeId, setActiveId] = useState<string>('sheer-soft');
  const [compositeUrl, setCompositeUrl] = useState<string>();
  const [photoUrl, setPhotoUrl] = useState<string>();

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
            Cortinas virtuales
          </div>
          <h1>Prueba cortinas en tu espacio</h1>
          <p>
            Elige entre sheers, lino, blackout o encaje. Prueba sobre la foto de tu ventana con efecto de brisa animada.
          </p>
          <div className="badge-row">
            <span className="badge">7 estilos de tela</span>
            <span className="badge">Animación de brisa</span>
            <span className="badge">Pliegues realistas</span>
          </div>
        </div>
        <CurtainScene fabric={activeFabric} />
      </motion.div>

      <section className="grid" style={{ marginTop: 20 }}>
        <div className="surface" style={{ padding: 16 }}>
          <div className="section-header">
            <h2>Elige tu tela</h2>
            <span className="pill">7 estilos</span>
          </div>
          <FabricPicker fabrics={fabrics} activeId={activeId} onSelect={setActiveId} />
        </div>
      </section>

      <section className="grid" style={{ marginTop: 20, gap: 18 }}>
        <UploadStage fabric={activeFabric} onComposite={setCompositeUrl} onPhotoChange={setPhotoUrl} />
        <OverlayPreview photoUrl={photoUrl} compositeUrl={compositeUrl} />
      </section>

      <footer className="footer">
        Hecho para jugar con luz, textura y movimiento.
      </footer>
    </div>
  );
}

export default App;
