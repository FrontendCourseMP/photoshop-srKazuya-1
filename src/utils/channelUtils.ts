/**
 * Channel Utils
 * Утилиты для работы с цветовыми каналами
 */

export interface ChannelState {
  red: boolean;
  green: boolean;
  blue: boolean;
  alpha: boolean;
}

export interface ChannelPreview {
  canvas: HTMLCanvasElement;
  label: string;
  type: 'r' | 'g' | 'b' | 'a' | 'grayscale' | 'rgb' | 'rgba';
}

/**
 * Получить количество каналов в изображении
 */
export function getChannelCount(width: number, height: number, data: Uint8Array): 1 | 2 | 3 | 4 {
  const pixelCount = width * height;
  const dataLength = data.length;
  
  if (dataLength === pixelCount) return 1; // Grayscale
  if (dataLength === pixelCount * 2) return 2; // Grayscale + Alpha
  if (dataLength === pixelCount * 3) return 3; // RGB
  if (dataLength === pixelCount * 4) return 4; // RGBA
  
  return 4; // Default to RGBA
}

/**
 * Извлечь отдельный канал из изображения
 */
export function extractChannel(
  imageData: Uint8Array,
  width: number,
  height: number,
  channelIndex: 0 | 1 | 2 | 3
): Uint8Array {
  const pixelCount = width * height;
  const bytesPerPixel = imageData.length / pixelCount;
  const channelData = new Uint8Array(pixelCount);
  
  for (let i = 0; i < pixelCount; i++) {
    const pixelStart = i * bytesPerPixel;
    channelData[i] = imageData[pixelStart + channelIndex];
  }
  
  return channelData;
}

/**
 * Создать превью канала (только один канал в градациях серого)
 */
export function createChannelPreview(
  channelData: Uint8Array,
  width: number,
  height: number
): CanvasImageData {
  const pixelCount = width * height;
  const rgbaData = new Uint8Array(pixelCount * 4);
  
  for (let i = 0; i < pixelCount; i++) {
    const value = channelData[i];
    const rgbaIndex = i * 4;
    
    // Показываем канал в градациях серого
    rgbaData[rgbaIndex] = value;      // R
    rgbaData[rgbaIndex + 1] = value;  // G
    rgbaData[rgbaIndex + 2] = value;  // B
    rgbaData[rgbaIndex + 3] = 255;    // A
  }
  
  return {
    data: rgbaData,
    width,
    height,
  };
}

/**
 * Создать превью RGB изображения
 */
export function createRgbPreview(
  imageData: Uint8Array,
  width: number,
  height: number
): CanvasImageData {
  const pixelCount = width * height;
  const bytesPerPixel = imageData.length / pixelCount;
  const rgbaData = new Uint8Array(pixelCount * 4);
  
  for (let i = 0; i < pixelCount; i++) {
    const pixelStart = i * bytesPerPixel;
    const rgbaIndex = i * 4;
    
    if (bytesPerPixel === 1) {
      // Grayscale
      const gray = imageData[pixelStart];
      rgbaData[rgbaIndex] = gray;
      rgbaData[rgbaIndex + 1] = gray;
      rgbaData[rgbaIndex + 2] = gray;
      rgbaData[rgbaIndex + 3] = 255;
    } else if (bytesPerPixel === 2) {
      // Grayscale + Alpha
      const gray = imageData[pixelStart];
      const alpha = imageData[pixelStart + 1];
      rgbaData[rgbaIndex] = gray;
      rgbaData[rgbaIndex + 1] = gray;
      rgbaData[rgbaIndex + 2] = gray;
      rgbaData[rgbaIndex + 3] = alpha;
    } else if (bytesPerPixel === 3) {
      // RGB
      rgbaData[rgbaIndex] = imageData[pixelStart];
      rgbaData[rgbaIndex + 1] = imageData[pixelStart + 1];
      rgbaData[rgbaIndex + 2] = imageData[pixelStart + 2];
      rgbaData[rgbaIndex + 3] = 255;
    } else if (bytesPerPixel === 4) {
      // RGBA
      rgbaData[rgbaIndex] = imageData[pixelStart];
      rgbaData[rgbaIndex + 1] = imageData[pixelStart + 1];
      rgbaData[rgbaIndex + 2] = imageData[pixelStart + 2];
      rgbaData[rgbaIndex + 3] = imageData[pixelStart + 3];
    }
  }
  
  return {
    data: rgbaData,
    width,
    height,
  };
}

