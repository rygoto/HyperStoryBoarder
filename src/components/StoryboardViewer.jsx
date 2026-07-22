import React, { useState, useRef, useEffect, useCallback } from 'react';
import ExportPDFButton from './ExportPDFButton';
import ExportDavinciButton from './ExportDavinciButton';
import AIAssistButton from './ai-assistant/AIAssistButton';
import StoryboardAIPanel from './ai-assistant/StoryboardAIPanel';
import { useAuth } from '../hooks/useAuth';
import { useStoryboard } from '../hooks/useStoryboard';
import { uploadImage } from '../services/storage-service';
import CutDialogueEditor from './CutDialogueEditor';
import {
  DEFAULT_DIALOGUE_CHARS_PER_SECOND,
  EMPTY_DIALOGUE_LINE,
  calcTimingFromDialogueLines,
  countDialogueLinesChars,
  emptyDialogueLinesForPage,
  formatDialogueDisplay,
  formatDialogueSpeakText,
  getCutDialogueLines,
  isDialogueLinesFilled,
  normalizePageDialogues
} from '../utils/dialogue';

const ANIM_FRAME_RATES = [8, 12, 24];
const DEFAULT_FRAME_RATE = 8;

const resolveFrameRate = (fps) => (ANIM_FRAME_RATES.includes(fps) ? fps : DEFAULT_FRAME_RATE);

const getCutFrameRate = (page, cutIdx, cutFps) => {
  if (ANIM_FRAME_RATES.includes(cutFps)) return cutFps;
  const bases = page?.frameRateBases;
  if (Array.isArray(bases) && ANIM_FRAME_RATES.includes(bases[cutIdx])) return bases[cutIdx];
  if (ANIM_FRAME_RATES.includes(page?.frameRateBase)) return page.frameRateBase;
  return DEFAULT_FRAME_RATE;
};

const defaultFrameRateBases = () => [8, 8, 8, 8, 8];

const formatSecondsFromFrames = (frames, fps) => {
  const n = parseInt(String(frames), 10);
  if (!n || n <= 0) return '';
  const sec = n / fps;
  return sec.toFixed(4).replace(/\.?0+$/, '') || '0';
};

const formatFramesFromSeconds = (seconds, fps) => {
  const s = parseFloat(seconds);
  if (isNaN(s) || s <= 0) return '';
  return String(Math.max(1, Math.round(s * fps)));
};

const normalizePage = (page) => {
  const legacyFps = page?.frameRateBase;
  const frameRateBases = Array.from({ length: 5 }, (_, i) =>
    getCutFrameRate(page, i, page.frameRateBases?.[i] ?? legacyFps)
  );
  return normalizePageDialogues({
    ...page,
    imageIndices: page.imageIndices || [0, 0, 0, 0, 0],
    drawingTexts: page.drawingTexts || ['', '', '', '', ''],
    screenTexts: page.screenTexts || ['', '', '', '', ''],
    frameValues: page.frameValues || ['', '', '', '', ''],
    frameRateBases
  });
};

const EMPTY_PAGE = () => ({
  images: [[null], [null], [null], [null], [null]],
  imageIndices: [0, 0, 0, 0, 0],
  faceTexts: ['', '', '', '', ''],
  drawingTexts: ['', '', '', '', ''],
  screenTexts: ['', '', '', '', ''],
  dialogueLines: emptyDialogueLinesForPage(),
  timeValues: ['', '', '', '', ''],
  frameValues: ['', '', '', '', ''],
  frameRateBases: defaultFrameRateBases(),
  blendFiles: ['', '', '', '', '']
});

const EMPTY_CUT = () => ({
  images: [null],
  imageIndex: 0,
  faceText: '',
  drawingText: '',
  screenText: '',
  dialogueLines: [EMPTY_DIALOGUE_LINE()],
  timeValue: '',
  frameValue: '',
  frameRateBase: DEFAULT_FRAME_RATE,
  blendFile: ''
});

const isCutFilled = (cut) => {
  const hasImage = cut.images && cut.images.some(img => img !== null);
  return (
    hasImage ||
    cut.faceText !== '' ||
    (cut.drawingText || '') !== '' ||
    (cut.screenText || '') !== '' ||
    isDialogueLinesFilled(cut.dialogueLines || []) ||
    cut.timeValue !== '' ||
    cut.frameValue !== '' ||
    cut.blendFile !== ''
  );
};

const flattenPagesToCuts = (pages) =>
  pages.flatMap((page) =>
    page.images.map((imgs, cIdx) => ({
      images: imgs,
      imageIndex: page.imageIndices[cIdx],
      faceText: page.faceTexts[cIdx],
      drawingText: (page.drawingTexts || [])[cIdx] || '',
      screenText: (page.screenTexts || [])[cIdx] || '',
      dialogueLines: getCutDialogueLines(page, cIdx),
      dialogueText: formatDialogueDisplay(getCutDialogueLines(page, cIdx)),
      timeValue: page.timeValues[cIdx],
      frameValue: (page.frameValues || [])[cIdx] || '',
      frameRateBase: getCutFrameRate(page, cIdx),
      blendFile: page.blendFiles[cIdx]
    }))
  );

const FrameRateSelector = ({ value, onChange, compact = false, mini = false }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: mini ? '1px' : compact ? '2px' : '4px' }}>
    {!compact && !mini && <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>fps:</span>}
    {ANIM_FRAME_RATES.map((fps) => (
      <button
        key={fps}
        type="button"
        onClick={() => onChange(fps)}
        style={{
          fontSize: mini ? '9px' : compact ? '10px' : '11px',
          padding: mini ? '1px 3px' : compact ? '2px 5px' : '3px 7px',
          border: `1px solid ${value === fps ? '#2563eb' : '#d1d5db'}`,
          borderRadius: '4px',
          cursor: 'pointer',
          background: value === fps ? '#2563eb' : '#f8fafc',
          color: value === fps ? '#fff' : '#374151',
          fontFamily: 'inherit',
          fontWeight: value === fps ? 700 : 400,
          lineHeight: 1.2,
          minWidth: mini ? '18px' : undefined
        }}
        title={`${fps}コマ打ち`}
      >
        {fps}
      </button>
    ))}
  </div>
);

const DialogueTimingButton = ({ onClick, disabled, mini = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      fontSize: mini ? '9px' : '11px',
      padding: mini ? '2px 4px' : '4px 8px',
      border: `1px solid ${disabled ? '#e5e7eb' : '#93c5fd'}`,
      borderRadius: '4px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      background: disabled ? '#f9fafb' : '#eff6ff',
      color: disabled ? '#9ca3af' : '#1d4ed8',
      fontFamily: 'inherit',
      fontWeight: 600,
      lineHeight: 1.2,
      whiteSpace: 'nowrap'
    }}
    title="セリフ文字数から尺を自動入力（セリフ本文のみ・1秒あたり文字数は設定参照）"
  >
    {mini ? '自動' : 'セリフ→尺'}
  </button>
);

