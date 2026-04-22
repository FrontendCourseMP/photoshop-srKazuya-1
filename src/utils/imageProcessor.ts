/**
 * Image Processing Utils
 * Утилиты для работы с изображениями
 */

import { decodeGB7, encodeGB7 } from './gb7Format';

export interface ImageInfo {
  width: number;
  height: number;
  bitDepth: number;
  format: 'png' | 'jpg' | 'gb7';
  hasMask?: boolean;
  fileSize: number;
}

/**
 * Определить глубину цвета PNG файла из заголовка
 */
function getPngBitDepth(arrayBuffer: ArrayBuffer): number {
  const view = new Uint8Array(arrayBuffer);
  
  // PNG сигнатура: 89 50 4E 47 0D 0A 1A 0A (8 байт)
  if (view.length < 25) return 8;
  
  // Проверка сигнатуры PNG
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (view[i] !== pngSignature[i]) return 8;
  }
  
  // После сигнатуры (8 байт):
  // - Длина IHDR чанка (4 байта, всегда 13 для IHDR)
  // - "IHDR" идентификатор (4 байта)
  // - IHDR данные (13 байт): width(4) + height(4) + bitDepth(1) + colorType(1) + compression(1) + filter(1) + interlace(1)
  // Позиция bitDepth: 8 + 4 + 4 + 4 + 4 = 24
  const bitDepth = view[24];
  
  return bitDepth;
}

/**
 * Определить глубину цвета JPEG файла из маркеров
 */
function getJpegBitDepth(arrayBuffer: ArrayBuffer): number {
  const view = new Uint8Array(arrayBuffer);
  
  // JPEG файл начинается с FFD8 (маркер SOI)
  if (view.length < 4 || view[0] !== 0xff || view[1] !== 0xd8) return 8;
  
  // Поиск маркера SOF (Start of Frame)
  let offset = 2;
  
  while (offset < view.length - 8) {
    if (view[offset] !== 0xff) break;
    
    const marker = view[offset + 1];
    
    // SOF маркеры: FFC0, FFC1, FFC2, FFC9, FFCA, FFCB, FFCD, FFCE
    // (пропускаем RSTm маркеры FFD0-FFD7 и другие служебные)
    const isSofMarker = (marker >= 0xc0 && marker <= 0xc3) || 
                        (marker >= 0xc9 && marker <= 0xcb) || 
                        marker === 0xcd || marker === 0xce;
    
    if (isSofMarker) {
      // Структура SOF:
      // FF C0 (маркер)
      // Длина (2 байта)
      // Sample precision (1 байт) - количество бит на компонент
      // Height (2 байта)
      // Width (2 байта)
      // Number of components (1 байт) - 1 для grayscale, 3 для RGB, 4 для CMYK
      
      const samplePrecision = view[offset + 4]; // В байтах от маркера
      const numComponents = view[offset + 9];   // В байтах от маркера
      
      const totalBitDepth = samplePrecision * numComponents;
      return totalBitDepth;
    }
    
    // Переход к следующему маркеру
    // Длина сегмента хранится в 2 байтах после маркера (big-endian)
    const segmentLength = (view[offset + 2] << 8) | view[offset + 3];
    offset += segmentLength + 2;
  }
  
  // Значение по умолчанию для JPEG (8 бит на компонент * 3 компонента для RGB)
  return 24;
}

export interface ProcessedImage {
  canvas: HTMLCanvasElement;
  info: ImageInfo;
  originalData?: Uint8Array;
}

/**
 * Загрузить изображение из файла и вернуть HTMLCanvasElement
 */
