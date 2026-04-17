/**
 * Status Bar Component
 * Строка состояния с информацией об изображении
 */

import React from 'react';
import type { ImageInfo } from '../utils/imageProcessor';
import { formatFileSize } from '../utils/imageProcessor';
import '../styles/statusBar.css';

interface StatusBarProps {
  imageInfo?: ImageInfo;
  status: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ imageInfo, status }) => {
  const getFormatLabel = (format: string) => {
    switch (format) {
      case 'png':
        return 'PNG';
      case 'jpg':
        return 'JPEG';
      case 'gb7':
        return 'GB7 (GrayBit-7)';
      default:
        return format.toUpperCase();
    }
  };

  return (
    <div className="status-bar">
      <div className="status-message">{status}</div>

      {imageInfo && (
        <div className="image-info">
          <span className="info-item">
            <strong>Размер:</strong> {imageInfo.width} × {imageInfo.height} px
          </span>
          <span className="info-item separator">|</span>
          <span className="info-item">
            <strong>Глубина цвета:</strong> {imageInfo.bitDepth} бит
          </span>
          <span className="info-item separator">|</span>
          <span className="info-item">
            <strong>Формат:</strong> {getFormatLabel(imageInfo.format)}
          </span>
          <span className="info-item separator">|</span>
          <span className="info-item">
            <strong>Размер файла:</strong> {formatFileSize(imageInfo.fileSize)}
          </span>
          {imageInfo.hasMask && (
            <>
              <span className="info-item separator">|</span>
              <span className="info-item">
                <strong>Маска:</strong> Включена
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
