import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createDefaultLevelsState,
  gammaToMidpoint,
  getHistogram,
  getHistogramDisplayMax,
  histogramValueToHeight,
  midpointToGamma,
  type HistogramScale,
  type LevelsState,
  type LevelsTargetChannel,
} from '../utils/levelsUtils';
import '../styles/levelsDialog.css';

interface LevelsDialogProps {
  isOpen: boolean;
  histogramData?: Uint8Array;
  levelsState: LevelsState;
  onPreviewChange: (nextState: LevelsState | null) => void;
  onApply: (nextState: LevelsState) => void;
  onCancel: () => void;
}

const CHANNEL_OPTIONS: Array<{ value: LevelsTargetChannel; label: string }> = [
  { value: 'master', label: 'Master (RGB)' },
  { value: 'red', label: 'Red' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
  { value: 'alpha', label: 'Alpha' },
];

const DEFAULT_WIDTH = 520;
/** Вмещает заголовок, гистограмму, слайдеры и футер без прокрутки */
const DEFAULT_HEIGHT = 640;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 360;
const PREVIEW_THROTTLE_MS = 48;
const MIN_TONE_GAP = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function fillHistogramBackground(
  ctx: CanvasRenderingContext2D,
  channel: LevelsTargetChannel,
  width: number,
  height: number
): void {
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  switch (channel) {
    case 'red':
      gradient.addColorStop(0, '#000000');
      gradient.addColorStop(1, '#ff0000');
      break;
    case 'green':
      gradient.addColorStop(0, '#000000');
      gradient.addColorStop(1, '#00ff00');
      break;
    case 'blue':
      gradient.addColorStop(0, '#000000');
      gradient.addColorStop(1, '#0000ff');
      break;
    case 'alpha':
      gradient.addColorStop(0, '#000000');
      gradient.addColorStop(0.5, '#808080');
      gradient.addColorStop(1, '#ffffff');
      break;
    default:
      gradient.addColorStop(0, '#000000');
      gradient.addColorStop(1, '#ffffff');
      break;
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function HistogramCanvas({
  histogram,
  maxValue,
  scale,
  channel,
}: {
  histogram: number[];
  maxValue: number;
  scale: HistogramScale;
  channel: LevelsTargetChannel;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width <= 0 || height <= 0) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    fillHistogramBackground(ctx, channel, width, height);

    const barWidth = width / 256;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';

    for (let index = 0; index < 256; index += 1) {
      const count = histogram[index];
      if (count <= 0) {
        continue;
      }
      const normalized = histogramValueToHeight(count, maxValue, scale) / 100;
      const barHeight = Math.max(1, Math.round(normalized * height));
      ctx.fillRect(index * barWidth, height - barHeight, Math.max(1, barWidth), barHeight);
    }
  }, [histogram, maxValue, scale, channel]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) {
      return;
    }
    const observer = new ResizeObserver(() => draw());
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [draw]);

  return (
    <div ref={wrapRef} className="histogram-canvas-wrap">
      <canvas ref={canvasRef} className="histogram-canvas" aria-hidden="true" />
    </div>
  );
}

