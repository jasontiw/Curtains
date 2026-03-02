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
            Sheers dinámicos
          </div>
          <h1>Prueba cortinas sheer en tu espacio</h1>
          <p>
            Anima, elige texturas translúcidas y prueba sobre la foto de tu ventana. Todo corre en el navegador, sin descargas.
          </p>
          <div className="badge-row">
            <span className="badge">3D motion con Three.js</span>
            <span className="badge">Warp 2D en canvas</span>
            <span className="badge">Listo para móvil</span>
          </div>
        </div>
        <CurtainScene fabric={activeFabric} />
      </motion.div>

      <section className="grid" style={{ marginTop: 20 }}>
        <div className="surface" style={{ padding: 16 }}>
          <div className="section-header">
            <h2>Elige tu sheer</h2>
            <span className="pill">Catálogo inicial</span>
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
