/**
 * Side Panel Component
 * Правая панель с вкладками (Channels, Layers, etc.)
 */

import React, { useState } from 'react';
import { ChannelsPanel } from './ChannelsPanel';
import { LayersPanel } from './LayersPanel';
import type { ChannelState } from '../utils/channelUtils';
import '../styles/sidePanel.css';

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
}

interface SidePanelProps {
  imageData?: Uint8Array;
  width?: number;
  height?: number;
  onChannelsChange: (channels: ChannelState) => void;
  layers: Layer[];
  onLayerToggle: (layerId: string) => void;
  onOpacityChange: (layerId: string, opacity: number) => void;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  imageData,
  width,
  height,
  onChannelsChange,
  layers,
  onLayerToggle,
  onOpacityChange,
}) => {
  const [activeTab, setActiveTab] = useState<'channels' | 'layers'>('channels');

  return (
    <div className="side-panel">
      <div className="panel-tabs">
        <button
          className={`panel-tab ${activeTab === 'channels' ? 'active' : ''}`}
          onClick={() => setActiveTab('channels')}
        >
          Каналы
        </button>
        <button
          className={`panel-tab ${activeTab === 'layers' ? 'active' : ''}`}
          onClick={() => setActiveTab('layers')}
        >
          Слои
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'channels' && (
          <ChannelsPanel
            imageData={imageData}
            width={width}
            height={height}
            onChannelsChange={onChannelsChange}
          />
        )}

        {activeTab === 'layers' && (
          <LayersPanel
            layers={layers}
            onLayerToggle={onLayerToggle}
            onOpacityChange={onOpacityChange}
          />
        )}
      </div>
    </div>
  );
};