/**
 * Создать превью альфа-канала
 */
export function createAlphaPreview(
  imageData: Uint8Array,
  width: number,
  height: number
): CanvasImageData {
  const pixelCount = width * height;
  const bytesPerPixel = imageData.length / pixelCount;
  const rgbaData = new Uint8Array(pixelCount * 4);
  
  for (let i = 0; i < pixelCount; i++) {
    const pixelStart = i * bytesPerPixel;
    const rgbaIndex = i * 4;
    
    let alpha = 255;
    if (bytesPerPixel === 2) {
      // Grayscale + Alpha
      alpha = imageData[pixelStart + 1];
    } else if (bytesPerPixel === 4) {
      // RGBA
      alpha = imageData[pixelStart + 3];
    }
    
    // Альфа показывается в градациях серого
    rgbaData[rgbaIndex] = alpha;
    rgbaData[rgbaIndex + 1] = alpha;
    rgbaData[rgbaIndex + 2] = alpha;
    rgbaData[rgbaIndex + 3] = 255;
  }
  
  return {
    data: rgbaData,
    width,
    height,
  };
}

/**
 * Применить фильтр каналов к изображению
 */
export function applyChannelFilter(
  originalImageData: Uint8Array,
  width: number,
  height: number,
  channels: ChannelState
): Uint8Array {
  const pixelCount = width * height;
  const bytesPerPixel = originalImageData.length / pixelCount;
  const filteredData = new Uint8Array(originalImageData);
  
  const isOnlyAlphaEnabled = channels.alpha && !channels.red && !channels.green && !channels.blue;

  for (let i = 0; i < pixelCount; i++) {
    const pixelStart = i * bytesPerPixel;
    
    if (bytesPerPixel === 1) {
      // Grayscale - если отключен, делаем черным
      if (!channels.red) {
        filteredData[pixelStart] = 0;
      }
    } else if (bytesPerPixel === 2) {
      // Grayscale + Alpha
      if (isOnlyAlphaEnabled) {
        const alpha = originalImageData[pixelStart + 1];
        filteredData[pixelStart] = alpha;
        filteredData[pixelStart + 1] = 255;
      } else {
        if (!channels.red) {
          filteredData[pixelStart] = 0;
        }
        if (!channels.alpha) {
          filteredData[pixelStart + 1] = 0;
        }
      }
    } else if (bytesPerPixel === 3) {
      // RGB
      if (!channels.red) filteredData[pixelStart] = 0;
      if (!channels.green) filteredData[pixelStart + 1] = 0;
      if (!channels.blue) filteredData[pixelStart + 2] = 0;
    } else if (bytesPerPixel === 4) {
      // RGBA
      if (isOnlyAlphaEnabled) {
        const alpha = originalImageData[pixelStart + 3];
        filteredData[pixelStart] = alpha;
        filteredData[pixelStart + 1] = alpha;
        filteredData[pixelStart + 2] = alpha;
        filteredData[pixelStart + 3] = 255;
      } else {
        if (!channels.red) filteredData[pixelStart] = 0;
        if (!channels.green) filteredData[pixelStart + 1] = 0;
        if (!channels.blue) filteredData[pixelStart + 2] = 0;
        if (!channels.alpha) filteredData[pixelStart + 3] = 0;
      }
    }
  }
  
  return filteredData;
}

export interface CanvasImageData {
  data: Uint8Array;
  width: number;
  height: number;
}
