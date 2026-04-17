import { useState, useRef } from 'react';
import { CanvasDisplay } from './components/CanvasDisplay';
import { StatusBar } from './components/StatusBar';
import { LayersPanel } from './components/LayersPanel';
import { loadImage, downloadAsPng, downloadAsJpg, downloadAsGb7, type ImageInfo } from './utils/imageProcessor';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageLoad = async (file: File) => {
    try {
      setStatus(`Загрузка ${file.name}...`);
      const processedImage = await loadImage(file);
      
      setCanvas(processedImage.canvas);
      setImageInfo(processedImage.info);
      setStatus(`Изображение загружено: ${file.name}`);
      
      setLayers([
        {
          id: '1',
          name: file.name.split('.')[0],
          visible: true,
          opacity: 100,
        },
      ]);
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
        <div className="header-content">
          <h1>Web Photoshop</h1>
          <nav className="header-nav" aria-label="Основное меню">
            <div className="nav-group">
              <button
                onClick={handleOpenClick}
                className="header-btn"
                aria-label="Открыть изображение из файла"
                title="Открыть изображение (Ctrl+O)"
              >
                Открыть
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.gb7"
                onChange={handleFileInput}
                style={{ display: 'none' }}
                aria-hidden="true"
              />
            </div>

            <div className="nav-group">
              <button
                onClick={handleExportPng}
                disabled={!canvas}
                className="header-btn"
                aria-label="Экспортировать изображение как PNG"
                title="Сохранить как PNG"
              >
                Export PNG
              </button>
              <button
                onClick={handleExportJpg}
                disabled={!canvas}
                className="header-btn"
                aria-label="Экспортировать изображение как JPEG"
                title="Сохранить как JPG"
              >
                Export JPEG
              </button>
              <button
                onClick={handleExportGb7}
                disabled={!canvas}
                className="header-btn"
                aria-label="Экспортировать изображение как GB7"
                title="Сохранить как GB7 (GrayBit-7)"
              >
                Export GB7
              </button>
            </div>
          </nav>
        </div>
      </header>

      <div className="app-main">
        <CanvasDisplay
          canvas={canvas}
        />

        <LayersPanel
          layers={layers}
          onLayerToggle={handleLayerToggle}
          onOpacityChange={handleOpacityChange}
        />
      </div>

      <StatusBar
        imageInfo={imageInfo}
        status={status}
      />
    </div>
  );
}

export default App;
