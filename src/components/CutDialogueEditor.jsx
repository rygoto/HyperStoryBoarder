import React, { useState, useRef } from 'react';
import {
  EMPTY_DIALOGUE_LINE,
  formatDialogueDisplay,
  formatDialogueSpeakText,
  normalizeDialogueLineArray
} from '../utils/dialogue';

const CutDialogueEditor = ({
  lines,
  onChange,
  onApplyTiming,
  canApplyTiming = false,
  compact = false,
  fillHeight = false,
  readOnly = false
}) => {
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState(null);
  const rootRef = useRef(null);
  const normalized = normalizeDialogueLineArray(lines);
  const displayText = formatDialogueDisplay(normalized);

  const showTooltip = () => {
    setHovered(true);
    if (rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      setTooltipPos({ left: rect.left, top: rect.top });
    }
  };
  const hideTooltip = () => {
    setHovered(false);
    setTooltipPos(null);
  };

  const updateLine = (lineIdx, field, value) => {
    const next = normalized.map((line, idx) =>
      idx === lineIdx ? { ...line, [field]: value } : line
    );
    onChange(next);
  };

  const addLine = () => {
    onChange([...normalized, EMPTY_DIALOGUE_LINE()]);
  };

  const removeLine = (lineIdx) => {
    if (normalized.length <= 1) {
      onChange([EMPTY_DIALOGUE_LINE()]);
      return;
    }
    onChange(normalized.filter((_, idx) => idx !== lineIdx));
  };

  const handleSpeak = () => {
    const text = formatDialogueSpeakText(normalized);
    if (!text || !window.speechSynthesis) return;
    const utter = new window.SpeechSynthesisUtterance(text);
    utter.lang = 'ja-JP';
    window.speechSynthesis.speak(utter);
  };

  const inputStyle = compact
    ? {
        border: '1px solid #d1d5db',
        borderRadius: '4px',
        padding: '3px 5px',
        fontSize: '11px',
        outline: 'none',
        fontFamily: 'inherit',
        background: '#fff',
        color: '#111',
        boxSizing: 'border-box'
      }
    : {
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        padding: '6px 10px',
        fontSize: '13px',
        outline: 'none',
        fontFamily: 'inherit',
        background: '#f8fafc',
        color: '#111',
        fontWeight: 600,
        boxSizing: 'border-box'
      };

  const rootStyle = {
    position: 'relative',
    flex: fillHeight ? 1 : undefined,
    width: '100%',
    minWidth: 0,
    minHeight: fillHeight ? 0 : undefined,
    height: fillHeight ? '100%' : undefined,
    display: fillHeight ? 'flex' : undefined,
    flexDirection: fillHeight ? 'column' : undefined
  };

  const bodyStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: compact ? '3px' : '6px',
    flex: fillHeight ? 1 : undefined,
    minHeight: fillHeight ? 0 : undefined,
    height: fillHeight ? '100%' : undefined,
    overflow: fillHeight ? 'hidden' : undefined
  };

  const scrollStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: compact ? '3px' : '6px',
    flex: fillHeight ? 1 : undefined,
    minHeight: fillHeight ? 0 : undefined,
    maxHeight: fillHeight ? undefined : (compact ? '120px' : undefined),
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingRight: '2px'
  };

  if (readOnly) {
    return (
      <div style={{ ...rootStyle, color: '#374151' }}>
        <div style={scrollStyle}>
          {normalized.some((line) => line.speaker || line.text) ? normalized.map((line, lineIdx) => (
            <div key={lineIdx} style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
              <span
                title={line.speaker}
                style={{ width: compact ? '14px' : '22px', flexShrink: 0, color: '#64748b', fontSize: compact ? '9px' : '11px', fontWeight: 700, textAlign: 'center', overflow: 'hidden' }}
              >
                {line.speaker.trim().slice(0, 1)}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: compact ? '11px' : '13px', lineHeight: 1.35, wordBreak: 'break-word' }}>
                {line.text}
              </span>
            </div>
          )) : <span style={{ color: '#bbb', fontSize: '11px' }}>セリフ...</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      style={rootStyle}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      <div style={bodyStyle}>
        <div style={scrollStyle}>
          {normalized.map((line, lineIdx) => (
            <div key={lineIdx} style={{ position: 'relative', display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
              <input
                type="text"
                value={line.speaker}
                onChange={(e) => updateLine(lineIdx, 'speaker', e.target.value)}
                placeholder={compact ? '話' : '話者'}
                title={line.speaker || '話者名'}
                style={{
                  ...inputStyle,
                  width: compact ? '18px' : '64px',
                  padding: compact ? '3px 0' : inputStyle.padding,
                  fontSize: compact ? '9px' : inputStyle.fontSize,
                  textAlign: compact ? 'center' : undefined,
                  flexShrink: 0
                }}
              />
              <input
                type="text"
                value={line.text}
                onChange={(e) => updateLine(lineIdx, 'text', e.target.value)}
                placeholder="セリフ"
                style={{ ...inputStyle, flex: 1, minWidth: 0, paddingRight: compact ? '18px' : inputStyle.padding }}
              />
              <button
                type="button"
                onClick={() => removeLine(lineIdx)}
                style={{
                  position: compact ? 'absolute' : undefined,
                  right: compact ? '1px' : undefined,
                  top: compact ? '2px' : undefined,
                  width: compact ? '16px' : '28px',
                  height: compact ? '20px' : '34px',
                  padding: 0,
                  border: compact ? 'none' : '1px solid #e2e8f0',
                  borderRadius: compact ? '3px' : '6px',
                  background: compact ? 'transparent' : '#f8fafc',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: compact ? '11px' : '16px',
                  lineHeight: 1,
                  flexShrink: 0
                }}
                title="このセリフ行を削除"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? '2px' : '6px', flexWrap: 'nowrap', flexShrink: 0 }}>
          <button
            type="button"
            onClick={addLine}
            title="話者とセリフの行を追加"
            style={{
              padding: compact ? '2px 4px' : '4px 10px',
              fontSize: compact ? '10px' : '12px',
              border: '1px dashed #93c5fd',
              borderRadius: '4px',
              background: '#eff6ff',
              color: '#1d4ed8',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 600,
              lineHeight: 1.2
            }}
          >
            {compact ? '＋' : '＋ 話者追加'}
          </button>
          <button
            type="button"
            onClick={handleSpeak}
            disabled={!formatDialogueSpeakText(normalized)}
            style={{
              padding: compact ? '2px 4px' : '4px 10px',
              fontSize: compact ? '10px' : '12px',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              background: '#f1f5f9',
              cursor: formatDialogueSpeakText(normalized) ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              opacity: formatDialogueSpeakText(normalized) ? 1 : 0.5,
              lineHeight: 1.2
            }}
            title="セリフを読み上げる"
          >
            🔊
          </button>
          {onApplyTiming && (
            <button
              type="button"
              onClick={onApplyTiming}
              disabled={!canApplyTiming}
              style={{
                padding: compact ? '2px 4px' : '4px 10px',
                fontSize: compact ? '10px' : '12px',
                border: `1px solid ${canApplyTiming ? '#93c5fd' : '#e5e7eb'}`,
                borderRadius: '4px',
                background: canApplyTiming ? '#eff6ff' : '#f9fafb',
                color: canApplyTiming ? '#1d4ed8' : '#9ca3af',
                cursor: canApplyTiming ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                fontWeight: 600,
                lineHeight: 1.2
              }}
              title="セリフ文字数から尺を自動入力"
            >
              →尺
            </button>
          )}
        </div>
      </div>

      {hovered && displayText.trim() && tooltipPos && (
        <div
          style={{
            position: 'fixed',
            left: `${tooltipPos.left}px`,
            bottom: `${window.innerHeight - tooltipPos.top + 8}px`,
            zIndex: 5000,
            maxWidth: '360px',
            minWidth: '180px',
            width: 'max-content',
            background: '#1f2937',
            color: '#fff',
            padding: '10px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
            pointerEvents: 'none'
          }}
        >
          {displayText}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '18px',
              width: 0,
              height: 0,
              borderLeft: '7px solid transparent',
              borderRight: '7px solid transparent',
              borderTop: '7px solid #1f2937'
            }}
          />
        </div>
      )}
    </div>
  );
};

export default CutDialogueEditor;
