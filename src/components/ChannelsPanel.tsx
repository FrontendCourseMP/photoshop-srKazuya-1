/**
 * Channels Panel Component
 * Панель для управления цветовыми каналами
 */

import React, { useState, useEffect } from 'react';
import type { ChannelState } from '../utils/channelUtils';
import { getChannelCount, extractChannel, createChannelPreview, createRgbPreview, createAlphaPreview } from '../utils/channelUtils';
import { createCanvasFromImageData } from '../utils/imageProcessor';
import '../styles/channelsPanel.css';

interface ChannelsPanelProps {
  imageData?: Uint8Array;
  width?: number;
  height?: number;
  onChannelsChange: (channels: ChannelState) => void;
}

export const ChannelsPanel: React.FC<ChannelsPanelProps> = ({
  imageData,
  width = 0,
  height = 0,
  onChannelsChange,
}) => {
  const [channels, setChannels] = useState<ChannelState>({
    red: true,
    green: true,
    blue: true,
    alpha: true,
  });

  const [channelCount, setChannelCount] = useState<1 | 2 | 3 | 4>(4);
  const [previews, setPreviews] = useState<Map<string, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    if (!imageData || width === 0 || height === 0) return;

    const count = getChannelCount(width, height, imageData);
    setChannelCount(count);
    const resetChannels: ChannelState = { red: true, green: true, blue: true, alpha: true };
    setChannels(resetChannels);
    onChannelsChange(resetChannels);

    // Генерируем превью каналов
    const newPreviews = new Map<string, HTMLCanvasElement>();

    if (count === 1) {
      // Grayscale
      const preview = createChannelPreview(imageData, width, height);
      newPreviews.set('grayscale', createCanvasFromImageData(preview.data, preview.width, preview.height));
    } else if (count === 2) {
      // Grayscale + Alpha
      const gsPreview = createChannelPreview(imageData, width, height);
      newPreviews.set('grayscale', createCanvasFromImageData(gsPreview.data, gsPreview.width, gsPreview.height));

      const alphaPreview = createAlphaPreview(imageData, width, height);
      newPreviews.set('alpha', createCanvasFromImageData(alphaPreview.data, alphaPreview.width, alphaPreview.height));
    } else if (count === 3) {
      // RGB
      const rPreview = createChannelPreview(extractChannel(imageData, width, height, 0), width, height);
      newPreviews.set('red', createCanvasFromImageData(rPreview.data, rPreview.width, rPreview.height));

      const gPreview = createChannelPreview(extractChannel(imageData, width, height, 1), width, height);
      newPreviews.set('green', createCanvasFromImageData(gPreview.data, gPreview.width, gPreview.height));

      const bPreview = createChannelPreview(extractChannel(imageData, width, height, 2), width, height);
      newPreviews.set('blue', createCanvasFromImageData(bPreview.data, bPreview.width, bPreview.height));

      const rgbPreview = createRgbPreview(imageData, width, height);
      newPreviews.set('rgb', createCanvasFromImageData(rgbPreview.data, rgbPreview.width, rgbPreview.height));
    } else if (count === 4) {
      // RGBA
      const rPreview = createChannelPreview(extractChannel(imageData, width, height, 0), width, height);
      newPreviews.set('red', createCanvasFromImageData(rPreview.data, rPreview.width, rPreview.height));

      const gPreview = createChannelPreview(extractChannel(imageData, width, height, 1), width, height);
      newPreviews.set('green', createCanvasFromImageData(gPreview.data, gPreview.width, gPreview.height));

      const bPreview = createChannelPreview(extractChannel(imageData, width, height, 2), width, height);
      newPreviews.set('blue', createCanvasFromImageData(bPreview.data, bPreview.width, bPreview.height));

      const alphaPreview = createAlphaPreview(imageData, width, height);
      newPreviews.set('alpha', createCanvasFromImageData(alphaPreview.data, alphaPreview.width, alphaPreview.height));

      const rgbaPreview = createRgbPreview(imageData, width, height);
      newPreviews.set('rgba', createCanvasFromImageData(rgbaPreview.data, rgbaPreview.width, rgbaPreview.height));
    }

    setPreviews(newPreviews);
  }, [imageData, width, height]);

  const handleChannelToggle = (channel: keyof ChannelState) => {
    const newChannels = { ...channels, [channel]: !channels[channel] };
    setChannels(newChannels);
    onChannelsChange(newChannels);
  };

  const handleCompositeToggle = () => {
    const hasDisabled = channelCount === 1 || channelCount === 2
      ? (!channels.red || (channelCount === 2 && !channels.alpha))
      : (!channels.red || !channels.green || !channels.blue || (channelCount === 4 && !channels.alpha));

    let newChannels: ChannelState;
    if (channelCount === 1) {
      newChannels = { ...channels, red: hasDisabled };
    } else if (channelCount === 2) {
      newChannels = { ...channels, red: hasDisabled, alpha: hasDisabled };
    } else if (channelCount === 3) {
      newChannels = { ...channels, red: hasDisabled, green: hasDisabled, blue: hasDisabled };
    } else {
      newChannels = { red: hasDisabled, green: hasDisabled, blue: hasDisabled, alpha: hasDisabled };
    }

    setChannels(newChannels);
    onChannelsChange(newChannels);
  };

  const isCompositeActive = channelCount === 1
    ? channels.red
    : channelCount === 2
      ? channels.red && channels.alpha
      : channelCount === 3
        ? channels.red && channels.green && channels.blue
        : channels.red && channels.green && channels.blue && channels.alpha;

  if (!imageData || width === 0 || height === 0) {
    return (
      <div className="channels-panel">
        <h3>Каналы</h3>
        <p className="no-image-message">Загрузите изображение для управления каналами</p>
      </div>
    );
  }

  return (
    <div className="channels-panel">
      <h3>Каналы</h3>
      <div className="channels-list">
        {((channelCount === 1 || channelCount === 2) && previews.get('grayscale')) && (
          <ChannelButton
            key="composite-gray"
            label={channelCount === 2 ? 'Gray + Alpha' : 'Grayscale'}
            active={isCompositeActive}
            preview={previews.get('grayscale')}
            onClick={handleCompositeToggle}
            isComposite
          />
        )}

        {channelCount === 3 && previews.get('rgb') && (
          <ChannelButton
            key="composite-rgb"
            label="RGB"
            active={isCompositeActive}
            preview={previews.get('rgb')}
            onClick={handleCompositeToggle}
            isComposite
          />
        )}

        {channelCount === 4 && previews.get('rgba') && (
          <ChannelButton
            key="composite-rgba"
            label="RGB + Alpha"
            active={isCompositeActive}
            preview={previews.get('rgba')}
            onClick={handleCompositeToggle}
            isComposite
          />
        )}

        {(channelCount === 1 || channelCount === 2) && (
          <>
            <ChannelButton
              key="grayscale"
              label="Grayscale"
              active={channels.red}
              preview={previews.get('grayscale')}
              onClick={() => handleChannelToggle('red')}
            />
            {channelCount === 2 && (
              <ChannelButton
                key="alpha"
                label="Alpha"
                active={channels.alpha}
                preview={previews.get('alpha')}
                onClick={() => handleChannelToggle('alpha')}
              />
            )}
          </>
        )}

        {(channelCount === 3 || channelCount === 4) && (
          <>
            <ChannelButton
              key="red"
              label="Red"
              active={channels.red}
              preview={previews.get('red')}
              onClick={() => handleChannelToggle('red')}
              color="red"
            />
            <ChannelButton
              key="green"
              label="Green"
              active={channels.green}
              preview={previews.get('green')}
              onClick={() => handleChannelToggle('green')}
              color="green"
            />
            <ChannelButton
              key="blue"
              label="Blue"
              active={channels.blue}
              preview={previews.get('blue')}
              onClick={() => handleChannelToggle('blue')}
              color="blue"
            />
            {channelCount === 4 && (
              <ChannelButton
                key="alpha"
                label="Alpha"
                active={channels.alpha}
                preview={previews.get('alpha')}
                onClick={() => handleChannelToggle('alpha')}
              />
            )}
          </>
        )}

      </div>
    </div>
  );
};

interface ChannelButtonProps {
  label: string;
  active: boolean;
  preview?: HTMLCanvasElement;
  onClick: () => void;
  color?: 'red' | 'green' | 'blue';
  isComposite?: boolean;
}

const ChannelButton: React.FC<ChannelButtonProps> = ({
  label,
  active,
  preview,
  onClick,
  color,
  isComposite = false,
}) => {
  return (
    <button
      className={`channel-button ${active ? 'active' : 'inactive'} ${color || ''} ${isComposite ? 'composite' : ''}`}
      onClick={onClick}
      title={`${active ? 'Отключить' : 'Включить'} канал ${label}`}
    >
      {preview && (
        <canvas
          ref={(ref) => {
            if (ref && preview) {
              const ctx = ref.getContext('2d');
              if (ctx) {
                ctx.drawImage(preview, 0, 0);
              }
            }
          }}
          width={Math.min(80, preview.width)}
          height={Math.min(80, preview.height)}
          className="channel-thumbnail"
        />
      )}
      <span className="channel-label">{label}</span>
      <span className={`channel-status ${active ? 'enabled' : 'disabled'}`}>
        {active ? '✓' : '○'}
      </span>
    </button>
  );
};
