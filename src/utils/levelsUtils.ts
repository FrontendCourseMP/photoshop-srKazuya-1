export type LevelsTargetChannel = 'master' | 'red' | 'green' | 'blue' | 'alpha';
export type HistogramScale = 'linear' | 'log';

export interface LevelsChannelSettings {
  inputBlack: number;
  inputWhite: number;
  gamma: number;
}

export type LevelsState = Record<LevelsTargetChannel, LevelsChannelSettings>;

const DEFAULT_LEVELS: LevelsChannelSettings = {
  inputBlack: 0,
  inputWhite: 255,
  gamma: 1,
};

export function createDefaultLevelsState(): LevelsState {
  return {
    master: { ...DEFAULT_LEVELS },
    red: { ...DEFAULT_LEVELS },
    green: { ...DEFAULT_LEVELS },
    blue: { ...DEFAULT_LEVELS },
    alpha: { ...DEFAULT_LEVELS },
  };
}

export function getHistogram(
  imageData: Uint8Array,
  channel: LevelsTargetChannel
): number[] {
  const bins = new Array<number>(256).fill(0);
  const pixelCount = Math.floor(imageData.length / 4);

  for (let i = 0; i < pixelCount; i += 1) {
    const offset = i * 4;
    const r = imageData[offset];
    const g = imageData[offset + 1];
    const b = imageData[offset + 2];
    const a = imageData[offset + 3];

    let value = 0;
    if (channel === 'master') {
      value = Math.round((0.299 * r) + (0.587 * g) + (0.114 * b));
    } else if (channel === 'red') {
      value = r;
    } else if (channel === 'green') {
      value = g;
    } else if (channel === 'blue') {
      value = b;
    } else {
      value = a;
    }

    bins[Math.max(0, Math.min(255, value))] += 1;
  }

  return bins;
}

function applyLevelsValue(value: number, settings: LevelsChannelSettings): number {
  const black = settings.inputBlack;
  const white = settings.inputWhite;
  const gamma = Math.max(0.1, Math.min(9.9, settings.gamma));

  if (white <= black) {
    return value;
  }
  if (value <= black) {
    return 0;
  }
  if (value >= white) {
    return 255;
  }

  const normalized = (value - black) / (white - black);
  const corrected = Math.pow(normalized, gamma);
  return Math.round(corrected * 255);
}

export function applyLevelsToImage(
  imageData: Uint8Array,
  levels: LevelsState
): Uint8Array {
  const result = new Uint8Array(imageData.length);
  const pixelCount = Math.floor(imageData.length / 4);

  for (let i = 0; i < pixelCount; i += 1) {
    const offset = i * 4;

    let r = imageData[offset];
    let g = imageData[offset + 1];
    let b = imageData[offset + 2];
    let a = imageData[offset + 3];

    r = applyLevelsValue(r, levels.master);
    g = applyLevelsValue(g, levels.master);
    b = applyLevelsValue(b, levels.master);

    r = applyLevelsValue(r, levels.red);
    g = applyLevelsValue(g, levels.green);
    b = applyLevelsValue(b, levels.blue);
    a = applyLevelsValue(a, levels.alpha);

    result[offset] = r;
    result[offset + 1] = g;
    result[offset + 2] = b;
    result[offset + 3] = a;
  }

  return result;
}

export function histogramValueToHeight(
  value: number,
  maxValue: number,
  scale: HistogramScale
): number {
  if (maxValue <= 0) {
    return 0;
  }

  if (scale === 'log') {
    const top = Math.log1p(maxValue);
    return (Math.log1p(value) / top) * 100;
  }

  return (value / maxValue) * 100;
}

export function gammaToMidpoint(black: number, white: number, gamma: number): number {
  const safeGamma = Math.max(0.1, Math.min(9.9, gamma));
  const normalized = Math.pow(0.5, 1 / safeGamma);
  return Math.round(black + (white - black) * normalized);
}

export function midpointToGamma(black: number, white: number, midpoint: number): number {
  if (white <= black + 1) {
    return 1;
  }
  const normalized = (midpoint - black) / (white - black);
  const clamped = Math.max(0.001, Math.min(0.999, normalized));
  const gamma = Math.log(0.5) / Math.log(clamped);
  return Math.max(0.1, Math.min(9.9, gamma));
}
