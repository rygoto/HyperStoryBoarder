import React, { useState } from 'react';
import { getDefaultAIConfig } from '../../services/ai-service';
import ImageModelSelector from './ImageModelSelector';
import APITestPanel from './APITestPanel';

const AIConfigPanel = ({ config, onConfigChange, onClose }) => {
  const [localConfig, setLocalConfig] = useState(() => {
    const initialConfig = config || getDefaultAIConfig();
    // 古いモデル名を自動更新
    if (initialConfig.dialogue.model === 'gpt-4-vision-preview') {
      initialConfig.dialogue.model = 'gpt-4o';
    }
    if (initialConfig.dialogue.model === 'gpt-4') {
      initialConfig.dialogue.model = 'gpt-4o';
    }
    return initialConfig;
  });
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState(false);

  const handleConfigUpdate = (section, field, value) => {
    const newConfig = {
      ...localConfig,
      [section]: {
        ...localConfig[section],
        [field]: value
      }
    };
    
    // 画像生成プロバイダーが変更された場合、モデルも自動更新
    if (section === 'imageGeneration' && field === 'provider') {
      if (value === 'openai') {
        newConfig.imageGeneration.model = 'dall-e-3';
      } else if (value === 'replicate') {
        newConfig.imageGeneration.model = 'black-forest-labs/flux-schnell';
      }
    }
    
    setLocalConfig(newConfig);
  };

  const handleSave = () => {
    onConfigChange(localConfig);
    onClose();
  };

  const handleReset = () => {
    setLocalConfig(getDefaultAIConfig());
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        width: '600px',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        {/* ヘッダー */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>
            🔧 AI設定
          </h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              onClick={() => {
                const defaultConfig = getDefaultAIConfig();
                setLocalConfig(defaultConfig);
                onConfigChange(defaultConfig);
              }}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              title="設定を初期値にリセット"
            >
              🔄 リセット
            </button>
            <button onClick={onClose} style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer'
            }}>
              ✕
            </button>
          </div>
        </div>

        {/* 対話AI設定 */}
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          background: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
            💬 対話・解析AI
          </h3>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '4px' }}>
              プロバイダー
            </label>
            <select
              value={localConfig.dialogue.provider}
              onChange={(e) => handleConfigUpdate('dialogue', 'provider', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="custom">カスタムAPI</option>
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '4px' }}>
              APIキー
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type={showApiKeys ? 'text' : 'password'}
                value={localConfig.dialogue.apiKey}
                onChange={(e) => handleConfigUpdate('dialogue', 'apiKey', e.target.value)}
                placeholder="sk-..."
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
              <button
                type="button"
                onClick={() => setShowApiKeys(!showApiKeys)}
                style={{
                  padding: '8px 12px',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {showApiKeys ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '4px' }}>
              モデル
            </label>
            <input
              type="text"
              value={localConfig.dialogue.model}
              onChange={(e) => handleConfigUpdate('dialogue', 'model', e.target.value)}
              placeholder="gpt-4o"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>

        {/* 画像生成AI設定 */}
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          background: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
            🎨 画像生成AI
          </h3>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '4px' }}>
              プロバイダー
            </label>
            <select
              value={localConfig.imageGeneration.provider}
              onChange={(e) => handleConfigUpdate('imageGeneration', 'provider', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="openai">OpenAI (DALL-E)</option>
              <option value="replicate">Replicate</option>
              <option value="stability">Stability AI</option>
              <option value="custom">カスタムAPI</option>
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '4px' }}>
              APIキー
            </label>
            <input
              type={showApiKeys ? 'text' : 'password'}
              value={localConfig.imageGeneration.apiKey}
              onChange={(e) => handleConfigUpdate('imageGeneration', 'apiKey', e.target.value)}
              placeholder={localConfig.imageGeneration.provider === 'openai' ? 'sk-...' : 'r8_...'}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '4px' }}>
              モデル
            </label>
                      <ImageModelSelector
            selectedModel={localConfig.imageGeneration.model}
            onModelChange={(model) => handleConfigUpdate('imageGeneration', 'model', model)}
            provider={localConfig.imageGeneration.provider}
          />
          </div>
        </div>

        {/* 注意事項 */}
        <div style={{
          marginBottom: '24px',
          padding: '12px',
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '6px'
        }}>
          <div style={{ fontSize: '12px', color: '#92400e' }}>
            ⚠️ APIキーは安全に管理してください。このアプリケーションではローカルストレージに保存されます。
          </div>
        </div>

        {/* アクションボタン */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <button
            onClick={() => setShowTestPanel(true)}
            style={{
              padding: '10px 20px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            🔧 接続テスト
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleReset}
              style={{
                padding: '10px 20px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              🔄 リセット
            </button>
            
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '10px 20px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              💾 保存
            </button>
          </div>
        </div>
      </div>
      
      {showTestPanel && (
        <APITestPanel 
          config={localConfig}
          onClose={() => setShowTestPanel(false)}
        />
      )}
    </div>
  );
};

export default AIConfigPanel; 