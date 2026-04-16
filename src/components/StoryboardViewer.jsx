import React, { useState, useRef, useEffect } from 'react';
import ExportPDFButton from './ExportPDFButton';
import AIAssistButton from './ai-assistant/AIAssistButton';
import StoryboardAIPanel from './ai-assistant/StoryboardAIPanel';
import { useAuth } from '../hooks/useAuth';
import { useStoryboard } from '../hooks/useStoryboard';
import { uploadImage, isBase64DataURL, migrateBase64ToStorage } from '../services/storage-service';

const EMPTY_PAGE = () => ({
  images: [[null], [null], [null], [null], [null]],
  imageIndices: [0, 0, 0, 0, 0],
  faceTexts: ['', '', '', '', ''],
  dialogueTexts: ['', '', '', '', ''],
  timeValues: ['', '', '', '', ''],
  blendFiles: ['', '', '', '', '']
});

const StoryboardViewer = ({ 
  storyboardId, 
  initialPages = [EMPTY_PAGE()], 
  storyboardName: initialName = '' 
}) => {
  const { user } = useAuth();
  const { saveStoryboard, saving, lastSaved } = useStoryboard();
  
  const [pages, setPages] = useState(initialPages);
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
  const [draggedCut, setDraggedCut] = useState(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [areButtonsHidden, setAreButtonsHidden] = useState(false);

  // AI補助機能用のstate
  const [aiPanelVisible, setAiPanelVisible] = useState(false);
  const [selectedAIFrame, setSelectedAIFrame] = useState(null);

  // Firebase Storage関連のstate
  const [uploadingImages, setUploadingImages] = useState(new Set());
  const [imageUploadProgress, setImageUploadProgress] = useState({});

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
      setPages(initialPages);
    }
  }, [initialPages]);

  // ストーリーボード名の同期
  useEffect(() => {
    if (initialName) {
      setStoryboardName(initialName);
    }
  }, [initialName]);

  // ページデータまたは名前が変更されたら未保存フラグを立てる
  useEffect(() => {
    if (storyboardId && user && pages.length > 0) {
      if (JSON.stringify(pages) === JSON.stringify(initialPages) && storyboardName === initialName) {
        return;
      }
      setHasUnsavedChanges(true);
    }
  }, [pages, storyboardName]);

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
    saveStoryboard(storyboardId, pages, storyboardName);
    setHasUnsavedChanges(false);
  };

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

  const handleDialogueChange = (pageIdx, cutIdx, value) => {
    setPages(prev => {
      const newPages = [...prev];
      newPages[pageIdx] = {
        ...newPages[pageIdx],
        dialogueTexts: newPages[pageIdx].dialogueTexts.map((txt, idx) => idx === cutIdx ? value : txt)
      };
      return newPages;
    });
  };

  const handleTimeChange = (pageIdx, cutIdx, value) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setPages(prev => {
        const newPages = [...prev];
        newPages[pageIdx] = {
          ...newPages[pageIdx],
          timeValues: newPages[pageIdx].timeValues.map((t, idx) => idx === cutIdx ? value : t)
        };
        return newPages;
      });
    }
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

  // 全ページ・全カットをフラットにまとめる
  const flatCuts = pages.flatMap((page, pageIdx) =>
    [0, 1, 2, 3, 4].map(cutIdx => {
      const currentImageIdx = page.imageIndices[cutIdx];
      const currentImage = page.images[cutIdx][currentImageIdx];
      return {
        image: currentImage,
        faceText: page.faceTexts[cutIdx],
        dialogueText: page.dialogueTexts[cutIdx],
        timeValue: page.timeValues[cutIdx],
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
    const text = (flatCuts[currentFrame].dialogueText || '').trim();
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
              return {
                ...page,
                images: page.images.map(img => [img]),
                imageIndices: page.imageIndices || [0, 0, 0, 0, 0]
              };
            }
          }
          return { ...page, imageIndices: page.imageIndices || [0, 0, 0, 0, 0] };
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
    const data = { name: storyboardName, pages: pages };
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
        } else if (Array.isArray(imported)) {
          pagesData = imported;
          setStoryboardName('');
        }
        
        const convertedPages = pagesData.map(page => {
          if (page.images && Array.isArray(page.images) && page.images.length > 0) {
            const isOldFormat = !Array.isArray(page.images[0]);
            if (isOldFormat) {
              return {
                ...page,
                images: page.images.map(img => [img]),
                imageIndices: page.imageIndices || [0, 0, 0, 0, 0]
              };
            }
          }
          return { ...page, imageIndices: page.imageIndices || [0, 0, 0, 0, 0] };
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
        group.push({
          images: [null],
          imageIndex: 0,
          faceText: '',
          dialogueText: '',
          timeValue: '',
          blendFile: ''
        });
      }
      pages.push({
        images: group.map(c => c.images || [c.image || null]),
        imageIndices: group.map(c => c.imageIndex || 0),
        faceTexts: group.map(c => c.faceText),
        dialogueTexts: group.map(c => c.dialogueText),
        timeValues: group.map(c => c.timeValue),
        blendFiles: group.map(c => c.blendFile)
      });
    }
    return pages;
  }

  // カット挿入
  const handleAddCutAt = (pageIdx, insertIdx) => {
    setPages(prev => {
      let newPages = [...prev];
      let page = { ...newPages[pageIdx] };
      page.images = [...page.images];
      page.imageIndices = [...page.imageIndices];
      page.faceTexts = [...page.faceTexts];
      page.dialogueTexts = [...page.dialogueTexts];
      page.timeValues = [...page.timeValues];
      page.blendFiles = [...page.blendFiles];

      page.images.splice(insertIdx, 0, [null]);
      page.imageIndices.splice(insertIdx, 0, 0);
      page.faceTexts.splice(insertIdx, 0, '');
      page.dialogueTexts.splice(insertIdx, 0, '');
      page.timeValues.splice(insertIdx, 0, '');
      page.blendFiles.splice(insertIdx, 0, '');

      const isFilled = (i) => {
        const hasImage = page.images[i] && page.images[i].some(img => img !== null);
        return (
          hasImage ||
          page.faceTexts[i] !== '' ||
          page.dialogueTexts[i] !== '' ||
          page.timeValues[i] !== '' ||
          page.blendFiles[i] !== ''
        );
      };

      let filledIndexes = [];
      for (let i = 0; i < page.images.length; i++) {
        if (isFilled(i)) filledIndexes.push(i);
      }

      while (filledIndexes.length > 5) {
        const overflowIndexes = filledIndexes.slice(5);
        const overflow = { images: [], imageIndices: [], faceTexts: [], dialogueTexts: [], timeValues: [], blendFiles: [] };
        for (let i = overflowIndexes.length - 1; i >= 0; i--) {
          const idx = overflowIndexes[i];
          overflow.images.unshift(page.images.splice(idx, 1)[0]);
          overflow.imageIndices.unshift(page.imageIndices.splice(idx, 1)[0]);
          overflow.faceTexts.unshift(page.faceTexts.splice(idx, 1)[0]);
          overflow.dialogueTexts.unshift(page.dialogueTexts.splice(idx, 1)[0]);
          overflow.timeValues.unshift(page.timeValues.splice(idx, 1)[0]);
          overflow.blendFiles.unshift(page.blendFiles.splice(idx, 1)[0]);
        }
        if (newPages[pageIdx + 1]) {
          let nextPage = { ...newPages[pageIdx + 1] };
          nextPage.images = [...overflow.images, ...nextPage.images];
          nextPage.imageIndices = [...overflow.imageIndices, ...nextPage.imageIndices];
          nextPage.faceTexts = [...overflow.faceTexts, ...nextPage.faceTexts];
          nextPage.dialogueTexts = [...overflow.dialogueTexts, ...nextPage.dialogueTexts];
          nextPage.timeValues = [...overflow.timeValues, ...nextPage.timeValues];
          nextPage.blendFiles = [...overflow.blendFiles, ...nextPage.blendFiles];
          newPages[pageIdx + 1] = nextPage;
          pageIdx = pageIdx + 1;
          page = nextPage;
          filledIndexes = [];
          for (let i = 0; i < page.images.length; i++) {
            if (isFilled(i)) filledIndexes.push(i);
          }
        } else {
          const EMPTY = () => ({
            images: [[null], [null], [null], [null], [null]],
            imageIndices: [0, 0, 0, 0, 0],
            faceTexts: ['', '', '', '', ''],
            dialogueTexts: ['', '', '', '', ''],
            timeValues: ['', '', '', '', ''],
            blendFiles: ['', '', '', '', '']
          });
          const newPage = EMPTY();
          for (let i = 0; i < overflow.images.length; i++) {
            newPage.images[i] = overflow.images[i];
            newPage.imageIndices[i] = overflow.imageIndices[i];
            newPage.faceTexts[i] = overflow.faceTexts[i];
            newPage.dialogueTexts[i] = overflow.dialogueTexts[i];
            newPage.timeValues[i] = overflow.timeValues[i];
            newPage.blendFiles[i] = overflow.blendFiles[i];
          }
          newPages.splice(pageIdx + 1, 0, newPage);
          break;
        }
      }
      newPages[pageIdx] = page;
      return newPages;
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

  // カット削除
  const handleDeleteCut = (pageIdx, cutIdx) => {
    setPages(prev => {
      const flatCuts = prev.flatMap((page) =>
        page.images.map((imgs, cIdx) => ({
          images: imgs,
          imageIndex: page.imageIndices[cIdx],
          faceText: page.faceTexts[cIdx],
          dialogueText: page.dialogueTexts[cIdx],
          timeValue: page.timeValues[cIdx],
          blendFile: page.blendFiles[cIdx]
        }))
      );
      const delIdx = pageIdx * 5 + cutIdx;
      flatCuts.splice(delIdx, 1);
      return regroupPagesFromFlatCuts(flatCuts);
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
      const flat = prev.flatMap((page) =>
        page.images.map((imgs, cIdx) => ({
          images: imgs,
          imageIndex: page.imageIndices[cIdx],
          faceText: page.faceTexts[cIdx],
          dialogueText: page.dialogueTexts[cIdx],
          timeValue: page.timeValues[cIdx],
          blendFile: page.blendFiles[cIdx]
        }))
      );
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
    faceContent: { padding: '9px 12px' },
    faceInputRow: { marginBottom: '2px', height: '165px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'transparent' },
    faceInput: { width: '100%', height: '40px', border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', resize: 'none', outline: 'none', fontFamily: 'inherit', marginBottom: '6px' },
    contentColumn: { flex: 1, borderRight: '1px solid #d1d5db' },
    timeColumn: { width: '60px' },
    timeContent: { padding: '16px 4px' },
    timeInputRow: { marginBottom: '16px', height: '144px', display: 'flex', alignItems: 'center' },
    timeInput: { width: '100%', height: '40px', border: '1px solid #d1d5db', borderRadius: '4px', padding: '8px 4px', fontSize: '12px', textAlign: 'center', outline: 'none', fontFamily: 'inherit' },
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
              {playbackMode === 'auto' && ` · ${parseFloat(flatCuts[currentFrame].timeValue) || 1}秒`}
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

          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#374151', userSelect: 'none' }}>
            <input type="checkbox" checked={isAutoSpeak} onChange={e => setIsAutoSpeak(e.target.checked)}
              disabled={isPlaying} style={{ margin: 0 }} />
            セリフ読み上げ
          </label>
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
                    <button
                      onClick={() => {
                        if (window.confirm(`カット ${globalIdx + 1} を削除しますか？`)) {
                          handleDeleteCut(pageIdx, cutIdx);
                        }
                      }}
                      style={{
                        padding: '4px 8px', fontSize: '11px',
                        background: '#fee2e2', color: '#dc2626',
                        border: '1px solid #fca5a5', borderRadius: '5px',
                        cursor: 'pointer', fontFamily: 'inherit'
                      }}
                    >
                      削除
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
                    ) : currentImage ? (
                      <img
                        src={currentImage}
                        alt={`Cut ${globalIdx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
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

                    {/* 画像追加ボタン */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/jpeg, image/png';
                        input.onchange = (ev) => handleImageUpload(pageIdx, cutIdx, ev, true);
                        input.click();
                      }}
                      style={{
                        position: 'absolute', top: '8px', right: '8px',
                        width: '30px', height: '30px',
                        background: '#10b981', color: 'white',
                        border: 'none', borderRadius: '50%', fontSize: '18px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                        zIndex: 2
                      }}
                      title="画像を追加"
                    >+</button>

                    {/* 画像削除ボタン */}
                    {currentImage && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('この画像を削除しますか？')) {
                            handleDeleteCurrentImage(pageIdx, cutIdx);
                          }
                        }}
                        style={{
                          position: 'absolute', top: '8px', left: '8px',
                          width: '30px', height: '30px',
                          background: '#ef4444', color: 'white',
                          border: 'none', borderRadius: '50%', fontSize: '16px',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                          zIndex: 2
                        }}
                        title="この画像を削除"
                      >×</button>
                    )}
                  </div>
                </div>

                {/* テキストエリア */}
                <div style={{ padding: '10px 12px' }}>
                  <textarea
                    value={page.faceTexts[cutIdx]}
                    onChange={(e) => handleTextChange(pageIdx, cutIdx, e.target.value)}
                    placeholder="内容..."
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

                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'flex-start' }}>
                    <textarea
                      value={page.dialogueTexts[cutIdx]}
                      onChange={(e) => handleDialogueChange(pageIdx, cutIdx, e.target.value)}
                      placeholder="セリフ..."
                      rows={2}
                      style={{
                        flex: 1,
                        border: '1px solid #e2e8f0', borderRadius: '6px',
                        padding: '6px 10px', fontSize: '13px',
                        resize: 'vertical', outline: 'none',
                        fontFamily: 'inherit', lineHeight: 1.5,
                        background: '#f8fafc',
                        color: '#111',
                        fontWeight: 600
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (window.speechSynthesis) {
                          const utter = new window.SpeechSynthesisUtterance(page.dialogueTexts[cutIdx]);
                          utter.lang = 'ja-JP';
                          window.speechSynthesis.speak(utter);
                        }
                      }}
                      style={{
                        padding: '6px 8px',
                        background: '#f1f5f9', border: '1px solid #e2e8f0',
                        borderRadius: '6px', cursor: 'pointer',
                        fontSize: '16px', lineHeight: 1,
                        flexShrink: 0, marginTop: '1px'
                      }}
                      title="セリフを読み上げる"
                    >
                      🔊
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>秒数:</span>
                    <input
                      type="text"
                      value={page.timeValues[cutIdx]}
                      onChange={(e) => handleTimeChange(pageIdx, cutIdx, e.target.value)}
                      placeholder="1.0"
                      inputMode="decimal"
                      style={{
                        width: '64px',
                        border: '1px solid #e2e8f0', borderRadius: '6px',
                        padding: '5px 8px', fontSize: '13px',
                        textAlign: 'center', outline: 'none',
                        fontFamily: 'inherit', background: '#f8fafc',
                        color: '#111',
                        fontWeight: 600
                      }}
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
            {currentFrame + 1}枚目 / {playbackMode === 'auto' ? `${parseFloat(flatCuts[currentFrame].timeValue) || 1}秒` : '手動'}
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
                              const flatCuts = prev.flatMap((page, pIdx) =>
                                page.images.map((imgs, cIdx) => ({
                                  images: imgs,
                                  imageIndex: page.imageIndices[cIdx],
                                  faceText: page.faceTexts[cIdx],
                                  dialogueText: page.dialogueTexts[cIdx],
                                  timeValue: page.timeValues[cIdx],
                                  blendFile: page.blendFiles[cIdx]
                                }))
                              );
                              const fromIdx = draggedCut.pageIdx * 5 + draggedCut.cutIdx;
                              const toIdx = pageIdx * 5 + cutIdx;
                              const [moved] = flatCuts.splice(fromIdx, 1);
                              flatCuts.splice(toIdx, 0, moved);
                              return regroupPagesFromFlatCuts(flatCuts);
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
                                {currentImage ? (
                                  <img src={currentImage} alt={`Frame ${pageIdx * 5 + cutIdx + 1}`} style={styles.frameImage} />
                                ) : (
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

                          {/* 一時的に非表示: このカットを削除ボタン (✕)
                          {!isExportingPDF && !areButtonsHidden && (
                            <button type="button"
                              onClick={e => { e.stopPropagation(); handleDeleteCut(pageIdx, cutIdx); }}
                              style={{ position: 'absolute', top: '130px', right: '-280px', width: '22px', height: '22px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', fontSize: '14px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                              title="このカットを削除">✕</button>
                          )}
                          */}

                          {/* 一時的に非表示: ここにカットを追加ボタン (＋ カット間)
                          {!isExportingPDF && !areButtonsHidden && (
                            <button type="button"
                              onClick={() => { handleAddCutAt(pageIdx, cutIdx); }}
                              style={{ position: 'absolute', right: '-210px', top: '-5%', transform: 'translateY(-50%)', zIndex: 1000, width: '24px', height: '24px', background: 'none', border: 'none', color: '#3730a3', fontSize: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, boxShadow: 'none' }}
                              title="ここにカットを追加">＋</button>
                          )}
                          */}

                          {!isExportingPDF && !areButtonsHidden && (
                            <>
                              <input type="file" accept=".blend" style={{ display: 'none' }}
                                id={`blend-input-${pageIdx}-${cutIdx}`}
                                onClick={(e) => e.stopPropagation()}
                                onChange={e => { if (e.target.files && e.target.files[0]) { handleBlendFileChange(pageIdx, cutIdx, e.target.files[0]); } }} />
                              <label htmlFor={`blend-input-${pageIdx}-${cutIdx}`}
                                title={page.blendFiles[cutIdx] ? `紐付け: ${page.blendFiles[cutIdx]}` : '.blendファイルを紐付け'}
                                style={{ position: 'absolute', right: '-18px', bottom: '140px', width: '20px', height: '20px', background: page.blendFiles[cutIdx] ? '#10b981' : '#e5e7eb', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: 'pointer', border: '1px solid #d1d5db', zIndex: 2 }}
                                onClick={(e) => e.stopPropagation()}>
                                <span style={{ fontSize: '12px', color: page.blendFiles[cutIdx] ? 'white' : '#6b7280' }}>🗎</span>
                              </label>
                              {page.blendFiles[cutIdx] && (
                                <label title="紐付けたファイルを開く"
                                  style={{ position: 'absolute', right: '-18px', bottom: '4px', width: '20px', height: '20px', background: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: 'pointer', border: '1px solid #d1d5db', zIndex: 2 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.webUtils && window.webUtils.openFile) {
                                      window.webUtils.openFile(page.blendFiles[cutIdx]);
                                    } else {
                                      alert(`ファイルを開く機能は現在利用できません。\n\n紐付けファイル: ${page.blendFiles[cutIdx]}`);
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

                    {/* 一時的に非表示: ここにカットを追加ボタン (＋ 行末)
                    {!isExportingPDF && !areButtonsHidden && (
                      <div style={{ position: 'relative', height: 0 }}>
                        <button type="button"
                          onClick={() => handleAddCutAt(pageIdx, page.images.length)}
                          style={{ position: 'absolute', right: '-40px', top: '0', zIndex: 30, width: '24px', height: '24px', background: 'none', border: 'none', color: '#3730a3', fontSize: '22px', cursor: page.images.length >= 5 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, pointerEvents: page.images.length >= 5 ? 'none' : 'auto', boxShadow: 'none' }}
                          title="ここにカットを追加"
                          disabled={page.images.length >= 5}>＋</button>
                      </div>
                    )}
                    */}
                  </div>
                </div>

                {/* 内容列 */}
                <div style={styles.faceColumn}>
                  <div style={{ ...styles.columnHeader, ...styles.faceHeader }}>内容</div>
                  <div style={styles.faceContent}>
                    {[0, 1, 2, 3, 4].map((cutIdx) => (
                      <div key={cutIdx} style={styles.faceInputRow}>
                        {isExportingPDF ? (
                          <div style={{ width: '100%', minHeight: '40px', fontSize: '13px', color: '#222', background: 'none', border: 'none', padding: '4px 8px', marginBottom: '6px', whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                            {page.faceTexts[cutIdx] || <span style={{ color: '#bbb' }}>内容...</span>}
                          </div>
                        ) : (
                          <textarea style={styles.faceInput}
                            value={page.faceTexts[cutIdx]}
                            onChange={(e) => handleTextChange(pageIdx, cutIdx, e.target.value)}
                            placeholder="内容..." rows={1} />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {isExportingPDF ? (
                            <div style={{ width: '100%', minHeight: '40px', fontSize: '13px', color: '#374151', background: 'none', border: 'none', padding: '4px 8px', whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                              {page.dialogueTexts[cutIdx] || <span style={{ color: '#bbb' }}>セリフ...</span>}
                            </div>
                          ) : (
                            <>
                              <textarea style={{ ...styles.faceInput, marginBottom: 0, flex: 1 }}
                                value={page.dialogueTexts[cutIdx]}
                                onChange={(e) => handleDialogueChange(pageIdx, cutIdx, e.target.value)}
                                placeholder="セリフ..." rows={1} />
                              <button type="button"
                                onClick={() => { if (window.speechSynthesis) { const utter = new window.SpeechSynthesisUtterance(page.dialogueTexts[cutIdx]); utter.lang = 'ja-JP'; window.speechSynthesis.speak(utter); } }}
                                style={{ marginLeft: '4px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '3px', padding: '1px 2px', cursor: 'pointer', fontSize: '12px', color: '#374151', lineHeight: 1, minWidth: '22px', minHeight: '22px' }}
                                title="セリフを読み上げる">🔊</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 右側のセクション */}
              <div style={styles.rightSection}>
                <div style={styles.timeColumn}>
                  <div style={styles.columnHeader}>秒</div>
                  <div style={styles.timeContent}>
                    {[0, 1, 2, 3, 4].map((cutIdx) => (
                      <div key={cutIdx} style={styles.timeInputRow}>
                        <input type="text" style={styles.timeInput}
                          value={page.timeValues[cutIdx]}
                          onChange={(e) => handleTimeChange(pageIdx, cutIdx, e.target.value)}
                          placeholder="0.0" inputMode="decimal" />
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
