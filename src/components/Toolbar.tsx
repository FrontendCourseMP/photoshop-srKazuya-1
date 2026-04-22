/**
 * Toolbar Component
 * Компонент с основными инструментами (пока что только загрузка/скачивание)
 */

import React, { useRef } from 'react';
import '../styles/toolbar.css';

interface ToolbarProps {
  onImageLoad: (file: File) => void;
  onDownloadPng: () => void;
  onDownloadJpg: () => void;
  onDownloadGb7: () => void;
  canExport: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onImageLoad,
  onDownloadPng,
  onDownloadJpg,
  onDownloadGb7,
  canExport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageLoad(file);
      // Сбросить значение input чтобы можно было загрузить тот же файл еще раз
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <h3>Файл</h3>
        <button onClick={handleLoadClick} className="toolbar-btn" title="Открыть изображение">
          <span className="btn-icon">📂</span>
          Открыть
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.gb7"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
      </div>

      <div className="toolbar-section">
        <h3>Экспорт</h3>
        <button
          onClick={onDownloadPng}
          disabled={!canExport}
          className="toolbar-btn"
          title="Сохранить как PNG"
        >
          <span className="btn-icon">💾</span>
          PNG
        </button>
        <button
          onClick={onDownloadJpg}
          disabled={!canExport}
          className="toolbar-btn"
          title="Сохранить как JPG"
        >
          <span className="btn-icon">💾</span>
          JPG
        </button>
        <button
          onClick={onDownloadGb7}
          disabled={!canExport}
          className="toolbar-btn"
          title="Сохранить как GB7"
        >
          <span className="btn-icon">💾</span>
          GB7
        </button>
      </div>
    </div>
  );
};
