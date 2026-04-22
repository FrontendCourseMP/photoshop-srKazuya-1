/**
 * Color Utils
 * Утилиты для работы с цветами и преобразованиями
 */

export interface ColorData {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
  l: number; // Lightness in CIELAB
  a_lab: number; // a* in CIELAB
  b_lab: number; // b* in CIELAB
}

/**
 * Получить данные пикселя по координатам
 */
export function getPixelColor(
  imageData: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number
): ColorData | null {
  // Проверка границ
  if (x < 0 || x >= width || y < 0 || y >= height) {
    return null;
  }
  
  const pixelCount = width * height;
  const bytesPerPixel = imageData.length / pixelCount;
  const pixelIndex = y * width + x;
  const pixelStart = pixelIndex * bytesPerPixel;
  
  let r = 0, g = 0, b = 0, a = 255;
  
  if (bytesPerPixel === 1) {
    // Grayscale
    r = g = b = imageData[pixelStart];
  } else if (bytesPerPixel === 2) {
    // Grayscale + Alpha
    r = g = b = imageData[pixelStart];
    a = imageData[pixelStart + 1];
  } else if (bytesPerPixel === 3) {
    // RGB
    r = imageData[pixelStart];
    g = imageData[pixelStart + 1];
    b = imageData[pixelStart + 2];
  } else if (bytesPerPixel === 4) {
    // RGBA
    r = imageData[pixelStart];
    g = imageData[pixelStart + 1];
    b = imageData[pixelStart + 2];
    a = imageData[pixelStart + 3];
  }
  
  // Преобразуем в CIELAB
  const lab = rgbToLab(r, g, b);
  
  return {
    x,
    y,
    r,
    g,
    b,
    a,
    l: lab.l,
    a_lab: lab.a,
    b_lab: lab.b,
  };
}

/**
 * RGB to CIELAB преобразование
 * Стандартное преобразование для графических приложений
 */
export function rgbToLab(r: number, g: number, b: number): { l: number; a: number; b: number } {
  // Нормализуем RGB в диапазон 0-1
  let rNorm = r / 255;
  let gNorm = g / 255;
  let bNorm = b / 255;
  
  // Применяем гамма-коррекцию (sRGB)
  rNorm = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
  gNorm = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
  bNorm = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;
  
  // Преобразуем в XYZ с использованием D65 освещения
  let x = rNorm * 0.4124 + gNorm * 0.3576 + bNorm * 0.1805;
  let y = rNorm * 0.2126 + gNorm * 0.7152 + bNorm * 0.0722;
  let z = rNorm * 0.0193 + gNorm * 0.1192 + bNorm * 0.9505;
  
  // Нормализуем относительно D65 точки белого
  x = x / 0.95047;
  y = y / 1.0;
  z = z / 1.08883;
  
  // Применяем LAB преобразование
  const delta = 6 / 29;
  const f = (t: number) => {
    return t > delta * delta * delta ? Math.pow(t, 1 / 3) : t / (3 * delta * delta) + 4 / 29;
  };
  
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  
  const l = 116 * fy - 16;
  const a_lab = 500 * (fx - fy);
  const b_lab = 200 * (fy - fz);
  
  return {
    l: Math.round(l * 100) / 100,
    a: Math.round(a_lab * 100) / 100,
    b: Math.round(b_lab * 100) / 100,
  };
}

/**
 * Преобразование RGB в Hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase()}`;
}

/**
 * Форматирование цветовых данных для отображения
 */
export function formatColorData(color: ColorData): {
  hex: string;
  rgb: string;
  lab: string;
} {
  return {
    hex: rgbToHex(color.r, color.g, color.b),
    rgb: `RGB(${color.r}, ${color.g}, ${color.b})`,
    lab: `LAB(${color.l}, ${color.a_lab}, ${color.b_lab})`,
  };
}
