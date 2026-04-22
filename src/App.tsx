import { useState, useRef } from 'react';
import { CanvasDisplay } from './components/CanvasDisplay';
import { StatusBar } from './components/StatusBar';
import { LayersPanel } from './components/LayersPanel';
import { ChannelsPanel } from './components/ChannelsPanel';
import { ColorPicker } from './components/ColorPicker';
import { ToolsPanel } from './components/ToolsPanel';
import { loadImage, downloadAsPng, downloadAsJpg, downloadAsGb7, createCanvasFromImageData, type ImageInfo } from './utils/imageProcessor';
import { applyChannelFilter, type ChannelState } from './utils/channelUtils';
import './App.css';

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
}

function App() {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | undefined>();
  const [imageInfo, setImageInfo] = useState<ImageInfo | undefined>();
  const [status, setStatus] = useState('Готово');
  const [layers, setLayers] = useState<Layer[]>([
    { id: '1', name: 'Фоновый слой', visible: true, opacity: 100 },
  ]);
  const [originalImageData, setOriginalImageData] = useState<Uint8Array | undefined>();
  const [activeTool, setActiveTool] = useState<'none' | 'picker'>('none');
  const [showChannelsPanel, setShowChannelsPanel] = useState(false);
  const [isWindowMenuOpen, setIsWindowMenuOpen] = useState(false);
  const [, setChannels] = useState<ChannelState>({
    red: true,
    green: true,
    blue: true,
    alpha: true,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageLoad = async (file: File) => {
    try {
      setStatus(`Загрузка ${file.name}...`);
      const processedImage = await loadImage(file);
      
      setCanvas(processedImage.canvas);
      setImageInfo(processedImage.info);
      // Сохраняем оригинальные данные для работы с каналами
      if (processedImage.originalData) {
        setOriginalImageData(new Uint8Array(processedImage.originalData));
      } else {
        // Если оригинальные данные не сохранены, достаем их из canvas
        const ctx = processedImage.canvas.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, processedImage.canvas.width, processedImage.canvas.height);
          setOriginalImageData(new Uint8Array(imageData.data));
        }
      }
      setStatus(`Изображение загружено: ${file.name}`);
      
      setLayers([
        {
          id: '1',
          name: file.name.split('.')[0],
          visible: true,
          opacity: 100,
        },
      ]);

      // Сбрасываем выбранные каналы и инструмент
      setChannels({
        red: true,
        green: true,
        blue: true,
        alpha: true,
      });
      setActiveTool('none');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setStatus(`Ошибка: ${errorMessage}`);
      console.error('Ошибка загрузки:', error);
    }
  };

  const handleExportPng = () => {
    if (canvas && imageInfo) {
      try {
        setStatus('Сохранение PNG...');
        const fileName = `image_${new Date().getTime()}.png`;
        downloadAsPng(canvas, fileName);
        setStatus(`PNG сохранен: ${fileName}`);
      } catch (error) {
        setStatus('Ошибка сохранения PNG');
        console.error(error);
      }
    }
  };

  const handleExportJpg = () => {
    if (canvas && imageInfo) {
      try {
        setStatus('Сохранение JPG...');
        const fileName = `image_${new Date().getTime()}.jpg`;
        downloadAsJpg(canvas, fileName, 0.9);
        setStatus(`JPG сохранен: ${fileName}`);
      } catch (error) {
        setStatus('Ошибка сохранения JPG');
        console.error(error);
      }
    }
  };

  const handleExportGb7 = () => {
    if (canvas && imageInfo) {
      try {
        setStatus('Сохранение GB7...');
        const fileName = `image_${new Date().getTime()}.gb7`;
        downloadAsGb7(canvas, fileName, imageInfo.hasMask ?? false);
        setStatus(`GB7 сохранен: ${fileName}`);
      } catch (error) {
        setStatus('Ошибка сохранения GB7');
        console.error(error);
      }
    }
  };

  const handleLayerToggle = (layerId: string) => {
    setLayers(layers.map(layer =>
      layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
    ));
  };

  const handleOpacityChange = (layerId: string, opacity: number) => {
    setLayers(layers.map(layer =>
      layer.id === layerId ? { ...layer, opacity } : layer
    ));
  };

  const handleChannelsChange = (newChannels: ChannelState) => {
    setChannels(newChannels);
    
    // Применяем фильтр каналов к изображению
    if (originalImageData && imageInfo && canvas) {
      const filteredData = applyChannelFilter(
        originalImageData,
        imageInfo.width,
        imageInfo.height,
        newChannels
      );
      
      const newCanvas = createCanvasFromImageData(filteredData, imageInfo.width, imageInfo.height);
      setCanvas(newCanvas);
      setStatus('Каналы обновлены');
    }
  };

  const handleToolClick = (tool: 'none' | 'picker') => {
    setActiveTool(tool);
    if (tool === 'picker') {
      setStatus('Пипетка активна. Нажмите на холст для выбора цвета');
    } else {
      setStatus('Пипетка отключена');
    }
  };

  const handleToolSelect = (tool: string) => {
    if (tool === 'eyedropper') {
      handleToolClick(activeTool === 'picker' ? 'none' : 'picker');
      return;
    }
    setActiveTool('none');
    setStatus(`Инструмент "${tool}" недоступен в текущей версии`);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageLoad(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleOpenClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="menu-bar" role="menubar" aria-label="Главное меню">
          <div className="menu-item-group">
            <button className="menu-item-btn" onClick={handleOpenClick} type="button">File</button>
            <button className="menu-item-btn" type="button">Edit</button>
            <button className="menu-item-btn" type="button">Image</button>
            <button className="menu-item-btn" type="button">Layer</button>
            <button className="menu-item-btn" type="button">Select</button>
            <button className="menu-item-btn" type="button">Filter</button>
            <button className="menu-item-btn" type="button">View</button>
            <div
              className="menu-dropdown"
              onMouseLeave={() => setIsWindowMenuOpen(false)}
            >
              <button
                className="menu-item-btn"
                type="button"
                onClick={() => setIsWindowMenuOpen((prev) => !prev)}
                aria-expanded={isWindowMenuOpen}
                aria-haspopup="menu"
              >
                Window
              </button>
              {isWindowMenuOpen && (
                <div className="dropdown-menu" role="menu" aria-label="Окна">
                  <button
                    className="dropdown-menu-item"
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={showChannelsPanel}
                    onClick={() => setShowChannelsPanel((prev) => !prev)}
                  >
                    <span>{showChannelsPanel ? '✓' : ''}</span>
                    <span>Channels</span>
                  </button>
                </div>
              )}
            </div>
            <button className="menu-item-btn" type="button">Help</button>
          </div>
          <div className="menu-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.gb7"
              onChange={handleFileInput}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
            <button
              onClick={handleOpenClick}
              className="header-btn"
              aria-label="Открыть изображение из файла"
              title="Открыть изображение (Ctrl+O)"
            >
              Открыть
            </button>
            <button
              onClick={handleExportPng}
              disabled={!canvas}
              className="header-btn"
              aria-label="Экспортировать изображение как PNG"
              title="Сохранить как PNG"
            >
              PNG
            </button>
              <button
                onClick={handleExportJpg}
                disabled={!canvas}
                className="header-btn"
                aria-label="Экспортировать изображение как JPEG"
                title="Сохранить как JPG"
              >
                JPG
              </button>
              <button
                onClick={handleExportGb7}
                disabled={!canvas}
                className="header-btn"
                aria-label="Экспортировать изображение как GB7"
                title="Сохранить как GB7 (GrayBit-7)"
              >
                GB7
              </button>
          </div>
        </div>
      </header>

      <div className="app-main">
        <ToolsPanel
          activeTool={activeTool === 'picker' ? 'eyedropper' : 'none'}
          onToolSelect={handleToolSelect}
        />
        <div className="app-main-left">
          <CanvasDisplay
            canvas={canvas}
            isPickerActive={activeTool === 'picker'}
            imageData={originalImageData}
            width={imageInfo?.width}
            height={imageInfo?.height}
          />
        </div>

        <div className="app-main-right">
          {showChannelsPanel && (
            <ChannelsPanel
              imageData={originalImageData}
              width={imageInfo?.width}
              height={imageInfo?.height}
              onChannelsChange={handleChannelsChange}
            />
          )}

          <LayersPanel
            layers={layers}
            onLayerToggle={handleLayerToggle}
            onOpacityChange={handleOpacityChange}
          />
        </div>
      </div>

      <ColorPicker
        isActive={activeTool === 'picker'}
        imageData={originalImageData}
        width={imageInfo?.width}
        height={imageInfo?.height}
      />

      <StatusBar
        imageInfo={imageInfo}
        status={status}
      />
    </div>
  );
}

export default App;
