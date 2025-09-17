import React, { useState, useRef, useEffect } from 'react';
import ExportPDFButton from './ExportPDFButton';
import AIAssistButton from './ai-assistant/AIAssistButton';
import StoryboardAIPanel from './ai-assistant/StoryboardAIPanel';

const EMPTY_PAGE = () => ({
  images: [null, null, null, null, null],
  faceTexts: ['', '', '', '', ''],
  dialogueTexts: ['', '', '', '', ''],
  timeValues: ['', '', '', '', ''],
  blendFiles: ['', '', '', '', '']
});

const StoryboardViewer = () => {
  const [pages, setPages] = useState([EMPTY_PAGE()]);
  const exportRef = useRef(null);
  const pageRefs = useRef([]); // 各ページごとのref
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isAutoSpeak, setIsAutoSpeak] = useState(false);
  const [hoveredFrame, setHoveredFrame] = useState(null);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [stopwatchStart, setStopwatchStart] = useState(null);
  const [stopwatchTime, setStopwatchTime] = useState(null);
  const [storyboardName, setStoryboardName] = useState('');
  const [draggedCut, setDraggedCut] = useState(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false); // PDFエクスポート中フラグ
  
  // AI補助機能用のstate
  const [aiPanelVisible, setAiPanelVisible] = useState(false);
  const [selectedAIFrame, setSelectedAIFrame] = useState(null);

  // ページ・カット指定で画像アップロード
  const handleImageUpload = (pageIdx, cutIdx, event) => {
    const file = event.target.files[0];
    if (file && (file.type === 'image/jpeg' || file.type === 'image/png')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        // 画像をリサイズして保存
        const img = new window.Image();
        img.onload = () => {
          const MAX_WIDTH = 512;
          const scale = MAX_WIDTH / img.width;
          const width = MAX_WIDTH;
          const height = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          // JPEG圧縮率0.7
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setPages(prev => {
            const newPages = [...prev];
            newPages[pageIdx] = {
              ...newPages[pageIdx],
              images: newPages[pageIdx].images.map((img, idx) => idx === cutIdx ? dataUrl : img)
            };
            return newPages;
          });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // ページ・カット指定で画像選択
  const handleFrameClick = (pageIdx, cutIdx, event) => {
    // blendファイルボタン（label要素またはその中のspan）がクリックされた場合は処理しない
    const clickedElement = event.target;
    const blendInputId = `blend-input-${pageIdx}-${cutIdx}`;

    // クリックされた要素がlabel自体、またはその子要素（span）、またはhidden input自体であればスキップ
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

  // ページ・カット指定でテキスト変更
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

  // ページ・カット指定でセリフ変更
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

  // ページ・カット指定で時間変更
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

  // blendファイル紐付け
  const handleBlendFileChange = (pageIdx, cutIdx, files) => {
    if (files && files.length > 0) {
      const file = files[0];
      // Electron 29以降推奨の方法
      const filePath = window.webUtils.getPathForFile(file);
      console.log('blendファイル紐付け:', filePath);

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
    [0, 1, 2, 3, 4].map(cutIdx => ({
      image: page.images[cutIdx],
      faceText: page.faceTexts[cutIdx],
      dialogueText: page.dialogueTexts[cutIdx],
      timeValue: page.timeValues[cutIdx],
      blendFile: page.blendFiles[cutIdx],
      pageIdx,
      cutIdx
    }))
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

  // 再生ロジック（全ページ対応）
  useEffect(() => {
    if (!isPlaying) return;
    if (currentFrame >= totalCuts) {
      setIsPlaying(false);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      return;
    }
    let sec = parseFloat(flatCuts[currentFrame].timeValue);
    if (isNaN(sec) || sec <= 0) sec = 1;
    if (isAutoSpeak && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utter = new window.SpeechSynthesisUtterance(flatCuts[currentFrame].dialogueText);
      utter.lang = 'ja-JP';
      window.speechSynthesis.speak(utter);
    }
    const timer = setTimeout(() => {
      setCurrentFrame((prev) => prev + 1);
    }, sec * 1000);
    return () => clearTimeout(timer);
  }, [isPlaying, currentFrame, flatCuts, isAutoSpeak]);

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
        setPages(JSON.parse(data));
        alert('読み込みました！');
      } else {
        alert('保存データがありません');
      }
    } catch (e) {
      alert('読み込みに失敗しました');
    }
  };

  // ストップウォッチのクリックハンドラ
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

  // JSONエクスポート
  const handleExport = () => {
    const data = {
      name: storyboardName,
      pages: pages
    };
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
        if (imported.pages && Array.isArray(imported.pages)) {
          setPages(imported.pages);
          setStoryboardName(imported.name || '');
        } else if (Array.isArray(imported)) {
          setPages(imported);
          setStoryboardName('');
        }
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
          image: null,
          faceText: '',
          dialogueText: '',
          timeValue: '',
          blendFile: ''
        });
      }
      pages.push({
        images: group.map(c => c.image),
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
      // 各配列に空要素を挿入
      page.images = [...page.images];
      page.faceTexts = [...page.faceTexts];
      page.dialogueTexts = [...page.dialogueTexts];
      page.timeValues = [...page.timeValues];
      page.blendFiles = [...page.blendFiles];
      // 挿入
      page.images.splice(insertIdx, 0, null);
      page.faceTexts.splice(insertIdx, 0, '');
      page.dialogueTexts.splice(insertIdx, 0, '');
      page.timeValues.splice(insertIdx, 0, '');
      page.blendFiles.splice(insertIdx, 0, '');

      // 空でないカットのみをカウント
      const isFilled = (i) => (
        page.images[i] !== null ||
        page.faceTexts[i] !== '' ||
        page.dialogueTexts[i] !== '' ||
        page.timeValues[i] !== '' ||
        page.blendFiles[i] !== ''
      );

      // 空でないカットのインデックスを取得
      let filledIndexes = [];
      for (let i = 0; i < page.images.length; i++) {
        if (isFilled(i)) filledIndexes.push(i);
      }

      // 6つ以上の空でないカットがある場合のみ分割
      while (filledIndexes.length > 5) {
        // 6つ目以降のfilledIndexesを取得
        const overflowIndexes = filledIndexes.slice(5);
        // 溢れた分を抽出
        const overflow = {
          images: [],
          faceTexts: [],
          dialogueTexts: [],
          timeValues: [],
          blendFiles: []
        };
        // 溢れた分をoverflowに格納し、元ページから削除
        for (let i = overflowIndexes.length - 1; i >= 0; i--) {
          const idx = overflowIndexes[i];
          overflow.images.unshift(page.images.splice(idx, 1)[0]);
          overflow.faceTexts.unshift(page.faceTexts.splice(idx, 1)[0]);
          overflow.dialogueTexts.unshift(page.dialogueTexts.splice(idx, 1)[0]);
          overflow.timeValues.unshift(page.timeValues.splice(idx, 1)[0]);
          overflow.blendFiles.unshift(page.blendFiles.splice(idx, 1)[0]);
        }
        // 次ページが存在するか
        if (newPages[pageIdx + 1]) {
          let nextPage = { ...newPages[pageIdx + 1] };
          nextPage.images = [...overflow.images, ...nextPage.images];
          nextPage.faceTexts = [...overflow.faceTexts, ...nextPage.faceTexts];
          nextPage.dialogueTexts = [...overflow.dialogueTexts, ...nextPage.dialogueTexts];
          nextPage.timeValues = [...overflow.timeValues, ...nextPage.timeValues];
          nextPage.blendFiles = [...overflow.blendFiles, ...nextPage.blendFiles];
          newPages[pageIdx + 1] = nextPage;
          // 次ページも再帰的に処理
          pageIdx = pageIdx + 1;
          page = nextPage;
          // filledIndexesを再計算
          filledIndexes = [];
          for (let i = 0; i < page.images.length; i++) {
            if (isFilled(i)) filledIndexes.push(i);
          }
        } else {
          // 新しいページを作成
          const EMPTY = () => ({
            images: [null, null, null, null, null],
            faceTexts: ['', '', '', '', ''],
            dialogueTexts: ['', '', '', '', ''],
            timeValues: ['', '', '', '', ''],
            blendFiles: ['', '', '', '', '']
          });
          const newPage = EMPTY();
          for (let i = 0; i < overflow.images.length; i++) {
            newPage.images[i] = overflow.images[i];
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

  // ページ内の配列長を5に揃える
  const normalizePageArrays = (page) => {
    const fill = (arr, val) => {
      while (arr.length < 5) arr.push(val);
      if (arr.length > 5) arr.length = 5;
      return arr;
    };
    return {
      ...page,
      images: fill(page.images, null),
      faceTexts: fill(page.faceTexts, ''),
      dialogueTexts: fill(page.dialogueTexts, ''),
      timeValues: fill(page.timeValues, ''),
      blendFiles: fill(page.blendFiles, ''),
    };
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
      newPages[pageIdx] = {
        ...newPages[pageIdx],
        images: newPages[pageIdx].images.map((img, idx) => 
          idx === cutIdx ? imageData : img
        )
      };
      return newPages;
    });
  };

  // カット削除
  const handleDeleteCut = (pageIdx, cutIdx) => {
    setPages(prev => {
      // 全カットをフラット化
      const flatCuts = prev.flatMap((page) =>
        page.images.map((img, cIdx) => ({
          image: img,
          faceText: page.faceTexts[cIdx],
          dialogueText: page.dialogueTexts[cIdx],
          timeValue: page.timeValues[cIdx],
          blendFile: page.blendFiles[cIdx]
        }))
      );
      // グローバルインデックス
      const delIdx = pageIdx * 5 + cutIdx;
      flatCuts.splice(delIdx, 1);
      // ページに再分割
      return regroupPagesFromFlatCuts(flatCuts);
    });
  };

  // スタイル定義
  const styles = {
    container: {
      padding: '32px',
      backgroundColor: '#f3f4f6',
      minHeight: '100vh'
    },
    wrapper: {
      maxWidth: '1152px',
      margin: '0 auto',
      backgroundColor: 'white',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
    },
    headerSection: {
      borderBottom: '2px solid black',
      padding: '16px'
    },
    headerContent: {
      display: 'flex'
    },
    headerLeft: {
      flex: 0.2
    },
    headerText: {
      fontSize: '14px'
    },
    headerUnderline: {
      borderBottom: '1px solid #d1d5db',
      marginTop: '4px'
    },
    headerRight: {
      flex: 1,
      marginLeft: '16px'
    },
    headerUnderlineRight: {
      borderBottom: '1px solid #d1d5db',
      marginTop: '24px'
    },
    mainContent: {
      display: 'flex',
      position: 'relative'
    },
    leftSection: {
      display: 'flex'
    },
    rightSection: {
      display: 'flex',
      flex: 1
    },
    columnHeader: {
      borderBottom: '1px solid #d1d5db',
      padding: '8px',
      textAlign: 'center',
      fontSize: '14px'
    },
    cutColumn: {
      borderRight: '2px solid black'
    },
    cutContent: {
      padding: '8px'
    },
    mvLabel: {
      width: '40px',
      color: '#9ca3af',
      fontSize: '9px'
    },
    screenColumn: {
      borderRight: '2px solid black'
    },
    framesContainer: {
      padding: '16px'
    },
    frameRow: {
      position: 'relative',
      marginBottom: '16px'
    },
    frame: {
      border: '4px solid black',
      width: '256px',
      height: '144px',
      cursor: 'pointer',
      overflow: 'hidden',
      backgroundColor: 'white',
      transition: 'background-color 0.15s'
    },
    frameHover: {
      backgroundColor: '#f9fafb'
    },
    frameImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    },
    framePlaceholder: {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#9ca3af'
    },
    placeholderContent: {
      textAlign: 'center'
    },
    plusIcon: {
      width: '32px',
      height: '32px',
      margin: '0 auto 8px'
    },
    placeholderText: {
      fontSize: '12px'
    },
    horizontalLine: {
      position: 'absolute',
      top: '160px', // フレームの高さ(144px) + ボーダー(8px) + 少し余白（少し上に調整）
      left: '-75px', // カット列の左端から開始
      right: '-233px', // 分・秒列の右端まで延長
      height: '1px',
      backgroundColor: '#d1d5db',
      zIndex: 10
    },
    frameNumber: {
      position: 'absolute',
      top: '120px', // 横線のちょっと上
      left: '-60px', // カット列内の位置
      fontSize: '20px',
      color: '#374151',
      fontWeight: '500'
    },
    faceColumn: {
      borderRight: '1px solid #d1d5db',
      width: '120px', // 幅を固定
      minWidth: '120px',
      maxWidth: '120px'
    },
    faceHeader: {
      width: '120px'
    },
    faceContent: {
      padding: '9px 12px'
    },
    faceInputRow: {
      marginBottom: '2px',
      height: '165px', // ペアごとに十分な高さ
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent'
    },
    faceInput: {
      width: '100%',
      height: '40px', // 高さを40pxに
      border: '1px solid #d1d5db',
      borderRadius: '4px',
      padding: '4px 8px',
      fontSize: '12px',
      resize: 'none',
      outline: 'none',
      fontFamily: 'inherit',
      marginBottom: '6px' // 下に少し余白
    },
    contentColumn: {
      flex: 1,
      borderRight: '1px solid #d1d5db'
    },
    timeColumn: {
      width: '60px'
    },
    timeContent: {
      padding: '16px 4px'
    },
    timeInputRow: {
      marginBottom: '16px',
      height: '144px', // フレームと同じ高さ
      display: 'flex',
      alignItems: 'center'
    },
    timeInput: {
      width: '100%',
      height: '40px',
      border: '1px solid #d1d5db',
      borderRadius: '4px',
      padding: '8px 4px',
      fontSize: '12px',
      textAlign: 'center',
      outline: 'none',
      fontFamily: 'inherit'
    },
    footerNumber: {
      textAlign: 'right',
      padding: '8px',
      fontSize: '14px',
      color: '#6b7280'
    }
  };

  return (
    <div style={styles.container}>
      {/* PDF保存ボタンとストップウォッチを横並びに */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '16px 0' }}>
        <ExportPDFButton targetRef={exportRef} pageRefs={pageRefs} pages={pages} setIsExportingPDF={setIsExportingPDF} />
      </div>
      {/* ストップウォッチ丸ボタンを画面中央右に固定配置 */}
      <button
        onClick={handleStopwatchClick}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#2563eb',
          color: 'white',
          border: 'none',
          fontSize: '14px',
          fontWeight: 600,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          position: 'fixed',
          top: '50%',
          right: '32px',
          transform: 'translateY(-50%)',
          outline: 'none',
          userSelect: 'none',
          transition: 'background 0.2s',
          zIndex: 2000,
        }}
        title="クリックで計測開始/停止"
      >
        <span style={{ fontSize: '12px', marginBottom: '2px' }}>タイム</span>
        <span style={{ fontSize: '15px', fontWeight: 700 }}>
          {isStopwatchRunning
            ? '...'
            : stopwatchTime
              ? stopwatchTime
              : '0.00'}
        </span>
      </button>
      {/* 再生ボタンとセリフ自動再生チェックボックス */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '16px 0' }}>
        <button
          onClick={handlePlay}
          disabled={isPlaying}
          style={{
            padding: '8px 24px',
            fontSize: '16px',
            background: isPlaying ? '#9ca3af' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isPlaying ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit'
          }}
        >
          {isPlaying ? '再生中...' : '再生'}
        </button>
        <button
          onClick={handleStop}
          disabled={!isPlaying}
          style={{
            padding: '8px 24px',
            fontSize: '16px',
            background: !isPlaying ? '#9ca3af' : '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !isPlaying ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit'
          }}
        >
          停止
        </button>
        <button
          onClick={handleExport}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          エクスポート
        </button>
        <label style={{
          padding: 0,
          margin: 0,
          display: 'inline-block',
          cursor: 'pointer',
          background: '#6366f1',
          color: 'white',
          borderRadius: '4px',
          fontSize: '14px',
          fontFamily: 'inherit',
          border: 'none',
          marginLeft: '4px',
          paddingLeft: '8px',
          paddingRight: '8px',
          paddingTop: '8px',
          paddingBottom: '8px',
        }}>
          インポート
          <input
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: '#374151', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={isAutoSpeak}
            onChange={e => setIsAutoSpeak(e.target.checked)}
            style={{ marginRight: '6px' }}
            disabled={isPlaying}
          />
          セリフも自動再生する
        </label>
      </div>
      {/* 再生中は大きく画像を表示 */}
      {isPlaying && flatCuts[currentFrame] && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          margin: '24px 0',
        }}>
          {flatCuts[currentFrame].image ? (
            <img
              src={flatCuts[currentFrame].image}
              alt={`Frame ${currentFrame + 1}`}
              style={{
                width: '512px',
                height: '288px',
                objectFit: 'cover',
                border: '6px solid #2563eb',
                borderRadius: '12px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.15)'
              }}
            />
          ) : (
            <div
              style={{
                width: '512px',
                height: '288px',
                background: 'black',
                border: '6px solid #2563eb',
                borderRadius: '12px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.15)'
              }}
            />
          )}
          <div style={{ marginTop: '12px', fontSize: '18px', color: '#374151' }}>
            {currentFrame + 1}枚目 / {parseFloat(flatCuts[currentFrame].timeValue) || 1}秒
          </div>
        </div>
      )}
      <div style={styles.wrapper} ref={exportRef}>
        {/* ヘッダー部分 */}
        <div style={styles.headerSection}>
          <div style={styles.headerContent}>
            <div style={styles.headerLeft}>
              <span style={styles.headerText}>No.</span>
              {/* 絵コンテ名インプット */}
              <input
                type="text"
                value={storyboardName}
                onChange={e => setStoryboardName(e.target.value)}
                placeholder="絵コンテ名"
                style={{
                  marginLeft: '12px',
                  fontSize: '15px',
                  padding: '2px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  width: '180px',
                }}
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
            {/* メインコンテンツ */}
            <div
              style={styles.mainContent}
              ref={el => pageRefs.current[pageIdx] = el}
            >
              {/* PDFエクスポート時のみ左上に絵コンテ名-ページ番号を表示 */}
              {isExportingPDF && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '-80px',
                  width: '100%',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  color: '#222',
                  background: 'rgba(255,255,255,0.95)',
                  padding: '8px 0 8px 12px',
                  zIndex: 100,
                  borderBottom: '2px solid #222',
                  boxShadow: 'none',
                  borderBottomRightRadius: 0,
                  borderBottomLeftRadius: 0,
                  margin: 0
                }}>
                  {`${storyboardName || 'Storyboard'}-${pageIdx + 1}`}
                </div>
              )}
              {/* 左側のセクション */}
              <div style={styles.leftSection}>
                {/* カット列 */}
                <div style={styles.cutColumn}>
                  <div style={styles.columnHeader}>
                    カット
                  </div>
                  <div style={styles.cutContent}>
                    <div style={styles.mvLabel}>
                      ＜16:9＞
                    </div>
                  </div>
                </div>

                {/* 画面列 */}
                <div style={styles.screenColumn}>
                  <div style={styles.columnHeader}>
                    画面
                  </div>
                  <div style={styles.framesContainer}>
                    {page.images.map((img, cutIdx) => (
                      <div key={cutIdx} style={styles.frameRow}>
                        <div
                          style={{
                            ...styles.frame,
                            ...(hoveredFrame === `${pageIdx}-${cutIdx}` ? styles.frameHover : {})
                          }}
                          onClick={(e) => handleFrameClick(pageIdx, cutIdx, e)}
                          onMouseEnter={() => setHoveredFrame(`${pageIdx}-${cutIdx}`)}
                          onMouseLeave={() => setHoveredFrame(null)}
                          draggable
                          onDragStart={() => setDraggedCut({ pageIdx, cutIdx })}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => {
                            if (!draggedCut || (draggedCut.pageIdx === pageIdx && draggedCut.cutIdx === cutIdx)) return;
                            setPages(prev => {
                              // 1. 全カットをフラットな配列に
                              const flatCuts = prev.flatMap((page, pIdx) =>
                                page.images.map((img, cIdx) => ({
                                  image: img,
                                  faceText: page.faceTexts[cIdx],
                                  dialogueText: page.dialogueTexts[cIdx],
                                  timeValue: page.timeValues[cIdx],
                                  blendFile: page.blendFiles[cIdx]
                                }))
                              );
                              // 2. 移動元と移動先のインデックスを計算
                              const fromIdx = draggedCut.pageIdx * 5 + draggedCut.cutIdx;
                              const toIdx = pageIdx * 5 + cutIdx;
                              // 3. カットを移動
                              const [moved] = flatCuts.splice(fromIdx, 1);
                              flatCuts.splice(toIdx, 0, moved);
                              // 4. ページに再分割
                              return regroupPagesFromFlatCuts(flatCuts);
                            });
                            setDraggedCut(null);
                          }}
                        >
                          {img ? (
                            <img
                              src={img}
                              alt={`Frame ${pageIdx * 5 + cutIdx + 1}`}
                              style={styles.frameImage}
                            />
                          ) : (
                            <div style={styles.framePlaceholder}>
                              <div style={styles.placeholderContent}>
                                <svg style={styles.plusIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </div>
                            </div>
                          )}
                          
                          {/* AI補助ボタン */}
                          {!isExportingPDF && (
                            <AIAssistButton
                              pageIdx={pageIdx}
                              cutIdx={cutIdx}
                              onAIAssist={handleAIAssist}
                            />
                          )}
                          
                          {/* 削除ボタン */}
                          {!isExportingPDF && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                handleDeleteCut(pageIdx, cutIdx);
                              }}
                              style={{
                                position: 'absolute',
                                top: '130px',
                                right: '-280px',
                                width: '22px',
                                height: '22px',
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                fontSize: '14px',
                                cursor: 'pointer',
                                zIndex: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0
                              }}
                              title="このカットを削除"
                            >
                              ✕
                            </button>
                          )}
                          {/* 右外に＋ボタン */}
                          {!isExportingPDF && (
                            <button
                              type="button"
                              onClick={() => { handleAddCutAt(pageIdx, cutIdx); }}
                              style={{
                                position: 'absolute',
                                right: '-210px',
                                top: '-5%',
                                transform: 'translateY(-50%)',
                                zIndex: 1000,
                                width: '24px',
                                height: '24px',
                                background: 'none',
                                border: 'none',
                                color: '#3730a3',
                                fontSize: '22px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                                boxShadow: 'none',
                              }}
                              title="ここにカットを追加"
                            >
                              ＋
                            </button>
                          )}
                          {/* Blenderファイルアタッチ・開くボタン */}
                          {!isExportingPDF && (
                            <>
                              <input
                                type="file"
                                accept=".blend"
                                style={{ display: 'none' }}
                                id={`blend-input-${pageIdx}-${cutIdx}`}
                                onClick={(e) => e.stopPropagation()}
                                onChange={e => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleBlendFileChange(pageIdx, cutIdx, e.target.files[0]);
                                  }
                                }}
                              />
                              <label
                                htmlFor={`blend-input-${pageIdx}-${cutIdx}`}
                                title={page.blendFiles[cutIdx] ? `紐付け: ${page.blendFiles[cutIdx]}` : '.blendファイルを紐付け'}
                                style={{
                                  position: 'absolute',
                                  right: '-18px',
                                  bottom: '140px',
                                  width: '20px',
                                  height: '20px',
                                  background: page.blendFiles[cutIdx] ? '#10b981' : '#e5e7eb',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                                  cursor: 'pointer',
                                  border: '1px solid #d1d5db',
                                  zIndex: 2
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span style={{ fontSize: '12px', color: page.blendFiles[cutIdx] ? 'white' : '#6b7280' }}>🗎</span>
                              </label>
                              {/* Blenderファイルを開くボタン */}
                              {page.blendFiles[cutIdx] && (
                                <label
                                  title="紐付けたファイルを開く"
                                  style={{
                                    position: 'absolute',
                                    right: '-18px',
                                    bottom: '4px',
                                    width: '20px',
                                    height: '20px',
                                    background: '#3b82f6',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                                    cursor: 'pointer',
                                    border: '1px solid #d1d5db',
                                    zIndex: 2
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.webUtils && window.webUtils.openFile) {
                                      window.webUtils.openFile(page.blendFiles[cutIdx]);
                                    } else {
                                      console.warn("window.webUtils.openFile is not available.");
                                      alert("ファイルを開く機能は現在利用できません。");
                                    }
                                  }}
                                >
                                  <span style={{ fontSize: '14px', color: 'white' }}>🔗</span>
                                </label>
                              )}
                            </>
                          )}
                        </div>
                        {/* フレーム番号 */}
                        <div style={styles.frameNumber}>{pageIdx * 5 + cutIdx + 1}</div>
                        {/* 各フレームの下に横線を追加 */}
                        <div style={styles.horizontalLine}></div>
                      </div>
                    ))}
                    {/* 最後のフレームの後ろにも＋ボタン */}
                    {!isExportingPDF && (
                      <div style={{ position: 'relative', height: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleAddCutAt(pageIdx, page.images.length)}
                          style={{
                            position: 'absolute',
                            right: '-40px',
                            top: '0',
                            zIndex: 30,
                            width: '24px',
                            height: '24px',
                            background: 'none',
                            border: 'none',
                            color: '#3730a3',
                            fontSize: '22px',
                            cursor: page.images.length >= 5 ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                            pointerEvents: page.images.length >= 5 ? 'none' : 'auto',
                            boxShadow: 'none',
                          }}
                          title="ここにカットを追加"
                          disabled={page.images.length >= 5}
                        >
                          ＋
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 面列 */}
                <div style={styles.faceColumn}>
                  <div style={{ ...styles.columnHeader, ...styles.faceHeader }}>
                    内容
                  </div>
                  <div style={styles.faceContent}>
                    {[0, 1, 2, 3, 4].map((cutIdx) => (
                      <div key={cutIdx} style={styles.faceInputRow}>
                        {isExportingPDF ? (
                          // PDF用: テキストだけをきれいに表示
                          <div style={{
                            width: '100%',
                            minHeight: '40px',
                            fontSize: '13px',
                            color: '#222',
                            background: 'none',
                            border: 'none',
                            padding: '4px 8px',
                            marginBottom: '6px',
                            whiteSpace: 'pre-line',
                            wordBreak: 'break-word',
                          }}>
                            {page.faceTexts[cutIdx] || <span style={{ color: '#bbb' }}>内容...</span>}
                          </div>
                        ) : (
                          <textarea
                            style={styles.faceInput}
                            value={page.faceTexts[cutIdx]}
                            onChange={(e) => handleTextChange(pageIdx, cutIdx, e.target.value)}
                            placeholder="内容..."
                            rows={1}
                          />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {isExportingPDF ? (
                            <div style={{
                              width: '100%',
                              minHeight: '40px',
                              fontSize: '13px',
                              color: '#374151',
                              background: 'none',
                              border: 'none',
                              padding: '4px 8px',
                              whiteSpace: 'pre-line',
                              wordBreak: 'break-word',
                            }}>
                              {page.dialogueTexts[cutIdx] || <span style={{ color: '#bbb' }}>セリフ...</span>}
                            </div>
                          ) : (
                            <>
                              <textarea
                                style={{ ...styles.faceInput, marginBottom: 0, flex: 1 }}
                                value={page.dialogueTexts[cutIdx]}
                                onChange={(e) => handleDialogueChange(pageIdx, cutIdx, e.target.value)}
                                placeholder="セリフ..."
                                rows={1}
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
                                  marginLeft: '4px',
                                  background: '#f3f4f6',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '3px',
                                  padding: '1px 2px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  color: '#374151',
                                  lineHeight: 1,
                                  minWidth: '22px',
                                  minHeight: '22px'
                                }}
                                title="セリフを読み上げる"
                              >
                                🔊
                              </button>
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
                {/* 分・秒列 */}
                <div style={styles.timeColumn}>
                  <div style={styles.columnHeader}>
                    秒
                  </div>
                  <div style={styles.timeContent}>
                    {[0, 1, 2, 3, 4].map((cutIdx) => (
                      <div key={cutIdx} style={styles.timeInputRow}>
                        <input
                          type="text"
                          style={styles.timeInput}
                          value={page.timeValues[cutIdx]}
                          onChange={(e) => handleTimeChange(pageIdx, cutIdx, e.target.value)}
                          placeholder="0.0"
                          inputMode="decimal"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* 下部の番号と＋ボタン */}.
        <div style={styles.footerNumber}>
          <button
            onClick={handleAddPage}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              fontSize: '24px',
              cursor: 'pointer',
              padding: 0
            }}
            title="ページを追加"
          >
            ＋
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
        onFrameUpdated={() => {}} // 将来の機能用
      />
    </div>
  );
};

export default StoryboardViewer;