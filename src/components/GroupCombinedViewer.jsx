import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';

const GROUP_LABELS = ['A', 'B', 'C', 'D', 'E'];

const checkIsMobile = () => {
  if (typeof window === 'undefined') return false;
  return Math.min(window.screen.width, window.screen.height) < 768;
};

// ============================================================
// デスクトップ用スタイル（StoryboardViewer と同一）
// ============================================================
const ds = {
  wrapper: { maxWidth: '1152px', margin: '0 auto', backgroundColor: 'white', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' },
  mainContent: { display: 'flex', position: 'relative', borderBottom: '1px solid #d1d5db' },
  leftSection: { display: 'flex' },
  rightSection: { display: 'flex', flex: 1 },
  columnHeader: { borderBottom: '1px solid #d1d5db', padding: '8px', textAlign: 'center', fontSize: '14px' },
  cutColumn: { borderRight: '2px solid black' },
  cutContent: { padding: '8px' },
  mvLabel: { width: '40px', color: '#9ca3af', fontSize: '9px' },
  screenColumn: { borderRight: '2px solid black' },
  framesContainer: { padding: '16px' },
  frameRow: { position: 'relative', marginBottom: '16px' },
  frame: { border: '4px solid black', width: '256px', height: '144px', overflow: 'hidden', backgroundColor: 'white', position: 'relative' },
  frameImage: { width: '100%', height: '100%', objectFit: 'cover' },
  framePlaceholder: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' },
  horizontalLine: { position: 'absolute', top: '160px', left: '-75px', right: '-233px', height: '1px', backgroundColor: '#d1d5db', zIndex: 10 },
  frameNumber: { position: 'absolute', top: '120px', left: '-60px', fontSize: '20px', color: '#374151', fontWeight: '500' },
  faceColumn: { borderRight: '1px solid #d1d5db', width: '120px', minWidth: '120px', maxWidth: '120px' },
  faceContent: { padding: '9px 12px' },
  faceInputRow: { marginBottom: '2px', height: '165px', maxHeight: '165px', minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', overflow: 'hidden', boxSizing: 'border-box' },
  faceText: { width: '100%', minHeight: '40px', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', background: '#f9fafb', color: '#111', wordBreak: 'break-all', whiteSpace: 'pre-wrap', boxSizing: 'border-box' },
  contentColumn: { flex: 1, borderRight: '1px solid #d1d5db' },
  timeColumn: { width: '60px' },
  timeContent: { padding: '16px 4px' },
  timeInputRow: { marginBottom: '16px', height: '144px', display: 'flex', alignItems: 'center' },
  timeText: { width: '100%', textAlign: 'center', fontSize: '12px', color: '#374151', wordBreak: 'break-all' },
};

// ============================================================
// デスクトップ: 1ページ（5カット）読み取り専用
// ============================================================
const DesktopReadOnlyPage = ({ page, globalPageIdx, storyboardId, onOpen, currentPlayFrame, globalCutOffset }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  return (
    <div style={ds.mainContent}>
      <div style={ds.leftSection}>
        <div style={ds.cutColumn}>
          <div style={ds.columnHeader}>カット</div>
          <div style={ds.cutContent}><div style={ds.mvLabel}>＜16:9＞</div></div>
        </div>

        <div style={ds.screenColumn}>
          <div style={ds.columnHeader}>画面</div>
          <div style={ds.framesContainer}>
            {page.images.map((cutImages, cutIdx) => {
              const currentIdx = page.imageIndices?.[cutIdx] ?? 0;
              const currentImage = Array.isArray(cutImages) ? cutImages[currentIdx] : null;
              const globalCutNum = globalPageIdx * 5 + cutIdx + 1;
              const hasMultiple = Array.isArray(cutImages) && cutImages.filter(Boolean).length > 1;
              const isCurrentFrame = (globalCutOffset + cutIdx) === currentPlayFrame;

              return (
                <div key={cutIdx} style={ds.frameRow}>
                  <div
                    style={{
                      ...ds.frame,
                      cursor: 'pointer',
                      outline: isCurrentFrame
                        ? '4px solid #10b981'
                        : hoveredIdx === cutIdx ? '3px solid #4a90d9' : 'none',
                      outlineOffset: '2px',
                      transition: 'outline 0.15s'
                    }}
                    title="クリックで編集を開く"
                    onMouseEnter={() => setHoveredIdx(cutIdx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => onOpen(storyboardId)}
                  >
                    {currentImage
                      ? <img src={currentImage} alt={`カット${globalCutNum}`} style={ds.frameImage} />
                      : <div style={ds.framePlaceholder}>
                          <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                    }
                    {hasMultiple && (
                      <div style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', zIndex: 10 }}>
                        {currentIdx + 1}/{cutImages.filter(Boolean).length}
                      </div>
                    )}
                  </div>
                  <div style={ds.frameNumber}>{globalCutNum}</div>
                  <div style={ds.horizontalLine} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={ds.rightSection}>
        <div style={ds.faceColumn}>
          <div style={ds.columnHeader}>台詞</div>
          <div style={ds.faceContent}>
            {page.dialogueTexts?.map((text, cutIdx) => (
              <div key={cutIdx} style={{ ...ds.faceInputRow, height: '165px', maxHeight: '165px', overflowY: 'auto', overflowX: 'hidden', alignItems: 'stretch', justifyContent: 'flex-start', paddingTop: '8px', paddingBottom: '8px', boxSizing: 'border-box' }}>
                <div style={{ ...ds.faceText, minHeight: 'unset' }}>{text || ''}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={ds.contentColumn}>
          <div style={ds.columnHeader}>ト書き</div>
          <div style={{ padding: '9px 12px' }}>
            {page.faceTexts?.map((text, cutIdx) => {
              const drawingText = page.drawingTexts?.[cutIdx] || '';
              const screenText = page.screenTexts?.[cutIdx] || '';
              const hasExtra = drawingText || screenText;
              return (
                <div key={cutIdx} style={{ ...ds.faceInputRow, height: '165px', maxHeight: '165px', overflowY: 'auto', overflowX: 'hidden', justifyContent: 'flex-start', paddingTop: '8px', paddingBottom: '8px', alignItems: 'stretch', boxSizing: 'border-box' }}>
                  <div style={{ ...ds.faceText, width: '100%', minHeight: 'unset', fontSize: hasExtra ? '11px' : '12px' }}>{text || ''}</div>
                  {drawingText && (
                    <div style={{ ...ds.faceText, width: '100%', minHeight: 'unset', marginTop: '4px', background: '#f0f4ff', borderColor: '#c7d7f7', fontSize: '11px' }}>
                      <span style={{ color: '#6b7280', fontSize: '10px', display: 'block', marginBottom: '2px' }}>作画</span>
                      {drawingText}
                    </div>
                  )}
                  {screenText && (
                    <div style={{ ...ds.faceText, width: '100%', minHeight: 'unset', marginTop: '4px', background: '#f0fff4', borderColor: '#a7f3d0', fontSize: '11px' }}>
                      <span style={{ color: '#6b7280', fontSize: '10px', display: 'block', marginBottom: '2px' }}>画面</span>
                      {screenText}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div style={ds.timeColumn}>
          <div style={ds.columnHeader}>時間</div>
          <div style={ds.timeContent}>
            {page.timeValues?.map((val, cutIdx) => {
              const frameVal = page.frameValues?.[cutIdx] || '';
              const fps = page.frameRateBases?.[cutIdx] ?? page.frameRateBase ?? 8;
              const display = frameVal
                ? `${frameVal}コマ(${fps})${val ? `\n${val}秒` : ''}`
                : (val || '');
              return (
              <div key={cutIdx} style={ds.timeInputRow}>
                <div style={{ ...ds.timeText, whiteSpace: 'pre-line' }}>{display}</div>
              </div>
            );})}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// モバイル: 1カットカード
// ============================================================
const MobileCutCard = ({ page, cutIdx, globalCutNum, storyboardId, onOpen, isCurrentFrame }) => {
  const cutImages = page.images[cutIdx];
  const currentImgIdx = page.imageIndices?.[cutIdx] ?? 0;
  const currentImage = Array.isArray(cutImages) ? cutImages[currentImgIdx] : null;
  const hasMultiple = Array.isArray(cutImages) && cutImages.filter(Boolean).length > 1;
  const faceText = page.faceTexts?.[cutIdx] || '';
  const dialogueText = page.dialogueTexts?.[cutIdx] || '';
  const drawingText = page.drawingTexts?.[cutIdx] || '';
  const screenText = page.screenTexts?.[cutIdx] || '';
  const timeValue = page.timeValues?.[cutIdx] || '';
  const frameValue = page.frameValues?.[cutIdx] || '';
  const cutFps = page.frameRateBases?.[cutIdx] ?? page.frameRateBase ?? 8;
  const timeDisplay = frameValue
    ? (timeValue ? `${frameValue}コマ(${cutFps}) / ${timeValue}秒` : `${frameValue}コマ(${cutFps})`)
    : timeValue;

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      marginBottom: '12px',
      overflow: 'hidden',
      boxShadow: isCurrentFrame ? '0 0 0 3px #10b981' : '0 1px 6px rgba(0,0,0,0.08)',
      border: isCurrentFrame ? '1px solid #10b981' : '1px solid #e2e8f0',
      transition: 'box-shadow 0.2s, border-color 0.2s'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '8px 12px',
        background: isCurrentFrame ? '#d1fae5' : '#f8fafc',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <span style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
          カット {globalCutNum}
        </span>
        {isCurrentFrame && (
          <span style={{ marginLeft: '8px', fontSize: '11px', color: '#10b981', fontWeight: '600' }}>▶ 再生中</span>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => onOpen(storyboardId)}
            style={{ padding: '4px 10px', fontSize: '11px', background: '#4a90d9', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            ✏️ 編集
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', paddingTop: '56.25%', background: '#e2e8f0', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          {currentImage
            ? <img src={currentImage} alt={`カット${globalCutNum}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                <svg width="36" height="36" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
          }
          {hasMultiple && (
            <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>
              {currentImgIdx + 1} / {cutImages.filter(Boolean).length}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '10px 12px' }}>
        {faceText
          ? <div style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', background: '#f8fafc', color: '#111', fontWeight: 600, whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: '6px' }}>{faceText}</div>
          : <div style={{ width: '100%', border: '1px dashed #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px' }}>内容なし</div>
        }
        {drawingText && (
          <div style={{ width: '100%', border: '1px solid #c7d7f7', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', background: '#f0f4ff', color: '#111', whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: '6px' }}>
            <span style={{ color: '#6b7280', fontSize: '10px', display: 'block', marginBottom: '2px' }}>作画</span>
            {drawingText}
          </div>
        )}
        {screenText && (
          <div style={{ width: '100%', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', background: '#f0fff4', color: '#111', whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: '6px' }}>
            <span style={{ color: '#6b7280', fontSize: '10px', display: 'block', marginBottom: '2px' }}>画面</span>
            {screenText}
          </div>
        )}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
          {dialogueText
            ? <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', background: '#f8fafc', color: '#111', fontWeight: 600, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{dialogueText}</div>
            : <div style={{ flex: 1, border: '1px dashed #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', color: '#cbd5e1' }}>セリフなし</div>
          }
          {timeDisplay && (
            <div style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', color: '#64748b', background: '#f8fafc', whiteSpace: 'nowrap' }}>
              ⏱ {timeDisplay}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 1ストーリーボードセクション
// ============================================================
const StoryboardSection = ({ storyboard, onOpen, startPageIndex, isMobile, currentPlayFrame, cutOffset }) => {
  const [collapsed, setCollapsed] = useState(false);

  const allMobileCuts = useMemo(() => {
    if (!storyboard.pages) return [];
    return storyboard.pages.flatMap((page, pageIdx) =>
      Array.from({ length: 5 }, (_, cutIdx) => ({
        page, cutIdx,
        globalCutNum: startPageIndex * 5 + pageIdx * 5 + cutIdx + 1,
        flatIdx: cutOffset + pageIdx * 5 + cutIdx
      }))
    );
  }, [storyboard.pages, startPageIndex, cutOffset]);

  return (
    <div style={{ marginBottom: isMobile ? '16px' : '32px' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '10px 12px' : '10px 16px',
          backgroundColor: '#e8f0fe', border: '2px solid #c8dff8',
          borderBottom: collapsed ? '2px solid #c8dff8' : 'none',
          borderRadius: collapsed ? '8px' : '8px 8px 0 0',
          cursor: 'pointer', userSelect: 'none',
          flexWrap: isMobile ? 'wrap' : 'nowrap', gap: '8px'
        }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <span style={{ backgroundColor: '#4a90d9', color: 'white', borderRadius: '4px', padding: '3px 10px', fontSize: '13px', fontWeight: '700', flexShrink: 0 }}>
            {storyboard.group}-{storyboard.order}
          </span>
          <span style={{ fontWeight: '700', color: '#1e293b', fontSize: isMobile ? '14px' : '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {storyboard.name}
          </span>
          {!isMobile && <span style={{ color: '#64748b', fontSize: '12px', flexShrink: 0 }}>{storyboard.pages?.length || 0}ページ</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(storyboard.id); }}
            style={{ padding: isMobile ? '5px 10px' : '5px 12px', backgroundColor: '#4a90d9', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
          >
            ✏️ 編集
          </button>
          <span style={{ color: '#64748b', fontSize: '16px' }}>{collapsed ? '▶' : '▼'}</span>
        </div>
      </div>

      {!collapsed && (
        <div style={{ border: '2px solid #c8dff8', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden', backgroundColor: isMobile ? '#f1f5f9' : 'white' }}>
          <div style={{ padding: isMobile ? '8px 12px' : '12px 16px', borderBottom: '1px solid #c8dff8', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>{storyboard.name}</span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              {isMobile ? `${storyboard.pages?.length || 0}ページ` : `グループ ${storyboard.group}　番号 ${storyboard.order}`}
            </span>
          </div>

          {storyboard.pages?.length > 0 ? (
            isMobile ? (
              <div style={{ padding: '10px 10px 4px' }}>
                {allMobileCuts.map(({ page, cutIdx, globalCutNum, flatIdx }) => (
                  <MobileCutCard
                    key={`${storyboard.id}-${globalCutNum}`}
                    page={page} cutIdx={cutIdx} globalCutNum={globalCutNum}
                    storyboardId={storyboard.id} onOpen={onOpen}
                    isCurrentFrame={flatIdx === currentPlayFrame}
                  />
                ))}
              </div>
            ) : (
              <div style={ds.wrapper}>
                {storyboard.pages.map((page, pageIdx) => (
                  <DesktopReadOnlyPage
                    key={pageIdx}
                    page={page} globalPageIdx={startPageIndex + pageIdx}
                    storyboardId={storyboard.id} onOpen={onOpen}
                    currentPlayFrame={currentPlayFrame}
                    globalCutOffset={cutOffset + pageIdx * 5}
                  />
                ))}
              </div>
            )
          ) : (
            <div style={{ textAlign: 'center', color: '#aaa', padding: '32px' }}>ページがありません</div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================
// 再生コントロールバー
// ============================================================
const PlaybackBar = ({
  isPlaying, playbackMode, setPlaybackMode,
  isAutoSpeak, setIsAutoSpeak,
  currentFrame, totalCuts,
  onPlay, onStop, isMobile,
  isFullscreen, onToggleFullscreen
}) => (
  <div style={{
    backgroundColor: '#1e293b',
    borderRadius: '10px',
    padding: isMobile ? '10px 12px' : '12px 20px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: isMobile ? '8px' : '16px'
  }}>
    {/* 再生モード */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '12px', color: '#94a3b8' }}>再生</span>
      {['auto', 'manual'].map(mode => (
        <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: '#e2e8f0', userSelect: 'none', cursor: 'pointer' }}>
          <input
            type="radio" name="combined-playbackMode" value={mode}
            checked={playbackMode === mode}
            onChange={() => setPlaybackMode(mode)}
            disabled={isPlaying}
            style={{ margin: 0 }}
          />
          {mode === 'auto' ? '自動' : '手動(←/→)'}
        </label>
      ))}
    </div>

    {/* 再生ボタン */}
    <button
      onClick={onPlay} disabled={isPlaying}
      style={{
        padding: isMobile ? '7px 18px' : '8px 24px', fontSize: '15px',
        background: isPlaying ? '#475569' : '#10b981',
        color: 'white', border: 'none', borderRadius: '6px',
        cursor: isPlaying ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 600
      }}
    >
      {isPlaying ? '再生中...' : '▶ 再生'}
    </button>

    {/* 停止ボタン */}
    <button
      onClick={onStop} disabled={!isPlaying}
      style={{
        padding: isMobile ? '7px 18px' : '8px 24px', fontSize: '15px',
        background: !isPlaying ? '#475569' : '#ef4444',
        color: 'white', border: 'none', borderRadius: '6px',
        cursor: !isPlaying ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 600
      }}
    >
      ■ 停止
    </button>

    {/* セリフ読み上げ */}
    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#e2e8f0', userSelect: 'none', cursor: 'pointer' }}>
      <input
        type="checkbox" checked={isAutoSpeak}
        onChange={e => setIsAutoSpeak(e.target.checked)}
        disabled={isPlaying}
        style={{ margin: 0 }}
      />
      🔊 セリフ読み上げ
    </label>

    {/* 全画面ボタン（デスクトップのみ） */}
    {!isMobile && (
      <button
        onClick={onToggleFullscreen}
        title={isFullscreen ? '全画面を閉じる (Esc)' : '再生画面を全画面表示'}
        style={{
          padding: '8px 14px', fontSize: '14px',
          background: isFullscreen ? '#7c3aed' : '#334155',
          color: 'white', border: 'none', borderRadius: '6px',
          cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '5px',
          marginLeft: 'auto'
        }}
      >
        {isFullscreen ? '⛶ 縮小' : '⛶ 全画面'}
      </button>
    )}

    {/* フレームカウンター（全画面ボタンがない場合） */}
    {(isMobile && isPlaying) && (
      <span style={{ fontSize: '13px', color: '#94a3b8', marginLeft: 'auto' }}>
        {currentFrame + 1} / {totalCuts}
      </span>
    )}
  </div>
);

// ============================================================
// メインコンポーネント
// ============================================================
const GroupCombinedViewer = ({ storyboards, onOpenStoryboard }) => {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isMobile, setIsMobile] = useState(checkIsMobile);

  // 再生関連 state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMode, setPlaybackMode] = useState('auto');
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isAutoSpeak, setIsAutoSpeak] = useState(false);
  const [isDesktopFullscreen, setIsDesktopFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobile(checkIsMobile());
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, []);

  // グループ整理
  const groupedStoryboards = useMemo(() => {
    const result = {};
    GROUP_LABELS.forEach(g => { result[g] = []; });
    storyboards.forEach(sb => {
      if (sb.group && GROUP_LABELS.includes(sb.group)) {
        result[sb.group].push(sb);
      }
    });
    GROUP_LABELS.forEach(g => {
      result[g].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    });
    return result;
  }, [storyboards]);

  const activeGroups = GROUP_LABELS.filter(g => groupedStoryboards[g].length > 0);
  const currentGroup = (selectedGroup && activeGroups.includes(selectedGroup)) ? selectedGroup : activeGroups[0] ?? null;
  const currentStoryboards = currentGroup ? groupedStoryboards[currentGroup] : [];

  // ページオフセット・カットオフセットを両方計算
  const { pageOffsets, cutOffsets } = useMemo(() => {
    const pageOffsets = [];
    const cutOffsets = [];
    let totalPages = 0;
    let totalCuts = 0;
    currentStoryboards.forEach(sb => {
      pageOffsets.push(totalPages);
      cutOffsets.push(totalCuts);
      totalPages += sb.pages?.length ?? 0;
      totalCuts += (sb.pages?.length ?? 0) * 5;
    });
    return { pageOffsets, cutOffsets };
  }, [currentStoryboards]);

  // グループの全カットをフラット化（再生用）
  const flatCuts = useMemo(() =>
    currentStoryboards.flatMap(sb =>
      (sb.pages ?? []).flatMap((page, pageIdx) =>
        Array.from({ length: 5 }, (_, cutIdx) => {
          const currentIdx = page.imageIndices?.[cutIdx] ?? 0;
          const cutImages = page.images?.[cutIdx];
          return {
            image: Array.isArray(cutImages) ? cutImages[currentIdx] : null,
            dialogueText: page.dialogueTexts?.[cutIdx] || '',
            timeValue: page.timeValues?.[cutIdx] || '',
            sbName: sb.name,
            sbGroup: sb.group,
            sbOrder: sb.order
          };
        })
      )
    ),
    [currentStoryboards]
  );
  const totalCuts = flatCuts.length;

  // グループ切り替え時に再生・全画面をリセット
  useEffect(() => {
    handleStop();
    setIsDesktopFullscreen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGroup]);

  // 再生開始
  const handlePlay = useCallback(() => {
    if (isPlaying) return;
    setCurrentFrame(0);
    setIsPlaying(true);
  }, [isPlaying]);

  // 停止
  const handleStop = useCallback(() => {
    setIsPlaying(false);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  // 自動送り
  useEffect(() => {
    if (!isPlaying || playbackMode !== 'auto') return;
    if (currentFrame >= totalCuts) {
      setIsPlaying(false);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      return;
    }
    let sec = parseFloat(flatCuts[currentFrame]?.timeValue);
    if (isNaN(sec) || sec <= 0) sec = 1;
    const timer = setTimeout(() => setCurrentFrame(prev => prev + 1), sec * 1000);
    return () => clearTimeout(timer);
  }, [isPlaying, playbackMode, currentFrame, flatCuts, totalCuts]);

  // セリフ読み上げ
  useEffect(() => {
    if (!isPlaying || !isAutoSpeak || !window.speechSynthesis) return;
    const text = (flatCuts[currentFrame]?.dialogueText || '').trim();
    if (!text) return;
    window.speechSynthesis.cancel();
    const utter = new window.SpeechSynthesisUtterance(text);
    utter.lang = 'ja-JP';
    window.speechSynthesis.speak(utter);
    return () => { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } };
  }, [isPlaying, isAutoSpeak, currentFrame, flatCuts]);

  // 手動再生: キーボード操作
  useEffect(() => {
    if (!isPlaying || playbackMode !== 'manual') return;
    const isTyping = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    const onKeyDown = (e) => {
      if (isTyping(e.target)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); setCurrentFrame(p => Math.min(p + 1, totalCuts - 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setCurrentFrame(p => Math.max(p - 1, 0)); }
      else if (e.key === 'Escape') { e.preventDefault(); handleStop(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPlaying, playbackMode, totalCuts, handleStop]);

  // 全画面時の Escape キー（再生モードに関わらず有効）
  useEffect(() => {
    if (!isDesktopFullscreen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsDesktopFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDesktopFullscreen]);

  const currentCut = flatCuts[currentFrame];

  if (activeGroups.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
        <p style={{ fontSize: '18px', marginBottom: '8px' }}>グループが設定されていません</p>
        <p style={{ fontSize: '14px', color: '#aaa' }}>
          「絵コンテ一覧」タブから各コンテの「グループ設定」ボタンで<br />
          グループ（A〜E）と番号（1〜5）を設定してください
        </p>
      </div>
    );
  }

  const handleToggleFullscreen = useCallback(() => {
    setIsDesktopFullscreen(prev => !prev);
  }, []);

  return (
    <div>
      {/* ---- デスクトップ全画面オーバーレイ ---- */}
      {isDesktopFullscreen && !isMobile && currentCut && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          zIndex: 9999, background: '#000',
          display: 'flex', flexDirection: 'column'
        }}>
          {/* 画像エリア */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {currentCut.image
              ? <img src={currentCut.image} alt={`フレーム${currentFrame + 1}`}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
              : <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '16px' }}>
                  画像なし
                </div>
            }

            {/* 右上: フレーム番号 + コンテ情報 */}
            <div style={{
              position: 'absolute', top: '16px', right: '16px',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <span style={{ background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 600 }}>
                {currentFrame + 1} / {totalCuts}
              </span>
              <span style={{ backgroundColor: '#4a90d9', color: 'white', borderRadius: '6px', padding: '4px 10px', fontSize: '13px', fontWeight: '700' }}>
                {currentCut.sbGroup}-{currentCut.sbOrder}
              </span>
            </div>

            {/* 左上: コンテ名 */}
            <div style={{
              position: 'absolute', top: '16px', left: '16px',
              background: 'rgba(0,0,0,0.5)', color: 'white',
              padding: '4px 12px', borderRadius: '20px', fontSize: '13px'
            }}>
              {currentCut.sbName}
            </div>

            {/* セリフ字幕 */}
            {currentCut.dialogueText && (
              <div style={{
                position: 'absolute', bottom: '0', left: 0, right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                color: 'white', padding: '32px 40px 20px',
                textAlign: 'center', fontSize: '22px', lineHeight: 1.6
              }}>
                {currentCut.dialogueText}
              </div>
            )}

            {/* 手動モード: ←/→ クリックゾーン */}
            {playbackMode === 'manual' && isPlaying && (
              <>
                <div
                  onClick={() => setCurrentFrame(p => Math.max(0, p - 1))}
                  style={{ position: 'absolute', top: 0, left: 0, width: '20%', height: '100%', cursor: currentFrame > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: '20px' }}
                >
                  {currentFrame > 0 && (
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', color: 'white' }}>◀</div>
                  )}
                </div>
                <div
                  onClick={() => setCurrentFrame(p => Math.min(totalCuts - 1, p + 1))}
                  style={{ position: 'absolute', top: 0, right: 0, width: '20%', height: '100%', cursor: currentFrame < totalCuts - 1 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '20px' }}
                >
                  {currentFrame < totalCuts - 1 && (
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', color: 'white' }}>▶</div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* 下部コントロールバー */}
          <div style={{
            backgroundColor: '#0f172a',
            padding: '12px 24px',
            display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap'
          }}>
            {/* 再生/停止 */}
            <button onClick={isPlaying ? handleStop : handlePlay}
              style={{ padding: '8px 22px', fontSize: '15px', background: isPlaying ? '#ef4444' : '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
              {isPlaying ? '■ 停止' : '▶ 再生'}
            </button>

            {/* 手動モード: ◀ ▶ ボタン */}
            {playbackMode === 'manual' && (
              <>
                <button onClick={() => setCurrentFrame(p => Math.max(0, p - 1))} disabled={currentFrame === 0}
                  style={{ padding: '8px 16px', fontSize: '15px', background: currentFrame === 0 ? '#334155' : '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: currentFrame === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  ◀ 前へ
                </button>
                <button onClick={() => setCurrentFrame(p => Math.min(totalCuts - 1, p + 1))} disabled={currentFrame >= totalCuts - 1}
                  style={{ padding: '8px 16px', fontSize: '15px', background: currentFrame >= totalCuts - 1 ? '#334155' : '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: currentFrame >= totalCuts - 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  次へ ▶
                </button>
              </>
            )}

            {/* モード表示 */}
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {playbackMode === 'auto' ? '自動再生' : '手動 (←/→)'}
            </span>

            {/* フレームカウンター */}
            <span style={{ fontSize: '14px', color: '#94a3b8', marginLeft: 'auto' }}>
              {currentFrame + 1} / {totalCuts}
            </span>

            {/* 縮小ボタン */}
            <button
              onClick={() => setIsDesktopFullscreen(false)}
              title="縮小 (Esc)"
              style={{ padding: '8px 16px', fontSize: '14px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
              ⛶ 縮小 <span style={{ fontSize: '11px', opacity: 0.7, background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: '3px' }}>Esc</span>
            </button>
          </div>
        </div>
      )}

      {/* ---- モバイル全画面再生オーバーレイ ---- */}
      {isPlaying && isMobile && currentCut && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          zIndex: 9999, background: '#000', overflow: 'hidden'
        }}>
          {currentCut.image
            ? <img src={currentCut.image} alt={`フレーム${currentFrame + 1}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
            : <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#111' }} />
          }

          {/* フレーム番号 + コンテ情報 */}
          <div style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'rgba(0,0,0,0.6)', color: 'white',
            padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600
          }}>
            {currentCut.sbGroup}-{currentCut.sbOrder}　{currentFrame + 1}/{totalCuts}
          </div>

          {/* セリフ */}
          {currentCut.dialogueText && (
            <div style={{
              position: 'absolute', bottom: '90px', left: 0, right: 0,
              background: 'rgba(0,0,0,0.65)', color: 'white',
              padding: '10px 20px', textAlign: 'center', fontSize: '16px', lineHeight: 1.5
            }}>
              {currentCut.dialogueText}
            </div>
          )}

          {/* コントロール */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '16px 24px 28px',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px'
          }}>
            {playbackMode === 'manual' ? (
              <>
                <button onClick={() => setCurrentFrame(f => Math.max(0, f - 1))} disabled={currentFrame === 0}
                  style={{ width: '64px', height: '56px', background: currentFrame === 0 ? 'rgba(55,65,81,0.8)' : 'rgba(59,130,246,0.9)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '22px', cursor: currentFrame === 0 ? 'not-allowed' : 'pointer' }}>
                  ◀
                </button>
                <button onClick={handleStop}
                  style={{ width: '72px', height: '56px', background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '22px', cursor: 'pointer' }}>
                  ■
                </button>
                <button onClick={() => setCurrentFrame(f => Math.min(f + 1, totalCuts - 1))} disabled={currentFrame >= totalCuts - 1}
                  style={{ width: '64px', height: '56px', background: currentFrame >= totalCuts - 1 ? 'rgba(55,65,81,0.8)' : 'rgba(59,130,246,0.9)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '22px', cursor: currentFrame >= totalCuts - 1 ? 'not-allowed' : 'pointer' }}>
                  ▶
                </button>
              </>
            ) : (
              <button onClick={handleStop}
                style={{ padding: '14px 40px', background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', cursor: 'pointer' }}>
                ■ 停止
              </button>
            )}
          </div>
        </div>
      )}

      {/* グループ選択タブ */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '2px solid #e0e0e0', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {activeGroups.map(group => (
          <button
            key={group}
            onClick={() => setSelectedGroup(group)}
            style={{
              padding: isMobile ? '7px 14px' : '8px 20px',
              border: 'none',
              backgroundColor: currentGroup === group ? '#4a90d9' : '#f0f0f0',
              color: currentGroup === group ? 'white' : '#555',
              borderRadius: '6px 6px 0 0',
              cursor: 'pointer',
              fontSize: isMobile ? '13px' : '15px',
              fontWeight: currentGroup === group ? '700' : '400',
              marginBottom: currentGroup === group ? '-2px' : '0',
              borderBottom: currentGroup === group ? '2px solid #4a90d9' : 'none',
              transition: 'all 0.15s', whiteSpace: 'nowrap', flexShrink: 0
            }}
          >
            グループ {group}
            <span style={{
              marginLeft: '5px',
              backgroundColor: currentGroup === group ? 'rgba(255,255,255,0.25)' : '#ddd',
              color: currentGroup === group ? 'white' : '#666',
              borderRadius: '10px', padding: '1px 5px', fontSize: '11px'
            }}>
              {groupedStoryboards[group].length}
            </span>
          </button>
        ))}
      </div>

      {/* サマリー */}
      {currentGroup && (
        <div style={{
          backgroundColor: '#f0f7ff', border: '1px solid #c8dff8', borderRadius: '6px',
          padding: '8px 12px', marginBottom: '12px',
          display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '20px',
          fontSize: '13px', color: '#444', flexWrap: 'wrap'
        }}>
          <span><strong>グループ {currentGroup}</strong></span>
          <span>{currentStoryboards.length}件</span>
          <span>合計 {Math.ceil(totalCuts / 5)}ページ / {totalCuts}カット</span>
          <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: isMobile ? '0' : 'auto' }}>
            ※ 読み取り専用 — 編集は「✏️ 編集」から
          </span>
        </div>
      )}

      {/* 再生コントロールバー */}
      {currentGroup && totalCuts > 0 && (
        <PlaybackBar
          isPlaying={isPlaying}
          playbackMode={playbackMode} setPlaybackMode={setPlaybackMode}
          isAutoSpeak={isAutoSpeak} setIsAutoSpeak={setIsAutoSpeak}
          currentFrame={currentFrame} totalCuts={totalCuts}
          onPlay={handlePlay} onStop={handleStop}
          isMobile={isMobile}
          isFullscreen={isDesktopFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}

      {/* デスクトップ: 再生中の大きな表示 */}
      {isPlaying && !isMobile && currentCut && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '16px 0 24px' }}>
          {currentCut.image
            ? <img src={currentCut.image} alt={`フレーム${currentFrame + 1}`} style={{ width: '512px', height: '288px', objectFit: 'cover', border: '6px solid #10b981', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }} />
            : <div style={{ width: '512px', height: '288px', background: '#1e293b', border: '6px solid #10b981', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '14px' }}>画像なし</div>
          }
          {currentCut.dialogueText && (
            <div style={{ marginTop: '10px', fontSize: '18px', color: '#1e293b', textAlign: 'center', maxWidth: '512px', lineHeight: 1.5 }}>
              {currentCut.dialogueText}
            </div>
          )}
          <div style={{ marginTop: '8px', fontSize: '13px', color: '#64748b', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span>カット {currentFrame + 1} / {totalCuts}</span>
            <span style={{ backgroundColor: '#4a90d9', color: 'white', borderRadius: '4px', padding: '2px 8px', fontSize: '12px', fontWeight: '700' }}>
              {currentCut.sbGroup}-{currentCut.sbOrder}
            </span>
            <span style={{ color: '#94a3b8' }}>{currentCut.sbName}</span>
            {playbackMode === 'manual' && <span style={{ color: '#94a3b8' }}>←/→で移動（Escで停止）</span>}
          </div>
        </div>
      )}

      {/* 結合コンテンツ */}
      {currentGroup && currentStoryboards.map((sb, idx) => (
        <StoryboardSection
          key={sb.id}
          storyboard={sb}
          onOpen={onOpenStoryboard}
          startPageIndex={pageOffsets[idx]}
          cutOffset={cutOffsets[idx]}
          isMobile={isMobile}
          currentPlayFrame={isPlaying ? currentFrame : -1}
        />
      ))}
    </div>
  );
};

export default GroupCombinedViewer;
