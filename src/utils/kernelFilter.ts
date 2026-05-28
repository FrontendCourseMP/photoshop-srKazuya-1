export type EdgeHandling = 'black' | 'white' | 'copy';

export interface KernelChannelState {
  red: boolean;
  green: boolean;
  blue: boolean;
  alpha: boolean;
}

export interface KernelFilterSettings {
  matrix: number[];
  edgeHandling: EdgeHandling;
  channels: KernelChannelState;
}

export interface KernelPreset {
  id: string;
  name: string;
  matrix: number[];
}

export const IDENTITY_KERNEL_MATRIX = [0, 0, 0, 0, 1, 0, 0, 0, 0] as const;

export const KERNEL_PRESETS: KernelPreset[] = [
  {
    id: 'identity',
    name: 'Тождественное отображение',
    matrix: [...IDENTITY_KERNEL_MATRIX],
  },
  {
    id: 'sharpen',
    name: 'Повышение резкости',
    matrix: [0, -1, 0, -1, 5, -1, 0, -1, 0],
  },
  {
    id: 'gaussian3',
    name: 'Фильтр Гаусса (3x3)',
    matrix: [1 / 16, 2 / 16, 1 / 16, 2 / 16, 4 / 16, 2 / 16, 1 / 16, 2 / 16, 1 / 16],
  },
  {
    id: 'box',
    name: 'Прямоугольное размытие',
    matrix: [1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9],
  },
  {
    id: 'prewitt-x',
    name: 'Прюитт X',
    matrix: [-1, 0, 1, -1, 0, 1, -1, 0, 1],
  },
  {
    id: 'prewitt-y',
    name: 'Прюитт Y',
    matrix: [-1, -1, -1, 0, 0, 0, 1, 1, 1],
  },
];

export function createDefaultKernelSettings(): KernelFilterSettings {
  return {
    matrix: [...KERNEL_PRESETS[0].matrix],
    edgeHandling: 'copy',
    channels: {
      red: true,
      green: true,
      blue: true,
      alpha: false,
    },
  };
}

export function matricesApproximatelyEqual(
  left: number[],
  right: readonly number[],
  epsilon = 1e-6
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (Math.abs(left[index] - right[index]) > epsilon) {
      return false;
    }
  }
  return true;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getPixelChannel(
  data: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  channel: number,
  edgeHandling: EdgeHandling
): number {
  if (x >= 0 && x < width && y >= 0 && y < height) {
    return data[(y * width + x) * 4 + channel];
  }

  if (edgeHandling === 'black') {
    return channel === 3 ? 255 : 0;
  }

  if (edgeHandling === 'white') {
    return 255;
  }

  const safeX = clamp(x, 0, width - 1);
  const safeY = clamp(y, 0, height - 1);
  return data[(safeY * width + safeX) * 4 + channel];
}

export async function applyKernelFilterAsync(
  sourceData: Uint8Array,
  width: number,
  height: number,
  settings: KernelFilterSettings,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const output = new Uint8Array(sourceData);
  const matrix = settings.matrix;
  const processChannel = [
    settings.channels.red,
    settings.channels.green,
    settings.channels.blue,
    settings.channels.alpha,
  ];

  const chunkSize = 16;
  for (let y = 0; y < height; y += 1) {
    if (signal?.aborted) {
      throw new Error('Kernel filter aborted');
    }

    for (let x = 0; x < width; x += 1) {
      const baseIndex = (y * width + x) * 4;

      for (let channel = 0; channel < 4; channel += 1) {
        if (!processChannel[channel]) {
          output[baseIndex + channel] = sourceData[baseIndex + channel];
          continue;
        }

        let sum = 0;
        let kernelIndex = 0;
        for (let ky = -1; ky <= 1; ky += 1) {
          for (let kx = -1; kx <= 1; kx += 1) {
            const sample = getPixelChannel(
              sourceData,
              width,
              height,
              x + kx,
              y + ky,
              channel,
              settings.edgeHandling
            );
            sum += sample * matrix[kernelIndex];
            kernelIndex += 1;
          }
        }

        output[baseIndex + channel] = clamp(Math.round(sum), 0, 255);
      }
    }

    if (y % chunkSize === 0) {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 0);
      });
    }
  }

  return output;
}
