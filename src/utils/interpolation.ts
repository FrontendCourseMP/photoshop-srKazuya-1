export type InterpolationMethod = 'nearest' | 'bilinear';

type PixelReader = (x: number, y: number, channel: number) => number;

const INTERPOLATION_LABELS: Record<InterpolationMethod, string> = {
  nearest: 'Ближайший сосед',
  bilinear: 'Билинейная',
};

const INTERPOLATION_DESCRIPTIONS: Record<InterpolationMethod, string> = {
  nearest:
    'Самый быстрый алгоритм: каждый пиксель берется от ближайшего исходного. Хорош для пиксель-арта и резких границ.',
  bilinear:
    'Сглаживает результат усреднением 4 соседних пикселей. Подходит для фото и дает меньше лесенок при изменении размера.',
};

export function getInterpolationLabel(method: InterpolationMethod): string {
  return INTERPOLATION_LABELS[method];
}

export function getInterpolationDescription(method: InterpolationMethod): string {
  return INTERPOLATION_DESCRIPTIONS[method];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createReader(data: Uint8Array, width: number, channels: number): PixelReader {
  return (x: number, y: number, channel: number) => {
    const index = (y * width + x) * channels + channel;
    return data[index] ?? 0;
  };
}

function sampleNearest(
  read: PixelReader,
  srcX: number,
  srcY: number,
  channel: number,
  width: number,
  height: number
): number {
  const x = clamp(Math.round(srcX), 0, width - 1);
  const y = clamp(Math.round(srcY), 0, height - 1);
  return read(x, y, channel);
}

function sampleBilinear(
  read: PixelReader,
  srcX: number,
  srcY: number,
  channel: number,
  width: number,
  height: number
): number {
  const x0 = clamp(Math.floor(srcX), 0, width - 1);
  const y0 = clamp(Math.floor(srcY), 0, height - 1);
  const x1 = clamp(x0 + 1, 0, width - 1);
  const y1 = clamp(y0 + 1, 0, height - 1);

  const dx = clamp(srcX - x0, 0, 1);
  const dy = clamp(srcY - y0, 0, 1);

  const p00 = read(x0, y0, channel);
  const p10 = read(x1, y0, channel);
  const p01 = read(x0, y1, channel);
  const p11 = read(x1, y1, channel);

  const top = p00 + (p10 - p00) * dx;
  const bottom = p01 + (p11 - p01) * dx;
  return Math.round(top + (bottom - top) * dy);
}

export function resizeImageData(
  sourceData: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  method: InterpolationMethod = 'bilinear',
  channels = 4
): Uint8Array {
  if (targetWidth <= 0 || targetHeight <= 0) {
    throw new Error('Размер результата должен быть больше нуля');
  }

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('Размер исходного изображения должен быть больше нуля');
  }

  if (sourceWidth === targetWidth && sourceHeight === targetHeight) {
    return new Uint8Array(sourceData);
  }

  const output = new Uint8Array(targetWidth * targetHeight * channels);
  const read = createReader(sourceData, sourceWidth, channels);

  const xScale = sourceWidth / targetWidth;
  const yScale = sourceHeight / targetHeight;

  for (let y = 0; y < targetHeight; y += 1) {
    const srcY = (y + 0.5) * yScale - 0.5;
    for (let x = 0; x < targetWidth; x += 1) {
      const srcX = (x + 0.5) * xScale - 0.5;
      const outIndex = (y * targetWidth + x) * channels;

      for (let channel = 0; channel < channels; channel += 1) {
        const value =
          method === 'nearest'
            ? sampleNearest(read, srcX, srcY, channel, sourceWidth, sourceHeight)
            : sampleBilinear(read, srcX, srcY, channel, sourceWidth, sourceHeight);
        output[outIndex + channel] = clamp(Math.round(value), 0, 255);
      }
    }
  }

  return output;
}
