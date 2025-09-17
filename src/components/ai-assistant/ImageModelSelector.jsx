import React from 'react';

const ImageModelSelector = ({ selectedModel, onModelChange, provider = 'replicate' }) => {
  const openaiModels = [
    {
      id: 'dall-e-3',
      name: 'DALL-E 3',
      description: '最高品質・高解像度（推奨）',
      cost: '~$0.04/画像',
      speed: '⚡ 高速（10-20秒）',
      quality: '⭐⭐⭐⭐⭐'
    },
    {
      id: 'dall-e-2',
      name: 'DALL-E 2',
      description: '安価・標準品質',
      cost: '~$0.02/画像',
      speed: '🚀 高速（5-10秒）',
      quality: '⭐⭐⭐⭐'
    },
    {
      id: 'gpt-image-1',
      name: 'GPT Image 1',
      description: '最新モデル・高品質',
      cost: '~$0.04/画像',
      speed: '⚡ 高速（10-20秒）',
      quality: '⭐⭐⭐⭐⭐'
    }
  ];

  const replicateModels = [
    {
      id: 'black-forest-labs/flux-schnell',
      name: 'FLUX Schnell',
      description: '高速・高品質（推奨）',
      cost: '~$0.01/画像',
      speed: '⚡ 超高速（2-4秒）',
      quality: '⭐⭐⭐⭐⭐'
    },
    {
      id: 'stability-ai/sdxl',
      name: 'Stable Diffusion XL',
      description: '安価・高品質',
      cost: '~$0.005/画像',
      speed: '🚀 高速（5-10秒）',
      quality: '⭐⭐⭐⭐'
    },
    {
      id: 'stability-ai/stable-diffusion-xl',
      name: 'SDXL (Alternative)',
      description: 'バランス型',
      cost: '~$0.003/画像',
      speed: '🐌 標準（10-15秒）',
      quality: '⭐⭐⭐⭐'
    }
  ];

  const models = provider === 'openai' ? openaiModels : replicateModels;

  return (
    <div style={{
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      padding: '16px',
      marginTop: '12px'
    }}>
      <h4 style={{
        fontSize: '14px',
        fontWeight: '600',
        marginBottom: '12px',
        color: '#1e293b'
      }}>
        🎨 画像生成モデル選択
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {models.map((model) => (
          <label
            key={model.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              padding: '12px',
              border: selectedModel === model.id ? '2px solid #3b82f6' : '1px solid #d1d5db',
              borderRadius: '6px',
              background: selectedModel === model.id ? '#eff6ff' : 'white',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <input
              type="radio"
              name="imageModel"
              value={model.id}
              checked={selectedModel === model.id}
              onChange={(e) => onModelChange(e.target.value)}
              style={{ marginRight: '12px', marginTop: '2px' }}
            />
            
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px'
              }}>
                <span style={{ 
                  fontWeight: '500',
                  fontSize: '13px',
                  color: '#1e293b'
                }}>
                  {model.name}
                </span>
                {(model.id === 'black-forest-labs/flux-schnell' || model.id === 'dall-e-3') && (
                  <span style={{
                    fontSize: '10px',
                    background: '#10b981',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: '500'
                  }}>
                    推奨
                  </span>
                )}
              </div>
              
              <div style={{
                fontSize: '11px',
                color: '#64748b',
                marginBottom: '6px'
              }}>
                {model.description}
              </div>
              
              <div style={{
                display: 'flex',
                gap: '16px',
                fontSize: '10px',
                color: '#6b7280'
              }}>
                <span>💰 {model.cost}</span>
                <span>{model.speed}</span>
                <span>🎯 {model.quality}</span>
              </div>
            </div>
          </label>
        ))}
      </div>

      <div style={{
        fontSize: '11px',
        color: '#64748b',
        marginTop: '12px',
        padding: '8px',
        background: '#f1f5f9',
        borderRadius: '4px'
      }}>
        💡 <strong>推奨:</strong> {provider === 'openai' 
          ? 'DALL-E 3は最高品質でストーリーボード用途に最適です。料金を抑えたい場合はDALL-E 2をお選びください。'
          : 'FLUX Schnellは高速・高品質でストーリーボード用途に最適です。料金を抑えたい場合はSDXLをお選びください。'
        }
      </div>
    </div>
  );
};

export default ImageModelSelector; 