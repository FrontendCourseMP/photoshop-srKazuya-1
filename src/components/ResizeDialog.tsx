import { useEffect, useMemo, useState } from 'react';
import {
  getInterpolationDescription,
  getInterpolationLabel,
  type InterpolationMethod,
} from '../utils/interpolation';
import '../styles/resizeDialog.css';

type ResizeMode = 'percent' | 'pixels';

interface ResizeDialogProps {
  isOpen: boolean;
  initialWidth: number;
  initialHeight: number;
  initialMethod: InterpolationMethod;
  onApply: (payload: {
    width: number;
    height: number;
    method: InterpolationMethod;
  }) => void;
  onCancel: () => void;
}

const MIN_SIDE = 1;
const MAX_SIDE = 10000;
const MIN_PERCENT = 12;
const MAX_PERCENT = 300;

function toMegapixels(width: number, height: number): string {
  const mp = (width * height) / 1_000_000;
  return `${mp.toFixed(2)} Мп`;
}

export function ResizeDialog({
  isOpen,
  initialWidth,
  initialHeight,
  initialMethod,
  onApply,
  onCancel,
}: ResizeDialogProps) {
  const [mode, setMode] = useState<ResizeMode>('percent');
  const [keepAspect, setKeepAspect] = useState(true);
  const [method, setMethod] = useState<InterpolationMethod>(initialMethod);
  const [widthInput, setWidthInput] = useState('100');
  const [heightInput, setHeightInput] = useState('100');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setMode('percent');
    setKeepAspect(true);
    setMethod(initialMethod);
    setWidthInput('100');
    setHeightInput('100');
    setError('');
  }, [isOpen, initialMethod]);

  const aspectRatio = initialWidth / initialHeight;

  const parsedWidth = Number(widthInput);
  const parsedHeight = Number(heightInput);
  const widthValid = Number.isFinite(parsedWidth);
  const heightValid = Number.isFinite(parsedHeight);

  const targetSize = useMemo(() => {
    if (!widthValid || !heightValid) {
      return null;
    }

    if (mode === 'percent') {
      const widthPercent = Math.round(parsedWidth);
      const heightPercent = Math.round(parsedHeight);
      return {
        width: Math.max(MIN_SIDE, Math.round((initialWidth * widthPercent) / 100)),
        height: Math.max(MIN_SIDE, Math.round((initialHeight * heightPercent) / 100)),
        widthPercent,
        heightPercent,
      };
    }

    return {
      width: Math.round(parsedWidth),
      height: Math.round(parsedHeight),
      widthPercent: Math.round((parsedWidth / initialWidth) * 100),
      heightPercent: Math.round((parsedHeight / initialHeight) * 100),
    };
  }, [heightValid, initialHeight, initialWidth, mode, parsedHeight, parsedWidth, widthValid]);

  const nextMegapixels = targetSize ? toMegapixels(targetSize.width, targetSize.height) : '—';

  const validate = (): string => {
    if (!widthValid || !heightValid) {
      return 'Введите числовые значения ширины и высоты.';
    }

    if (mode === 'percent') {
      if (parsedWidth < MIN_PERCENT || parsedWidth > MAX_PERCENT) {
        return `Ширина в процентах должна быть от ${MIN_PERCENT}% до ${MAX_PERCENT}%.`;
      }
      if (parsedHeight < MIN_PERCENT || parsedHeight > MAX_PERCENT) {
        return `Высота в процентах должна быть от ${MIN_PERCENT}% до ${MAX_PERCENT}%.`;
      }
    } else {
      if (parsedWidth < MIN_SIDE || parsedWidth > MAX_SIDE) {
        return `Ширина в пикселях должна быть от ${MIN_SIDE} до ${MAX_SIDE}.`;
      }
      if (parsedHeight < MIN_SIDE || parsedHeight > MAX_SIDE) {
        return `Высота в пикселях должна быть от ${MIN_SIDE} до ${MAX_SIDE}.`;
      }
    }

    if (!targetSize) {
      return 'Не удалось вычислить итоговый размер.';
    }

    if (
      targetSize.width < MIN_SIDE ||
      targetSize.height < MIN_SIDE ||
      targetSize.width > MAX_SIDE ||
      targetSize.height > MAX_SIDE
    ) {
      return `Итоговый размер должен быть в диапазоне ${MIN_SIDE}..${MAX_SIDE} px.`;
    }

    return '';
  };

  const handleWidthChange = (value: string) => {
    setWidthInput(value);
    setError('');
    if (!keepAspect) {
      return;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return;
    }
    if (mode === 'percent') {
      setHeightInput(String(Math.round(numeric)));
      return;
    }
    setHeightInput(String(Math.round(numeric / aspectRatio)));
  };

  const handleHeightChange = (value: string) => {
    setHeightInput(value);
    setError('');
    if (!keepAspect) {
      return;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return;
    }
    if (mode === 'percent') {
      setWidthInput(String(Math.round(numeric)));
      return;
    }
    setWidthInput(String(Math.round(numeric * aspectRatio)));
  };

  const handleModeChange = (nextMode: ResizeMode) => {
    if (nextMode === mode) {
      return;
    }
    setMode(nextMode);
    setError('');
    if (nextMode === 'percent') {
      setWidthInput('100');
      setHeightInput('100');
      return;
    }
    setWidthInput(String(initialWidth));
    setHeightInput(String(initialHeight));
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="resize-dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <dialog
        open
        className="resize-dialog"
        aria-label="Изменение размера изображения"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="resize-dialog-header">
          <h3>Размер изображения</h3>
        </div>

        <div className="resize-dialog-content">
          <div className="resize-meta">
            <span>До: {initialWidth} × {initialHeight} px ({toMegapixels(initialWidth, initialHeight)})</span>
            <span>После: {targetSize ? `${targetSize.width} × ${targetSize.height} px (${nextMegapixels})` : '—'}</span>
          </div>

          <label className="resize-field">
            <span>Единицы</span>
            <select value={mode} onChange={(e) => handleModeChange(e.target.value as ResizeMode)}>
              <option value="percent">Проценты</option>
              <option value="pixels">Пиксели</option>
            </select>
          </label>

          <div className="resize-grid">
            <label className="resize-field">
              <span>Ширина {mode === 'percent' ? '(%)' : '(px)'}</span>
              <input
                type="number"
                min={mode === 'percent' ? MIN_PERCENT : MIN_SIDE}
                max={mode === 'percent' ? MAX_PERCENT : MAX_SIDE}
                value={widthInput}
                onChange={(e) => handleWidthChange(e.target.value)}
              />
            </label>
            <label className="resize-field">
              <span>Высота {mode === 'percent' ? '(%)' : '(px)'}</span>
              <input
                type="number"
                min={mode === 'percent' ? MIN_PERCENT : MIN_SIDE}
                max={mode === 'percent' ? MAX_PERCENT : MAX_SIDE}
                value={heightInput}
                onChange={(e) => handleHeightChange(e.target.value)}
              />
            </label>
          </div>

          <label className="resize-checkbox">
            <input
              type="checkbox"
              checked={keepAspect}
              onChange={(e) => setKeepAspect(e.target.checked)}
            />
            <span>Сохранять пропорции</span>
          </label>

          <label className="resize-field">
            <span>Алгоритм интерполяции</span>
            <select value={method} onChange={(e) => setMethod(e.target.value as InterpolationMethod)}>
              <option value="bilinear">{getInterpolationLabel('bilinear')}</option>
              <option value="nearest">{getInterpolationLabel('nearest')}</option>
            </select>
          </label>

          <p className="resize-tooltip" role="note">
            {getInterpolationDescription(method)}
          </p>

          {error ? <p className="resize-error">{error}</p> : null}
        </div>

        <div className="resize-dialog-footer">
          <button type="button" onClick={onCancel}>Отмена</button>
          <button
            type="button"
            onClick={() => {
              const validationError = validate();
              if (validationError || !targetSize) {
                setError(validationError || 'Не удалось применить размер.');
                return;
              }
              onApply({ width: targetSize.width, height: targetSize.height, method });
            }}
          >
            Применить
          </button>
        </div>
      </dialog>
    </div>
  );
}