const StoryboardViewer = ({ 
  storyboardId, 
  initialPages = [EMPTY_PAGE()], 
  storyboardName: initialName = '',
  initialDialogueCharsPerSecond = DEFAULT_DIALOGUE_CHARS_PER_SECOND
}) => {
  const { user } = useAuth();
  const { saveStoryboard, saving, lastSaved } = useStoryboard();
  
  const [pages, setPages] = useState(() => (initialPages || [EMPTY_PAGE()]).map(normalizePage));
  const exportRef = useRef(null);
  const pageRefs = useRef([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMode, setPlaybackMode] = useState('auto');
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isAutoSpeak, setIsAutoSpeak] = useState(false);
  const [hoveredFrame, setHoveredFrame] = useState(null);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [stopwatchStart, setStopwatchStart] = useState(null);
  const [stopwatchTime, setStopwatchTime] = useState(null);
  const [storyboardName, setStoryboardName] = useState(initialName);
  const [dialogueCharsPerSecond, setDialogueCharsPerSecond] = useState(initialDialogueCharsPerSecond);
  const [draggedCut, setDraggedCut] = useState(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [areButtonsHidden, setAreButtonsHidden] = useState(false);

  // AI補助機能用のstate
  const [aiPanelVisible, setAiPanelVisible] = useState(false);
  const [selectedAIFrame, setSelectedAIFrame] = useState(null);

  // Firebase Storage関連のstate
  const [uploadingImages, setUploadingImages] = useState(new Set());
  const [imageUploadProgress, setImageUploadProgress] = useState({});

  // 内容/作画 モード切り替え
  const [contentMode, setContentMode] = useState('content'); // 'content' | 'drawing'

  // 画像グレースケール切り替え
  const [isGrayscale, setIsGrayscale] = useState(false);
  const [gsContrast, setGsContrast] = useState(1.6);
  const [gsBrightness, setGsBrightness] = useState(1.15);
  const [gsAdjustOpen, setGsAdjustOpen] = useState(false);
  const gsAdjustRef = useRef(null);

  // 画像グレーオーバーレイ
  const [isGrayOverlay, setIsGrayOverlay] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(0.4);
  const [overlayShade, setOverlayShade] = useState(128); // 0=黒 255=白
  const [overlayAdjustOpen, setOverlayAdjustOpen] = useState(false);
  const overlayAdjustRef = useRef(null);

  // グレースケール調整パネルの外クリック閉じ
  useEffect(() => {
    if (!gsAdjustOpen) return;
    const handler = (e) => {
      if (gsAdjustRef.current && !gsAdjustRef.current.contains(e.target)) {
        setGsAdjustOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [gsAdjustOpen]);

  // グレーオーバーレイ調整パネルの外クリック閉じ
  useEffect(() => {
    if (!overlayAdjustOpen) return;
    const handler = (e) => {
      if (overlayAdjustRef.current && !overlayAdjustRef.current.contains(e.target)) {
        setOverlayAdjustOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [overlayAdjustOpen]);

  // 線画化
  const [isLineArt, setIsLineArt] = useState(false);
  const [lineArtThreshold, setLineArtThreshold] = useState(30);
  const [lineArtAdjustOpen, setLineArtAdjustOpen] = useState(false);
  const lineArtAdjustRef = useRef(null);
  const lineArtCacheRef = useRef({});
  const [lineArtCache, setLineArtCache] = useState({});
  const lineArtProcessTimerRef = useRef(null);

  // 線画化: crossOrigin成功→Sobel / CORS失敗→CSSフィルター代替
  const processLineArtImage = useCallback((url, threshold) => {
    const cacheKey = `${url}__${threshold}`;
    if (lineArtCacheRef.current[cacheKey] !== undefined) return;
    lineArtCacheRef.current[cacheKey] = 'loading';

    const setCssFallback = () => {
      lineArtCacheRef.current[cacheKey] = 'css-fallback';
      setLineArtCache(prev => ({ ...prev, [cacheKey]: 'css-fallback' }));
    };

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const maxSize = 600;
      const scale = Math.min(1, maxSize / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      try {
        const { data } = ctx.getImageData(0, 0, w, h);
        // グレースケール変換
        const gray = new Float32Array(w * h);
        for (let i = 0; i < gray.length; i++) {
          gray[i] = 0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2];
        }
        // ガウスぼかし 3x3
        const k = [1/16, 2/16, 1/16, 2/16, 4/16, 2/16, 1/16, 2/16, 1/16];
        const blurred = new Float32Array(w * h);
        for (let y = 1; y < h-1; y++) {
          for (let x = 1; x < w-1; x++) {
            blurred[y*w+x] =
              k[0]*gray[(y-1)*w+(x-1)] + k[1]*gray[(y-1)*w+x] + k[2]*gray[(y-1)*w+(x+1)] +
              k[3]*gray[y*w+(x-1)]     + k[4]*gray[y*w+x]     + k[5]*gray[y*w+(x+1)]     +
              k[6]*gray[(y+1)*w+(x-1)] + k[7]*gray[(y+1)*w+x] + k[8]*gray[(y+1)*w+(x+1)];
          }
        }
        // Sobelエッジ検出 → 白背景・黒線
        const out = new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            let gx = 0, gy = 0;
            if (y > 0 && y < h-1 && x > 0 && x < w-1) {
              gx = -blurred[(y-1)*w+(x-1)] + blurred[(y-1)*w+(x+1)]
                   - 2*blurred[y*w+(x-1)]   + 2*blurred[y*w+(x+1)]
                   - blurred[(y+1)*w+(x-1)] + blurred[(y+1)*w+(x+1)];
              gy = -blurred[(y-1)*w+(x-1)] - 2*blurred[(y-1)*w+x] - blurred[(y-1)*w+(x+1)]
                   + blurred[(y+1)*w+(x-1)] + 2*blurred[(y+1)*w+x] + blurred[(y+1)*w+(x+1)];
            }
            const val = Math.sqrt(gx*gx + gy*gy) > threshold ? 0 : 255;
            const o = (y*w+x)*4;
            out[o] = out[o+1] = out[o+2] = val; out[o+3] = 255;
          }
        }
        ctx.putImageData(new ImageData(out, w, h), 0, 0);
        const dataURL = canvas.toDataURL('image/png');
        lineArtCacheRef.current[cacheKey] = dataURL;
        setLineArtCache(prev => ({ ...prev, [cacheKey]: dataURL }));
      } catch(e) {
        // getImageData失敗（tainted canvas）→ CSSフィルター代替
        setCssFallback();
      }
    };

    // CORS失敗 → CSSフィルター代替
    img.onerror = setCssFallback;
    img.src = url;
  }, []);

  // 線画化: isLineArt/threshold/pages変化時にデバウンスして処理
  useEffect(() => {
    if (!isLineArt) return;
    clearTimeout(lineArtProcessTimerRef.current);
    lineArtProcessTimerRef.current = setTimeout(() => {
      pages.forEach(page => {
        page.images.forEach(cutImages => {
          cutImages.forEach(url => { if (url) processLineArtImage(url, lineArtThreshold); });
        });
      });
    }, 300);
    return () => clearTimeout(lineArtProcessTimerRef.current);
  }, [isLineArt, lineArtThreshold, pages, processLineArtImage]);

  // 線画化調整パネルの外クリック閉じ
  useEffect(() => {
    if (!lineArtAdjustOpen) return;
    const handler = (e) => {
      if (lineArtAdjustRef.current && !lineArtAdjustRef.current.contains(e.target)) {
        setLineArtAdjustOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [lineArtAdjustOpen]);

  // 未保存変更の追跡
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // スマホ・向き判定
  // screen.width/height は向きに関係ない物理サイズなので、横向き時も正しくスマホ判定できる
  const checkIsMobile = () => {
    if (typeof window === 'undefined') return false;
    const narrowSide = Math.min(window.screen.width, window.screen.height);
    return narrowSide < 768;
  };
  const [isMobile, setIsMobile] = useState(checkIsMobile);
  const [isPortrait, setIsPortrait] = useState(() =>
    typeof window !== 'undefined' && window.innerHeight > window.innerWidth
  );

  // 長押し関連
  const [longPressTarget, setLongPressTarget] = useState(null);
  const longPressTimer = useRef(null);

  // 初期データの同期
  useEffect(() => {
    if (initialPages && initialPages.length > 0) {
      setPages(initialPages.map(normalizePage));
    }
  }, [initialPages]);

  // ストーリーボード名の同期
  useEffect(() => {
    if (initialName) {
      setStoryboardName(initialName);
    }
  }, [initialName]);

  useEffect(() => {
    if (initialDialogueCharsPerSecond) {
      setDialogueCharsPerSecond(initialDialogueCharsPerSecond);
    }
  }, [initialDialogueCharsPerSecond]);

  // ページデータまたは名前が変更されたら未保存フラグを立てる
  useEffect(() => {
    if (storyboardId && user && pages.length > 0) {
      if (
        JSON.stringify(pages) === JSON.stringify((initialPages || []).map(normalizePage)) &&
        storyboardName === initialName &&
        dialogueCharsPerSecond === initialDialogueCharsPerSecond
      ) {
        return;
      }
      setHasUnsavedChanges(true);
    }
  }, [pages, storyboardName, dialogueCharsPerSecond]);

  // スマホ・向き検知
  useEffect(() => {
    const check = () => {
      setIsMobile(checkIsMobile());
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  // 手動保存ハンドラー
  const handleManualSave = () => {
    if (!storyboardId || !user) return;
    saveStoryboard(storyboardId, pages, storyboardName, dialogueCharsPerSecond);
    setHasUnsavedChanges(false);
  };

  const handleDialogueCharsPerSecondChange = (value) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setDialogueCharsPerSecond(value);
    }
  };

  const resolvedCharsPerSecond = () => {
    const n = parseFloat(dialogueCharsPerSecond);
    return !isNaN(n) && n > 0 ? n : DEFAULT_DIALOGUE_CHARS_PER_SECOND;
  };

  const hasAnyDialogueText = pages.some((page) =>
    (page.dialogueLines || []).some((lines) => countDialogueLinesChars(lines) > 0)
  );

  // ページ・カット指定で画像アップロード（Firebase Storage版）
  const handleImageUpload = async (pageIdx, cutIdx, event, addNew = false) => {
    const file = event.target.files[0];
    if (!file || !user) return;

    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      alert('JPEGまたはPNG形式の画像のみアップロード可能です');
      return;
    }

    const uploadKey = `${pageIdx}-${cutIdx}`;
    
    try {
      setUploadingImages(prev => new Set(prev).add(uploadKey));
      setImageUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));

      const frameId = `page${pageIdx}_cut${cutIdx}_${Date.now()}`;
      const uploadResult = await uploadImage(file, user.uid, frameId);

      setPages(prev => {
        const newPages = [...prev];
        const page = newPages[pageIdx];
        const cutImages = [...page.images[cutIdx]];
        const currentIdx = page.imageIndices[cutIdx];
        
        if (addNew) {
          cutImages.push(uploadResult.url);
          const newImageIndices = [...page.imageIndices];
          newImageIndices[cutIdx] = cutImages.length - 1;
          newPages[pageIdx] = {
            ...page,
            images: page.images.map((imgs, idx) => idx === cutIdx ? cutImages : imgs),
            imageIndices: newImageIndices
          };
        } else {
          cutImages[currentIdx] = uploadResult.url;
          newPages[pageIdx] = {
            ...page,
            images: page.images.map((imgs, idx) => idx === cutIdx ? cutImages : imgs)
          };
        }
        return newPages;
      });

      setImageUploadProgress(prev => ({ ...prev, [uploadKey]: 100 }));
      
    } catch (error) {
      console.error('画像アップロードエラー:', error);
      alert(`画像アップロードに失敗しました: ${error.message}`);
    } finally {
      setUploadingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(uploadKey);
        return newSet;
      });
      setTimeout(() => {
        setImageUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[uploadKey];
          return newProgress;
        });
      }, 2000);
    }
  };

  // 画像インデックスを変更
  const handleChangeImageIndex = (pageIdx, cutIdx, direction) => {
    setPages(prev => {
      const newPages = [...prev];
      const page = newPages[pageIdx];
      const cutImages = page.images[cutIdx];
      const currentIdx = page.imageIndices[cutIdx];
      
      let newIdx = currentIdx + direction;
      if (newIdx < 0) newIdx = cutImages.length - 1;
      if (newIdx >= cutImages.length) newIdx = 0;
      
      const newImageIndices = [...page.imageIndices];
      newImageIndices[cutIdx] = newIdx;
      newPages[pageIdx] = {
        ...page,
        imageIndices: newImageIndices
      };
      return newPages;
    });
  };

  // 現在の画像を削除
  const handleDeleteCurrentImage = (pageIdx, cutIdx) => {
    setPages(prev => {
      const newPages = [...prev];
      const page = newPages[pageIdx];
      const cutImages = [...page.images[cutIdx]];
      const currentIdx = page.imageIndices[cutIdx];
      
      if (cutImages.filter(img => img !== null).length <= 1) {
        cutImages[currentIdx] = null;
        newPages[pageIdx] = {
          ...page,
          images: page.images.map((imgs, idx) => idx === cutIdx ? cutImages : imgs)
        };
      } else {
        cutImages.splice(currentIdx, 1);
        const newIdx = Math.max(0, Math.min(currentIdx, cutImages.length - 1));
        const newImageIndices = [...page.imageIndices];
        newImageIndices[cutIdx] = newIdx;
        newPages[pageIdx] = {
          ...page,
          images: page.images.map((imgs, idx) => idx === cutIdx ? cutImages : imgs),
          imageIndices: newImageIndices
        };
      }
      return newPages;
    });
  };

  // ページ・カット指定で画像選択
  const handleFrameClick = (pageIdx, cutIdx, event) => {
    const clickedElement = event.target;
    const blendInputId = `blend-input-${pageIdx}-${cutIdx}`;

    if (clickedElement.id === blendInputId ||
      (clickedElement.tagName === 'LABEL' && clickedElement.htmlFor === blendInputId) ||
      clickedElement.closest(`label[for="${blendInputId}"]`)) {
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg, image/png';
    input.onchange = (e) => handleImageUpload(pageIdx, cutIdx, e);
    input.click();
  };

  const handleTextChange = (pageIdx, cutIdx, value) => {
    setPages(prev => {
      const newPages = [...prev];
      newPages[pageIdx] = {
        ...newPages[pageIdx],
        faceTexts: newPages[pageIdx].faceTexts.map((txt, idx) => idx === cutIdx ? value : txt)
      };
      return newPages;
    });
  };

  const handleDrawingChange = (pageIdx, cutIdx, value) => {
    setPages(prev => {
      const newPages = [...prev];
      newPages[pageIdx] = {
        ...newPages[pageIdx],
        drawingTexts: (newPages[pageIdx].drawingTexts || ['', '', '', '', '']).map((txt, idx) => idx === cutIdx ? value : txt)
      };
      return newPages;
    });
  };

  const handleScreenChange = (pageIdx, cutIdx, value) => {
    setPages(prev => {
      const newPages = [...prev];
      newPages[pageIdx] = {
        ...newPages[pageIdx],
        screenTexts: (newPages[pageIdx].screenTexts || ['', '', '', '', '']).map((txt, idx) => idx === cutIdx ? value : txt)
      };
      return newPages;
    });
  };

  const handleDialogueLinesChange = (pageIdx, cutIdx, lines) => {
    setPages(prev => {
      const newPages = [...prev];
      const page = newPages[pageIdx];
      const dialogueLines = [...(page.dialogueLines || emptyDialogueLinesForPage())];
      dialogueLines[cutIdx] = lines;
      newPages[pageIdx] = { ...page, dialogueLines };
      return newPages;
    });
  };

  const handleTimeChange = (pageIdx, cutIdx, value) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setPages(prev => {
        const newPages = [...prev];
        const page = newPages[pageIdx];
        const fps = getCutFrameRate(page, cutIdx);
        const frameStr = value === '' ? '' : formatFramesFromSeconds(value, fps);
        newPages[pageIdx] = {
          ...page,
          timeValues: page.timeValues.map((t, idx) => idx === cutIdx ? value : t),
          frameValues: (page.frameValues || ['', '', '', '', '']).map((f, idx) => idx === cutIdx ? frameStr : f)
        };
        return newPages;
      });
    }
  };

  const handleFrameChange = (pageIdx, cutIdx, value) => {
    if (value !== '' && !/^\d+$/.test(value)) return;
    setPages(prev => {
      const newPages = [...prev];
      const page = newPages[pageIdx];
      const fps = getCutFrameRate(page, cutIdx);
      const timeStr = value === '' ? '' : formatSecondsFromFrames(value, fps);
      newPages[pageIdx] = {
        ...page,
        frameValues: (page.frameValues || ['', '', '', '', '']).map((f, idx) => idx === cutIdx ? value : f),
        timeValues: page.timeValues.map((t, idx) => idx === cutIdx ? timeStr : t)
      };
      return newPages;
    });
  };

  const handleFrameRateChange = (pageIdx, cutIdx, fps) => {
    const newFps = resolveFrameRate(fps);
    setPages(prev => {
      const newPages = [...prev];
      const page = newPages[pageIdx];
      const frameValues = page.frameValues || ['', '', '', '', ''];
      const fv = frameValues[cutIdx];
      const t = page.timeValues[cutIdx];
      let newFrameValue = fv;
      let newTimeValue = t;
      if (fv !== '') {
        newTimeValue = formatSecondsFromFrames(fv, newFps);
      } else if (t !== '') {
        newFrameValue = formatFramesFromSeconds(t, newFps);
      }
      newPages[pageIdx] = {
        ...page,
        frameRateBases: (page.frameRateBases || defaultFrameRateBases()).map((r, idx) =>
          idx === cutIdx ? newFps : getCutFrameRate(page, idx)
        ),
        frameValues: frameValues.map((f, idx) => idx === cutIdx ? newFrameValue : f),
        timeValues: page.timeValues.map((tv, idx) => idx === cutIdx ? newTimeValue : tv)
      };
      return newPages;
    });
  };

  const applyDialogueTimingToPage = (page, cutIdx) => {
    const lines = getCutDialogueLines(page, cutIdx);
    const timing = calcTimingFromDialogueLines(
      lines,
      getCutFrameRate(page, cutIdx),
      resolvedCharsPerSecond()
    );
    if (!timing) return page;
    return {
      ...page,
      frameValues: (page.frameValues || ['', '', '', '', '']).map((f, idx) =>
        idx === cutIdx ? timing.frames : f
      ),
      timeValues: page.timeValues.map((t, idx) => idx === cutIdx ? timing.seconds : t)
    };
  };

  const handleApplyDialogueTiming = (pageIdx, cutIdx) => {
    setPages(prev => {
      const page = prev[pageIdx];
      const updated = applyDialogueTimingToPage(page, cutIdx);
      if (updated === page) return prev;
      const newPages = [...prev];
      newPages[pageIdx] = updated;
      return newPages;
    });
  };

  const handleApplyDialogueTimingAll = () => {
    setPages(prev => prev.map(page => {
      let updated = page;
      for (let cutIdx = 0; cutIdx < 5; cutIdx++) {
        const next = applyDialogueTimingToPage(updated, cutIdx);
        if (next !== updated) updated = next;
      }
      return updated;
    }));
  };

  const getCutDurationLabel = (cut) => {
    const fps = resolveFrameRate(cut.frameRateBase);
    if (cut.frameValue) return `${cut.frameValue}コマ(${fps})`;
    const sec = parseFloat(cut.timeValue);
    if (!isNaN(sec) && sec > 0) return `${sec}秒`;
    return '1秒';
  };

  const handleBlendFileChange = (pageIdx, cutIdx, file) => {
    if (file) {
      let filePath;
      if (window.webUtils && window.webUtils.getPathForFile) {
        filePath = window.webUtils.getPathForFile(file);
      } else {
        filePath = file.name;
      }

      setPages(prev => {
        const newPages = [...prev];
        newPages[pageIdx] = {
          ...newPages[pageIdx],
          blendFiles: newPages[pageIdx].blendFiles.map((b, idx) =>
            idx === cutIdx ? filePath : b
          )
        };
        return newPages;
      });
    }
  };

  const handleFolderChange = (pageIdx, cutIdx, files) => {
    if (files && files.length > 0) {
      let folderPath;
      if (window.webUtils && window.webUtils.getPathForFile) {
        const fullPath = window.webUtils.getPathForFile(files[0]);
        const sep = fullPath.includes('/') ? '/' : '\\';
        const parts = fullPath.split(sep);
        parts.pop();
        folderPath = parts.join(sep);
      } else {
        const relativePath = files[0].webkitRelativePath || '';
        folderPath = relativePath.split('/')[0] || files[0].name;
      }

      setPages(prev => {
        const newPages = [...prev];
        newPages[pageIdx] = {
          ...newPages[pageIdx],
          blendFiles: newPages[pageIdx].blendFiles.map((b, idx) =>
            idx === cutIdx ? folderPath : b
          )
        };
        return newPages;
      });
    }
  };

  // 全ページ・全カットをフラットにまとめる
  const flatCuts = pages.flatMap((page, pageIdx) =>
    [0, 1, 2, 3, 4].map(cutIdx => {
      const currentImageIdx = page.imageIndices[cutIdx];
      const currentImage = page.images[cutIdx][currentImageIdx];
      return {
        image: currentImage,
        faceText: page.faceTexts[cutIdx],
        drawingText: (page.drawingTexts || [])[cutIdx] || '',
        screenText: (page.screenTexts || [])[cutIdx] || '',
        dialogueText: formatDialogueDisplay(getCutDialogueLines(page, cutIdx)),
        dialogueLines: getCutDialogueLines(page, cutIdx),
        timeValue: page.timeValues[cutIdx],
        frameValue: (page.frameValues || [])[cutIdx] || '',
        frameRateBase: getCutFrameRate(page, cutIdx),
        blendFile: page.blendFiles[cutIdx],
        pageIdx,
        cutIdx
      };
    })
  );
  const totalCuts = flatCuts.length;

  // 再生ボタンのハンドラ
  const handlePlay = () => {
    if (isPlaying) return;
    setCurrentFrame(0);
    setIsPlaying(true);
  };

  // 停止ボタンのハンドラ
  const handleStop = () => {
    setIsPlaying(false);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  // 自動送り
  useEffect(() => {
    if (!isPlaying) return;
    if (playbackMode !== 'auto') return;
    if (currentFrame >= totalCuts) {
      setIsPlaying(false);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      return;
    }
    let sec = parseFloat(flatCuts[currentFrame].timeValue);
    if (isNaN(sec) || sec <= 0) sec = 1;
    const timer = setTimeout(() => {
      setCurrentFrame((prev) => prev + 1);
    }, sec * 1000);
    return () => clearTimeout(timer);
  }, [isPlaying, playbackMode, currentFrame, flatCuts, totalCuts]);

  // セリフ自動再生
  useEffect(() => {
    if (!isPlaying) return;
    if (!isAutoSpeak) return;
    if (!window.speechSynthesis) return;
    if (!flatCuts[currentFrame]) return;
    const text = formatDialogueSpeakText(flatCuts[currentFrame].dialogueLines || []).trim();
    if (!text) return;

    window.speechSynthesis.cancel();
    const utter = new window.SpeechSynthesisUtterance(text);
    utter.lang = 'ja-JP';
    window.speechSynthesis.speak(utter);

    return () => {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    };
  }, [isPlaying, isAutoSpeak, currentFrame, flatCuts]);

  // 手動再生: キーボード操作
  useEffect(() => {
    if (!isPlaying) return;
    if (playbackMode !== 'manual') return;

    const isTypingTarget = (target) => {
      if (!target) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (target.isContentEditable) return true;
      return false;
    };

    const onKeyDown = (e) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentFrame((prev) => Math.min(prev + 1, Math.max(0, totalCuts - 1)));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentFrame((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleStop();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPlaying, playbackMode, totalCuts]);

  // ページ追加
  const handleAddPage = () => {
    setPages(prev => [...prev, EMPTY_PAGE()]);
  };

  // localStorage保存
  const handleSave = () => {
    try {
      localStorage.setItem('storyboardPages', JSON.stringify(pages));
      alert('保存しました！');
    } catch (e) {
      alert('保存に失敗しました');
    }
  };

  // localStorageから復元
  const handleLoad = () => {
    try {
      const data = localStorage.getItem('storyboardPages');
      if (data) {
        const loadedPages = JSON.parse(data);
        const convertedPages = loadedPages.map(page => {
          if (page.images && Array.isArray(page.images) && page.images.length > 0) {
            const isOldFormat = !Array.isArray(page.images[0]);
            if (isOldFormat) {
              return normalizePage({
                ...page,
                images: page.images.map(img => [img]),
                imageIndices: page.imageIndices || [0, 0, 0, 0, 0]
              });
            }
          }
          return normalizePage({ ...page, imageIndices: page.imageIndices || [0, 0, 0, 0, 0] });
        });
        setPages(convertedPages);
        alert('読み込みました！');
      } else {
        alert('保存データがありません');
      }
    } catch (e) {
      alert('読み込みに失敗しました');
    }
  };

  // ストップウォッチ
  const handleStopwatchClick = () => {
    if (!isStopwatchRunning) {
      setIsStopwatchRunning(true);
      setStopwatchStart(Date.now());
      setStopwatchTime(null);
    } else {
      setIsStopwatchRunning(false);
      if (stopwatchStart) {
        const elapsed = (Date.now() - stopwatchStart) / 1000;
        setStopwatchTime(elapsed.toFixed(2));
      }
    }
  };

  const handleStopwatchReset = () => {
    setIsStopwatchRunning(false);
    setStopwatchStart(null);
    setStopwatchTime(null);
  };

  // カットの画像をすべてクリア（カット自体は残す）
  const handleClearCutImages = (pageIdx, cutIdx) => {
    if (!window.confirm(`カット ${pageIdx * 5 + cutIdx + 1} の画像をすべて削除しますか？\n（カット枠は残ります）`)) return;
    setPages(prev => {
      const newPages = [...prev];
      const page = newPages[pageIdx];
      newPages[pageIdx] = {
        ...page,
        images: page.images.map((imgs, idx) => idx === cutIdx ? [null] : imgs),
        imageIndices: page.imageIndices.map((v, idx) => idx === cutIdx ? 0 : v)
      };
      return newPages;
    });
  };

  // Fキーでボタン表示切り替え
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setAreButtonsHidden(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // JSONエクスポート
  const handleExport = () => {
    const data = { name: storyboardName, pages, dialogueCharsPerSecond: resolvedCharsPerSecond() };
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = storyboardName && storyboardName.trim() ? storyboardName.trim() : 'storyboard';
    a.href = url;
    a.download = `${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // セリフだけをカットまたぎの連番でMarkdown出力
  const handleExportDialogueMd = () => {
    const cuts = flattenPagesToCuts(pages);
    const lines = [];
    cuts.forEach((cut, idx) => {
      const text = (cut.dialogueText || '').trim();
      if (!text) return;
      const oneLine = text.replace(/\s*\n\s*/g, ' ');
      lines.push(`${idx + 1}. ${oneLine}`);
    });
    const safeName = storyboardName && storyboardName.trim() ? storyboardName.trim() : 'storyboard';
    const body = lines.length ? lines.join('\n') : '（セリフがありません）';
    const md = `# ${safeName} セリフ\n\n${body}\n`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}_セリフ.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // JSONインポート
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        let pagesData = [];
        
        if (imported.pages && Array.isArray(imported.pages)) {
          pagesData = imported.pages;
          setStoryboardName(imported.name || '');
          if (imported.dialogueCharsPerSecond != null) {
            setDialogueCharsPerSecond(imported.dialogueCharsPerSecond);
          }
        } else if (Array.isArray(imported)) {
          pagesData = imported;
          setStoryboardName('');
        }
        
        const convertedPages = pagesData.map(page => {
          if (page.images && Array.isArray(page.images) && page.images.length > 0) {
            const isOldFormat = !Array.isArray(page.images[0]);
            if (isOldFormat) {
              return normalizePage({
                ...page,
                images: page.images.map(img => [img]),
                imageIndices: page.imageIndices || [0, 0, 0, 0, 0]
              });
            }
          }
          return normalizePage({ ...page, imageIndices: page.imageIndices || [0, 0, 0, 0, 0] });
        });
        
        setPages(convertedPages);
        alert('インポートしました！');
      } catch {
        alert('インポートに失敗しました');
      }
    };
    reader.readAsText(file);
  };

  // フラットなカット配列からページ配列に再分割する関数
  function regroupPagesFromFlatCuts(flatCuts) {
    const pages = [];
    for (let i = 0; i < flatCuts.length; i += 5) {
      const group = flatCuts.slice(i, i + 5);
      while (group.length < 5) {
        group.push(EMPTY_CUT());
      }
      pages.push({
        images: group.map(c => c.images || [c.image || null]),
        imageIndices: group.map(c => c.imageIndex || 0),
        faceTexts: group.map(c => c.faceText),
        drawingTexts: group.map(c => c.drawingText || ''),
        screenTexts: group.map(c => c.screenText || ''),
        dialogueLines: group.map(c => c.dialogueLines || [EMPTY_DIALOGUE_LINE()]),
        timeValues: group.map(c => c.timeValue),
        frameValues: group.map(c => c.frameValue || ''),
        frameRateBases: group.map(c => resolveFrameRate(c.frameRateBase)),
        blendFiles: group.map(c => c.blendFile)
      });
    }
    return pages;
  }

  // カット挿入（以降のカットを繰り下げ、1ページ5カットを維持）
  const handleAddCutAt = (pageIdx, cutIdx) => {
    setPages(prev => {
      const flat = flattenPagesToCuts(prev);
      const lastHadContent = flat.length > 0 && isCutFilled(flat[flat.length - 1]);
      const maxWithoutNewPage = Math.ceil(flat.length / 5) * 5;

      const insertIdx = pageIdx * 5 + cutIdx + 1;
      flat.splice(insertIdx, 0, EMPTY_CUT());

      if (!lastHadContent && flat.length > maxWithoutNewPage) {
        flat.length = maxWithoutNewPage;
      }

      if (flat.length === 0) return [EMPTY_PAGE()];
      return regroupPagesFromFlatCuts(flat);
    });
  };

  // AI補助ボタンのハンドラ
  const handleAIAssist = (pageIdx, cutIdx) => {
    setSelectedAIFrame({ pageIdx, cutIdx });
    setAiPanelVisible(true);
  };

  // AI生成画像のフレーム適用
  const handleAIFrameGenerated = (pageIdx, cutIdx, imageData) => {
    setPages(prev => {
      const newPages = [...prev];
      const page = newPages[pageIdx];
      const cutImages = [...page.images[cutIdx]];
      const currentIdx = page.imageIndices[cutIdx];
      cutImages[currentIdx] = imageData;
      newPages[pageIdx] = {
        ...page,
        images: page.images.map((imgs, idx) => idx === cutIdx ? cutImages : imgs)
      };
      return newPages;
    });
  };

  // カット削除（カットそのものを削除し、以降のカットを繰り上げる）
  const handleDeleteCut = (pageIdx, cutIdx) => {
    const globalCutNum = pageIdx * 5 + cutIdx + 1;
    if (!window.confirm(`カット ${globalCutNum} を削除しますか？\nカット内のデータがすべて消え、以降のカットが繰り上がります。`)) return;
    setPages(prev => {
      const flat = flattenPagesToCuts(prev);
      const delIdx = pageIdx * 5 + cutIdx;
      flat.splice(delIdx, 1);
      if (flat.length === 0) return [EMPTY_PAGE()];
      return regroupPagesFromFlatCuts(flat);
    });
  };

  // ---- スマホ専用: 長押しハンドラ ----
  const handleCutTouchStart = (pageIdx, cutIdx) => {
    longPressTimer.current = setTimeout(() => {
      setLongPressTarget({ pageIdx, cutIdx });
    }, 600);
  };

  const handleCutTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // カット移動（上/下）
  const handleMoveCut = (fromPageIdx, fromCutIdx, direction) => {
    setPages(prev => {
      const flat = flattenPagesToCuts(prev);
      const fromIdx = fromPageIdx * 5 + fromCutIdx;
      const toIdx = fromIdx + direction;
      if (toIdx < 0 || toIdx >= flat.length) return prev;
      const [moved] = flat.splice(fromIdx, 1);
      flat.splice(toIdx, 0, moved);
      return regroupPagesFromFlatCuts(flat);
    });
    setLongPressTarget(null);
  };

  // ---- デスクトップ用スタイル定義 ----
  const styles = {
    container: { padding: '32px', backgroundColor: '#f3f4f6', minHeight: '100vh' },
    wrapper: { maxWidth: '1152px', margin: '0 auto', backgroundColor: 'white', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' },
    headerSection: { borderBottom: '2px solid black', padding: '16px' },
    headerContent: { display: 'flex' },
    headerLeft: { flex: 0.2 },
    headerText: { fontSize: '14px' },
    headerUnderline: { borderBottom: '1px solid #d1d5db', marginTop: '4px' },
    headerRight: { flex: 1, marginLeft: '16px' },
    headerUnderlineRight: { borderBottom: '1px solid #d1d5db', marginTop: '24px' },
    mainContent: { display: 'flex', position: 'relative' },
    leftSection: { display: 'flex' },
    rightSection: { display: 'flex', flex: 1 },
    columnHeader: { borderBottom: '1px solid #d1d5db', padding: '8px', textAlign: 'center', fontSize: '14px' },
    cutColumn: { borderRight: '2px solid black' },
    cutContent: { padding: '8px' },
    mvLabel: { width: '40px', color: '#9ca3af', fontSize: '9px' },
    screenColumn: { borderRight: '2px solid black' },
    framesContainer: { padding: '16px' },
    frameRow: { position: 'relative', marginBottom: '16px' },
    frame: { border: '4px solid black', width: '256px', height: '144px', cursor: 'pointer', overflow: 'hidden', backgroundColor: 'white', transition: 'background-color 0.15s' },
    frameHover: { backgroundColor: '#f9fafb' },
    frameImage: { width: '100%', height: '100%', objectFit: 'cover' },
    framePlaceholder: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' },
    placeholderContent: { textAlign: 'center' },
    plusIcon: { width: '32px', height: '32px', margin: '0 auto 8px' },
    placeholderText: { fontSize: '12px' },
    horizontalLine: { position: 'absolute', top: '160px', left: '-75px', right: '-233px', height: '1px', backgroundColor: '#d1d5db', zIndex: 10 },
    frameNumber: { position: 'absolute', top: '120px', left: '-60px', fontSize: '20px', color: '#374151', fontWeight: '500' },
    faceColumn: { borderRight: '1px solid #d1d5db', width: '120px', minWidth: '120px', maxWidth: '120px' },
    faceHeader: { width: '120px' },
    faceContent: { padding: '20px 12px' },
    faceInputRow: {
      marginBottom: '16px',
      height: '152px',
      minHeight: '152px',
      maxHeight: '152px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      background: 'transparent',
      boxSizing: 'border-box'
    },
    faceInputTop: {
      flex: '1 1 50%',
      minHeight: 0,
      overflow: 'hidden',
      boxSizing: 'border-box'
    },
    faceInputBottom: {
      flex: '1 1 50%',
      minHeight: 0,
      overflow: 'hidden',
      boxSizing: 'border-box',
      borderTop: '1px solid #e5e7eb'
    },
    faceInput: {
      width: '100%',
      height: '100%',
      minHeight: 0,
      border: '1px solid #d1d5db',
      borderRadius: '4px',
      padding: '4px 6px',
      fontSize: '12px',
      lineHeight: 1.4,
      resize: 'none',
      outline: 'none',
      fontFamily: 'inherit',
      boxSizing: 'border-box',
      overflow: 'auto',
      display: 'block'
    },
    faceInputReadonly: {
      width: '100%',
      height: '100%',
      minHeight: 0,
      fontSize: '12px',
      lineHeight: 1.4,
      color: '#222',
      padding: '4px 6px',
      boxSizing: 'border-box',
      overflow: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word'
    },
    contentColumn: { flex: 1, borderRight: '1px solid #d1d5db' },
    timeColumn: { width: '92px', minWidth: '92px' },
    timeContent: { padding: '20px 4px' },
    timeInputRow: { marginBottom: '16px', height: '152px', minHeight: '152px', maxHeight: '152px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px' },
    timeInput: { width: '100%', height: '28px', border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px 2px', fontSize: '11px', textAlign: 'center', outline: 'none', fontFamily: 'inherit' },
    frameInput: { width: '100%', height: '28px', border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px 2px', fontSize: '11px', textAlign: 'center', outline: 'none', fontFamily: 'inherit', background: '#f8fafc' },
    timeFieldLabel: { fontSize: '9px', color: '#9ca3af', lineHeight: 1 },
    footerNumber: { textAlign: 'right', padding: '8px', fontSize: '14px', color: '#6b7280' }
  };

  // =========================================================
  // モバイルレイアウト
  // =========================================================
  if (isMobile) {
    const globalCuts = pages.flatMap((page, pageIdx) =>
      page.images.map((_, cutIdx) => ({ page, pageIdx, cutIdx, globalIdx: pageIdx * 5 + cutIdx }))
    );

    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100vh - 82px)',
        backgroundColor: '#f1f5f9', fontFamily: 'inherit',
        overflow: 'hidden'
      }}>

        {/* ---- モバイル全画面再生オーバーレイ ---- */}
        {isPlaying && flatCuts[currentFrame] && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9999,
            background: '#000',
            overflow: 'hidden'
          }}>
            {/* 画像 - 全画面いっぱい */}
            {flatCuts[currentFrame].image ? (
              <img
                src={flatCuts[currentFrame].image}
                alt={`Frame ${currentFrame + 1}`}
                style={{
                  position: 'absolute',
                  top: 0, left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
              />
            ) : (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#111' }} />
            )}

            {/* フレーム番号（右上） */}
            <div style={{
              position: 'absolute',
              top: '16px', right: '16px',
              background: 'rgba(0,0,0,0.55)',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 600
            }}>
              {currentFrame + 1} / {totalCuts}
              {playbackMode === 'auto' && ` · ${getCutDurationLabel(flatCuts[currentFrame])}`}
            </div>

            {/* セリフ（コントロールの上） */}
            {flatCuts[currentFrame].dialogueText && (
              <div style={{
                position: 'absolute',
                bottom: '90px', left: 0, right: 0,
                background: 'rgba(0,0,0,0.6)',
                color: 'white',
                padding: '10px 20px',
                textAlign: 'center',
                fontSize: '16px',
                lineHeight: 1.5
              }}>
                {flatCuts[currentFrame].dialogueText}
              </div>
            )}

            {/* コントロール - 最下部オーバーレイ */}
            <div style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              padding: '16px 24px 28px',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px'
            }}>
              {playbackMode === 'manual' ? (
                <>
                  <button
                    onClick={() => setCurrentFrame(f => Math.max(0, f - 1))}
                    disabled={currentFrame === 0}
                    style={{
                      width: '64px', height: '56px',
                      background: currentFrame === 0 ? 'rgba(55,65,81,0.8)' : 'rgba(59,130,246,0.9)',
                      color: 'white', border: 'none', borderRadius: '12px',
                      fontSize: '22px', cursor: currentFrame === 0 ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', backdropFilter: 'blur(4px)'
                    }}
                  >◀</button>
                  <button
                    onClick={handleStop}
                    style={{
                      width: '72px', height: '56px',
                      background: 'rgba(239,68,68,0.9)',
                      color: 'white', border: 'none', borderRadius: '12px',
                      fontSize: '22px', cursor: 'pointer',
                      fontFamily: 'inherit', backdropFilter: 'blur(4px)'
                    }}
                  >■</button>
                  <button
                    onClick={() => setCurrentFrame(f => Math.min(f + 1, totalCuts - 1))}
                    disabled={currentFrame >= totalCuts - 1}
                    style={{
                      width: '64px', height: '56px',
                      background: currentFrame >= totalCuts - 1 ? 'rgba(55,65,81,0.8)' : 'rgba(59,130,246,0.9)',
                      color: 'white', border: 'none', borderRadius: '12px',
                      fontSize: '22px', cursor: currentFrame >= totalCuts - 1 ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', backdropFilter: 'blur(4px)'
                    }}
                  >▶</button>
                </>
              ) : (
                <button
                  onClick={handleStop}
                  style={{
                    padding: '14px 40px',
                    background: 'rgba(239,68,68,0.9)',
                    color: 'white', border: 'none', borderRadius: '12px',
                    fontSize: '18px', cursor: 'pointer',
                    fontFamily: 'inherit', backdropFilter: 'blur(4px)'
                  }}
                >■ 停止</button>
              )}
            </div>
          </div>
        )}

        {/* ---- 長押しメニュー ---- */}
        {longPressTarget && (
          <div
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setLongPressTarget(null)}
          >
            <div
              style={{ background: 'white', borderRadius: '16px', padding: '24px 32px', minWidth: '240px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ textAlign: 'center', marginBottom: '20px', fontWeight: 700, fontSize: '16px', color: '#1e293b' }}>
                カット {longPressTarget.pageIdx * 5 + longPressTarget.cutIdx + 1} を移動
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={() => handleMoveCut(longPressTarget.pageIdx, longPressTarget.cutIdx, -1)}
                  disabled={longPressTarget.pageIdx * 5 + longPressTarget.cutIdx === 0}
                  style={{
                    padding: '14px',
                    background: longPressTarget.pageIdx * 5 + longPressTarget.cutIdx === 0 ? '#e2e8f0' : '#3b82f6',
                    color: longPressTarget.pageIdx * 5 + longPressTarget.cutIdx === 0 ? '#94a3b8' : 'white',
                    border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 600,
                    cursor: longPressTarget.pageIdx * 5 + longPressTarget.cutIdx === 0 ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  ↑ 前に移動
                </button>
                <button
                  onClick={() => handleMoveCut(longPressTarget.pageIdx, longPressTarget.cutIdx, 1)}
                  disabled={longPressTarget.pageIdx * 5 + longPressTarget.cutIdx >= totalCuts - 1}
                  style={{
                    padding: '14px',
                    background: longPressTarget.pageIdx * 5 + longPressTarget.cutIdx >= totalCuts - 1 ? '#e2e8f0' : '#3b82f6',
                    color: longPressTarget.pageIdx * 5 + longPressTarget.cutIdx >= totalCuts - 1 ? '#94a3b8' : 'white',
                    border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 600,
                    cursor: longPressTarget.pageIdx * 5 + longPressTarget.cutIdx >= totalCuts - 1 ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  ↓ 後に移動
                </button>
                <button
                  onClick={() => setLongPressTarget(null)}
                  style={{
                    padding: '12px',
                    background: '#f1f5f9',
                    color: '#64748b',
                    border: 'none', borderRadius: '10px', fontSize: '15px',
                    cursor: 'pointer', fontFamily: 'inherit'
                  }}
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---- トップバー ---- */}
        <div style={{
          flexShrink: 0,
          background: '#1e293b',
          padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          <input
            type="text"
            value={storyboardName}
            onChange={e => setStoryboardName(e.target.value)}
            placeholder="絵コンテ名"
            style={{
              flex: 1,
              fontSize: '14px',
              padding: '6px 10px',
              border: '1px solid #475569',
              borderRadius: '6px',
              outline: 'none',
              fontFamily: 'inherit',
              background: '#334155',
              color: 'white',
              minWidth: 0
            }}
          />
          {storyboardId && user && (
            <button
              onClick={handleManualSave}
              disabled={saving || !hasUnsavedChanges}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                background: hasUnsavedChanges ? '#16a34a' : '#475569',
                color: 'white',
                border: 'none', borderRadius: '6px',
                cursor: hasUnsavedChanges ? 'pointer' : 'default',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                fontWeight: hasUnsavedChanges ? 600 : 400
              }}
            >
              {saving ? '⏳' : '💾'} 保存
            </button>
          )}
          {hasUnsavedChanges && (
            <span style={{ fontSize: '10px', color: '#fbbf24', whiteSpace: 'nowrap' }}>未保存</span>
          )}
        </div>

        {/* ---- 再生コントロールバー ---- */}
        <div style={{
          flexShrink: 0,
          background: 'white',
          borderBottom: '1px solid #e2e8f0',
          padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
          boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
        }}>
          {/* 再生モード */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: '#374151', userSelect: 'none' }}>
              <input type="radio" name="mob-playbackMode" value="auto"
                checked={playbackMode === 'auto'} onChange={() => setPlaybackMode('auto')} disabled={isPlaying}
                style={{ margin: 0 }} />
              自動
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: '#374151', userSelect: 'none' }}>
              <input type="radio" name="mob-playbackMode" value="manual"
                checked={playbackMode === 'manual'} onChange={() => setPlaybackMode('manual')} disabled={isPlaying}
                style={{ margin: 0 }} />
              手動
            </label>
          </div>

          <button
            onClick={handlePlay}
            disabled={isPlaying}
            style={{
              padding: '8px 18px', fontSize: '14px',
              background: isPlaying ? '#9ca3af' : '#10b981',
              color: 'white', border: 'none', borderRadius: '6px',
              cursor: isPlaying ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', fontWeight: 600
            }}
          >
            ▶ 再生
          </button>

          <button
            onClick={handleStop}
            disabled={!isPlaying}
            style={{
              padding: '8px 14px', fontSize: '14px',
              background: !isPlaying ? '#e2e8f0' : '#ef4444',
              color: !isPlaying ? '#94a3b8' : 'white',
              border: 'none', borderRadius: '6px',
              cursor: !isPlaying ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit'
            }}
          >
            ■ 停止
          </button>

          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#374151', whiteSpace: 'nowrap' }}>
            1秒
            <input
              type="text"
              value={dialogueCharsPerSecond}
              onChange={(e) => handleDialogueCharsPerSecondChange(e.target.value)}
              inputMode="decimal"
              style={{
                width: '36px', textAlign: 'center',
                border: '1px solid #d1d5db', borderRadius: '4px',
                padding: '2px 4px', fontSize: '12px', fontFamily: 'inherit'
              }}
            />
            文字
          </label>

          <DialogueTimingButton
            disabled={!hasAnyDialogueText}
            onClick={handleApplyDialogueTimingAll}
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#374151', userSelect: 'none' }}>
            <input type="checkbox" checked={isAutoSpeak} onChange={e => setIsAutoSpeak(e.target.checked)}
              disabled={isPlaying} style={{ margin: 0 }} />
            セリフ読み上げ
          </label>

          <button
            onClick={handleExportDialogueMd}
            style={{
              padding: '8px 14px', fontSize: '14px',
              background: '#0ea5e9', color: 'white',
              border: 'none', borderRadius: '6px',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600
            }}
            title="全カットのセリフを連番付きのMarkdownで書き出します"
          >
            セリフMD出力
          </button>
        </div>

        {/* ---- モバイル ストップウォッチ 右下オーバーレイ ---- */}
        <div style={{
          position: 'fixed',
          bottom: '20px', right: '14px',
          zIndex: 500,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px'
        }}>
          <button
            onClick={handleStopwatchClick}
            style={{
              padding: '7px 11px',
              background: isStopwatchRunning ? '#dc2626' : '#2563eb',
              color: 'white', border: 'none', borderRadius: '20px',
              fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: '5px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.25)'
            }}
            title="タイム計測"
          >
            ⏱ {isStopwatchRunning ? '計測中' : (stopwatchTime ? `${stopwatchTime}s` : '0.00')}
          </button>
          {(stopwatchTime !== null || isStopwatchRunning) && (
            <button
              onClick={handleStopwatchReset}
              style={{
                padding: '3px 10px',
                background: 'rgba(100,116,139,0.85)',
                color: 'white', border: 'none', borderRadius: '12px',
                fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
              }}
              title="ゼロに戻す"
            >
              ↺ リセット
            </button>
          )}
        </div>

        {/* ---- カットリスト ---- */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '12px 10px 40px'
        }}>
          {globalCuts.map(({ page, pageIdx, cutIdx, globalIdx }) => {
            const cutImages = page.images[cutIdx];
            const currentImgIdx = page.imageIndices[cutIdx];
            const currentImage = cutImages[currentImgIdx];
            const uploadKey = `${pageIdx}-${cutIdx}`;
            const isUploading = uploadingImages.has(uploadKey);

            return (
              <div key={`${pageIdx}-${cutIdx}`} style={{
                background: 'white',
                borderRadius: '12px',
                marginBottom: '12px',
                overflow: 'hidden',
                boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
                border: '1px solid #e2e8f0'
              }}>
                {/* カードヘッダー */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center',
                    padding: '8px 12px',
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    userSelect: 'none'
                  }}
                  onTouchStart={() => handleCutTouchStart(pageIdx, cutIdx)}
                  onTouchEnd={handleCutTouchEnd}
                  onTouchMove={handleCutTouchEnd}
                >
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                    カット {globalIdx + 1}
                  </span>
                  <span style={{ marginLeft: '6px', fontSize: '10px', color: '#94a3b8' }}>長押しで並び替え</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                    {/* 画像追加ボタン */}
                    <button
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/jpeg, image/png';
                        input.onchange = (ev) => handleImageUpload(pageIdx, cutIdx, ev, true);
                        input.click();
                      }}
                      style={{
                        padding: '4px 8px', fontSize: '13px',
                        background: '#10b981', color: 'white',
                        border: 'none', borderRadius: '5px',
                        cursor: 'pointer', fontFamily: 'inherit'
                      }}
                      title="画像を追加"
                    >
                      +
                    </button>
                    {/* 画像クリアボタン（画像がある場合のみ） */}
                    {cutImages.some(img => img !== null) && (
                      <button
                        onClick={() => handleClearCutImages(pageIdx, cutIdx)}
                        style={{
                          padding: '4px 8px', fontSize: '11px',
                          background: '#fff7ed', color: '#c2410c',
                          border: '1px solid #fed7aa', borderRadius: '5px',
                          cursor: 'pointer', fontFamily: 'inherit'
                        }}
                        title="このカットの画像をすべて削除"
                      >
                        🗑
                      </button>
                    )}
                    {/* カット挿入ボタン */}
                    <button
                      onClick={() => handleAddCutAt(pageIdx, cutIdx)}
                      style={{
                        padding: '4px 8px', fontSize: '13px',
                        background: '#3730a3', color: 'white',
                        border: 'none', borderRadius: '5px',
                        cursor: 'pointer', fontFamily: 'inherit'
                      }}
                      title="このカットの後に空カットを挿入"
                    >
                      ＋
                    </button>
                    {/* カット削除ボタン */}
                    <button
                      onClick={() => handleDeleteCut(pageIdx, cutIdx)}
                      style={{
                        padding: '4px 8px', fontSize: '11px',
                        background: '#ef4444', color: 'white',
                        border: 'none', borderRadius: '5px',
                        cursor: 'pointer', fontFamily: 'inherit'
                      }}
                      title="このカットを削除（以降のカットが繰り上がります）"
                    >
                      ✕
                    </button>
                    <button
                      onClick={() => handleAIAssist(pageIdx, cutIdx)}
                      style={{
                        padding: '4px 8px', fontSize: '11px',
                        background: '#6366f1', color: 'white',
                        border: 'none', borderRadius: '5px',
                        cursor: 'pointer', fontFamily: 'inherit'
                      }}
                    >
                      AI
                    </button>
                  </div>
                </div>

                {/* 画像エリア (16:9) */}
                <div
                  style={{
                    position: 'relative',
                    paddingTop: '56.25%', // 16:9
                    background: '#e2e8f0',
                    cursor: 'pointer',
                    overflow: 'hidden'
                  }}
                  onClick={(e) => handleFrameClick(pageIdx, cutIdx, e)}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                    {isUploading ? (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', color: '#3b82f6' }}>
                        <div style={{ fontSize: '24px' }}>⏳</div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>アップロード中...</div>
                      </div>
                    ) : currentImage ? (() => {
                        const laCacheKey = `${currentImage}__${lineArtThreshold}`;
                        const laCacheVal = lineArtCache[laCacheKey];
                        const isCssFallback = laCacheVal === 'css-fallback';
                        const laSrc = isLineArt && laCacheVal && laCacheVal !== 'loading' && !isCssFallback
                          ? laCacheVal : currentImage;
                        const laProcessing = isLineArt && (!laCacheVal || laCacheVal === 'loading');
                        const laFilter = isLineArt && isCssFallback
                          ? `grayscale(1) invert(1) contrast(${lineArtThreshold / 10}) brightness(1.1)`
                          : (!isLineArt && isGrayscale) ? `grayscale(1) contrast(${gsContrast}) brightness(${gsBrightness})` : 'none';
                        return (
                          <>
                            <img
                              src={laSrc}
                              alt={`Cut ${globalIdx + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', filter: laFilter }}
                            />
                            {isGrayOverlay && !isLineArt && (
                              <div style={{ position: 'absolute', inset: 0, background: `rgba(${overlayShade},${overlayShade},${overlayShade},${overlayOpacity})`, pointerEvents: 'none' }} />
                            )}
                            {laProcessing && (
                              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.6)', fontSize: '11px', color: '#6b7280', pointerEvents: 'none' }}>処理中...</div>
                            )}
                          </>
                        );
                      })()
                    : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '6px', color: '#94a3b8' }}>
                        <svg width="36" height="36" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                        </svg>
                        <span style={{ fontSize: '12px' }}>タップして画像追加</span>
                      </div>
                    )}

                    {/* 複数画像ナビゲーション */}
                    {cutImages.filter(Boolean).length > 1 && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleChangeImageIndex(pageIdx, cutIdx, -1); }}
                          style={{
                            position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
                            width: '36px', height: '36px',
                            background: 'rgba(0,0,0,0.55)', color: 'white',
                            border: 'none', borderRadius: '50%', fontSize: '16px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                          }}
                        >◀</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleChangeImageIndex(pageIdx, cutIdx, 1); }}
                          style={{
                            position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                            width: '36px', height: '36px',
                            background: 'rgba(0,0,0,0.55)', color: 'white',
                            border: 'none', borderRadius: '50%', fontSize: '16px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                          }}
                        >▶</button>
                        <div style={{
                          position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)',
                          background: 'rgba(0,0,0,0.6)', color: 'white',
                          padding: '2px 8px', borderRadius: '10px', fontSize: '11px'
                        }}>
                          {currentImgIdx + 1} / {cutImages.filter(Boolean).length}
                        </div>
                      </>
                    )}

                  </div>
                </div>

                {/* テキストエリア */}
                <div style={{ padding: '10px 12px' }}>
                  {/* 内容/作画/画面 タブ */}
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setContentMode('content')}
                      style={{
                        padding: '3px 12px', fontSize: '12px', border: 'none', borderRadius: '4px', cursor: 'pointer',
                        background: contentMode === 'content' ? '#3730a3' : '#e0e7ff',
                        color: contentMode === 'content' ? 'white' : '#3730a3',
                        fontWeight: contentMode === 'content' ? 700 : 400
                      }}
                    >内容</button>
                    <button
                      type="button"
                      onClick={() => setContentMode('drawing')}
                      style={{
                        padding: '3px 12px', fontSize: '12px', border: 'none', borderRadius: '4px', cursor: 'pointer',
                        background: contentMode === 'drawing' ? '#3730a3' : '#e0e7ff',
                        color: contentMode === 'drawing' ? 'white' : '#3730a3',
                        fontWeight: contentMode === 'drawing' ? 700 : 400
                      }}
                    >作画</button>
                    <button
                      type="button"
                      onClick={() => setContentMode('screen')}
                      style={{
                        padding: '3px 12px', fontSize: '12px', border: 'none', borderRadius: '4px', cursor: 'pointer',
                        background: contentMode === 'screen' ? '#3730a3' : '#e0e7ff',
                        color: contentMode === 'screen' ? 'white' : '#3730a3',
                        fontWeight: contentMode === 'screen' ? 700 : 400
                      }}
                    >画面</button>
                  </div>
                  <textarea
                    value={
                      contentMode === 'drawing' ? ((page.drawingTexts || [])[cutIdx] || '')
                      : contentMode === 'screen' ? ((page.screenTexts || [])[cutIdx] || '')
                      : page.faceTexts[cutIdx]
                    }
                    onChange={(e) =>
                      contentMode === 'drawing' ? handleDrawingChange(pageIdx, cutIdx, e.target.value)
                      : contentMode === 'screen' ? handleScreenChange(pageIdx, cutIdx, e.target.value)
                      : handleTextChange(pageIdx, cutIdx, e.target.value)
                    }
                    placeholder={contentMode === 'drawing' ? '作画...' : contentMode === 'screen' ? '画面作成タスク...' : '内容...'}
                    rows={2}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      border: '1px solid #e2e8f0', borderRadius: '6px',
                      padding: '6px 10px', fontSize: '13px',
                      resize: 'vertical', outline: 'none',
                      fontFamily: 'inherit', lineHeight: 1.5,
                      background: '#f8fafc',
                      color: '#111',
                      fontWeight: 600
                    }}
                  />

                  <div style={{ marginTop: '6px' }}>
                    <CutDialogueEditor
                      lines={getCutDialogueLines(page, cutIdx)}
                      onChange={(lines) => handleDialogueLinesChange(pageIdx, cutIdx, lines)}
                      onApplyTiming={() => handleApplyDialogueTiming(pageIdx, cutIdx)}
                      canApplyTiming={countDialogueLinesChars(getCutDialogueLines(page, cutIdx)) > 0}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>秒:</span>
                    <input
                      type="text"
                      value={page.timeValues[cutIdx]}
                      onChange={(e) => handleTimeChange(pageIdx, cutIdx, e.target.value)}
                      placeholder="1.0"
                      inputMode="decimal"
                      style={{
                        width: '56px',
                        border: '1px solid #e2e8f0', borderRadius: '6px',
                        padding: '5px 8px', fontSize: '13px',
                        textAlign: 'center', outline: 'none',
                        fontFamily: 'inherit', background: '#f8fafc',
                        color: '#111',
                        fontWeight: 600
                      }}
                    />
                    <span style={{ fontSize: '12px', color: '#64748b' }}>コマ:</span>
                    <input
                      type="text"
                      value={(page.frameValues || [])[cutIdx] || ''}
                      onChange={(e) => handleFrameChange(pageIdx, cutIdx, e.target.value)}
                      placeholder="12"
                      inputMode="numeric"
                      style={{
                        width: '48px',
                        border: '1px solid #e2e8f0', borderRadius: '6px',
                        padding: '5px 8px', fontSize: '13px',
                        textAlign: 'center', outline: 'none',
                        fontFamily: 'inherit', background: '#f8fafc',
                        color: '#111',
                        fontWeight: 600
                      }}
                    />
                    <FrameRateSelector
                      mini
                      value={getCutFrameRate(page, cutIdx)}
                      onChange={(fps) => handleFrameRateChange(pageIdx, cutIdx, fps)}
                    />
                    {/* 順番移動ボタン */}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleMoveCut(pageIdx, cutIdx, -1)}
                        disabled={globalIdx === 0}
                        style={{
                          width: '36px', height: '36px',
                          background: globalIdx === 0 ? '#e2e8f0' : '#dbeafe',
                          color: globalIdx === 0 ? '#94a3b8' : '#1d4ed8',
                          border: `1px solid ${globalIdx === 0 ? '#cbd5e1' : '#93c5fd'}`,
                          borderRadius: '6px', fontSize: '16px',
                          cursor: globalIdx === 0 ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: 0, fontFamily: 'inherit'
                        }}
                        title="上に移動"
                      >↑</button>
                      <button
                        type="button"
                        onClick={() => handleMoveCut(pageIdx, cutIdx, 1)}
                        disabled={globalIdx >= totalCuts - 1}
                        style={{
                          width: '36px', height: '36px',
                          background: globalIdx >= totalCuts - 1 ? '#e2e8f0' : '#dbeafe',
                          color: globalIdx >= totalCuts - 1 ? '#94a3b8' : '#1d4ed8',
                          border: `1px solid ${globalIdx >= totalCuts - 1 ? '#cbd5e1' : '#93c5fd'}`,
                          borderRadius: '6px', fontSize: '16px',
                          cursor: globalIdx >= totalCuts - 1 ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: 0, fontFamily: 'inherit'
                        }}
                        title="下に移動"
                      >↓</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* ページ追加ボタン */}
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <button
              onClick={handleAddPage}
              style={{
                padding: '14px 32px', fontSize: '15px',
                background: '#2563eb', color: 'white',
                border: 'none', borderRadius: '10px',
                cursor: 'pointer', fontFamily: 'inherit',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(37,99,235,0.3)'
              }}
            >
              + ページ追加（カット5枚）
            </button>
          </div>
        </div>

        {/* AI補助パネル */}
        <StoryboardAIPanel
          isVisible={aiPanelVisible}
          selectedFrame={selectedAIFrame}
          pages={pages}
          onClose={() => setAiPanelVisible(false)}
          onFrameGenerated={handleAIFrameGenerated}
          onFrameUpdated={() => {}}
        />
      </div>
    );
  }

  // =========================================================
  // デスクトップレイアウト（既存）
  // =========================================================
  return (
    <div style={styles.container}>
      {/* ---- デスクトップ スティッキーコントロールバー ---- */}
      <div style={{
        position: 'sticky',
        top: '82px',
        zIndex: 890,
        backgroundColor: '#f3f4f6',
        paddingTop: '8px',
        paddingBottom: '4px',
        borderBottom: '1px solid #e5e7eb',
        marginBottom: '4px'
      }}>
      {/* PDF保存ボタンとストップウォッチを横並びに */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '6px' }}>
        <ExportPDFButton targetRef={exportRef} pageRefs={pageRefs} pages={pages} setIsExportingPDF={setIsExportingPDF} />
        <ExportDavinciButton flatCuts={flatCuts} storyboardName={storyboardName} />
        
        {/* ボタン表示切り替えボタン */}
        <button
          onClick={() => setAreButtonsHidden(!areButtonsHidden)}
          style={{
            padding: '6px 12px', fontSize: '13px',
            background: areButtonsHidden ? '#ef4444' : '#6b7280',
            color: 'white', border: 'none', borderRadius: '4px',
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: '6px',
            transition: 'background 0.2s'
          }}
          title={areButtonsHidden ? 'ボタンを表示 (Fキー)' : 'ボタンを非表示 (Fキー)'}
        >
          <span style={{ fontSize: '16px' }}>{areButtonsHidden ? '👁️' : '🙈'}</span>
          <span>{areButtonsHidden ? 'ボタン表示' : 'ボタン非表示'}</span>
          <span style={{ fontSize: '11px', opacity: 0.8, marginLeft: '2px', background: 'rgba(0,0,0,0.2)', padding: '1px 4px', borderRadius: '3px' }}>F</span>
        </button>

        {/* 手動保存ボタン */}
        {storyboardId && user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleManualSave}
              disabled={saving || !hasUnsavedChanges}
              style={{
                padding: '6px 16px', fontSize: '13px',
                background: hasUnsavedChanges ? '#16a34a' : '#d1d5db',
                color: hasUnsavedChanges ? 'white' : '#6b7280',
                border: 'none', borderRadius: '4px',
                cursor: hasUnsavedChanges ? 'pointer' : 'default',
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'background 0.2s',
                fontWeight: hasUnsavedChanges ? 600 : 400
              }}
              title={hasUnsavedChanges ? 'クラウドに保存する' : '変更なし'}
            >
              <span style={{ fontSize: '15px' }}>{saving ? '⏳' : '💾'}</span>
              <span>{saving ? '保存中...' : '保存'}</span>
            </button>
            {lastSaved && !hasUnsavedChanges && (
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                {lastSaved.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 保存済み
              </span>
            )}
            {hasUnsavedChanges && (
              <span style={{ fontSize: '12px', color: '#b45309' }}>未保存の変更あり</span>
            )}
          </div>
        )}
      </div>

      {/* ストップウォッチ（デスクトップ固定） */}
      <div style={{
        position: 'fixed', top: '50%', right: '24px', transform: 'translateY(-50%)',
        zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'
      }}>
        <button
          onClick={handleStopwatchClick}
          style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: isStopwatchRunning ? '#dc2626' : '#2563eb',
            color: 'white', border: 'none',
            fontSize: '14px', fontWeight: 600,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer', fontFamily: 'inherit',
            outline: 'none', userSelect: 'none', transition: 'background 0.2s',
          }}
          title="クリックで計測開始/停止"
        >
          <span style={{ fontSize: '11px', marginBottom: '1px' }}>タイム</span>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>
            {isStopwatchRunning ? '...' : stopwatchTime ? stopwatchTime : '0.00'}
          </span>
        </button>
        {(stopwatchTime !== null || isStopwatchRunning) && (
          <button
            onClick={handleStopwatchReset}
            style={{
              padding: '3px 8px',
              background: 'rgba(100,116,139,0.85)',
              color: 'white', border: 'none', borderRadius: '10px',
              fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
              whiteSpace: 'nowrap'
            }}
            title="ゼロに戻す"
          >
            ↺ リセット
          </button>
        )}
      </div>

      {/* 再生コントロール */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>再生</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#374151', userSelect: 'none', lineHeight: 1 }}>
            <input type="radio" name="playbackMode" value="auto"
              checked={playbackMode === 'auto'} onChange={() => setPlaybackMode('auto')} disabled={isPlaying}
              style={{ transform: 'scale(0.9)', margin: 0 }} />
            自動
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#374151', userSelect: 'none', lineHeight: 1 }}>
            <input type="radio" name="playbackMode" value="manual"
              checked={playbackMode === 'manual'} onChange={() => setPlaybackMode('manual')} disabled={isPlaying}
              style={{ transform: 'scale(0.9)', margin: 0 }} />
            手動（←/→）
          </label>
        </div>
        <button
          onClick={handlePlay} disabled={isPlaying}
          style={{
            padding: '8px 24px', fontSize: '16px',
            background: isPlaying ? '#9ca3af' : '#10b981',
            color: 'white', border: 'none', borderRadius: '4px',
            cursor: isPlaying ? 'not-allowed' : 'pointer', fontFamily: 'inherit'
          }}
        >
          {isPlaying ? '再生中...' : '再生'}
        </button>
        <button
          onClick={handleStop} disabled={!isPlaying}
          style={{
            padding: '8px 24px', fontSize: '16px',
            background: !isPlaying ? '#9ca3af' : '#ef4444',
            color: 'white', border: 'none', borderRadius: '4px',
            cursor: !isPlaying ? 'not-allowed' : 'pointer', fontFamily: 'inherit'
          }}
        >
          停止
        </button>
        <button
          onClick={handleExport}
          style={{ padding: '8px 16px', fontSize: '14px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          エクスポート
        </button>
        <button
          onClick={handleExportDialogueMd}
          style={{ padding: '8px 16px', fontSize: '14px', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit' }}
          title="全カットのセリフを連番付きのMarkdownで書き出します"
        >
          セリフMD出力
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#374151', whiteSpace: 'nowrap' }}>
          1秒
          <input
            type="text"
            value={dialogueCharsPerSecond}
            onChange={(e) => handleDialogueCharsPerSecondChange(e.target.value)}
            inputMode="decimal"
            style={{
              width: '36px', textAlign: 'center',
              border: '1px solid #d1d5db', borderRadius: '4px',
              padding: '2px 4px', fontSize: '12px', fontFamily: 'inherit'
            }}
          />
          文字
        </label>
        <DialogueTimingButton
          disabled={!hasAnyDialogueText}
          onClick={handleApplyDialogueTimingAll}
        />
        <label style={{
          padding: '8px', display: 'inline-block', cursor: 'pointer',
          background: '#6366f1', color: 'white', borderRadius: '4px',
          fontSize: '14px', fontFamily: 'inherit', border: 'none', marginLeft: '4px',
        }}>
          インポート
          <input type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImport} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: '#374151', userSelect: 'none' }}>
          <input type="checkbox" checked={isAutoSpeak} onChange={e => setIsAutoSpeak(e.target.checked)}
            disabled={isPlaying} style={{ marginRight: '6px' }} />
          セリフも自動再生する
        </label>
      </div>
      </div>{/* /スティッキーコントロールバー */}

      {/* デスクトップ: 再生中の大きな表示 */}
      {isPlaying && flatCuts[currentFrame] && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '24px 0' }}>
          {flatCuts[currentFrame].image ? (
            <img
              src={flatCuts[currentFrame].image}
              alt={`Frame ${currentFrame + 1}`}
              style={{ width: '512px', height: '288px', objectFit: 'cover', border: '6px solid #2563eb', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}
            />
          ) : (
            <div style={{ width: '512px', height: '288px', background: 'black', border: '6px solid #2563eb', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }} />
          )}
          <div style={{ marginTop: '12px', fontSize: '18px', color: '#374151' }}>
            {currentFrame + 1}枚目 / {playbackMode === 'auto' ? getCutDurationLabel(flatCuts[currentFrame]) : '手動'}
          </div>
          {playbackMode === 'manual' && (
            <div style={{ marginTop: '6px', fontSize: '13px', color: '#6b7280' }}>←/→で移動（Escで停止）</div>
          )}
        </div>
      )}

      <div style={styles.wrapper} ref={exportRef}>
        {/* ヘッダー部分 */}
        <div style={styles.headerSection}>
          <div style={styles.headerContent}>
            <div style={styles.headerLeft}>
              <span style={styles.headerText}>No.</span>
              <input
                type="text"
                value={storyboardName}
                onChange={e => setStoryboardName(e.target.value)}
                placeholder="絵コンテ名"
                style={{ marginLeft: '12px', fontSize: '15px', padding: '2px 8px', border: '1px solid #d1d5db', borderRadius: '4px', outline: 'none', fontFamily: 'inherit', width: '180px' }}
              />
              <div style={styles.headerUnderline}></div>
            </div>
            <div style={styles.headerRight}>
              <div style={styles.headerUnderlineRight}></div>
            </div>
          </div>
          {!isExportingPDF && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setIsGrayscale(v => !v)}
                style={{
                  padding: '3px 12px', fontSize: '12px', border: '1px solid #d1d5db',
                  borderRadius: '4px', cursor: 'pointer',
                  background: isGrayscale ? '#374151' : '#f9fafb',
                  color: isGrayscale ? 'white' : '#374151',
                  fontWeight: isGrayscale ? 700 : 400,
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <span style={{ fontSize: '14px' }}>◑</span>
                グレースケール {isGrayscale ? 'ON' : 'OFF'}
              </button>
              {/* グレースケール調整ボタン */}
              <div style={{ position: 'relative' }} ref={gsAdjustRef}>
                <button
                  type="button"
                  onClick={() => setGsAdjustOpen(v => !v)}
                  title="グレースケール調整"
                  style={{
                    width: '24px', height: '24px', padding: 0,
                    border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer',
                    background: gsAdjustOpen ? '#e5e7eb' : '#f9fafb',
                    color: '#374151', fontSize: '14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >⚙</button>
                {gsAdjustOpen && (
                  <div style={{
                    position: 'absolute', top: '28px', left: 0, zIndex: 200,
                    background: 'white', border: '1px solid #d1d5db', borderRadius: '8px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '12px 16px',
                    minWidth: '200px'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', marginBottom: '10px', letterSpacing: '0.05em' }}>グレースケール調整</div>
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#374151', marginBottom: '4px' }}>
                        <span>コントラスト</span>
                        <span style={{ fontWeight: 700 }}>{gsContrast.toFixed(1)}</span>
                      </div>
                      <input
                        type="range" min="0.5" max="3.0" step="0.1"
                        value={gsContrast}
                        onChange={e => setGsContrast(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: '#374151' }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#374151', marginBottom: '4px' }}>
                        <span>明るさ</span>
                        <span style={{ fontWeight: 700 }}>{gsBrightness.toFixed(2)}</span>
                      </div>
                      <input
                        type="range" min="0.5" max="2.0" step="0.05"
                        value={gsBrightness}
                        onChange={e => setGsBrightness(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: '#374151' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => { setGsContrast(1.6); setGsBrightness(1.15); }}
                      style={{ marginTop: '10px', width: '100%', fontSize: '11px', padding: '3px 0', border: '1px solid #d1d5db', borderRadius: '4px', background: '#f3f4f6', cursor: 'pointer', color: '#6b7280' }}
                    >リセット</button>
                  </div>
                )}
              </div>
              {/* グレーオーバーレイ */}
              <button
                type="button"
                onClick={() => setIsGrayOverlay(v => !v)}
                style={{
                  padding: '3px 12px', fontSize: '12px', border: '1px solid #d1d5db',
                  borderRadius: '4px', cursor: 'pointer',
                  background: isGrayOverlay ? '#6b7280' : '#f9fafb',
                  color: isGrayOverlay ? 'white' : '#374151',
                  fontWeight: isGrayOverlay ? 700 : 400,
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <span style={{ fontSize: '13px' }}>▣</span>
                グレー幕 {isGrayOverlay ? 'ON' : 'OFF'}
              </button>
              <div style={{ position: 'relative' }} ref={overlayAdjustRef}>
                <button
                  type="button"
                  onClick={() => setOverlayAdjustOpen(v => !v)}
                  title="グレーオーバーレイ調整"
                  style={{
                    width: '24px', height: '24px', padding: 0,
                    border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer',
                    background: overlayAdjustOpen ? '#e5e7eb' : '#f9fafb',
                    color: '#374151', fontSize: '14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >⚙</button>
                {overlayAdjustOpen && (
                  <div style={{
                    position: 'absolute', top: '28px', left: 0, zIndex: 200,
                    background: 'white', border: '1px solid #d1d5db', borderRadius: '8px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '12px 16px',
                    minWidth: '200px'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', marginBottom: '10px', letterSpacing: '0.05em' }}>グレー幕調整</div>
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#374151', marginBottom: '4px' }}>
                        <span>透明度</span>
                        <span style={{ fontWeight: 700 }}>{Math.round(overlayOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range" min="0.05" max="1.0" step="0.05"
                        value={overlayOpacity}
                        onChange={e => setOverlayOpacity(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: '#6b7280' }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#374151', marginBottom: '4px' }}>
                        <span>グレーの明るさ</span>
                        <span style={{ fontWeight: 700 }}>{overlayShade < 86 ? '暗め' : overlayShade < 170 ? '中間' : '明るめ'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '10px', color: '#9ca3af' }}>黒</span>
                        <input
                          type="range" min="0" max="255" step="5"
                          value={overlayShade}
                          onChange={e => setOverlayShade(parseInt(e.target.value))}
                          style={{ flex: 1, accentColor: '#6b7280' }}
                        />
                        <span style={{ fontSize: '10px', color: '#9ca3af' }}>白</span>
                      </div>
                      <div style={{ marginTop: '6px', height: '14px', borderRadius: '3px', border: '1px solid #e5e7eb', background: `rgba(${overlayShade},${overlayShade},${overlayShade},${overlayOpacity})` }} />
                    </div>
                    <button
                      type="button"
                      onClick={() => { setOverlayOpacity(0.4); setOverlayShade(128); }}
                      style={{ marginTop: '10px', width: '100%', fontSize: '11px', padding: '3px 0', border: '1px solid #d1d5db', borderRadius: '4px', background: '#f3f4f6', cursor: 'pointer', color: '#6b7280' }}
                    >リセット</button>
                  </div>
                )}
              </div>
              {/* 線画化 */}
              <button
                type="button"
                onClick={() => setIsLineArt(v => !v)}
                style={{
                  padding: '3px 12px', fontSize: '12px', border: '1px solid #d1d5db',
                  borderRadius: '4px', cursor: 'pointer',
                  background: isLineArt ? '#1e293b' : '#f9fafb',
                  color: isLineArt ? 'white' : '#374151',
                  fontWeight: isLineArt ? 700 : 400,
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <span style={{ fontSize: '13px' }}>✏</span>
                線画化 {isLineArt ? 'ON' : 'OFF'}
              </button>
              <div style={{ position: 'relative' }} ref={lineArtAdjustRef}>
                <button
                  type="button"
                  onClick={() => setLineArtAdjustOpen(v => !v)}
                  title="線画化調整"
                  style={{
                    width: '24px', height: '24px', padding: 0,
                    border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer',
                    background: lineArtAdjustOpen ? '#e5e7eb' : '#f9fafb',
                    color: '#374151', fontSize: '14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >⚙</button>
                {lineArtAdjustOpen && (
                  <div style={{
                    position: 'absolute', top: '28px', left: 0, zIndex: 200,
                    background: 'white', border: '1px solid #d1d5db', borderRadius: '8px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '12px 16px',
                    minWidth: '220px'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', marginBottom: '4px', letterSpacing: '0.05em' }}>線画化調整</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>閾値が低いほど線が多く出ます</div>
                    <div style={{ fontSize: '10px', color: '#d1d5db', marginBottom: '10px' }}>※ CORS未設定の場合はCSSフィルター代替</div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#374151', marginBottom: '4px' }}>
                        <span>エッジ感度（閾値）</span>
                        <span style={{ fontWeight: 700 }}>{lineArtThreshold}</span>
                      </div>
                      <input
                        type="range" min="5" max="100" step="1"
                        value={lineArtThreshold}
                        onChange={e => setLineArtThreshold(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: '#1e293b' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ca3af' }}>
                        <span>線が多い</span><span>線が少ない</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLineArtThreshold(30)}
                      style={{ marginTop: '10px', width: '100%', fontSize: '11px', padding: '3px 0', border: '1px solid #d1d5db', borderRadius: '4px', background: '#f3f4f6', cursor: 'pointer', color: '#6b7280' }}
                    >リセット</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ページごとに描画 */}
        {pages.map((page, pageIdx) => (
          <div key={pageIdx}>
            <div style={styles.mainContent} ref={el => pageRefs.current[pageIdx] = el}>
              {isExportingPDF && (
                <div style={{
                  position: 'absolute', top: 0, left: '-80px', width: '100%',
                  fontWeight: 'bold', fontSize: '18px', color: '#222',
                  background: 'rgba(255,255,255,0.95)', padding: '8px 0 8px 12px',
                  zIndex: 100, borderBottom: '2px solid #222',
                }}>
                  {`${storyboardName || 'Storyboard'}-${pageIdx + 1}`}
                </div>
              )}

              {/* 左側のセクション */}
              <div style={styles.leftSection}>
                {/* カット列 */}
                <div style={styles.cutColumn}>
                  <div style={styles.columnHeader}>カット</div>
                  <div style={styles.cutContent}>
                    <div style={styles.mvLabel}>＜16:9＞</div>
                  </div>
                </div>

                {/* 画面列 */}
                <div style={styles.screenColumn}>
                  <div style={styles.columnHeader}>画面</div>
                  <div style={styles.framesContainer}>
                    {page.images.map((img, cutIdx) => (
                      <div key={cutIdx} style={styles.frameRow}>
                        <div
                          style={{ ...styles.frame, ...(hoveredFrame === `${pageIdx}-${cutIdx}` ? styles.frameHover : {}) }}
                          onClick={(e) => handleFrameClick(pageIdx, cutIdx, e)}
                          onMouseEnter={() => setHoveredFrame(`${pageIdx}-${cutIdx}`)}
                          onMouseLeave={() => setHoveredFrame(null)}
                          draggable
                          onDragStart={() => setDraggedCut({ pageIdx, cutIdx })}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => {
                            if (!draggedCut || (draggedCut.pageIdx === pageIdx && draggedCut.cutIdx === cutIdx)) return;
                            setPages(prev => {
                              const flatCutsList = flattenPagesToCuts(prev);
                              const fromIdx = draggedCut.pageIdx * 5 + draggedCut.cutIdx;
                              const toIdx = pageIdx * 5 + cutIdx;
                              const [moved] = flatCutsList.splice(fromIdx, 1);
                              flatCutsList.splice(toIdx, 0, moved);
                              return regroupPagesFromFlatCuts(flatCutsList);
                            });
                            setDraggedCut(null);
                          }}
                        >
                          {(() => {
                            const cutImages = page.images[cutIdx];
                            const currentIdx = page.imageIndices[cutIdx];
                            const currentImage = cutImages[currentIdx];
                            return (
                              <>
                                {currentImage ? (() => {
                                  const laCacheKey = `${currentImage}__${lineArtThreshold}`;
                                  const laCacheVal = lineArtCache[laCacheKey];
                                  const isCssFallback = laCacheVal === 'css-fallback';
                                  const laSrc = isLineArt && laCacheVal && laCacheVal !== 'loading' && !isCssFallback
                                    ? laCacheVal : currentImage;
                                  const laProcessing = isLineArt && (!laCacheVal || laCacheVal === 'loading');
                                  const laFilter = isLineArt && isCssFallback
                                    ? `grayscale(1) invert(1) contrast(${lineArtThreshold / 10}) brightness(1.1)`
                                    : (!isLineArt && isGrayscale) ? `grayscale(1) contrast(${gsContrast}) brightness(${gsBrightness})` : 'none';
                                  return (
                                    <>
                                      <img src={laSrc} alt={`Frame ${pageIdx * 5 + cutIdx + 1}`} style={{ ...styles.frameImage, filter: laFilter }} />
                                      {isGrayOverlay && !isLineArt && (
                                        <div style={{ position: 'absolute', inset: 0, background: `rgba(${overlayShade},${overlayShade},${overlayShade},${overlayOpacity})`, pointerEvents: 'none' }} />
                                      )}
                                      {laProcessing && (
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.6)', fontSize: '10px', color: '#6b7280', pointerEvents: 'none' }}>処理中...</div>
                                      )}
                                    </>
                                  );
                                })() : (
                                  <div style={styles.framePlaceholder}>
                                    <div style={styles.placeholderContent}>
                                      <svg style={styles.plusIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                      </svg>
                                    </div>
                                  </div>
                                )}

                                {!isExportingPDF && !areButtonsHidden && cutImages.filter(img => img !== null).length > 1 && (
                                  <>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleChangeImageIndex(pageIdx, cutIdx, -1); }}
                                      style={{ position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)', width: '32px', height: '32px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', fontSize: '18px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>◀</button>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleChangeImageIndex(pageIdx, cutIdx, 1); }}
                                      style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', width: '32px', height: '32px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', fontSize: '18px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>▶</button>
                                    <div style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', zIndex: 10 }}>
                                      {currentIdx + 1} / {cutImages.filter(img => img !== null).length}
                                    </div>
                                  </>
                                )}
                              </>
                            );
                          })()}

                          {!isExportingPDF && !areButtonsHidden && (
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg, image/png'; input.onchange = (ev) => handleImageUpload(pageIdx, cutIdx, ev, true); input.click(); }}
                              style={{ position: 'absolute', top: '4px', right: '4px', width: '28px', height: '28px', background: '#10b981', color: 'white', border: 'none', borderRadius: '50%', fontSize: '18px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                              title="画像を追加">+</button>
                          )}

                          {!isExportingPDF && !areButtonsHidden && (() => {
                            const cutImages = page.images[cutIdx];
                            const currentIdx = page.imageIndices[cutIdx];
                            const currentImage = cutImages[currentIdx];
                            return currentImage && (
                              <button type="button"
                                onClick={(e) => { e.stopPropagation(); if (window.confirm('この画像を削除しますか？')) { handleDeleteCurrentImage(pageIdx, cutIdx); } }}
                                style={{ position: 'absolute', top: '4px', left: '4px', width: '28px', height: '28px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', fontSize: '16px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                title="この画像を削除">×</button>
                            );
                          })()}

                          {/* 全画像クリアボタン（画像がある場合のみ） */}
                          {!isExportingPDF && !areButtonsHidden && (() => {
                            const cutImages = page.images[cutIdx];
                            const hasAnyImage = cutImages.some(img => img !== null);
                            return hasAnyImage && (
                              <button type="button"
                                onClick={(e) => { e.stopPropagation(); handleClearCutImages(pageIdx, cutIdx); }}
                                style={{ position: 'absolute', bottom: '4px', left: '4px', height: '22px', background: 'rgba(194,65,12,0.85)', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', whiteSpace: 'nowrap' }}
                                title="このカットの画像をすべて削除">🗑</button>
                            );
                          })()}

                          {!isExportingPDF && !areButtonsHidden && (
                            <AIAssistButton pageIdx={pageIdx} cutIdx={cutIdx} onAIAssist={handleAIAssist} />
                          )}

                          {/* カット挿入・削除ボタン（フレーム右下） */}
                          {!isExportingPDF && !areButtonsHidden && (
                            <div style={{ position: 'absolute', bottom: '4px', right: '4px', display: 'flex', gap: '4px', zIndex: 10 }}>
                              <button type="button"
                                onClick={e => { e.stopPropagation(); handleAddCutAt(pageIdx, cutIdx); }}
                                style={{ height: '22px', background: 'rgba(55,48,163,0.85)', color: 'white', border: 'none', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', whiteSpace: 'nowrap', lineHeight: 1 }}
                                title="このカットの後に空カットを挿入">＋</button>
                              <button type="button"
                                onClick={e => { e.stopPropagation(); handleDeleteCut(pageIdx, cutIdx); }}
                                style={{ height: '22px', background: 'rgba(239,68,68,0.85)', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', whiteSpace: 'nowrap' }}
                                title="このカットを削除（以降のカットが繰り上がります）">✕</button>
                            </div>
                          )}


                          {!isExportingPDF && !areButtonsHidden && (
                            <>
                              <input type="file" style={{ display: 'none' }}
                                id={`blend-input-${pageIdx}-${cutIdx}`}
                                onClick={(e) => e.stopPropagation()}
                                onChange={e => { if (e.target.files && e.target.files[0]) { handleBlendFileChange(pageIdx, cutIdx, e.target.files[0]); } }} />
                              <input type="file" webkitdirectory="" style={{ display: 'none' }}
                                id={`folder-input-${pageIdx}-${cutIdx}`}
                                onClick={(e) => e.stopPropagation()}
                                onChange={e => { if (e.target.files && e.target.files.length > 0) { handleFolderChange(pageIdx, cutIdx, e.target.files); e.target.value = ''; } }} />
                              <label htmlFor={`blend-input-${pageIdx}-${cutIdx}`}
                                title={page.blendFiles[cutIdx] ? `紐付け: ${page.blendFiles[cutIdx]}` : 'ファイルを紐付け'}
                                style={{ position: 'absolute', right: '-18px', bottom: '140px', width: '20px', height: '20px', background: page.blendFiles[cutIdx] ? '#10b981' : '#e5e7eb', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: 'pointer', border: '1px solid #d1d5db', zIndex: 2 }}
                                onClick={(e) => e.stopPropagation()}>
                                <span style={{ fontSize: '12px', color: page.blendFiles[cutIdx] ? 'white' : '#6b7280' }}>🗎</span>
                              </label>
                              <label htmlFor={`folder-input-${pageIdx}-${cutIdx}`}
                                title="フォルダを紐付け"
                                style={{ position: 'absolute', right: '-18px', bottom: '116px', width: '20px', height: '20px', background: '#e5e7eb', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: 'pointer', border: '1px solid #d1d5db', zIndex: 2 }}
                                onClick={(e) => e.stopPropagation()}>
                                <span style={{ fontSize: '12px', color: '#6b7280' }}>📁</span>
                              </label>
                              {page.blendFiles[cutIdx] && (
                                <label title="紐付けたファイル/フォルダを開く"
                                  style={{ position: 'absolute', right: '-18px', bottom: '4px', width: '20px', height: '20px', background: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: 'pointer', border: '1px solid #d1d5db', zIndex: 2 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.webUtils && window.webUtils.openFile) {
                                      window.webUtils.openFile(page.blendFiles[cutIdx]);
                                    } else {
                                      alert(`ファイルを開く機能は現在利用できません。\n\n紐付け先: ${page.blendFiles[cutIdx]}`);
                                    }
                                  }}>
                                  <span style={{ fontSize: '14px', color: 'white' }}>🔗</span>
                                </label>
                              )}
                            </>
                          )}
                        </div>
                        <div style={styles.frameNumber}>{pageIdx * 5 + cutIdx + 1}</div>
                        <div style={styles.horizontalLine}></div>
                      </div>
                    ))}

                  </div>
                </div>

                {/* 内容列 */}
                <div style={styles.faceColumn}>
                  <div style={{ ...styles.columnHeader, ...styles.faceHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px' }}>
                    {isExportingPDF ? (
                      <span>{contentMode === 'drawing' ? '作画' : contentMode === 'screen' ? '画面' : '内容'}</span>
                    ) : (
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <button
                          type="button"
                          onClick={() => setContentMode('content')}
                          style={{
                            padding: '2px 8px', fontSize: '11px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                            background: contentMode === 'content' ? '#3730a3' : '#e0e7ff',
                            color: contentMode === 'content' ? 'white' : '#3730a3',
                            fontWeight: contentMode === 'content' ? 700 : 400
                          }}
                        >内容</button>
                        <button
                          type="button"
                          onClick={() => setContentMode('drawing')}
                          style={{
                            padding: '2px 8px', fontSize: '11px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                            background: contentMode === 'drawing' ? '#3730a3' : '#e0e7ff',
                            color: contentMode === 'drawing' ? 'white' : '#3730a3',
                            fontWeight: contentMode === 'drawing' ? 700 : 400
                          }}
                        >作画</button>
                        <button
                          type="button"
                          onClick={() => setContentMode('screen')}
                          style={{
                            padding: '2px 8px', fontSize: '11px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                            background: contentMode === 'screen' ? '#3730a3' : '#e0e7ff',
                            color: contentMode === 'screen' ? 'white' : '#3730a3',
                            fontWeight: contentMode === 'screen' ? 700 : 400
                          }}
                        >画面</button>
                      </div>
                    )}
                  </div>
                  <div style={styles.faceContent}>
                    {[0, 1, 2, 3, 4].map((cutIdx) => (
                      <div key={cutIdx} style={styles.faceInputRow}>
                        <div style={styles.faceInputTop}>
                          {isExportingPDF ? (
                            <div style={styles.faceInputReadonly}>
                              {contentMode === 'drawing'
                                ? ((page.drawingTexts || [])[cutIdx] || <span style={{ color: '#bbb' }}>作画...</span>)
                                : contentMode === 'screen'
                                ? ((page.screenTexts || [])[cutIdx] || <span style={{ color: '#bbb' }}>画面作成タスク...</span>)
                                : (page.faceTexts[cutIdx] || <span style={{ color: '#bbb' }}>内容...</span>)
                              }
                            </div>
                          ) : (
                            <textarea
                              style={styles.faceInput}
                              value={
                                contentMode === 'drawing' ? ((page.drawingTexts || [])[cutIdx] || '')
                                : contentMode === 'screen' ? ((page.screenTexts || [])[cutIdx] || '')
                                : page.faceTexts[cutIdx]
                              }
                              onChange={(e) =>
                                contentMode === 'drawing' ? handleDrawingChange(pageIdx, cutIdx, e.target.value)
                                : contentMode === 'screen' ? handleScreenChange(pageIdx, cutIdx, e.target.value)
                                : handleTextChange(pageIdx, cutIdx, e.target.value)
                              }
                              placeholder={contentMode === 'drawing' ? '作画...' : contentMode === 'screen' ? '画面作成タスク...' : '内容...'}
                            />
                          )}
                        </div>
                        <div style={styles.faceInputBottom}>
                          <CutDialogueEditor
                            compact
                            fillHeight
                            readOnly={isExportingPDF}
                            lines={getCutDialogueLines(page, cutIdx)}
                            onChange={(lines) => handleDialogueLinesChange(pageIdx, cutIdx, lines)}
                            onApplyTiming={() => handleApplyDialogueTiming(pageIdx, cutIdx)}
                            canApplyTiming={countDialogueLinesChars(getCutDialogueLines(page, cutIdx)) > 0}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 右側のセクション */}
              <div style={styles.rightSection}>
                <div style={styles.timeColumn}>
                  <div style={styles.columnHeader}>秒/コマ</div>
                  <div style={styles.timeContent}>
                    {[0, 1, 2, 3, 4].map((cutIdx) => (
                      <div key={cutIdx} style={styles.timeInputRow}>
                        <FrameRateSelector
                          mini
                          value={getCutFrameRate(page, cutIdx)}
                          onChange={(fps) => handleFrameRateChange(pageIdx, cutIdx, fps)}
                        />
                        <span style={styles.timeFieldLabel}>秒</span>
                        <input type="text" style={styles.timeInput}
                          value={page.timeValues[cutIdx]}
                          onChange={(e) => handleTimeChange(pageIdx, cutIdx, e.target.value)}
                          placeholder="0.0" inputMode="decimal" />
                        <span style={styles.timeFieldLabel}>コマ</span>
                        <input type="text" style={styles.frameInput}
                          value={(page.frameValues || [])[cutIdx] || ''}
                          onChange={(e) => handleFrameChange(pageIdx, cutIdx, e.target.value)}
                          placeholder="12" inputMode="numeric" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* 下部の＋ボタン */}
        <div style={styles.footerNumber}>
          <button onClick={handleAddPage}
            style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '24px', cursor: 'pointer', padding: 0 }}
            title="ページを追加">＋</button>
        </div>
      </div>

      {/* AI補助パネル */}
      <StoryboardAIPanel
        isVisible={aiPanelVisible}
        selectedFrame={selectedAIFrame}
        pages={pages}
        onClose={() => setAiPanelVisible(false)}
        onFrameGenerated={handleAIFrameGenerated}
        onFrameUpdated={() => {}}
      />
    </div>
  );
};

export default StoryboardViewer;
