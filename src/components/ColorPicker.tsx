/**
 * Color Picker Component
 * Инструмент для получения цвета пикселей
 */

import React, { useState, useEffect } from 'react';
import { formatColorData, type ColorData } from '../utils/colorUtils';
import '../styles/colorPicker.css';

interface ColorPickerProps {
  isActive: boolean;
  imageData?: Uint8Array;
  width?: number;
  height?: number;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  isActive,
  imageData,
}) => {
  const [selectedColor, setSelectedColor] = useState<ColorData | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    const handleColorPicked = (event: Event) => {
      const customEvent = event as CustomEvent;
      const color = customEvent.detail as ColorData;
      setSelectedColor(color);
      setShowInfo(true);
    };

    window.addEventListener('colorpicked', handleColorPicked);
    return () => window.removeEventListener('colorpicked', handleColorPicked);
  }, [isActive]);

  if (!isActive || !imageData) {
    return null;
  }

  return (
    <>
      {/* Информационное окно */}
      {selectedColor && showInfo && (
        <ColorInfoPanel color={selectedColor} onClose={() => setShowInfo(false)} />
      )}
    </>
  );
};

interface ColorInfoPanelProps {
  color: ColorData;
  onClose: () => void;
}

const ColorInfoPanel: React.FC<ColorInfoPanelProps> = ({ color, onClose }) => {
  const formatted = formatColorData(color);

  return (
    <div className="color-info-panel">
      <div className="color-info-header">
        <h4>Информация о цвете</h4>
        <button className="close-btn" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </div>

      <div className="color-info-content">
        {/* Цветной прямоугольник */}
        <div
          className="color-preview"
          style={{
            backgroundColor: `rgba(${color.r}, ${color.g}, ${color.b}, ${(color.a / 255).toFixed(3)})`,
          }}
        />

        {/* Координаты */}
        <div className="info-row">
          <span className="info-label">Координаты:</span>
          <span className="info-value">X: {color.x}, Y: {color.y}</span>
        </div>

        {/* RGB */}
        <div className="info-row">
          <span className="info-label">RGB:</span>
          <span className="info-value">{formatted.rgb}</span>
        </div>

        {/* Hex */}
        <div className="info-row">
          <span className="info-label">Hex:</span>
          <span className="info-value">{formatted.hex}</span>
        </div>

        {/* Alpha */}
        <div className="info-row">
          <span className="info-label">Альфа:</span>
          <span className="info-value">{color.a} ({((color.a / 255) * 100).toFixed(1)}%)</span>
        </div>

        {/* LAB */}
        <div className="info-row">
          <span className="info-label">LAB:</span>
          <span className="info-value">{formatted.lab}</span>
        </div>

        {/* Детали LAB */}
        <div className="info-section">
          <h5>CIELAB компоненты:</h5>
          <div className="info-row">
            <span className="info-label">L (Lightness):</span>
            <span className="info-value">{color.l}</span>
          </div>
          <div className="info-row">
            <span className="info-label">a* (Green-Red):</span>
            <span className="info-value">{color.a_lab}</span>
          </div>
          <div className="info-row">
            <span className="info-label">b* (Blue-Yellow):</span>
            <span className="info-value">{color.b_lab}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
