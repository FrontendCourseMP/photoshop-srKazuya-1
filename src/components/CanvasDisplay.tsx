/**
 * Canvas Display Component
 * Компонент для отображения canvas с масштабированием и прокруткой
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { getPixelColor } from '../utils/colorUtils';
import '../styles/canvasDisplay.css';

interface CanvasDisplayProps {
  canvas?: HTMLCanvasElement;
  isPickerActive?: boolean;
  imageData?: Uint8Array;
  width?: number;
  height?: number;
  scalePercent?: number;
  onScaleChange?: (nextScale: number) => void;
  onViewportResize?: (size: { width: number; height: number }) => void;
}

export const CanvasDisplay = React.forwardRef<HTMLDivElement, CanvasDisplayProps>(
  (
    {
      canvas,
      isPickerActive = false,
      imageData,
      width = 0,
      height = 0,
      scalePercent = 100,
      onScaleChange,
      onViewportResize,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });

    React.useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);
    const imageSrc = useMemo(() => (canvas ? canvas.toDataURL() : ''), [canvas]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container || !onViewportResize) {
        return;
      }
      const emitSize = () => {
        onViewportResize({ width: container.clientWidth, height: container.clientHeight });
      };
      emitSize();
      const observer = new ResizeObserver(emitSize);
      observer.observe(container);
      return () => observer.disconnect();
    }, [onViewportResize]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container || !onScaleChange) {
        return;
      }
      const handleWheel = (event: WheelEvent) => {
        if (!event.ctrlKey || !canvas) {
          return;
        }
        event.preventDefault();
        const delta = event.deltaY > 0 ? -10 : 10;
        onScaleChange(scalePercent + delta);
      };
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }, [canvas, onScaleChange, scalePercent]);

    useEffect(() => {
      setScrollPos({ x: 0, y: 0 });
    }, [imageSrc]);

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
              src={imageSrc}
              alt="Загруженное изображение с размером и информацией о масштабировании"
              style={{
                width: `${canvas.width}px`,
                height: `${canvas.height}px`,
                imageRendering: 'auto',
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
            {canvas ? `${scalePercent}%` : 'Нет изображения'}
          </span>
        </div>
      </div>
    );
  }
);

CanvasDisplay.displayName = 'CanvasDisplay';
