/**
 * Layers Panel Component
 * Панель слоев (демонстрационная для структуры как в GIMP)
 */

import React from 'react';
import '../styles/layersPanel.css';

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
}

interface LayersPanelProps {
  layers: Layer[];
  onLayerToggle: (layerId: string) => void;
  onOpacityChange: (layerId: string, opacity: number) => void;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  onLayerToggle,
  onOpacityChange,
}) => {
  return (
    <aside className="layers-panel" aria-label="Панель слоев">
      <h3>Слои</h3>
      <div className="layers-list" role="list">
        {layers.map((layer) => (
          <div key={layer.id} className="layer-item" role="listitem">
            <button
              className="layer-visibility-btn"
              onClick={() => onLayerToggle(layer.id)}
              aria-label={layer.visible ? `Скрыть слой ${layer.name}` : `Показать слой ${layer.name}`}
              aria-pressed={layer.visible}
              title={layer.visible ? 'Скрыть слой' : 'Показать слой'}
            >
              <span className="visibility-icon" aria-hidden="true">
                {layer.visible ? '✓' : '○'}
              </span>
            </button>
            <span className="layer-name">{layer.name}</span>
            <div className="layer-opacity">
              <input
                type="range"
                min="0"
                max="100"
                value={layer.opacity}
                onChange={(e) => onOpacityChange(layer.id, parseInt(e.target.value))}
                className="opacity-slider"
                aria-label={`Прозрачность слоя ${layer.name}`}
              />
              <span className="opacity-value" aria-live="polite" aria-atomic="true">{layer.opacity}%</span>
            </div>
          </div>
        ))}
      </div>
      
      {layers.length === 0 && (
        <div className="layers-empty" role="status" aria-live="polite">
          <p>Нет слоев</p>
        </div>
      )}
    </aside>
  );
};