export async function loadImage(file: File): Promise<ProcessedImage> {
  const arrayBuffer = await file.arrayBuffer();
  const fileName = file.name.toLowerCase();
  let canvas: HTMLCanvasElement;
  let info: ImageInfo;
  let originalData: Uint8Array | undefined;

  if (fileName.endsWith('.gb7')) {
    // Обработка GB7 формата
    const gb7Data = decodeGB7(arrayBuffer);
    
    canvas = createCanvasFromImageData(gb7Data.data, gb7Data.width, gb7Data.height);
    info = {
      width: gb7Data.width,
      height: gb7Data.height,
      bitDepth: gb7Data.bitDepth,
      format: 'gb7',
      hasMask: gb7Data.hasMask,
      fileSize: file.size,
    };
    originalData = new Uint8Array(arrayBuffer);
  } else if (fileName.endsWith('.png')) {
    // Обработка PNG
    const bitDepth = getPngBitDepth(arrayBuffer);
    const imageData = await loadPngOrJpg(arrayBuffer);
    canvas = createCanvasFromImageData(imageData.data, imageData.width, imageData.height);
    info = {
      width: imageData.width,
      height: imageData.height,
      bitDepth: bitDepth,
      format: 'png',
      fileSize: file.size,
    };
  } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
    // Обработка JPG
    const bitDepth = getJpegBitDepth(arrayBuffer);
    const imageData = await loadPngOrJpg(arrayBuffer);
    canvas = createCanvasFromImageData(imageData.data, imageData.width, imageData.height);
    info = {
      width: imageData.width,
      height: imageData.height,
      bitDepth: bitDepth,
      format: 'jpg',
      fileSize: file.size,
    };
  } else {
    throw new Error(`Неподдерживаемый формат файла: ${file.type}`);
  }

  return { canvas, info, originalData };
}

/**
 * Загрузить PNG/JPG используя встроенные возможности браузера
 */
function loadPngOrJpg(arrayBuffer: ArrayBuffer): Promise<{ data: Uint8Array; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([arrayBuffer]);
    const url = URL.createObjectURL(blob);
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Не удалось получить контекст canvas'));
        return;
      }
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      
      URL.revokeObjectURL(url);
      resolve({
        data: new Uint8Array(imageData.data),
        width: img.width,
        height: img.height,
      });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Ошибка загрузки изображения'));
    };
    
    img.src = url;
  });
}

/**
 * Создать canvas из ImageData
 */
export function createCanvasFromImageData(
  imageData: Uint8Array,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не удалось получить контекст canvas');
  }
  
  const canvasImageData = ctx.createImageData(width, height);
  canvasImageData.data.set(imageData);
  ctx.putImageData(canvasImageData, 0, 0);
  
  return canvas;
}

/**
 * Получить ImageData из canvas
 */
export function getCanvasImageData(canvas: HTMLCanvasElement): { data: Uint8Array; width: number; height: number } {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не удалось получить контекст canvas');
  }
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    data: new Uint8Array(imageData.data),
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Сохранить изображение как PNG
 */
export function downloadAsPng(canvas: HTMLCanvasElement, fileName: string = 'image.png'): void {
  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, fileName);
    }
  }, 'image/png');
}

/**
 * Сохранить изображение как JPG
 */
export function downloadAsJpg(canvas: HTMLCanvasElement, fileName: string = 'image.jpg', quality: number = 0.9): void {
  canvas.toBlob(
    (blob) => {
      if (blob) {
        downloadBlob(blob, fileName);
      }
    },
    'image/jpeg',
    quality
  );
}

/**
 * Сохранить изображение как GB7
 */
export function downloadAsGb7(canvas: HTMLCanvasElement, fileName: string = 'image.gb7', hasMask: boolean = false): void {
  const { data, width, height } = getCanvasImageData(canvas);
  
  const gb7Data = encodeGB7({ width, height, data, bitDepth: 7, hasMask }, hasMask);
  const blob = new Blob([gb7Data as BlobPart], { type: 'application/octet-stream' });
  
  downloadBlob(blob, fileName);
}

/**
 * Вспомогательная функция для загрузки blob
 */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Форматировать размер файла
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
