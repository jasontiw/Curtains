import React from 'react';

type Props = {
  photoUrl?: string;
  compositeUrl?: string;
};

const OverlayPreview: React.FC<Props> = ({ photoUrl, compositeUrl }) => {
  const showOnlyComposite = photoUrl && compositeUrl;

  return (
    <div className="surface" style={{ padding: 16 }}>
      <div className="section-header">
        <h2>Previsualización</h2>
        <span className="pill">Sólo con sheer</span>
      </div>
      {!photoUrl && <p className="card-copy">Sube una foto para ver el montaje.</p>}
      {photoUrl && !compositeUrl && <p className="card-copy">Procesando montaje...</p>}
      {showOnlyComposite && (
        <div>
          <div className="card-title">Con sheer</div>
          <img className="preview-img" src={compositeUrl} alt="Cortina aplicada" />
        </div>
      )}
    </div>
  );
};

export default OverlayPreview;
