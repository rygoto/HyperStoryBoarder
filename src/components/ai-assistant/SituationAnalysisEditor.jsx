import React from 'react';

const SituationAnalysisEditor = ({ analysis, onUpdate, onConfirm, isLoading }) => {
  if (!analysis) return null;

  const handleFieldChange = (field, value) => {
    onUpdate({ ...analysis, [field]: value });
  };

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
        📝 シチュエーション理解
      </h4>
      
      <div style={{ display: 'grid', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
            シチュエーション（場面・状況）
          </label>
          <textarea
            value={analysis.scenario}
            onChange={(e) => handleFieldChange('scenario', e.target.value)}
            style={{
              width: '100%',
              minHeight: '60px',
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px',
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
            placeholder="例: キャラクターAとBが重要な会話をしている緊張した場面"
          />
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
              登場人物
            </label>
            <input
              value={analysis.characters}
              onChange={(e) => handleFieldChange('characters', e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '13px',
                fontFamily: 'inherit'
              }}
              placeholder="例: 主人公、ヒロイン"
            />
          </div>
          
          <div>
            <label style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
              場所・環境
            </label>
            <input
              value={analysis.setting}
              onChange={(e) => handleFieldChange('setting', e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '13px',
                fontFamily: 'inherit'
              }}
              placeholder="例: 学校の屋上、夕暮れ"
            />
          </div>
        </div>
        
        <div>
          <label style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
            雰囲気・感情
          </label>
          <input
            value={analysis.mood}
            onChange={(e) => handleFieldChange('mood', e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px',
              fontFamily: 'inherit'
            }}
            placeholder="例: 緊張感、期待感、不安"
          />
        </div>
        
        <div>
          <label style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
            ストーリー展開
          </label>
          <textarea
            value={analysis.narrative}
            onChange={(e) => handleFieldChange('narrative', e.target.value)}
            style={{
              width: '100%',
              minHeight: '50px',
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px',
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
            placeholder="例: AがBに告白しようとしているが、まだ言い出せずにいる"
          />
        </div>
        
        <div>
          <label style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
            中間フレームで表現すべき要素
          </label>
          <textarea
            value={analysis.objectives}
            onChange={(e) => handleFieldChange('objectives', e.target.value)}
            style={{
              width: '100%',
              minHeight: '60px',
              padding: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '13px',
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
            placeholder="例: キャラクターの心理的な変化、視線の動き、距離感の変化"
          />
        </div>
      </div>
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        gap: '8px',
        marginTop: '16px'
      }}>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          style={{
            padding: '8px 16px',
            background: isLoading ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '13px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
            fontFamily: 'inherit'
          }}
        >
          {isLoading ? '解析中...' : 'この内容で対話を開始'}
        </button>
      </div>
    </div>
  );
};

export default SituationAnalysisEditor; 