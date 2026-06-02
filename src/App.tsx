import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CanvasDisplay } from './components/CanvasDisplay';
import { StatusBar } from './components/StatusBar';
import { LayersPanel } from './components/LayersPanel';
import { ChannelsPanel } from './components/ChannelsPanel';
import { ColorPicker } from './components/ColorPicker';
import { ToolsPanel } from './components/ToolsPanel';
import { LevelsDialog } from './components/LevelsDialog';
import { ResizeDialog } from './components/ResizeDialog';
import { KernelFilterDialog } from './components/KernelFilterDialog';
import { loadImage, downloadAsPng, downloadAsJpg, downloadAsGb7, createCanvasFromImageData, type ImageInfo } from './utils/imageProcessor';
import { applyChannelFilter, type ChannelState } from './utils/channelUtils';
import { applyLevelsToImage, createDefaultLevelsState, type LevelsState } from './utils/levelsUtils';
import { resizeImageData, type InterpolationMethod } from './utils/interpolation';
import {
  IDENTITY_KERNEL_MATRIX,
  applyKernelFilterAsync,
  createDefaultKernelSettings,
  matricesApproximatelyEqual,
  type KernelFilterSettings,
} from './utils/kernelFilter';
import './App.css';

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
}

const MIN_SCALE_PERCENT = 12;
const MAX_SCALE_PERCENT = 300;
const DEFAULT_VIEW_INTERPOLATION: InterpolationMethod = 'bilinear';

function hasExpectedRgbaLength(data: Uint8Array, info: ImageInfo): boolean {
  return data.length === info.width * info.height * 4;
}

