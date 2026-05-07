import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createDefaultLevelsState,
  gammaToMidpoint,
  getHistogram,
  histogramValueToHeight,
  midpointToGamma,
  type HistogramScale,
  type LevelsState,
  type LevelsTargetChannel,
} from '../utils/levelsUtils';
import '../styles/levelsDialog.css';

interface LevelsDialogProps {
  isOpen: boolean;
  imageData?: Uint8Array;
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

export function LevelsDialog({
  isOpen,
  imageData,
  levelsState,
  onPreviewChange,
  onApply,
  onCancel,
}: LevelsDialogProps) {
  const sanitizeSettings = (
    settings: LevelsState[LevelsTargetChannel]
  ): LevelsState[LevelsTargetChannel] => {
    const safeBlack = Math.max(0, Math.min(254, Math.round(settings.inputBlack)));
    const safeWhite = Math.max(safeBlack + 1, Math.min(255, Math.round(settings.inputWhite)));
    const safeGamma = Math.max(0.1, Math.min(9.9, settings.gamma));
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
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setLocalLevels(levelsState);
    setActiveChannel('master');
    setHistogramScale('linear');
    setPreviewEnabled(true);
    const width = Math.min(760, window.innerWidth - 40);
    const centerX = Math.max(20, Math.round((window.innerWidth - width) / 2));
    const centerY = Math.max(20, Math.round((window.innerHeight - 580) / 2));
    setPosition({ x: centerX, y: centerY });
  }, [isOpen, levelsState]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onMove = (event: MouseEvent) => {
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
      dragRef.current = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    onPreviewChange(previewEnabled ? localLevels : null);
  }, [isOpen, previewEnabled, localLevels, onPreviewChange]);

  const histogram = useMemo(() => {
    if (!imageData) {
      return new Array<number>(256).fill(0);
    }
    return getHistogram(imageData, activeChannel);
  }, [imageData, activeChannel]);

  const maxHistogramValue = useMemo(
    () => histogram.reduce((max, value) => (value > max ? value : max), 0),
    [histogram]
  );

  const channelSettings = localLevels[activeChannel] ?? createDefaultLevelsState().master;
  const midpointValue = gammaToMidpoint(
    channelSettings.inputBlack,
    channelSettings.inputWhite,
    channelSettings.gamma
  );

  const setChannelSettings = (next: Partial<LevelsState[LevelsTargetChannel]>) => {
    setLocalLevels((prev) => ({
      ...prev,
      [activeChannel]: sanitizeSettings({
        ...prev[activeChannel],
        ...next,
      }),
    }));
  };

  if (!isOpen) {
    return null;
  }

  return (
    <dialog
      open
      className="levels-dialog"
      aria-label="Уровни"
      style={position ? { left: `${position.x}px`, top: `${position.y}px` } : undefined}
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

      {!imageData ? (
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
            <div className="histogram-bars" aria-label="Гистограмма">
              {histogram.map((value, index) => {
                const height = histogramValueToHeight(value, maxHistogramValue, histogramScale);
                return (
                  <span
                    key={`hist-${index}`}
                    className="histogram-bar"
                    style={{ height: `${height}%` }}
                  />
                );
              })}
            </div>
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
              max={channelSettings.inputWhite - 1}
              value={channelSettings.inputBlack}
              onChange={(e) => {
                const nextBlack = Number(e.target.value);
                const midpoint = Math.max(nextBlack + 1, midpointValue);
                const safeMid = Math.min(channelSettings.inputWhite - 1, midpoint);
                setChannelSettings({
                  inputBlack: nextBlack,
                  gamma: midpointToGamma(nextBlack, channelSettings.inputWhite, safeMid),
                });
              }}
            />

            <label htmlFor="input-midpoint">Полутона (Gamma): {channelSettings.gamma.toFixed(2)}</label>
            <input
              id="input-midpoint"
              type="range"
              min={channelSettings.inputBlack + 1}
              max={channelSettings.inputWhite - 1}
              value={Math.min(channelSettings.inputWhite - 1, Math.max(channelSettings.inputBlack + 1, midpointValue))}
              onChange={(e) => {
                const midpoint = Number(e.target.value);
                setChannelSettings({
                  gamma: midpointToGamma(channelSettings.inputBlack, channelSettings.inputWhite, midpoint),
                });
              }}
            />

            <label htmlFor="input-white">Белая точка: {channelSettings.inputWhite}</label>
            <input
              id="input-white"
              type="range"
              min={channelSettings.inputBlack + 1}
              max={255}
              value={channelSettings.inputWhite}
              onChange={(e) => {
                const nextWhite = Number(e.target.value);
                const midpoint = Math.min(nextWhite - 1, midpointValue);
                const safeMid = Math.max(channelSettings.inputBlack + 1, midpoint);
                setChannelSettings({
                  inputWhite: nextWhite,
                  gamma: midpointToGamma(channelSettings.inputBlack, nextWhite, safeMid),
                });
              }}
            />
          </div>

          <label className="levels-preview-toggle">
            <input
              type="checkbox"
              checked={previewEnabled}
              onChange={(e) => setPreviewEnabled(e.target.checked)}
            />
            <span>Предпросмотр</span>
          </label>
        </>
      )}

      <div className="levels-actions">
        <button
          type="button"
          onClick={() => {
            const reset = createDefaultLevelsState();
            setLocalLevels(reset);
          }}
        >
          Сброс
        </button>
        <button type="button" onClick={onCancel}>Отмена</button>
        <button
          type="button"
          disabled={!imageData}
          onClick={() => onApply(localLevels)}
        >
          Применить
        </button>
      </div>
    </dialog>
  );
}
