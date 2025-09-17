import React, { useState } from 'react';

// カメラワークプリセットの定義
const CAMERA_PRESETS = [
  {
    id: 'close-up',
    name: 'クローズアップ',
    description: '顔や表情に焦点を当てた近景',
    prompt: 'close-up shot, focusing on facial expressions, intimate framing',
    icon: '👤'
  },
  {
    id: 'medium-shot',
    name: 'ミディアムショット',
    description: '上半身を中心とした中景',
    prompt: 'medium shot, waist-up framing, balanced composition',
    icon: '🧍'
  },
  {
    id: 'wide-shot',
    name: 'ワイドショット',
    description: '全身や背景を含む遠景',
    prompt: 'wide shot, full body, establishing the environment',
    icon: '🏞️'
  },
  {
    id: 'over-shoulder',
    name: 'オーバーショルダー',
    description: '肩越しのアングル',
    prompt: 'over-the-shoulder shot, conversational angle',
    icon: '👥'
  },
  {
    id: 'high-angle',
    name: 'ハイアングル',
    description: '上から見下ろすアングル',
    prompt: 'high angle shot, looking down, dramatic perspective',
    icon: '📐'
  },
  {
    id: 'low-angle',
    name: 'ローアングル',
    description: '下から見上げるアングル',
    prompt: 'low angle shot, looking up, powerful perspective',
    icon: '📏'
  },
  {
    id: 'dutch-angle',
    name: 'ダッチアングル',
    description: '斜めに傾いたアングル',
    prompt: 'dutch angle, tilted camera, dynamic unease',
    icon: '📐'
  },
  {
    id: 'bird-eye',
    name: 'バードアイビュー',
    description: '真上からの俯瞰',
    prompt: 'bird\'s eye view, top-down perspective, aerial view',
    icon: '🐦'
  }
];

const COMPOSITION_PRESETS = [
  {
    id: 'rule-of-thirds',
    name: '三分割法',
    description: '画面を三分割して配置',
    prompt: 'rule of thirds composition, balanced placement',
    icon: '⚏'
  },
  {
    id: 'center-composition',
    name: '中央配置',
    description: '被写体を中央に配置',
    prompt: 'centered composition, symmetrical framing',
    icon: '⊕'
  },
  {
    id: 'leading-lines',
    name: 'リーディングライン',
    description: '視線を誘導する線の活用',
    prompt: 'leading lines composition, directional flow',
    icon: '➡️'
  },
  {
    id: 'depth-of-field',
    name: '被写界深度',
    description: '前景・中景・後景の活用',
    prompt: 'depth of field, foreground and background elements',
    icon: '🌊'
  }
];

const CameraPresets = ({ selectedPresets, onPresetToggle, onApplyPresets }) => {
  const [activeTab, setActiveTab] = useState('camera');

  const handlePresetClick = (preset) => {
    if (selectedPresets.find(p => p.id === preset.id)) {
      onPresetToggle(selectedPresets.filter(p => p.id !== preset.id));
    } else {
      onPresetToggle([...selectedPresets, preset]);
    }
  };

  const renderPresetGrid = (presets) => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '8px',
      marginBottom: '16px'
    }}>
      {presets.map(preset => {
        const isSelected = selectedPresets.find(p => p.id === preset.id);
        return (
          <div
            key={preset.id}
            onClick={() => handlePresetClick(preset)}
            style={{
              padding: '12px',
              border: `2px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              background: isSelected ? '#eff6ff' : 'white',
              transition: 'all 0.2s'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '4px'
            }}>
              <span style={{ fontSize: '16px', marginRight: '8px' }}>
                {preset.icon}
              </span>
              <span style={{
                fontSize: '13px',
                fontWeight: '500',
                color: isSelected ? '#1e40af' : '#374151'
              }}>
                {preset.name}
              </span>
            </div>
            <div style={{
              fontSize: '11px',
              color: '#6b7280',
              lineHeight: '1.3'
            }}>
              {preset.description}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{
      padding: '16px',
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      marginBottom: '16px'
    }}>
      <h4 style={{
        fontSize: '16px',
        fontWeight: '600',
        marginBottom: '12px',
        color: '#1e293b'
      }}>
        📷 カメラワーク・構図
      </h4>

      {/* タブ切り替え */}
      <div style={{
        display: 'flex',
        marginBottom: '16px',
        background: '#f1f5f9',
        borderRadius: '6px',
        padding: '2px'
      }}>
        <button
          onClick={() => setActiveTab('camera')}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer',
            background: activeTab === 'camera' ? 'white' : 'transparent',
            color: activeTab === 'camera' ? '#1e293b' : '#64748b',
            boxShadow: activeTab === 'camera' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          📹 カメラアングル
        </button>
        <button
          onClick={() => setActiveTab('composition')}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer',
            background: activeTab === 'composition' ? 'white' : 'transparent',
            color: activeTab === 'composition' ? '#1e293b' : '#64748b',
            boxShadow: activeTab === 'composition' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          🖼️ 構図
        </button>
      </div>

      {/* プリセット表示 */}
      {activeTab === 'camera' && renderPresetGrid(CAMERA_PRESETS)}
      {activeTab === 'composition' && renderPresetGrid(COMPOSITION_PRESETS)}

      {/* 選択されたプリセットの表示 */}
      {selectedPresets.length > 0 && (
        <div style={{
          padding: '12px',
          background: '#ecfdf5',
          border: '1px solid #d1fae5',
          borderRadius: '6px',
          marginBottom: '12px'
        }}>
          <div style={{ fontSize: '12px', color: '#065f46', marginBottom: '4px' }}>
            選択中のプリセット:
          </div>
          <div style={{ fontSize: '11px', color: '#047857' }}>
            {selectedPresets.map(p => p.name).join(', ')}
          </div>
        </div>
      )}

      {/* 適用ボタン */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button
          onClick={() => onPresetToggle([])}
          disabled={selectedPresets.length === 0}
          style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: selectedPresets.length === 0 ? 'not-allowed' : 'pointer',
            background: 'white',
            color: '#6b7280',
            opacity: selectedPresets.length === 0 ? 0.5 : 1
          }}
        >
          クリア
        </button>
        <button
          onClick={onApplyPresets}
          disabled={selectedPresets.length === 0}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: selectedPresets.length === 0 ? 'not-allowed' : 'pointer',
            background: selectedPresets.length === 0 ? '#9ca3af' : '#10b981',
            color: 'white',
            opacity: selectedPresets.length === 0 ? 0.5 : 1
          }}
        >
          このプリセットで生成
        </button>
      </div>
    </div>
  );
};

export default CameraPresets; 