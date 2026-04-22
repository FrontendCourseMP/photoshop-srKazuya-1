/**
 * Canvas Display Component
 * Компонент для отображения canvas с масштабированием и прокруткой
 */

import React, { useRef, useEffect, useState } from 'react';
import { getPixelColor } from '../utils/colorUtils';
import '../styles/canvasDisplay.css';

interface CanvasDisplayProps {
  canvas?: HTMLCanvasElement;
  isPickerActive?: boolean;
  imageData?: Uint8Array;
  width?: number;
  height?: number;
}

export const CanvasDisplay = React.forwardRef<HTMLDivElement, CanvasDisplayProps>(
  ({ canvas, isPickerActive = false, imageData, width = 0, height = 0 }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(100);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });

    React.useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

    useEffect(() => {
      const handleWheel = (e: WheelEvent) => {
        if (!containerRef.current || !canvas) return;

        // Ctrl + скролл = зум
        if (e.ctrlKey) {
          e.preventDefault();
          const newZoom = Math.max(10, Math.min(400, zoom + (e.deltaY > 0 ? -10 : 10)));
          setZoom(newZoom);
        }
      };

      const container = containerRef.current;
      if (container) {
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
      }
    }, [zoom, canvas]);

    const handleMouseDown = (e: React.MouseEvent) => {
      if (isPickerActive) {
        // Пипетка активна
        handlePickerClick(e);
      } else if (e.button !== 2) {
        // Средняя или правая кнопка для перемещения
        return;
      } else {
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    };

    const handlePickerClick = (e: React.MouseEvent) => {
      if (!canvas || !imageData || width === 0 || height === 0) return;

      const imageElement = containerRef.current?.querySelector('img');
      if (!imageElement) return;

      const rect = imageElement.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;

      if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) return;

      const x = Math.floor((localX / rect.width) * width);
      const y = Math.floor((localY / rect.height) * height);
      const color = getPixelColor(imageData, width, height, x, y);
      if (color) {
        const event = new CustomEvent('colorpicked', { detail: color });
        window.dispatchEvent(event);
      }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      setScrollPos((prev) => ({
        x: prev.x - deltaX,
        y: prev.y - deltaY,
      }));

      setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
    };

    return (
      <div
        ref={containerRef}
        className="canvas-display"
        role="region"
        aria-label="Область отображения изображения"
        aria-live="polite"
        style={{
          cursor: isPickerActive ? 'crosshair' : (isDragging ? 'grabbing' : 'grab'),
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
      >
        <div
          className="canvas-viewport"
          style={{
            transform: `translate(-${scrollPos.x}px, -${scrollPos.y}px)`,
          }}
        >
          {canvas ? (
            <img
              src={canvas.toDataURL()}
              alt="Загруженное изображение с размером и информацией о масштабировании"
              style={{
                width: `${(canvas.width * zoom) / 100}px`,
                height: `${(canvas.height * zoom) / 100}px`,
                imageRendering: 'pixelated',
              }}
            />
          ) : (
            <div className="canvas-placeholder" role="status">
              <p>Загрузите изображение для начала</p>
            </div>
          )}
        </div>

        <div className="zoom-info" aria-live="polite" aria-atomic="true">
          <span aria-label="Уровень масштабирования">
            {canvas ? `${zoom}%` : 'Нет изображения'}
          </span>
        </div>
      </div>
    );
  }
);

CanvasDisplay.displayName = 'CanvasDisplay';