export function LevelsDialog({
  isOpen,
  histogramData,
  levelsState,
  onPreviewChange,
  onApply,
  onCancel,
}: LevelsDialogProps) {
  const sanitizeSettings = (
    settings: LevelsState[LevelsTargetChannel]
  ): LevelsState[LevelsTargetChannel] => {
    const safeBlack = clamp(Math.round(settings.inputBlack), 0, 255 - MIN_TONE_GAP);
    const safeWhite = clamp(Math.round(settings.inputWhite), safeBlack + MIN_TONE_GAP, 255);
    const midpoint = clamp(
      gammaToMidpoint(safeBlack, safeWhite, settings.gamma),
      safeBlack + 1,
      safeWhite - 1
    );
    const safeGamma = clamp(midpointToGamma(safeBlack, safeWhite, midpoint), 0.1, 9.9);
    return {
      inputBlack: safeBlack,
      inputWhite: safeWhite,
      gamma: safeGamma,
    };
  };

  const [localLevels, setLocalLevels] = useState<LevelsState>(levelsState);
  const [activeChannel, setActiveChannel] = useState<LevelsTargetChannel>('master');
  const [histogramScale, setHistogramScale] = useState<HistogramScale>('linear');
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });

  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    originW: number;
    originH: number;
  } | null>(null);
  const localLevelsRef = useRef(localLevels);
  const previewEnabledRef = useRef(previewEnabled);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  localLevelsRef.current = localLevels;
  previewEnabledRef.current = previewEnabled;

  const clearPreviewTimer = () => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  };

  const emitPreview = useCallback(
    (immediate = false) => {
      const payload = previewEnabledRef.current ? localLevelsRef.current : null;
      if (immediate) {
        clearPreviewTimer();
        onPreviewChange(payload);
        return;
      }
      if (previewTimerRef.current) {
        return;
      }
      previewTimerRef.current = setTimeout(() => {
        previewTimerRef.current = null;
        onPreviewChange(previewEnabledRef.current ? localLevelsRef.current : null);
      }, PREVIEW_THROTTLE_MS);
    },
    [onPreviewChange]
  );

  useEffect(() => {
    if (!isOpen) {
      clearPreviewTimer();
      return;
    }
    setLocalLevels(levelsState);
    localLevelsRef.current = levelsState;
    setActiveChannel('master');
    setHistogramScale('linear');
    setPreviewEnabled(true);
    previewEnabledRef.current = true;
    setSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });

    const width = Math.min(DEFAULT_WIDTH, window.innerWidth - 40);
    const centerX = Math.max(20, Math.round((window.innerWidth - width) / 2));
    const centerY = Math.max(20, Math.round((window.innerHeight - DEFAULT_HEIGHT) / 2));
    setPosition({ x: centerX, y: centerY });
    onPreviewChange(levelsState);
  }, [isOpen, levelsState, onPreviewChange]);

  useEffect(() => () => clearPreviewTimer(), []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onMove = (event: MouseEvent) => {
      if (resizeRef.current) {
        const nextWidth = Math.max(
          MIN_WIDTH,
          resizeRef.current.originW + (event.clientX - resizeRef.current.startX)
        );
        const nextHeight = Math.max(
          MIN_HEIGHT,
          resizeRef.current.originH + (event.clientY - resizeRef.current.startY)
        );
        setSize({ width: nextWidth, height: nextHeight });
        return;
      }
      if (!dragRef.current) {
        return;
      }
      const nextX = dragRef.current.originX + (event.clientX - dragRef.current.startX);
      const nextY = dragRef.current.originY + (event.clientY - dragRef.current.startY);
      setPosition({
        x: Math.max(8, nextX),
        y: Math.max(8, nextY),
      });
    };

    const onUp = () => {
      if (resizeRef.current) {
        resizeRef.current = null;
      }
      if (dragRef.current) {
        dragRef.current = null;
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isOpen]);

  const histogram = useMemo(() => {
    if (!histogramData) {
      return new Array<number>(256).fill(0);
    }
    return getHistogram(histogramData, activeChannel, localLevels);
  }, [histogramData, activeChannel, localLevels]);

  const maxHistogramValue = useMemo(
    () => getHistogramDisplayMax(histogram, histogramScale),
    [histogram, histogramScale]
  );

  const channelSettings = localLevels[activeChannel] ?? createDefaultLevelsState().master;
  const midpointValue = gammaToMidpoint(
    channelSettings.inputBlack,
    channelSettings.inputWhite,
    channelSettings.gamma
  );
  const midpointMin = channelSettings.inputBlack + 1;
  const midpointMax = channelSettings.inputWhite - 1;
  const clampedMidpoint = clamp(midpointValue, midpointMin, midpointMax);

  const updateChannelSettings = (
    updater: (current: LevelsState[LevelsTargetChannel]) => LevelsState[LevelsTargetChannel]
  ) => {
    setLocalLevels((prev) => {
      const current = sanitizeSettings(prev[activeChannel]);
      const nextSettings = sanitizeSettings(updater(current));
      const updated = {
        ...prev,
        [activeChannel]: nextSettings,
      };
      localLevelsRef.current = updated;
      emitPreview(false);
      return updated;
    });
  };

  const handleSliderPointerUp = () => {
    emitPreview(true);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <dialog
      open
      className="levels-dialog"
      aria-label="Уровни"
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              width: `${size.width}px`,
              height: `${size.height}px`,
            }
          : undefined
      }
    >
      <div
        className="levels-header"
        onMouseDown={(event) => {
          if (!position) {
            return;
          }
          dragRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            originX: position.x,
            originY: position.y,
          };
        }}
      >
        <h3>Уровни</h3>
      </div>

      <div className="levels-content">
        {!histogramData ? (
          <p className="levels-empty">Загрузите изображение, чтобы использовать Levels.</p>
        ) : (
          <>
            <div className="levels-controls-row">
              <label className="levels-label" htmlFor="levels-channel-select">Канал</label>
              <select
                id="levels-channel-select"
                value={activeChannel}
                onChange={(e) => setActiveChannel(e.target.value as LevelsTargetChannel)}
                className="levels-select"
              >
                {CHANNEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="levels-controls-row">
              <label className="levels-label" htmlFor="levels-histogram-scale">Гистограмма</label>
              <select
                id="levels-histogram-scale"
                value={histogramScale}
                onChange={(e) => setHistogramScale(e.target.value as HistogramScale)}
                className="levels-select"
              >
                <option value="linear">Линейная</option>
                <option value="log">Логарифмическая</option>
              </select>
            </div>

            <div className="histogram-wrap">
              <HistogramCanvas
                histogram={histogram}
                maxValue={maxHistogramValue}
                scale={histogramScale}
                channel={activeChannel}
              />
              <div className="histogram-axis">
                <span>0</span>
                <span>255</span>
              </div>
            </div>

            <div className="levels-sliders">
              <label htmlFor="input-black">Черная точка: {channelSettings.inputBlack}</label>
              <input
                id="input-black"
                type="range"
                min={0}
                max={channelSettings.inputWhite - MIN_TONE_GAP}
                value={channelSettings.inputBlack}
                onChange={(e) => {
                  updateChannelSettings((current) => {
                    const nextBlack = clamp(
                      Number(e.target.value),
                      0,
                      current.inputWhite - MIN_TONE_GAP
                    );
                    const currentMidpoint = clamp(
                      gammaToMidpoint(current.inputBlack, current.inputWhite, current.gamma),
                      current.inputBlack + 1,
                      current.inputWhite - 1
                    );
                    const safeMid = clamp(currentMidpoint, nextBlack + 1, current.inputWhite - 1);
                    return {
                      ...current,
                      inputBlack: nextBlack,
                      gamma: midpointToGamma(nextBlack, current.inputWhite, safeMid),
                    };
                  });
                }}
                onPointerUp={handleSliderPointerUp}
                onPointerCancel={handleSliderPointerUp}
              />

              <label htmlFor="input-midpoint">
                Полутона (Gamma): {channelSettings.gamma.toFixed(2)}
              </label>
              <input
                id="input-midpoint"
                type="range"
                min={midpointMin}
                max={midpointMax}
                value={clampedMidpoint}
                onChange={(e) => {
                  updateChannelSettings((current) => {
                    const localMidMin = current.inputBlack + 1;
                    const localMidMax = current.inputWhite - 1;
                    const midpoint = clamp(Number(e.target.value), localMidMin, localMidMax);
                    return {
                      ...current,
                      gamma: midpointToGamma(current.inputBlack, current.inputWhite, midpoint),
                    };
                  });
                }}
                onPointerUp={handleSliderPointerUp}
                onPointerCancel={handleSliderPointerUp}
              />

              <label htmlFor="input-white">Белая точка: {channelSettings.inputWhite}</label>
              <input
                id="input-white"
                type="range"
                min={channelSettings.inputBlack + MIN_TONE_GAP}
                max={255}
                value={channelSettings.inputWhite}
                onChange={(e) => {
                  updateChannelSettings((current) => {
                    const nextWhite = clamp(
                      Number(e.target.value),
                      current.inputBlack + MIN_TONE_GAP,
                      255
                    );
                    const currentMidpoint = clamp(
                      gammaToMidpoint(current.inputBlack, current.inputWhite, current.gamma),
                      current.inputBlack + 1,
                      current.inputWhite - 1
                    );
                    const safeMid = clamp(currentMidpoint, current.inputBlack + 1, nextWhite - 1);
                    return {
                      ...current,
                      inputWhite: nextWhite,
                      gamma: midpointToGamma(current.inputBlack, nextWhite, safeMid),
                    };
                  });
                }}
                onPointerUp={handleSliderPointerUp}
                onPointerCancel={handleSliderPointerUp}
              />
            </div>

            <label className="levels-preview-toggle">
              <input
                type="checkbox"
                checked={previewEnabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setPreviewEnabled(enabled);
                  previewEnabledRef.current = enabled;
                  emitPreview(true);
                }}
              />
              <span>Предпросмотр</span>
            </label>
          </>
        )}
      </div>

      <div className="levels-footer">
        <div className="levels-actions">
          <button
            type="button"
            onClick={() => {
              const reset = createDefaultLevelsState();
              setLocalLevels(reset);
              localLevelsRef.current = reset;
              emitPreview(true);
            }}
          >
            Сброс
          </button>
          <button type="button" onClick={onCancel}>Отмена</button>
          <button
            type="button"
            disabled={!histogramData}
            onClick={() => onApply(localLevels)}
          >
            Применить
          </button>
        </div>
      </div>

      <div
        className="levels-resize-handle"
        role="separator"
        aria-label="Изменить размер"
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          resizeRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            originW: size.width,
            originH: size.height,
          };
        }}
      />
    </dialog>
  );
}
