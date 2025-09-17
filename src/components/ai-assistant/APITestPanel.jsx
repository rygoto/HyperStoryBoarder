import React, { useState } from 'react';

const APITestPanel = ({ config, onClose }) => {
  const [testResults, setTestResults] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const testOpenAI = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.dialogue.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setTestResults(prev => ({ ...prev, openai: '✅ 接続成功' }));
      } else {
        const error = await response.text();
        setTestResults(prev => ({ ...prev, openai: `❌ エラー: ${response.status} - ${error.slice(0, 100)}` }));
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, openai: `❌ 接続エラー: ${error.message}` }));
    }
    setIsLoading(false);
  };

  const testReplicate = async () => {
    setIsLoading(true);
    try {
      // プロキシ経由でテスト
      const response = await fetch('/api/replicate/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${config.imageGeneration.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          version: 'f2ab8a5569070ad7c70c40b6e3e62b0e0976f7b09b6e1a4c9c91e4c5e8e4b5f6',
          input: {
            prompt: 'test connection',
            width: 512,
            height: 256,
            num_inference_steps: 1
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        setTestResults(prev => ({ 
          ...prev, 
          replicate: `✅ 接続成功 - ID: ${data.id?.slice(0, 8)}...` 
        }));
      } else {
        const error = await response.text();
        setTestResults(prev => ({ 
          ...prev, 
          replicate: `❌ エラー: ${response.status} - ${error.slice(0, 200)}` 
        }));
      }
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        replicate: `❌ 接続エラー: ${error.message}` 
      }));
    }
    setIsLoading(false);
  };

  const testDirect = async () => {
    setIsLoading(true);
    try {
      // 直接APIテスト（CORS確認用）
      const response = await fetch('https://api.replicate.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Token ${config.imageGeneration.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setTestResults(prev => ({ ...prev, direct: '✅ 直接接続可能' }));
      } else {
        setTestResults(prev => ({ ...prev, direct: `❌ 直接接続エラー: ${response.status}` }));
      }
    } catch (error) {
      if (error.message.includes('CORS')) {
        setTestResults(prev => ({ 
          ...prev, 
          direct: '🔒 CORS制限 - プロキシ経由が必要' 
        }));
      } else {
        setTestResults(prev => ({ 
          ...prev, 
          direct: `❌ 直接接続エラー: ${error.message}` 
        }));
      }
    }
    setIsLoading(false);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        width: '600px',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
            🔧 API接続テスト
          </h3>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer'
          }}>
            ✕
          </button>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '14px', color: '#374151', marginBottom: '12px' }}>
            現在の設定:
          </h4>
          <div style={{
            background: '#f8fafc',
            padding: '12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            <div>OpenAI: {config.dialogue.apiKey ? `${config.dialogue.apiKey.slice(0, 7)}...` : '未設定'}</div>
            <div>Replicate: {config.imageGeneration.apiKey ? `${config.imageGeneration.apiKey.slice(0, 7)}...` : '未設定'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={testOpenAI}
            disabled={!config.dialogue.apiKey || isLoading}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              background: config.dialogue.apiKey ? '#3b82f6' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: config.dialogue.apiKey ? 'pointer' : 'not-allowed'
            }}
          >
            <span>🤖 OpenAI API テスト</span>
            <span>{testResults.openai || (isLoading ? '⏳' : '▶️')}</span>
          </button>

          <button
            onClick={testReplicate}
            disabled={!config.imageGeneration.apiKey || isLoading}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              background: config.imageGeneration.apiKey ? '#10b981' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: config.imageGeneration.apiKey ? 'pointer' : 'not-allowed'
            }}
          >
            <span>🎨 Replicate API テスト (プロキシ経由)</span>
            <span>{testResults.replicate || (isLoading ? '⏳' : '▶️')}</span>
          </button>

          <button
            onClick={testDirect}
            disabled={!config.imageGeneration.apiKey || isLoading}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              background: config.imageGeneration.apiKey ? '#f59e0b' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: config.imageGeneration.apiKey ? 'pointer' : 'not-allowed'
            }}
          >
            <span>🔒 Replicate 直接接続テスト</span>
            <span>{testResults.direct || (isLoading ? '⏳' : '▶️')}</span>
          </button>
        </div>

        <div style={{
          marginTop: '20px',
          padding: '12px',
          background: '#fef3c7',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#92400e'
        }}>
          <strong>💡 ヒント:</strong><br />
          • OpenAI接続が成功すれば対話機能が利用可能<br />
          • Replicate直接接続はCORS制限でブロックされる予定<br />
          • プロキシ経由テストが成功すれば画像生成が利用可能<br />
          • エラーが出る場合はAPIキーを確認してください
        </div>
      </div>
    </div>
  );
};

export default APITestPanel; 