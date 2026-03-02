import React from 'react';

export type Fabric = {
  id: string;
  name: string;
  description: string;
  textureUrl: string;
  tint: string;
  translucency: number; // 0-1 range
};

type Props = {
  fabrics: Fabric[];
  activeId: string;
  onSelect: (id: string) => void;
};

const FabricPicker: React.FC<Props> = ({ fabrics, activeId, onSelect }) => {
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
      {fabrics.map((fabric) => {
        const active = fabric.id === activeId;
        return (
          <button
            key={fabric.id}
            className={`surface selector-chip ${active ? 'active' : ''}`}
            onClick={() => onSelect(fabric.id)}
            aria-pressed={active}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: `linear-gradient(135deg, ${fabric.tint}22, ${fabric.tint}66)`,
                border: '1px solid rgba(17,24,38,0.06)'
              }}
            />
            <div style={{ textAlign: 'left' }}>
              <div className="card-title">{fabric.name}</div>
              <div className="card-copy" style={{ fontSize: 13 }}>{fabric.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default FabricPicker;
