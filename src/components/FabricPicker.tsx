import React, { useMemo } from 'react';

export type Fabric = {
  id: string;
  name: string;
  description: string;
  textureUrl: string;
  tint: string;
  translucency: number; // 0-1 range
  category: 'transparentes' | 'opacos' | 'decorativos';
};

type Props = {
  fabrics: Fabric[];
  activeId: string;
  onSelect: (id: string) => void;
};

const categoryLabels: Record<Fabric['category'], { label: string; icon: string }> = {
  transparentes: { label: 'Transparentes', icon: '☁️' },
  opacos: { label: 'Opacos', icon: '🌑' },
  decorativos: { label: 'Decorativos', icon: '✨' },
};

const FabricPicker: React.FC<Props> = ({ fabrics, activeId, onSelect }) => {
  const grouped = useMemo(() => {
    const groups: Record<Fabric['category'], Fabric[]> = {
      transparentes: [],
      opacos: [],
      decorativos: [],
    };
    fabrics.forEach((f) => groups[f.category].push(f));
    return groups;
  }, [fabrics]);

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {(Object.keys(grouped) as Fabric['category'][]).map((cat) => {
        const items = grouped[cat];
        if (items.length === 0) return null;
        const { label, icon } = categoryLabels[cat];
        return (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{icon} {label}:</span>
            {items.map((fabric) => {
              const active = fabric.id === activeId;
              return (
                <button
                  key={fabric.id}
                  className={`selector-chip ${active ? 'active' : ''}`}
                  onClick={() => onSelect(fabric.id)}
                  aria-pressed={active}
                  title={fabric.description}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', fontSize: 13 }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      background: `linear-gradient(135deg, ${fabric.tint}66, ${fabric.tint}cc)`,
                      border: '1px solid rgba(17,24,38,0.1)',
                      flexShrink: 0,
                    }}
                  />
                  <span>{fabric.name.split(' ').slice(-1)[0]}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default FabricPicker;
