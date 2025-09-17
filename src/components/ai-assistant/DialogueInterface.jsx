import React, { useState, useRef, useEffect, useCallback } from 'react';

const DialogueInterface = ({ 
  situationAnalysis, 
  aiService, 
  onGenerateImage, 
  isGenerating,
  availableFeatures,
  onAddPresetMessage,
  chatHistory,
  setChatHistory
}) => {
  const [userMessage, setUserMessage] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('pencil-sketch'); // デフォルトは鉛筆スケッチ
  const chatContainerRef = useRef(null);

  // スタイルオプションの定義
  const styleOptions = [
    {
      id: 'pencil-sketch',
      name: '鉛筆スケッチ調',
      description: '手描きの鉛筆スケッチ風',
      icon: '✏️',
      prompt: 'pencil sketch style, hand-drawn, monochrome, rough lines'
    },
    {
      id: 'grayscale-composition',
      name: 'グレースケール構図',
      description: 'モノクロの構図確認用',
      icon: '🎨',
      prompt: 'grayscale composition, monochrome, clean lines, storyboard style'
    },
    {
      id: 'colored-normal',
      name: 'カラー通常調',
      description: '色付きの通常画像',
      icon: '🌈',
      prompt: 'colored illustration, vibrant, detailed, professional artwork'
    }
  ];

  // AI応答処理関数
  const handleAIResponse = useCallback(async (message) => {
    setIsThinking(true);

    try {
      if (!availableFeatures.dialogue) {
        throw new Error('対話機能が利用できません');
      }

      const response = await aiService.chatWithAI(message, situationAnalysis, chatHistory);
      
      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: response.message,
        suggestions: response.suggestions,
        timestamp: new Date()
      };

      setChatHistory(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('API呼び出しエラー:', error);
      
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: `申し訳ございません。現在AIとの接続に問題があります。

ただし、以下のような一般的なアドバイスをお試しください：

🎬 **カメラワーク提案:**
- クローズアップ: 感情を強調したい場合
- ワイドショット: 環境や関係性を示したい場合  
- ローアングル: キャラクターに力強さを与えたい場合
- ハイアングル: 緊張感や不安を演出したい場合

💡 ご希望があれば「画像を生成」ボタンで現在の設定でお試しいただけます`,
        suggestions: [
          '緊張感を出したい',
          '明るい雰囲気にしたい', 
          '距離感を表現したい'
        ],
        timestamp: new Date()
      };

      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsThinking(false);
    }
  }, [availableFeatures.dialogue, aiService, situationAnalysis, chatHistory]);

  // プリセットメッセージ追加用のコールバック
  useEffect(() => {
    if (onAddPresetMessage) {
      onAddPresetMessage((message) => {
        const presetMessage = {
          id: Date.now(),
          type: 'user',
          content: message,
          timestamp: new Date()
        };
        setChatHistory(prev => [...prev, presetMessage]);
        setUserMessage(''); // 入力欄をクリア
        
        // AIの返答を自動生成
        handleAIResponse(message);
      });
    }
  }, [onAddPresetMessage, handleAIResponse, setChatHistory]);

  // 初期メッセージの設定
  useEffect(() => {
    if (situationAnalysis && chatHistory.length === 0) {
      const initialMessage = {
        id: Date.now(),
        type: 'ai',
        content: `「${situationAnalysis.scenario}」の構図、一緒に考えましょう！どんな感じにしたいですか？`,
        timestamp: new Date()
      };
      setChatHistory([initialMessage]);
    }
  }, [situationAnalysis, chatHistory.length, setChatHistory]);

  // チャット履歴の自動スクロール
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // メッセージ送信
  const handleSendMessage = async () => {
    if (!userMessage.trim() || !aiService || isThinking) return;

    const newUserMessage = {
      id: Date.now(),
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    };

    setChatHistory(prev => [...prev, newUserMessage]);
    setUserMessage('');
    setIsThinking(true);

    try {
      // AI対話の実行
      const response = await aiService.chatWithAI(userMessage, situationAnalysis, chatHistory);
      
      const aiResponse = {
        id: Date.now() + 1,
        type: 'ai',
        content: response.message,
        suggestions: response.suggestions,
        timestamp: new Date()
      };

      setChatHistory(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('対話エラー:', error);
      
      // フォールバック応答
      const fallbackResponse = {
        id: Date.now() + 1,
        type: 'ai',
        content: `申し訳ございません。現在AIとの接続に問題があります。

ただし、以下のような一般的なアドバイスをお試しください：

🎬 **カメラワーク提案:**
- クローズアップ: 感情を強調したい場合
- ワイドショット: 環境や関係性を示したい場合
- ローアングル: キャラクターに力強さを与えたい場合
- ハイアングル: 緊張感や不安を演出したい場合

💡 ご希望があれば「画像を生成」ボタンで現在の設定でお試しいただけます。`,
        timestamp: new Date()
      };

      setChatHistory(prev => [...prev, fallbackResponse]);
    } finally {
      setIsThinking(false);
    }
  };

  // Enter キーでメッセージ送信
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 提案をクリックした時の処理
  const handleSuggestionClick = (suggestion) => {
    setUserMessage(suggestion);
  };

  // 画像生成の実行
  const handleImageGeneration = async () => {
    // 重複実行を防ぐ
    if (isGenerating) {
      console.log('🔄 画像生成中です。重複実行をスキップします。');
      return;
    }
    
    try {
      console.log('🎨 画像生成開始');
      
      // 選択されたスタイルのプロンプトを取得
      const selectedStyleOption = styleOptions.find(style => style.id === selectedStyle);
      const stylePrompt = selectedStyleOption ? selectedStyleOption.prompt : 'pencil sketch style, hand-drawn, monochrome';
      
      console.log('🎨 選択されたスタイル:', selectedStyle, stylePrompt);
      
      // 会話履歴からユーザーメッセージを抽出
      const userMessages = chatHistory.filter(msg => msg.type === 'user').map(msg => msg.content);
      const conversationContext = userMessages.join(', ');
      
      // スタイル情報付きで画像生成を実行
      await onGenerateImage(conversationContext, stylePrompt);
      
    } catch (error) {
      console.error('画像生成エラー:', error);
      alert('画像生成に失敗しました: ' + error.message);
    } finally {
      console.log('🎨 画像生成完了');
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '500px',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      {/* チャット履歴 */}
      <div 
        ref={chatContainerRef}
        style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          background: '#fafafa'
        }}
      >
        {chatHistory.map((message) => (
          <div key={message.id} style={{
            marginBottom: '16px',
            display: 'flex',
            justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start'
          }}>
            <div style={{
              maxWidth: '80%',
              padding: '12px 16px',
              borderRadius: '12px',
              background: message.type === 'user' ? '#3b82f6' : 'white',
              color: message.type === 'user' ? 'white' : '#374151',
              border: message.type === 'ai' ? '1px solid #e5e7eb' : 'none',
              fontSize: '14px',
              lineHeight: '1.5',
              whiteSpace: 'pre-line'
            }}>
              {message.type === 'ai' && (
                <div style={{ fontSize: '12px', color: '#8b5cf6', marginBottom: '4px' }}>
                  🤖 AI Assistant
                </div>
              )}
              {message.content}
              
              {/* AI提案ボタン */}
              {message.suggestions && message.suggestions.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>
                    💡 提案:
                  </div>
                  {message.suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      style={{
                        display: 'block',
                        width: '100%',
                        marginBottom: '4px',
                        padding: '6px 10px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#374151',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* AI思考中表示 */}
        {isThinking && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'white',
              border: '1px solid #e5e7eb',
              fontSize: '14px',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '12px', color: '#8b5cf6', marginBottom: '4px' }}>
                🤖 AI Assistant
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #f3f4f6',
                  borderTop: '2px solid #8b5cf6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                考え中...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 入力エリア */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid #e2e8f0',
        background: 'white'
      }}>
        {!availableFeatures.dialogue && (
          <div style={{
            marginBottom: '12px',
            fontSize: '12px',
            color: '#dc2626',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '4px',
            padding: '8px'
          }}>
            ⚠️ AI対話機能を使用するにはAPI設定が必要です（現在はモック応答を表示）
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <textarea
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="構図や演出についてAIに相談してみましょう..."
            style={{
              flex: 1,
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              resize: 'none',
              minHeight: '40px',
              maxHeight: '120px',
              fontFamily: 'inherit'
            }}
            rows={2}
          />
          <button
            onClick={handleSendMessage}
            disabled={!userMessage.trim() || isThinking}
            style={{
              padding: '10px 16px',
              background: (!userMessage.trim() || isThinking) ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: (!userMessage.trim() || isThinking) ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {isThinking ? '...' : '送信'}
          </button>
        </div>
        
                 {/* スタイル選択UI */}
         <div style={{ marginBottom: '12px' }}>
           <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
             🎨 生成スタイルを選択:
           </div>
           <div style={{ display: 'flex', gap: '6px' }}>
             {styleOptions.map((style) => (
               <button
                 key={style.id}
                 onClick={() => setSelectedStyle(style.id)}
                 style={{
                   flex: 1,
                   padding: '8px 6px',
                   background: selectedStyle === style.id ? '#3b82f6' : '#f8fafc',
                   color: selectedStyle === style.id ? 'white' : '#374151',
                   border: `1px solid ${selectedStyle === style.id ? '#3b82f6' : '#e2e8f0'}`,
                   borderRadius: '6px',
                   fontSize: '11px',
                   cursor: 'pointer',
                   display: 'flex',
                   flexDirection: 'column',
                   alignItems: 'center',
                   gap: '2px'
                 }}
                 title={style.description}
               >
                 <span style={{ fontSize: '14px' }}>{style.icon}</span>
                 <span style={{ fontWeight: '500' }}>{style.name}</span>
               </button>
             ))}
           </div>
         </div>
         
         {/* 画像生成ボタン */}
         <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
           <button
             onClick={handleImageGeneration}
             disabled={isGenerating || chatHistory.length <= 1}
             style={{
               padding: '10px 20px',
               background: (isGenerating || chatHistory.length <= 1) ? '#9ca3af' : '#10b981',
               color: 'white',
               border: 'none',
               borderRadius: '6px',
               fontSize: '14px',
               cursor: (isGenerating || chatHistory.length <= 1) ? 'not-allowed' : 'pointer',
               fontWeight: '500'
             }}
           >
             {isGenerating ? '🎨 生成中...' : '🎨 会話内容で画像生成'}
           </button>
           
           {chatHistory.length > 2 && (
             <div style={{
               fontSize: '11px',
               color: '#64748b',
               fontStyle: 'italic',
               textAlign: 'center'
             }}>
               💡 会話で決めた内容がプロンプトに反映されます
             </div>
           )}
         </div>
      </div>
      
      {/* CSS for loading animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DialogueInterface; 