function App() {
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | undefined>();
  const [imageInfo, setImageInfo] = useState<ImageInfo | undefined>();
  const [status, setStatus] = useState('Готово');
  const [layers, setLayers] = useState<Layer[]>([
    { id: '1', name: 'Фоновый слой', visible: true, opacity: 100 },
  ]);
  const [originalImageData, setOriginalImageData] = useState<Uint8Array | undefined>();
  const [activeTool, setActiveTool] = useState<'none' | 'picker'>('none');
  const [showChannelsPanel, setShowChannelsPanel] = useState(false);
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [isWindowMenuOpen, setIsWindowMenuOpen] = useState(false);
  const [isImageMenuOpen, setIsImageMenuOpen] = useState(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isLevelsDialogOpen, setIsLevelsDialogOpen] = useState(false);
  const [isKernelDialogOpen, setIsKernelDialogOpen] = useState(false);
  const [isResizeDialogOpen, setIsResizeDialogOpen] = useState(false);
  const [viewScalePercent, setViewScalePercent] = useState(100);
  const [viewInterpolation, setViewInterpolation] = useState<InterpolationMethod>(DEFAULT_VIEW_INTERPOLATION);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [imageToken, setImageToken] = useState(0);
  const [autoFitToken, setAutoFitToken] = useState(0);
  const [channels, setChannels] = useState<ChannelState>({
    red: true,
    green: true,
    blue: true,
    alpha: true,
  });
  const [committedLevels, setCommittedLevels] = useState<LevelsState>(createDefaultLevelsState());
  const [previewLevels, setPreviewLevels] = useState<LevelsState | null>(null);
  const [committedKernel, setCommittedKernel] = useState<KernelFilterSettings>(createDefaultKernelSettings());
  const [previewKernel, setPreviewKernel] = useState<KernelFilterSettings | null>(null);
  const [kernelBaseData, setKernelBaseData] = useState<Uint8Array | undefined>();
  const [isKernelProcessing, setIsKernelProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const levelsForRender = previewLevels ?? committedLevels;
  const kernelForRender = previewKernel ?? committedKernel;

  const isIdentityKernel = useMemo(
    () => matricesApproximatelyEqual(kernelForRender.matrix, IDENTITY_KERNEL_MATRIX),
    [kernelForRender]
  );

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    const run = async () => {
      if (!originalImageData || !imageInfo) {
        setKernelBaseData(undefined);
        setIsKernelProcessing(false);
        return;
      }

      if (isIdentityKernel) {
        setKernelBaseData(originalImageData);
        setIsKernelProcessing(false);
        return;
      }

      try {
        setIsKernelProcessing(true);
        const processed = await applyKernelFilterAsync(
          originalImageData,
          imageInfo.width,
          imageInfo.height,
          kernelForRender,
          controller.signal
        );
        if (isActive) {
          setKernelBaseData(processed);
          setIsKernelProcessing(false);
        }
      } catch (error) {
        if ((error as Error).message !== 'Kernel filter aborted') {
          console.error(error);
        }
        if (isActive) {
          setIsKernelProcessing(false);
        }
      }
    };

    void run();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [originalImageData, imageInfo, kernelForRender, isIdentityKernel]);

  const levelsSourceData = useMemo(() => {
    if (!kernelBaseData || !imageInfo) {
      return undefined;
    }
    if (!hasExpectedRgbaLength(kernelBaseData, imageInfo)) {
      return undefined;
    }
    return applyLevelsToImage(kernelBaseData, levelsForRender);
  }, [kernelBaseData, imageInfo, levelsForRender]);

  const filteredImageData = useMemo(() => {
    if (!levelsSourceData || !imageInfo) {
      return undefined;
    }
    if (!hasExpectedRgbaLength(levelsSourceData, imageInfo)) {
      return undefined;
    }

    return applyChannelFilter(
      levelsSourceData,
      imageInfo.width,
      imageInfo.height,
      channels,
      imageInfo.channelCount
    );
  }, [levelsSourceData, imageInfo, channels]);

  const viewCanvas = useMemo(() => {
    if (!filteredImageData || !imageInfo) {
      return undefined;
    }
    if (!hasExpectedRgbaLength(filteredImageData, imageInfo)) {
      return undefined;
    }

    const targetWidth = Math.max(
      1,
      Math.round((imageInfo.width * viewScalePercent) / 100)
    );
    const targetHeight = Math.max(
      1,
      Math.round((imageInfo.height * viewScalePercent) / 100)
    );

    if (targetWidth === imageInfo.width && targetHeight === imageInfo.height) {
      return createCanvasFromImageData(filteredImageData, imageInfo.width, imageInfo.height);
    }

    // Нижний ползунок масштаба (StatusBar -> handleScaleChange -> viewScalePercent)
    // приводит именно к ресемплингу этим алгоритмом интерполяции.
    const resizedForView = resizeImageData(
      filteredImageData,
      imageInfo.width,
      imageInfo.height,
      targetWidth,
      targetHeight,
      viewInterpolation
    );

    return createCanvasFromImageData(resizedForView, targetWidth, targetHeight);
  }, [filteredImageData, imageInfo, viewScalePercent, viewInterpolation]);

  useEffect(() => {
    if (!filteredImageData || !imageInfo) {
      setSourceCanvas(undefined);
      return;
    }
    if (!hasExpectedRgbaLength(filteredImageData, imageInfo)) {
      setSourceCanvas(undefined);
      return;
    }
    setSourceCanvas(createCanvasFromImageData(filteredImageData, imageInfo.width, imageInfo.height));
  }, [filteredImageData, imageInfo]);

  useEffect(() => {
    if (!imageInfo || viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }
    if (autoFitToken !== imageToken) {
      return;
    }

    const availableWidth = Math.max(1, viewportSize.width - 100);
    const availableHeight = Math.max(1, viewportSize.height - 100);
    const fitScale = Math.min(
      availableWidth / imageInfo.width,
      availableHeight / imageInfo.height
    );
    const nextScale = Math.round(
      Math.max(MIN_SCALE_PERCENT, Math.min(MAX_SCALE_PERCENT, fitScale * 100))
    );
    setViewScalePercent(nextScale);
    setAutoFitToken(-1);
  }, [imageInfo, viewportSize, imageToken, autoFitToken]);

  const handleImageLoad = async (file: File) => {
    try {
      setStatus(`Загрузка ${file.name}...`);
      const processedImage = await loadImage(file);
      
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
      setCommittedLevels(createDefaultLevelsState());
      setPreviewLevels(null);
      setCommittedKernel(createDefaultKernelSettings());
      setPreviewKernel(null);
      setActiveTool('none');
      setViewInterpolation(DEFAULT_VIEW_INTERPOLATION);
      setImageToken((prev) => {
        const next = prev + 1;
        setAutoFitToken(next);
        return next;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setStatus(`Ошибка: ${errorMessage}`);
      console.error('Ошибка загрузки:', error);
    }
  };

  const handleExportPng = () => {
    if (sourceCanvas && imageInfo) {
      try {
        setStatus('Сохранение PNG...');
        const fileName = `image_${new Date().getTime()}.png`;
        downloadAsPng(sourceCanvas, fileName);
        setStatus(`PNG сохранен: ${fileName}`);
      } catch (error) {
        setStatus('Ошибка сохранения PNG');
        console.error(error);
      }
    }
  };

  const handleExportJpg = () => {
    if (sourceCanvas && imageInfo) {
      try {
        setStatus('Сохранение JPG...');
        const fileName = `image_${new Date().getTime()}.jpg`;
        downloadAsJpg(sourceCanvas, fileName, 0.9);
        setStatus(`JPG сохранен: ${fileName}`);
      } catch (error) {
        setStatus('Ошибка сохранения JPG');
        console.error(error);
      }
    }
  };

  const handleExportGb7 = () => {
    if (sourceCanvas && imageInfo) {
      try {
        setStatus('Сохранение GB7...');
        const fileName = `image_${new Date().getTime()}.gb7`;
        downloadAsGb7(sourceCanvas, fileName, imageInfo.hasMask ?? false);
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
    if (originalImageData && imageInfo) {
      setStatus('Каналы обновлены');
    }
  };

  const handleOpenLevelsDialog = () => {
    if (!originalImageData) {
      return;
    }
    setPreviewLevels(null);
    setIsLevelsDialogOpen(true);
    setStatus('Уровни: редактирование');
  };

  const handleOpenKernelDialog = () => {
    if (!originalImageData) {
      return;
    }
    setPreviewKernel(null);
    setIsKernelDialogOpen(true);
    setStatus('Фильтр ядром: редактирование');
  };

  const handleOpenResizeDialog = () => {
    if (!originalImageData || !imageInfo) {
      return;
    }
    setIsResizeDialogOpen(true);
    setStatus('Изменение размера: редактирование');
  };

  const handleLevelsPreviewChange = useCallback((nextState: LevelsState | null) => {
    setPreviewLevels(nextState);
    if (nextState) {
      setStatus('Уровни: предпросмотр');
    } else {
      setStatus('Уровни: предпросмотр выключен');
    }
  }, []);

  const handleLevelsCancel = () => {
    setPreviewLevels(null);
    setIsLevelsDialogOpen(false);
    setStatus('Уровни: изменения отменены');
  };

  const handleLevelsApply = (nextState: LevelsState) => {
    setCommittedLevels(nextState);
    setPreviewLevels(null);
    setIsLevelsDialogOpen(false);
    setStatus('Уровни применены');
  };

  const handleKernelApply = (nextSettings: KernelFilterSettings) => {
    setCommittedKernel({
      matrix: [...nextSettings.matrix],
      channels: { ...nextSettings.channels },
      edgeHandling: nextSettings.edgeHandling,
    });
    setPreviewKernel(null);
    setIsKernelDialogOpen(false);
    setStatus('Фильтр ядром применен');
  };

  const handleResizeApply = ({
    width: nextWidth,
    height: nextHeight,
    method,
  }: {
    width: number;
    height: number;
    method: InterpolationMethod;
  }) => {
    if (!originalImageData || !imageInfo) {
      return;
    }
    const resizedData = resizeImageData(
      originalImageData,
      imageInfo.width,
      imageInfo.height,
      nextWidth,
      nextHeight,
      method
    );
    setOriginalImageData(resizedData);
    setImageInfo((prev) =>
      prev
        ? {
            ...prev,
            width: nextWidth,
            height: nextHeight,
          }
        : prev
    );
    setIsResizeDialogOpen(false);
    setViewInterpolation(method);
    setStatus(`Изображение изменено: ${nextWidth} × ${nextHeight}px (${method})`);
  };

  const handleScaleChange = (nextScale: number) => {
    const clampedScale = Math.max(MIN_SCALE_PERCENT, Math.min(MAX_SCALE_PERCENT, Math.round(nextScale)));
    setViewScalePercent(clampedScale);
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
    if (tool === 'zoom') {
      handleOpenResizeDialog();
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
            <button className="menu-item-btn" onClick={handleOpenClick} type="button">Файл</button>
            <button className="menu-item-btn" type="button">Изменить</button>
            <div
              className="menu-dropdown"
              onMouseLeave={() => setIsImageMenuOpen(false)}
            >
              <button
                className="menu-item-btn"
                type="button"
                onClick={() => setIsImageMenuOpen((prev) => !prev)}
                aria-expanded={isImageMenuOpen}
                aria-haspopup="menu"
              >
                Изображение
              </button>
              {isImageMenuOpen && (
                <div className="dropdown-menu" role="menu" aria-label="Изображение">
                  <button
                    className="dropdown-menu-item"
                    type="button"
                    role="menuitem"
                    onClick={handleOpenResizeDialog}
                    disabled={!originalImageData}
                  >
                    <span />
                    <span>Размер изображения...</span>
                  </button>
                  <button
                    className="dropdown-menu-item"
                    type="button"
                    role="menuitem"
                    onClick={handleOpenLevelsDialog}
                    disabled={!originalImageData}
                  >
                    <span />
                    <span>Уровни...</span>
                  </button>
                </div>
              )}
            </div>
            <button className="menu-item-btn" type="button">Слои</button>
            {/* <button className="menu-item-btn" type="button">Select</button> */}
            <div
              className="menu-dropdown"
              onMouseLeave={() => setIsFilterMenuOpen(false)}
            >
              <button
                className="menu-item-btn"
                type="button"
                onClick={() => setIsFilterMenuOpen((prev) => !prev)}
                aria-expanded={isFilterMenuOpen}
                aria-haspopup="menu"
              >
                Фильтр
              </button>
              {isFilterMenuOpen && (
                <div className="dropdown-menu" role="menu" aria-label="Фильтр">
                  <button
                    className="dropdown-menu-item"
                    type="button"
                    role="menuitem"
                    onClick={handleOpenKernelDialog}
                    disabled={!originalImageData}
                  >
                    <span />
                    <span>Пользовательский фильтр...</span>
                  </button>
                </div>
              )}
            </div>
            <button className="menu-item-btn" type="button">Вид</button>
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
                Окно
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
                    <span>Каналы</span>
                  </button>
                  <button
                    className="dropdown-menu-item"
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={showLayersPanel}
                    onClick={() => setShowLayersPanel((prev) => !prev)}
                  >
                    <span>{showLayersPanel ? '✓' : ''}</span>
                    <span>Слои</span>
                  </button>
                </div>
              )}
            </div>
            <button className="menu-item-btn" type="button">Помощь</button>
          </div>
          <div className="menu-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.gb7,.jb7"
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
              disabled={!sourceCanvas}
              className="header-btn"
              aria-label="Экспортировать изображение как PNG"
              title="Сохранить как PNG"
            >
              PNG
            </button>
              <button
                onClick={handleExportJpg}
                disabled={!sourceCanvas}
                className="header-btn"
                aria-label="Экспортировать изображение как JPEG"
                title="Сохранить как JPG"
              >
                JPG
              </button>
              <button
                onClick={handleExportGb7}
                disabled={!sourceCanvas}
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
            canvas={viewCanvas}
            isPickerActive={activeTool === 'picker'}
            imageData={originalImageData}
            width={imageInfo?.width}
            height={imageInfo?.height}
            scalePercent={viewScalePercent}
            onScaleChange={handleScaleChange}
            onViewportResize={setViewportSize}
          />
        </div>

        <div className="app-main-right">
          {showChannelsPanel && (
            <ChannelsPanel
              imageData={originalImageData}
              width={imageInfo?.width}
              height={imageInfo?.height}
              sourceChannelCount={imageInfo?.channelCount}
              onChannelsChange={handleChannelsChange}
            />
          )}

          {showLayersPanel && (
            <LayersPanel
              layers={layers}
              onLayerToggle={handleLayerToggle}
              onOpacityChange={handleOpacityChange}
            />
          )}
        </div>
      </div>

      <ColorPicker
        isActive={activeTool === 'picker'}
        imageData={originalImageData}
        width={imageInfo?.width}
        height={imageInfo?.height}
      />

      <LevelsDialog
        isOpen={isLevelsDialogOpen}
        histogramData={originalImageData}
        levelsState={committedLevels}
        onPreviewChange={handleLevelsPreviewChange}
        onApply={handleLevelsApply}
        onCancel={handleLevelsCancel}
      />

      <ResizeDialog
        isOpen={isResizeDialogOpen}
        initialWidth={imageInfo?.width ?? 1}
        initialHeight={imageInfo?.height ?? 1}
        initialMethod={viewInterpolation}
        onApply={handleResizeApply}
        onCancel={() => {
          setIsResizeDialogOpen(false);
          setStatus('Изменение размера: отменено');
        }}
      />

      <KernelFilterDialog
        isOpen={isKernelDialogOpen}
        initialSettings={committedKernel}
        onPreviewChange={setPreviewKernel}
        onApply={handleKernelApply}
        onCancel={() => {
          setPreviewKernel(null);
          setIsKernelDialogOpen(false);
          setStatus('Фильтр ядром: изменения отменены');
        }}
      />

      <StatusBar
        imageInfo={imageInfo}
        status={isKernelProcessing ? 'Фильтр ядром: обработка...' : status}
        scalePercent={viewScalePercent}
        onScaleChange={handleScaleChange}
      />
    </div>
  );
}

export default App;
