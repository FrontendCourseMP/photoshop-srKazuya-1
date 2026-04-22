/**
 * GB7 Format - GrayBit-7 Image Format Encoder/Decoder
 * Формат изображения в оттенках серого без сжатия для образовательных целей.
 * 7-бит на пиксель для значений серого, 8-й бит может использоваться для маски.
 */

export interface GB7Header {
  version: number;
  hasMask: boolean;
  width: number;
  height: number;
}

export interface GB7Image {
  header: GB7Header;
  data: Uint8Array;
}

export interface ImageData {
  width: number;
  height: number;
  data: Uint8Array; // RGBA format
  bitDepth: number;
  hasMask: boolean;
}

const GB7_SIGNATURE = [0x47, 0x42, 0x37, 0x1d]; // "GB7·"
const GB7_VERSION = 0x01;
const GRAYSCALE_MAX = 127; // 7-bit max value

/**
 * Кодирует RGBA изображение в GB7 формат
 */
export function encodeGB7(imageData: ImageData, hasMask: boolean = false): Uint8Array {
  const { width, height, data } = imageData;
  
  // Заголовок: сигнатура (4) + версия (1) + флаги (1) + ширина (2) + высота (2) + резерв (2) = 12 байт
  const headerSize = 12;
  const dataSize = width * height;
  const totalSize = headerSize + dataSize;
  
  const buffer = new Uint8Array(totalSize);
  let offset = 0;
  
  // Сигнатура (4 байта)
  buffer.set(GB7_SIGNATURE, offset);
  offset += 4;
  
  // Версия (1 байт)
  buffer[offset++] = GB7_VERSION;
  
  // Флаги (1 байт): бит 0 = флаг маски, биты 1-7 = зарезервированы
  buffer[offset++] = hasMask ? 0x01 : 0x00;
  
  // Ширина (2 байта, big-endian)
  buffer[offset++] = (width >> 8) & 0xff;
  buffer[offset++] = width & 0xff;
  
  // Высота (2 байта, big-endian)
  buffer[offset++] = (height >> 8) & 0xff;
  buffer[offset++] = height & 0xff;
  
  // Резерв (2 байта)
  buffer[offset++] = 0x00;
  buffer[offset++] = 0x00;
  
  // Данные изображения
  for (let i = 0; i < width * height; i++) {
    const rgbaIndex = i * 4;
    const r = data[rgbaIndex];
    const g = data[rgbaIndex + 1];
    const b = data[rgbaIndex + 2];
    const a = data[rgbaIndex + 3];
    
    // Конвертируем RGB в оттенки серого (Y = 0.299*R + 0.587*G + 0.114*B)
    let gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    
    // Масштабируем 0-255 в 0-127 (7-bit)
    gray = Math.floor((gray / 255) * GRAYSCALE_MAX);
    
    let pixelByte = gray & 0x7f; // 7 младших бит для серого
    
    if (hasMask) {
      // Бит 7 используется для маски
      // 1 = непрозрачный, 0 = прозрачный
      const maskBit = a > 127 ? 1 : 0;
      pixelByte |= (maskBit << 7);
    }
    
    buffer[offset++] = pixelByte;
  }
  
  return buffer;
}

/**
 * Декодирует GB7 формат в RGBA изображение
 */
export function decodeGB7(fileData: ArrayBuffer): ImageData {
  const buffer = new Uint8Array(fileData);
  let offset = 0;
  
  // Проверка сигнатуры
  if (buffer.length < 12) {
    throw new Error('GB7: Файл слишком маленький');
  }
  
  for (let i = 0; i < 4; i++) {
    if (buffer[offset + i] !== GB7_SIGNATURE[i]) {
      throw new Error('GB7: Неверная сигнатура файла');
    }
  }
  offset += 4;
  
  // Версия
  const version = buffer[offset++];
  if (version !== GB7_VERSION) {
    throw new Error(`GB7: Неподдерживаемая версия ${version}`);
  }
  
  // Флаги
  const flags = buffer[offset++];
  const hasMask = (flags & 0x01) !== 0;
  
  // Ширина (big-endian)
  const width = (buffer[offset] << 8) | buffer[offset + 1];
  offset += 2;
  
  // Высота (big-endian)
  const height = (buffer[offset] << 8) | buffer[offset + 1];
  offset += 2;
  
  // Резерв (игнорируем)
  offset += 2;
  
  // Проверка размера данных
  const expectedDataSize = width * height;
  const remainingSize = buffer.length - offset;
  
  if (remainingSize < expectedDataSize) {
    throw new Error(`GB7: Недостаточно данных. Ожидается ${expectedDataSize}, получено ${remainingSize}`);
  }
  
  // Декодирование данных
  const rgbaData = new Uint8Array(width * height * 4);
  
  for (let i = 0; i < width * height; i++) {
    const pixelByte = buffer[offset + i];
    
    // 7 младших бит - значение серого
    const gray = pixelByte & 0x7f;
    
    // Масштабируем 0-127 в 0-255
    const grayValue = Math.floor((gray / GRAYSCALE_MAX) * 255);
    
    // Определяем альфа-канал
    let alpha = 255;
    if (hasMask) {
      // Бит 7 - маска (1 = видимый, 0 = прозрачный)
      const maskBit = (pixelByte >> 7) & 0x01;
      alpha = maskBit === 1 ? 255 : 0;
    }
    
    // Записываем в RGBA
    const rgbaIndex = i * 4;
    rgbaData[rgbaIndex] = grayValue;     // R
    rgbaData[rgbaIndex + 1] = grayValue; // G
    rgbaData[rgbaIndex + 2] = grayValue; // B
    rgbaData[rgbaIndex + 3] = alpha;     // A
  }
  
  return {
    width,
    height,
    data: rgbaData,
    bitDepth: 7,
    hasMask,
  };
}

/**
 * Получить информацию о GB7 файле без полного декодирования
 */
export function getGB7Info(fileData: ArrayBuffer): { width: number; height: number; hasMask: boolean } {
  const buffer = new Uint8Array(fileData);
  
  if (buffer.length < 12) {
    throw new Error('GB7: Файл слишком маленький');
  }
  
  // Проверка сигнатуры
  for (let i = 0; i < 4; i++) {
    if (buffer[i] !== GB7_SIGNATURE[i]) {
      throw new Error('GB7: Неверная сигнатура файла');
    }
  }
  
  const version = buffer[4];
  if (version !== GB7_VERSION) {
    throw new Error(`GB7: Неподдерживаемая версия ${version}`);
  }
  
  const flags = buffer[5];
  const hasMask = (flags & 0x01) !== 0;
  
  const width = (buffer[6] << 8) | buffer[7];
  const height = (buffer[8] << 8) | buffer[9];
  
  return { width, height, hasMask };
}
