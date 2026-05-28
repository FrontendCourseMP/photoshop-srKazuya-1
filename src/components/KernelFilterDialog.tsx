import { useEffect, useMemo, useState } from 'react';
import {
  IDENTITY_KERNEL_MATRIX,
  KERNEL_PRESETS,
  matricesApproximatelyEqual,
  type EdgeHandling,
  type KernelFilterSettings,
  type KernelPreset,
} from '../utils/kernelFilter';
import '../styles/kernelFilterDialog.css';

interface KernelFilterDialogProps {
  isOpen: boolean;
  initialSettings: KernelFilterSettings;
  onPreviewChange: (settings: KernelFilterSettings | null) => void;
  onApply: (settings: KernelFilterSettings) => void;
  onCancel: () => void;
}

function cloneSettings(settings: KernelFilterSettings): KernelFilterSettings {
  return {
    matrix: [...settings.matrix],
    edgeHandling: settings.edgeHandling,
    channels: { ...settings.channels },
  };
}

export function KernelFilterDialog({
  isOpen,
  initialSettings,
  onPreviewChange,
  onApply,
  onCancel,
}: KernelFilterDialogProps) {
  const [localSettings, setLocalSettings] = useState<KernelFilterSettings>(cloneSettings(initialSettings));
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<string>('identity');

  const detectPresetId = (matrix: number[]): string => {
    const matched = KERNEL_PRESETS.find((preset) => matricesApproximatelyEqual(matrix, preset.matrix));
    return matched?.id ?? 'custom';
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const cloned = cloneSettings(initialSettings);
    setLocalSettings(cloned);
    setPreviewEnabled(true);
    setSelectedPreset(detectPresetId(cloned.matrix));
    onPreviewChange(cloned);
  }, [initialSettings, isOpen, onPreviewChange]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    onPreviewChange(previewEnabled ? localSettings : null);
  }, [isOpen, localSettings, onPreviewChange, previewEnabled]);

  const matrixSum = useMemo(
    () => localSettings.matrix.reduce((acc, value) => acc + value, 0),
    [localSettings.matrix]
  );

  if (!isOpen) {
    return null;
  }

  const applyPreset = (preset: KernelPreset) => {
    setSelectedPreset(preset.id);
    setLocalSettings((prev) => ({
      ...prev,
      matrix: [...preset.matrix],
    }));
  };

  return (
    <div className="kernel-dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <dialog
        open
        className="kernel-dialog"
        aria-label="Фильтрация ядром"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="kernel-dialog-header">
          <h3>Пользовательский фильтр (Ядро 3x3)</h3>
          <button type="button" onClick={onCancel} aria-label="Закрыть">✕</button>
        </div>

        <div className="kernel-dialog-content">
          <label className="kernel-field">
            <span>Предустановка</span>
            <select
              value={selectedPreset}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setSelectedPreset('custom');
                  return;
                }
                const preset = KERNEL_PRESETS.find((item) => item.id === e.target.value);
                if (preset) {
                  applyPreset(preset);
                }
              }}
            >
              {KERNEL_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
              <option value="custom">Пользовательское</option>
            </select>
          </label>

          <fieldset className="kernel-matrix-fieldset">
            <legend>Коэффициенты ядра 3x3</legend>
            <div className="kernel-grid-labels">
              <span>Левый</span>
              <span>Центр</span>
              <span>Правый</span>
            </div>
            <div className="kernel-grid">
              {localSettings.matrix.map((value, index) => (
                <label key={`kernel-cell-${index}`} className="kernel-cell">
                  <span className="kernel-cell-label">K{index + 1}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={Number.isFinite(value) ? value : 0}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setSelectedPreset('custom');
                      setLocalSettings((prev) => {
                        const matrix = [...prev.matrix];
                        matrix[index] = Number.isFinite(next) ? next : 0;
                        return { ...prev, matrix };
                      });
                    }}
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <div className="kernel-row">
            <label className="kernel-field">
              <span>Обработка края</span>
              <select
                value={localSettings.edgeHandling}
                onChange={(e) =>
                  setLocalSettings((prev) => ({
                    ...prev,
                    edgeHandling: e.target.value as EdgeHandling,
                  }))
                }
              >
                <option value="black">Заполнение черным</option>
                <option value="white">Заполнение белым</option>
                <option value="copy">Копирование края</option>
              </select>
            </label>
          </div>

          <div className="kernel-row">
            <span>Каналы</span>
            <label>
              <input
                type="checkbox"
                checked={
                  localSettings.channels.red &&
                  localSettings.channels.green &&
                  localSettings.channels.blue &&
                  localSettings.channels.alpha
                }
                onChange={(e) =>
                  setLocalSettings((prev) => ({
                    ...prev,
                    channels: {
                      red: e.target.checked,
                      green: e.target.checked,
                      blue: e.target.checked,
                      alpha: e.target.checked,
                    },
                  }))
                }
              />
              All
            </label>
            <label><input type="checkbox" checked={localSettings.channels.red} onChange={(e) => setLocalSettings((prev) => ({ ...prev, channels: { ...prev.channels, red: e.target.checked } }))} />R</label>
            <label><input type="checkbox" checked={localSettings.channels.green} onChange={(e) => setLocalSettings((prev) => ({ ...prev, channels: { ...prev.channels, green: e.target.checked } }))} />G</label>
            <label><input type="checkbox" checked={localSettings.channels.blue} onChange={(e) => setLocalSettings((prev) => ({ ...prev, channels: { ...prev.channels, blue: e.target.checked } }))} />B</label>
            <label><input type="checkbox" checked={localSettings.channels.alpha} onChange={(e) => setLocalSettings((prev) => ({ ...prev, channels: { ...prev.channels, alpha: e.target.checked } }))} />A</label>
          </div>

          <div className="kernel-summary">Сумма коэффициентов: {matrixSum.toFixed(2)}</div>
        </div>

        <div className="kernel-dialog-footer">
          <label className="kernel-footer-left">
            <input
              type="checkbox"
              checked={previewEnabled}
              onChange={(e) => setPreviewEnabled(e.target.checked)}
            />
            <span>Предпросмотр</span>
          </label>
          <div className="kernel-footer-actions">
            <button
              type="button"
              onClick={() => {
                const identity = KERNEL_PRESETS[0];
                setSelectedPreset(identity.id);
                setLocalSettings((prev) => ({
                  ...prev,
                  matrix: [...IDENTITY_KERNEL_MATRIX],
                }));
              }}
            >
              Сброс
            </button>
            <button type="button" onClick={onCancel}>Закрыть</button>
            <button
              type="button"
              onClick={() => onApply(localSettings)}
            >
              Применить
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
