/**
 * Tools Panel Component
 * Левая панель с инструментами
 */

import React from 'react';
import { MdCrop, MdPanTool, MdZoomIn, MdCircle } from 'react-icons/md';
import { BsEyedropper } from 'react-icons/bs';
import { BiRectangle } from 'react-icons/bi';
import '../styles/toolsPanel.css';

interface ToolsPanelProps {
  activeTool: string;
  onToolSelect: (tool: string) => void;
}

export const ToolsPanel: React.FC<ToolsPanelProps> = ({ activeTool, onToolSelect }) => {
  const tools = [
    { id: 'selection', name: 'Прямоугольное выделение', icon: BiRectangle, shortcut: 'M' },
    { id: 'ellipse', name: 'Эллиптическое выделение', icon: MdCircle, shortcut: 'E' },
    { id: 'crop', name: 'Кадрирование', icon: MdCrop, shortcut: 'C' },
    { id: 'eyedropper', name: 'Пипетка', icon: BsEyedropper, shortcut: 'I' },
    { id: 'zoom', name: 'Масштабирование', icon: MdZoomIn, shortcut: 'Z' },
    { id: 'hand', name: 'Навигация', icon: MdPanTool, shortcut: 'H' },
  ];

  return (
    <div className="tools-panel">
      <div className="tools-header">
        <span className="tools-title">Tools</span>
      </div>
      <div className="tools-grid">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`tool-button ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => onToolSelect(tool.id)}
            title={`${tool.name} (${tool.shortcut})`}
            aria-label={tool.name}
          >
            <span className="tool-icon">
              <tool.icon />
            </span>
            <span className="tool-shortcut">{tool.shortcut}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
