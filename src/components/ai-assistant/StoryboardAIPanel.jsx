import React, { useState, useEffect, useRef } from 'react';
import { extractContextFrames } from '../../services/frame-extractor';
import { AIServiceManager, getDefaultAIConfig, getAvailableFeatures, validateAIConfig } from '../../services/ai-service';
import AIConfigPanel from './AIConfigPanel';
import SituationAnalysisEditor from './SituationAnalysisEditor';
import CameraPresets from './CameraPresets';
import DialogueInterface from './DialogueInterface';

const StoryboardAIPanel = ({
  isVisible,
  selectedFrame,
  pages,
  onClose,
  onFrameGenerated, // eslint-disable-line no-unused-vars
  onFrameUpdated    // eslint-disable-line no-unused-vars
}) => {
  const [currentStep, setCurrentStep] = useState('analyzing');
  const [situationAnalysis, setSituationAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [aiConfig, setAiConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('storyboard_ai_config');
      return saved ? JSON.parse(saved) : getDefaultAIConfig();
    } catch {
      return getDefaultAIConfig();
    }
  });
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [aiService, setAiService] = useState(null);
  const [selectedPresets, setSelectedPresets] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [availableFeatures, setAvailableFeatures] = useState({ dialogue: false, imageGeneration: false });
  
  // 対話履歴をStoryboardAIPanelで管理
  const [chatHistory, setChatHistory] = useState([]);
  
  // DialogueInterfaceとの通信用ref
  const addPresetMessageRef = useRef(null);

  // AI設定が変更されたときにサービスを更新
  useEffect(() => {
    if (aiConfig) {
      const newService = new AIServiceManager(aiConfig);
      console.log('🔧 AIサービス作成:', newService);
      console.log('🔧 キャッシュ機能確認:', {
        hasGetCacheStatus: typeof newService.getCacheStatus === 'function',
        hasClearCache: typeof newService.clearCache === 'function',
        hasAnalyzeFrames: typeof newService.analyzeFrames === 'function'
      });
      setAiService(newService);
    }
  }, [aiConfig]);

  // パネルが表示されたときの初期化
  useEffect(() => {
    if (isVisible && selectedFrame && aiService) {
      // 設定の古いモデル名を自動更新
      if (aiConfig.dialogue?.model === 'gpt-4-vision-preview' || aiConfig.dialogue?.model === 'gpt-4') {
        const updatedConfig = {
          ...aiConfig,
          dialogue: {
            ...aiConfig.dialogue,
            model: 'gpt-4o'
          }
        };
        setAiConfig(updatedConfig);
        localStorage.setItem('storyboard_ai_config', JSON.stringify(updatedConfig));
      }

      // 既に解析済みの場合はスキップ
      if (situationAnalysis && currentStep !== 'analyzing') {
        return;
      }

      setCurrentStep('analyzing');
      setIsLoading(true);
      
      const frameContext = extractContextFrames(pages, selectedFrame.pageIdx, selectedFrame.cutIdx);
      
      // AI解析を実行（キャッシュ機能付き）
      aiService.analyzeFrames({
        previous: frameContext.previousFrame,
        current: frameContext.currentFrame,
        next: frameContext.nextFrame
      }).then(result => {
        setSituationAnalysis(result.situationAnalysis);
        setCurrentStep('situation');
        setIsLoading(false);
      }).catch(error => {
        console.error('AI解析エラー:', error);
        // フォールバック解析
        const fallbackAnalysis = {
          scenario: '解析できませんでしたが、フレーム間の中間的な場面',
          characters: '登場人物の詳細は不明',
          setting: '場所・環境の詳細は不明',
          mood: '中性的な雰囲気',
          narrative: 'フレーム間の自然な流れを想定',
          objectives: 'スムーズな場面転換と視覚的な連続性'
        };
        setSituationAnalysis(fallbackAnalysis);
        setCurrentStep('situation');
        setIsLoading(false);
      });
    }
  }, [isVisible, selectedFrame, aiService, pages, aiConfig, situationAnalysis, currentStep]);

  // AI設定の保存
  const handleConfigChange = (newConfig) => {
    setAiConfig(newConfig);
    try {
      localStorage.setItem('storyboard_ai_config', JSON.stringify(newConfig));
    } catch (error) {
      console.error('AI設定の保存に失敗:', error);
    }
  };

  // プリセットを対話に組み込む処理
  const handleApplyPresetsToDialogue = (presets) => {
    if (presets.length === 0) {
      alert('プリセットを選択してください');
      return;
    }

    // 選択されたプリセットの名前を取得
    const CAMERA_PRESETS = [
      { id: 'close-up', name: 'クローズアップ' },
      { id: 'medium-shot', name: 'ミディアムショット' },
      { id: 'wide-shot', name: 'ワイドショット' },
      { id: 'over-shoulder', name: 'オーバーショルダー' },
      { id: 'high-angle', name: 'ハイアングル' },
      { id: 'low-angle', name: 'ローアングル' },
      { id: 'dutch-angle', name: 'ダッチアングル' },
      { id: 'bird-eye', name: 'バードアイ' }
    ];
    
    const COMPOSITION_PRESETS = [
      { id: 'rule-of-thirds', name: '三分割法' },
      { id: 'center-composition', name: '中央構図' },
      { id: 'symmetrical', name: 'シンメトリー' },
      { id: 'depth-of-field', name: '被写界深度' },
      { id: 'frame-in-frame', name: 'フレームインフレーム' },
      { id: 'leading-lines', name: 'リーディングライン' }
    ];

    const presetNames = presets.map(presetId => {
      const foundPreset = [...CAMERA_PRESETS, ...COMPOSITION_PRESETS].find(p => p.id === presetId);
      return foundPreset ? foundPreset.name : presetId;
    });

    const message = `${presetNames.join('と')}で撮影したいです`;
    
    // DialogueInterfaceにメッセージを送信
    if (addPresetMessageRef.current) {
      addPresetMessageRef.current(message);
    }
  };

  // 画像生成処理（対話用）
  const handleGenerateImageWithDialogue = async (conversationContext, selectedStylePrompt) => {
    if (!aiService || !situationAnalysis) return;
    
    // 重複実行を防ぐ
    if (isGenerating) {
      console.log('🔄 画像生成中です。重複実行をスキップします。');
      return;
    }
    
    setIsGenerating(true);
    console.log('🎨 StoryboardAIPanel: 画像生成開始');
    console.log('🎨 選択されたスタイル:', selectedStylePrompt);
    
    try {
      // フレームコンテキストを取得
      const frameContext = extractContextFrames(pages, selectedFrame.pageIdx, selectedFrame.cutIdx);
      
      // AI駆動のインテリジェントプロンプト生成を使用（中間フレーム用）
      const context = {
        situationAnalysis,
        conversationHistory: [{ type: 'user', content: conversationContext }],
        frameContext: {
          previousFrame: frameContext.previousFrame,
          currentFrame: frameContext.currentFrame,
          nextFrame: frameContext.nextFrame
        },
        selectedPresets,
        stylePrompt: selectedStylePrompt || 'pencil sketch style, hand-drawn, monochrome, rough lines' // 選択されたスタイルまたはデフォルト
      };
      
      const generatedPrompt = await aiService.generateIntelligentPrompt(context);
      console.log('🤖 AI生成プロンプト:', generatedPrompt);

      // 画像生成（DALL-E 3対応で1024x1024を使用）
      const generatedImage = await aiService.generateImage(generatedPrompt, {
        width: 1024,
        height: 1024,
        style: 'storyboard'
      });

      // 生成された画像をフレームに適用
      onFrameGenerated(selectedFrame.pageIdx, selectedFrame.cutIdx, generatedImage);
      
      // 成功メッセージ
      alert('AIが対話内容と前後フレームを考慮して中間フレームを生成しました！');
      
    } catch (error) {
      console.error('画像生成エラー:', error);
      alert('画像生成に失敗しました: ' + error.message);
    } finally {
      setIsGenerating(false);
      console.log('🎨 StoryboardAIPanel: 画像生成完了');
    }
  };

  // 機能の可用性を更新
  useEffect(() => {
    setAvailableFeatures(getAvailableFeatures(aiConfig));
  }, [aiConfig]);

  if (!isVisible || !selectedFrame) return null;
  
  const frameContext = extractContextFrames(pages, selectedFrame.pageIdx, selectedFrame.cutIdx);
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '480px',
      height: '100vh',
      background: 'white',
      boxShadow: '-4px 0 12px rgba(0,0,0,0.15)',
      zIndex: 1000,
      transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.3s ease-in-out',
      overflowY: 'auto'
    }}>
      <div style={{ padding: '16px' }}>
        {/* ヘッダー */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
            🤖 AI構図補助
          </h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                         <button 
               onClick={() => {
                 if (aiService && aiService.getCacheStatus) {
                   try {
                     const status = aiService.getCacheStatus();
                     console.log('キャッシュ状態:', status);
                     alert(`キャッシュ状態:\n保存済み: ${status.cachedCount}件\n解析中: ${status.pendingCount}件`);
                   } catch (error) {
                     console.error('キャッシュ状態取得エラー:', error);
                     alert('キャッシュ状態の取得に失敗しました');
                   }
                 }
               }}
              style={{
                background: '#e0f2fe', 
                border: '1px solid #0288d1', 
                borderRadius: '4px',
                fontSize: '12px', 
                cursor: 'pointer',
                padding: '4px 8px',
                color: '#0277bd'
              }}
              title="キャッシュ状態確認"
            >
              💾
            </button>
                         <button 
               onClick={() => {
                 if (aiService && aiService.clearCache) {
                   try {
                     aiService.clearCache();
                     alert('キャッシュをクリアしました');
                   } catch (error) {
                     console.error('キャッシュクリアエラー:', error);
                     alert('キャッシュのクリアに失敗しました');
                   }
                 }
               }}
              style={{
                background: '#ffebee', 
                border: '1px solid #f44336', 
                borderRadius: '4px',
                fontSize: '12px', 
                cursor: 'pointer',
                padding: '4px 8px',
                color: '#d32f2f'
              }}
              title="キャッシュクリア"
            >
              🗑️
            </button>
            <button 
              onClick={() => setShowConfigPanel(true)}
              style={{
                background: '#f3f4f6', 
                border: '1px solid #d1d5db', 
                borderRadius: '4px',
                fontSize: '16px', 
                cursor: 'pointer',
                padding: '4px 8px'
              }}
              title="AI設定"
            >
              ⚙️
            </button>
            <button onClick={onClose} style={{
              background: 'none', 
              border: 'none', 
              fontSize: '20px', 
              cursor: 'pointer'
            }}>
              ✕
            </button>
          </div>
        </div>
        
        {/* ステップインジケーター */}
        <div style={{
          display: 'flex',
          marginBottom: '20px',
          background: '#f1f5f9',
          borderRadius: '8px',
          padding: '4px'
        }}>
          {[
            { key: 'analyzing', label: '再解析', icon: '🔍' },
            { key: 'situation', label: 'シチュエーション', icon: '📝' },
            { key: 'dialogue', label: '対話', icon: '💬' }
          ].map((step) => (
            <div
              key={step.key}
              onClick={() => {
                if (step.key === 'analyzing') {
                  // 再解析ボタンを押したら確認ダイアログを表示
                  const confirmed = window.confirm(
                    '再解析を実行しますか？\n\n' +
                    '⚠️ 注意: 再解析にはAPI使用料が発生します\n' +
                    '現在の解析結果を上書きします。\n\n' +
                    '続行しますか？'
                  );
                  
                  if (confirmed) {
                    setCurrentStep('analyzing');
                    setIsLoading(true);
                    
                    // 再解析時は対話履歴をリセット
                    setChatHistory([]);
                    
                    const frameContext = extractContextFrames(pages, selectedFrame.pageIdx, selectedFrame.cutIdx);
                    
                    aiService.analyzeFrames({
                      previous: frameContext.previousFrame,
                      current: frameContext.currentFrame,
                      next: frameContext.nextFrame
                    }).then(result => {
                      setSituationAnalysis(result.situationAnalysis);
                      setCurrentStep('situation');
                      setIsLoading(false);
                    }).catch(error => {
                      console.error('AI解析エラー:', error);
                      const fallbackAnalysis = {
                        scenario: '解析できませんでしたが、フレーム間の中間的な場面',
                        characters: '登場人物の詳細は不明',
                        setting: '場所・環境の詳細は不明',
                        mood: '中性的な雰囲気',
                        narrative: 'フレーム間の自然な流れを想定',
                        objectives: 'スムーズな場面転換と視覚的な連続性'
                      };
                      setSituationAnalysis(fallbackAnalysis);
                      setCurrentStep('situation');
                      setIsLoading(false);
                    });
                  }
                } else {
                  // その他のステップは直接切り替え
                  setCurrentStep(step.key);
                }
              }}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '8px 4px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                background: currentStep === step.key ? 'white' : 'transparent',
                color: currentStep === step.key ? '#1e293b' : '#64748b',
                boxShadow: currentStep === step.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out'
              }}
              onMouseEnter={(e) => {
                if (currentStep !== step.key) {
                  e.target.style.background = '#e2e8f0';
                }
              }}
              onMouseLeave={(e) => {
                if (currentStep !== step.key) {
                  e.target.style.background = 'transparent';
                }
              }}
            >
              <div>{step.icon}</div>
              <div>{step.label}</div>
            </div>
          ))}
        </div>
        
        {/* フレーム情報表示 */}
        <div style={{ 
          marginBottom: '16px',
          padding: '12px',
          background: '#f8fafc',
          borderRadius: '6px'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
            選択フレーム: {selectedFrame.pageIdx + 1}ページ目 {selectedFrame.cutIdx + 1}カット目
          </div>
                  {!availableFeatures.imageAnalysis && (
          <div style={{ 
            fontSize: '12px', 
            color: '#dc2626',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '4px',
            padding: '8px',
            marginTop: '8px'
          }}>
            ⚠️ AI解析機能を使用するにはAPI設定が必要です
          </div>
        )}
        
        {(() => {
          const validation = validateAIConfig(aiConfig);
          return !validation.isValid && (
            <div style={{ 
              fontSize: '12px', 
              color: '#dc2626',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '4px',
              padding: '8px',
              marginTop: '8px'
            }}>
              ⚠️ API設定に問題があります: {validation.errors.join(', ')}
            </div>
          );
        })()}
        </div>
        
        {/* 前後フレーム表示 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                前フレーム
              </div>
              {frameContext.previousFrame ? (
                <img 
                  src={frameContext.previousFrame} 
                  style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px' }}
                  alt="前フレーム"
                />
              ) : (
                <div style={{ 
                  width: '100%', 
                  height: '80px', 
                  background: '#f1f5f9',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  fontSize: '12px'
                }}>
                  フレームなし
                </div>
              )}
            </div>
            
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                次フレーム
              </div>
              {frameContext.nextFrame ? (
                <img 
                  src={frameContext.nextFrame} 
                  style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px' }}
                  alt="次フレーム"
                />
              ) : (
                <div style={{ 
                  width: '100%', 
                  height: '80px', 
                  background: '#f1f5f9',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  fontSize: '12px'
                }}>
                  フレームなし
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* ステップ別コンテンツ */}
        {currentStep === 'analyzing' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: '16px', marginBottom: '16px', color: '#64748b' }}>
              🔍 フレームを解析中...
            </div>
            {isLoading && (
              <div style={{
                width: '32px',
                height: '32px',
                border: '3px solid #f3f4f6',
                borderTop: '3px solid #8b5cf6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }} />
            )}
            {!availableFeatures.imageAnalysis && (
              <div style={{ color: '#64748b', fontSize: '14px', marginTop: '16px' }}>
                AI設定を行ってから解析を開始してください
              </div>
            )}
                         {aiService && aiService.getCacheStatus && (
               <div style={{ 
                 marginTop: '16px', 
                 padding: '8px 12px', 
                 background: '#f0f9ff', 
                 borderRadius: '6px',
                 fontSize: '12px',
                 color: '#0369a1'
               }}>
                 💾 キャッシュ状態: {aiService.getCacheStatus().cachedCount}件保存済み
               </div>
             )}
          </div>
        )}
        
        {currentStep === 'situation' && situationAnalysis && (
          <SituationAnalysisEditor
            analysis={situationAnalysis}
            onUpdate={setSituationAnalysis}
            onConfirm={() => setCurrentStep('dialogue')}
            isLoading={false}
          />
        )}
        
        {currentStep === 'dialogue' && (
          <div>
            <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                確認されたシチュエーション:
              </div>
              <div style={{ fontSize: '13px', color: '#374151' }}>
                {situationAnalysis?.scenario}
              </div>
            </div>
            
                         {/* AI対話インターフェース */}
             <DialogueInterface
               situationAnalysis={situationAnalysis}
               aiService={aiService}
               onGenerateImage={handleGenerateImageWithDialogue}
               isGenerating={isGenerating}
               availableFeatures={availableFeatures}
               onAddPresetMessage={(callback) => { addPresetMessageRef.current = callback; }}
               chatHistory={chatHistory}
               setChatHistory={setChatHistory}
             />
            
            {/* カメラプリセット（追加オプション） */}
            <details style={{ marginTop: '16px' }}>
              <summary style={{
                cursor: 'pointer',
                padding: '8px',
                background: '#f1f5f9',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                📷 カメラプリセットも併用する
              </summary>
              <div style={{ marginTop: '8px' }}>
                <CameraPresets
                  selectedPresets={selectedPresets}
                  onPresetToggle={setSelectedPresets}
                  onApplyPresets={() => handleApplyPresetsToDialogue(selectedPresets)}
                />
              </div>
            </details>
            

          </div>
        )}
      </div>
      
      {/* CSS for loading animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      
      {/* AI設定パネル */}
      {showConfigPanel && (
        <AIConfigPanel
          config={aiConfig}
          onConfigChange={handleConfigChange}
          onClose={() => setShowConfigPanel(false)}
        />
      )}
    </div>
  );
};

export default StoryboardAIPanel; 