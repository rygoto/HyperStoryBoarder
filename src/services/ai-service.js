// AI設定の型定義（JSDocで型情報を提供）

/**
 * @typedef {Object} DialogueConfig
 * @property {'openai' | 'anthropic' | 'custom'} provider
 * @property {string} apiKey
 * @property {string} [endpoint]
 * @property {string} model
 */

/**
 * @typedef {Object} ImageGenerationConfig
 * @property {'openai' | 'replicate' | 'stability' | 'custom'} provider
 * @property {string} apiKey
 * @property {string} [endpoint]
 * @property {string} model
 */

/**
 * @typedef {Object} AIConfig
 * @property {DialogueConfig} dialogue
 * @property {ImageGenerationConfig} imageGeneration
 */

/**
 * @typedef {Object} SituationAnalysisData
 * @property {string} scenario - シチュエーション（場面・状況）
 * @property {string} characters - 登場人物
 * @property {string} setting - 場所・環境
 * @property {string} mood - 雰囲気・感情
 * @property {string} narrative - ストーリー展開
 * @property {string} objectives - 中間フレームで表現すべき要素
 */

/**
 * AIサービス管理クラス
 */
export class AIServiceManager {
  /**
   * @param {AIConfig} config
   */
  constructor(config) {
    this.config = config;
    // 解析結果のキャッシュ
    this.analysisCache = new Map();
    // 解析中のリクエストを防ぐためのセット
    this.pendingAnalysis = new Set();
  }

  /**
   * APIキーが設定されているかチェック
   * @returns {boolean}
   */
  hasValidConfig() {
    return !!(this.config?.dialogue?.apiKey);
  }

  /**
   * フレームのハッシュキーを生成
   * @param {Object} frames - フレーム画像データ
   * @returns {string}
   */
  generateFrameKey(frames) {
    const { previous, current, next } = frames;
    // 画像データの最初の100文字でハッシュを生成（完全な比較は重いため）
    const hashData = [
      previous ? previous.substring(0, 100) : 'null',
      current ? current.substring(0, 100) : 'null',
      next ? next.substring(0, 100) : 'null'
    ].join('|');
    
    // 簡単なハッシュ関数
    let hash = 0;
    for (let i = 0; i < hashData.length; i++) {
      const char = hashData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return hash.toString(36);
  }

  /**
   * フレーム解析を実行（キャッシュ付き）
   * @param {Object} frames - フレーム画像データ
   * @param {string} [frames.previous] - 前フレーム画像（base64）
   * @param {string} [frames.current] - 現在フレーム画像（base64）
   * @param {string} [frames.next] - 次フレーム画像（base64）
   * @returns {Promise<{frameAnalysis: Object, situationAnalysis: SituationAnalysisData, suggestions: string[]}>}
   */
  async analyzeFrames(frames) {
    if (!this.hasValidConfig()) {
      return this.getFallbackAnalysis();
    }

    // フレームのハッシュキーを生成
    const frameKey = this.generateFrameKey(frames);
    
    // キャッシュをチェック
    if (this.analysisCache.has(frameKey)) {
      console.log('🎯 キャッシュから解析結果を取得:', frameKey);
      return this.analysisCache.get(frameKey);
    }
    
    // 既に解析中の場合は待機
    if (this.pendingAnalysis.has(frameKey)) {
      console.log('⏳ 解析中です。完了まで待機...');
      // 解析完了まで待機（最大10秒）
      for (let i = 0; i < 100; i++) {
        if (this.analysisCache.has(frameKey)) {
          return this.analysisCache.get(frameKey);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      // タイムアウト時はフォールバック
      return this.getFallbackAnalysis();
    }
    
    // 解析開始
    this.pendingAnalysis.add(frameKey);
    console.log('🔍 新しい解析を開始:', frameKey);
    
    try {
      let result;
      // 選択されたAPI providerに応じて分岐
      switch (this.config.dialogue.provider) {
        case 'openai':
          result = await this.callOpenAIVision(frames);
          break;
        case 'anthropic':
          result = await this.callAnthropicVision(frames);
          break;
        default:
          result = await this.callCustomAPI(frames);
      }
      
      // 結果をキャッシュに保存
      this.analysisCache.set(frameKey, result);
      console.log('💾 解析結果をキャッシュに保存:', frameKey);
      
      return result;
    } catch (error) {
      console.error('解析エラー:', error);
      const fallbackResult = this.getFallbackAnalysis();
      // エラー時もキャッシュに保存（フォールバック結果）
      this.analysisCache.set(frameKey, fallbackResult);
      return fallbackResult;
    } finally {
      this.pendingAnalysis.delete(frameKey);
    }
  }

  /**
   * OpenAI Vision APIを呼び出し
   * @param {Object} frames
   * @returns {Promise<Object>}
   */
  async callOpenAIVision(frames) {
    try {
      // 実際のOpenAI API呼び出し
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.dialogue.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.dialogue.model || 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'あなたは絵コンテ制作の専門家です。フレーム画像を解析して、シチュエーションを理解し、JSON形式で返してください。回答は以下のJSON形式で：{"scenario": "場面の説明", "characters": "登場人物", "setting": "場所・環境", "mood": "雰囲気・感情", "narrative": "ストーリー展開", "objectives": "中間フレームで表現すべき要素"}'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: '以下のフレーム画像を解析してください：'
                },
                ...(frames.previous ? [{
                  type: 'image_url',
                  image_url: { url: frames.previous }
                }] : []),
                ...(frames.current ? [{
                  type: 'image_url', 
                  image_url: { url: frames.current }
                }] : []),
                ...(frames.next ? [{
                  type: 'image_url',
                  image_url: { url: frames.next }
                }] : [])
              ]
            }
          ],
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API Response:', response.status, response.statusText, errorText);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      let situationAnalysis;
      try {
        situationAnalysis = JSON.parse(content);
      } catch {
        // JSON解析失敗時のフォールバック
        situationAnalysis = {
          scenario: content || 'フレーム解析を実行しました',
          characters: '登場人物を確認',
          setting: '場所・環境を確認',
          mood: '雰囲気を確認',
          narrative: 'ストーリー展開を確認',
          objectives: '表現要素を確認'
        };
      }

      return {
        frameAnalysis: {
          previous: frames.previous ? 'OpenAI解析: 前フレームを確認しました' : null,
          current: frames.current ? 'OpenAI解析: 現在フレームを確認しました' : null,
          next: frames.next ? 'OpenAI解析: 次フレームを確認しました' : null
        },
        situationAnalysis,
        suggestions: [
          'クローズアップで感情を強調',
          'カメラアングルで印象を変更',
          'ライティングで雰囲気を調整'
        ]
      };

    } catch (error) {
      console.error('OpenAI API Error:', error);
      return this.getFallbackAnalysis();
    }
  }

  /**
   * Anthropic Vision APIを呼び出し
   * @param {Object} frames
   * @returns {Promise<Object>}
   */
  async callAnthropicVision(frames) {
    // TODO: Anthropic API実装
    console.log('Anthropic Vision API呼び出し:', frames);
    
    return this.getFallbackAnalysis();
  }

  /**
   * カスタムAPIを呼び出し
   * @param {Object} frames
   * @returns {Promise<Object>}
   */
  async callCustomAPI(frames) {
    // TODO: カスタムAPI実装
    console.log('カスタムAPI呼び出し:', frames);
    
    return this.getFallbackAnalysis();
  }

  /**
   * キャッシュをクリア
   */
  clearCache() {
    this.analysisCache.clear();
    this.pendingAnalysis.clear();
    console.log('🗑️ 解析キャッシュをクリアしました');
  }

  /**
   * キャッシュの状態を取得
   * @returns {Object}
   */
  getCacheStatus() {
    return {
      cachedCount: this.analysisCache.size,
      pendingCount: this.pendingAnalysis.size,
      cacheKeys: Array.from(this.analysisCache.keys())
    };
  }

  /**
   * フォールバック解析を取得
   * @returns {Object}
   */
  getFallbackAnalysis() {
    return {
      frameAnalysis: {
        previous: '前フレームが存在します',
        current: '現在フレームが存在します',
        next: '次フレームが存在します'
      },
      situationAnalysis: {
        scenario: '一般的な絵コンテシーン',
        characters: '登場人物',
        setting: '場所・環境',
        mood: '中性的な雰囲気',
        narrative: '前フレームから次フレームへの自然な流れ',
        objectives: 'スムーズな場面転換と視覚的な連続性'
      },
      suggestions: [
        'シンプルで効果的な構図',
        '視線の流れを意識した配置',
        '物語の進行に合わせた演出'
      ]
    };
  }

  /**
   * AI対話を実行
   * @param {string} userMessage - ユーザーメッセージ
   * @param {SituationAnalysisData} situationAnalysis - シチュエーション解析結果
   * @param {Array} chatHistory - 対話履歴
   * @returns {Promise<{message: string, suggestions: string[]}>}
   */
  async chatWithAI(userMessage, situationAnalysis, chatHistory) {
    if (!this.hasValidConfig()) {
      return this.generateMockChatResponse(userMessage, situationAnalysis);
    }

    try {
      return await this.callActualChatAPI(userMessage, situationAnalysis, chatHistory);
    } catch (error) {
      console.error('API呼び出しエラー:', error);
      return this.generateMockChatResponse(userMessage, situationAnalysis);
    }
  }

  /**
   * 実際のチャットAPIを呼び出し
   * @param {string} userMessage 
   * @param {SituationAnalysisData} situationAnalysis 
   * @param {Array} chatHistory 
   * @returns {Promise<{message: string, suggestions: string[]}>}
   */
  async callActualChatAPI(userMessage, situationAnalysis, chatHistory) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.dialogue.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.dialogue.model || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `あなたは絵コンテ制作の専門アシスタントです。あなたの重要な役割は、前フレームと次フレームの2つの画像を参照して、その中間に配置する1枚のフレーム画像について、ユーザーと一緒に構図や演出を考えることです。

【あなたの仕事】
- 前フレームから次フレームへの自然な流れを理解し、中間フレームで何を表現すべきかを分析する
- ユーザーの要望を聞き取り、前後フレームとの連続性を保ちながら中間フレームの構図を提案する
- カメラアングル、ライティング、キャラクターの配置、感情表現など、具体的な演出要素をアドバイスする

【現在の状況】
- 場面: ${situationAnalysis.scenario}
- 登場人物: ${situationAnalysis.characters}
- 場所: ${situationAnalysis.setting}
- 雰囲気: ${situationAnalysis.mood}
- 目的: ${situationAnalysis.objectives}

【対話の指針】
- 前後フレームとの連続性を常に意識する
- ユーザーの要望を具体的な視覚的要素に変換する
- カメラワーク（クローズアップ、ワイドショット、アングルなど）を具体的に提案する
- 感情や雰囲気を視覚的に表現する方法をアドバイスする
- ストーリーボードとしての一貫性を重視する

返答は短く（2-3行程度）、フレンドリーに。提案は1つか2つに絞って、前後フレームとの関係を意識した具体的なアドバイスを提供してください。`
          },
          ...chatHistory.slice(-3).map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.content
          })),
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: 150,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Chat API Response:', response.status, response.statusText, errorText);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || 'すみません、応答を生成できませんでした。';

    // 応答から提案を抽出
    const suggestions = [];
    if (content.includes('クローズアップ') || content.includes('アップ')) {
      suggestions.push('クローズアップで表情を強調して');
    }
    if (content.includes('ワイド') || content.includes('引き')) {
      suggestions.push('ワイドショットで全体を見せて');
    }
    if (content.includes('ロー') || content.includes('下から')) {
      suggestions.push('ローアングルで迫力を出して');
    }
    if (content.includes('ハイ') || content.includes('上から')) {
      suggestions.push('ハイアングルで緊張感を演出して');
    }

    return {
      message: content,
      suggestions: suggestions.length > 0 ? suggestions : [
        'もう少し詳しく教えて',
        '他のアングルも検討したい',
        'ライティングについても相談したい'
      ]
    };
  }

  /**
   * モック対話応答を生成
   * @param {string} userMessage 
   * @param {SituationAnalysisData} situationAnalysis 
   * @returns {Promise<{message: string, suggestions: string[]}>}
   */
  async generateMockChatResponse(userMessage, situationAnalysis) {
    // リアルな遅延を模擬
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const responses = {
      '緊張感': {
        message: `緊張感を出すなら、ローアングルかクローズアップがいいですね！ダッチアングル（傾けた構図）も効果的ですよ。どの方向で攻めてみます？`,
        suggestions: [
          'ローアングルで迫力出そう',
          'クローズアップで表情重視',
          'ダッチアングルで不安定感'
        ]
      },
      '明るい': {
        message: `明るくするなら、ハイキー照明とワイドショットの組み合わせがおすすめ！暖色系の光で温かみも演出できますね。どんな感じがお好みですか？`,
        suggestions: [
          'ハイキー照明で全体明るく',
          'ワイドショットで開放感',
          '暖色系で温かい感じに'
        ]
      },
      '距離感': {
        message: `距離感の表現は面白いテーマですね！ワイドで物理的距離を見せるか、クローズアップで心理的な距離を表現するか...どちらが合いそうですか？`,
        suggestions: [
          'ワイドで物理的距離を表現',
          'クローズアップで心理的距離',
          'オーバーショルダーで関係性'
        ]
      },
      'アングル': {
        message: `アングルで印象がガラッと変わりますからね！ローアングルで力強く、ハイアングルで脆さを表現...どんな印象にしたいですか？`,
        suggestions: [
          'ローアングルで力強さ',
          'ハイアングルで不安感',
          '水平アングルで安定感'
        ]
      },
      'ライティング': {
        message: `ライティング重要ですね！逆光でドラマチックに、サイドライトで立体感...どんな雰囲気を狙ってます？`,
        suggestions: [
          '逆光でドラマチック',
          'サイドライトで立体感',
          'トップライトで神秘的'
        ]
      }
    };

    // キーワードマッチングで応答を選択
    let selectedResponse;
    for (const [keyword, response] of Object.entries(responses)) {
      if (userMessage.includes(keyword) || userMessage.includes(keyword.toLowerCase())) {
        selectedResponse = response;
        break;
      }
    }

    // より多くのキーワード対応
    const additionalKeywords = {
      '構図': 'アングル',
      'カメラ': 'アングル', 
      '照明': 'ライティング',
      '光': 'ライティング',
      '関係': '距離感',
      '感情': '距離感',
      'ドラマ': '緊張感',
      '迫力': '緊張感',
      '暗い': '緊張感',
      '明るく': '明るい',
      '楽しい': '明るい',
      '希望': '明るい'
    };

    if (!selectedResponse) {
      for (const [key, mappedKeyword] of Object.entries(additionalKeywords)) {
        if (userMessage.includes(key)) {
          selectedResponse = responses[mappedKeyword];
          break;
        }
      }
    }

    // デフォルト応答
    if (!selectedResponse) {
      const randomResponses = [
        `「${userMessage}」ですね！面白いアイデアです。どんな風に表現したいですか？`,
        `なるほど！「${situationAnalysis.scenario}」でそれをやるなら、いくつか方法がありますね。`,
        `いいですね！その方向で行くなら、カメラワークで攻めるか、ライティングで行くか...どちらがお好みです？`,
        `そうですね！「${situationAnalysis.mood}」な雰囲気に、それを加えるとより良くなりそうです。`
      ];
      
      selectedResponse = {
        message: randomResponses[Math.floor(Math.random() * randomResponses.length)],
        suggestions: [
          'アングルを変えてみる',
          'ライティングで雰囲気作り', 
          'キャラクターの配置調整',
          '他のアイデアも聞きたい'
        ]
      };
    }

    return selectedResponse;
  }

  /**
   * 画像生成を実行
   * @param {string} prompt - 生成指示
   * @param {Object} settings - 生成設定
   * @param {number} settings.width - 幅
   * @param {number} settings.height - 高さ
   * @param {string} [settings.style] - スタイル指定
   * @returns {Promise<string>} - 生成画像のbase64データ
   */
  async generateImage(prompt, settings) {
    console.log('画像生成:', prompt, settings);
    
    // 画像生成API設定をチェック
    if (this.config.imageGeneration?.apiKey && this.config.imageGeneration.provider === 'openai') {
      try {
        return await this.callOpenAIImageGeneration(prompt, settings);
      } catch (error) {
        console.error('OpenAI Image API Error:', error);
        // エラー時はプレースホルダーにフォールバック
      }
    }
    
    // プレースホルダー画像生成
    return this.generatePlaceholderImage(prompt, settings);
  }

  /**
   * OpenAI GPT Image APIで画像生成
   * @param {string} prompt 
   * @param {Object} settings 
   * @returns {Promise<string>}
   */
  async callOpenAIImageGeneration(prompt, settings) {
    // APIキーの確認
    if (!this.config.imageGeneration.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }
    
    console.log('🔧 OpenAI Image API Configuration:');
    console.log('API Key:', this.config.imageGeneration.apiKey.slice(0, 10) + '...');
    console.log('Model:', this.config.imageGeneration.model);
    
    // プロンプトを整理して一枚の絵として生成されるように最適化
    const optimizedPrompt = this.optimizeImagePrompt(prompt);
    
    // 品質設定（DALL-E 3のみ対応）
    const model = this.getOpenAIImageModel(this.config.imageGeneration.model);
    
    // サイズの決定（OpenAIの制限に合わせる）
    const size = this.getOpenAIImageSize(settings.width, settings.height, model);
    let quality = undefined;
    
    if (model === 'dall-e-3') {
      const requestedQuality = settings.quality || 'standard';
      // DALL-E 3で有効なquality値のみを許可
      if (requestedQuality === 'standard' || requestedQuality === 'hd') {
        quality = requestedQuality;
      } else {
        quality = 'standard'; // デフォルト値
      }
    }
    
    console.log('🔍 Request Details:');
    console.log('Prompt:', optimizedPrompt);
    console.log('Size:', size);
    console.log('Model:', model);
    console.log('Settings Quality:', settings.quality);
    console.log('Final Quality:', quality);

    // リトライ機能付きでAPI呼び出し
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
                 const requestBody = {
           model: model,
           prompt: optimizedPrompt,
           n: 1,
           size: size
         };
         
         // response_formatはDALL-Eモデルのみに追加（gpt-image-1では除外）
         if (model === 'dall-e-2' || model === 'dall-e-3') {
           requestBody.response_format = 'b64_json';
         }
         
         // qualityパラメータはDALL-E 3のみに追加
         if (quality) {
           requestBody.quality = quality;
         }
        
        console.log(`🔍 Request Body (Attempt ${attempt}):`, JSON.stringify(requestBody, null, 2));
        
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.imageGeneration.apiKey}`
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`🔴 OpenAI Image API Error (Attempt ${attempt}):`, response.status, errorText);
          
          // 500エラーの場合はリトライ
          if (response.status === 500 && attempt < maxRetries) {
            console.log(`🔄 Retrying in ${attempt * 2} seconds...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            lastError = new Error(`OpenAI Image API error: ${response.status} - ${errorText}`);
            continue;
          }
          
          throw new Error(`OpenAI Image API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('🎉 OpenAI Image Generation Response:', data);
        
        if (data.data && data.data[0] && data.data[0].b64_json) {
          return `data:image/png;base64,${data.data[0].b64_json}`;
        } else {
          throw new Error('No image data received from OpenAI');
        }

      } catch (error) {
        console.error(`🔴 OpenAI Image Generation Error (Attempt ${attempt}):`, error);
        lastError = error;
        
        // 最後の試行でない場合はリトライ
        if (attempt < maxRetries) {
          console.log(`🔄 Retrying in ${attempt * 2} seconds...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        }
      }
    }
    
    // すべてのリトライが失敗した場合
    throw lastError || new Error('Image generation failed after all retries');
  }

  /**
   * OpenAI画像サイズを取得
   * @param {number} width 
   * @param {number} height 
   * @param {string} model - 使用するモデル
   * @returns {string}
   */
  getOpenAIImageSize(width = 512, height = 256, model = 'dall-e-3') {
    const aspectRatio = width / height;
    
    if (model === 'dall-e-2') {
      // DALL-E 2の対応サイズ（512x512も追加）
      if (Math.abs(aspectRatio - 1) < 0.1) {
        // 構図確認用なら512x512、最終生成なら1024x1024
        return width <= 512 ? '512x512' : '1024x1024';
      } else {
        return '1024x1024'; // DALL-E 2は正方形のみ
      }
    } else if (model === 'gpt-image-1') {
      // GPT Image 1の対応サイズ（1024x1024のみ）
      return '1024x1024';
    } else {
      // DALL-E 3の対応サイズ（最小1024x1024）
      if (Math.abs(aspectRatio - 1) < 0.1) {
        // DALL-E 3は512x512をサポートしないので、常に1024x1024
        return '1024x1024';
      } else if (aspectRatio > 1) {
        return '1792x1024'; // 横長（16:9相当）
      } else {
        return '1024x1792'; // 縦長（9:16相当）
      }
    }
  }

  /**
   * 幅と高さからアスペクト比を計算
   * @param {number} width 
   * @param {number} height 
   * @returns {string}
   */
  getAspectRatio(width = 512, height = 256) {
    // 一般的なアスペクト比にマッピング
    const ratio = width / height;
    
    if (Math.abs(ratio - 1) < 0.1) return "1:1";        // 正方形
    if (Math.abs(ratio - 4/3) < 0.1) return "4:3";      // 4:3
    if (Math.abs(ratio - 3/4) < 0.1) return "3:4";      // 縦長4:3
    if (Math.abs(ratio - 16/9) < 0.1) return "16:9";    // 16:9
    if (Math.abs(ratio - 9/16) < 0.1) return "9:16";    // 縦長16:9
    if (Math.abs(ratio - 2) < 0.1) return "2:1";        // 2:1（512x256）
    if (Math.abs(ratio - 0.5) < 0.1) return "1:2";      // 縦長2:1
    
    // デフォルトは2:1（ストーリーボード用）
    return "2:1";
  }

  /**
   * 画像生成プロンプトを最適化
   * @param {string} prompt - 元のプロンプト
   * @returns {string} - 最適化されたプロンプト
   */
  optimizeImagePrompt(prompt) {
    console.log('🔍 プロンプト最適化開始:', prompt);
    
    // プロンプトが空または無効な場合はデフォルトを返す
    if (!prompt || prompt.trim() === '') {
      console.log('⚠️ 空のプロンプトを検出、デフォルトを使用');
      return 'intermediate storyboard frame, monochrome sketch, hand-drawn style';
    }
    
         // プロンプトが既にAI生成された詳細なプロンプトの場合はそのまま使用
     let optimizedPrompt = '';
     if (prompt.includes('Wide shot') || prompt.includes('Close-up') || prompt.includes('lion') || 
         prompt.includes('cliff') || prompt.includes('ocean') || prompt.includes('background') ||
         prompt.length > 200) {
       console.log('🎯 AI生成の詳細プロンプトを検出、そのまま使用');
       optimizedPrompt = prompt;
     } else {
       // 従来の構造化処理（レガシー形式用）
       const lines = prompt.split('\n').filter(line => line.trim());
       
       // ユーザーの要望とカメラワークを抽出
       let userRequests = '';
       let cameraWork = '';
       let scene = '';
       
       for (const line of lines) {
         if (line.includes('User consultation and requirements:')) {
           userRequests = line.replace('User consultation and requirements:', '').trim();
         } else if (line.includes('Camera work:')) {
           cameraWork = line.replace('Camera work:', '').trim();
         } else if (line.includes('Scene:')) {
           scene = line.replace('Scene:', '').trim();
         }
       }
       
       // シンプルなプロンプトを作成（シーン解析結果は除外）
       
       // ユーザーの要望を最優先
       if (userRequests) {
         optimizedPrompt += userRequests;
       }
       
       // カメラワークの追加
       if (cameraWork && !optimizedPrompt.includes(cameraWork)) {
         optimizedPrompt += optimizedPrompt ? `, ${cameraWork}` : cameraWork;
       }
       
       // シーンの基本情報（必要最小限）
       if (scene && !optimizedPrompt.includes(scene)) {
         optimizedPrompt += optimizedPrompt ? `, ${scene}` : scene;
       }
     }
    
    // スタイル指定（シンプルに）
    optimizedPrompt += ', monochrome sketch, hand-drawn style';
    
    // プロンプトの長さを制限（DALL-Eの制限に合わせる）
    if (optimizedPrompt.length > 1000) {
      optimizedPrompt = optimizedPrompt.substring(0, 1000);
    }
    
         // 空のプロンプトの場合はデフォルトを設定
     if (!optimizedPrompt.trim()) {
       console.log('⚠️ 空のプロンプトを検出、デフォルトを使用');
       optimizedPrompt = 'intermediate storyboard frame, monochrome sketch, hand-drawn style';
     }
    
    console.log('✅ 最適化されたプロンプト:', optimizedPrompt);
    return optimizedPrompt;
  }

  /**
   * AI駆動のインテリジェントプロンプト生成
   * @param {Object} context - コンテキスト情報
   * @param {Object} context.situationAnalysis - シーン解析結果
   * @param {Array} context.conversationHistory - 対話履歴
   * @param {Object} context.frameContext - フレームコンテキスト
   * @param {string} context.frameContext.previousFrame - 前フレーム画像
   * @param {string} context.frameContext.currentFrame - 現在フレーム画像
   * @param {string} context.frameContext.nextFrame - 次フレーム画像
   * @param {Array} context.selectedPresets - 選択されたカメラプリセット
   * @param {string} context.stylePrompt - 選択されたスタイルのプロンプト
   * @returns {Promise<string>} - 生成されたプロンプト
   */
  async generateIntelligentPrompt(context) {
    const { situationAnalysis, conversationHistory, selectedPresets, stylePrompt } = context;
    
    if (!this.hasValidConfig()) {
      // API設定がない場合は従来の方法でフォールバック
      return this.generateFallbackPrompt(context);
    }

    try {
      // 対話履歴からユーザーの要望を抽出
      const userMessages = conversationHistory
        .filter(msg => msg.type === 'user')
        .map(msg => msg.content)
        .join(', ');

             // カメラプリセットの情報を抽出
       const cameraWork = selectedPresets.length > 0 
         ? selectedPresets.map(p => p.prompt).join(', ')
         : '';

       // スタイル情報を取得（デフォルトは鉛筆スケッチ）
       const finalStylePrompt = stylePrompt || 'pencil sketch style, hand-drawn, monochrome, rough lines';

       // AIにプロンプト生成を依頼
       const promptGenerationRequest = {
        model: this.config.dialogue.model || 'gpt-4o',
        messages: [
                               {
            role: 'system',
            content: `あなたは絵コンテ制作の専門家です。前後2枚のフレーム画像を参考に、その中間に配置する1枚のフレーム画像の生成プロンプトを作成してください。

このプロジェクトでは、前フレームと次フレームの間に1枚の画像を生成して、スムーズな場面転換を実現します。

以下の要素を考慮して、中間フレームのプロンプトを生成してください：
1. 前フレームから中間フレームへの自然な流れ
2. 中間フレームから次フレームへの自然な流れ
3. ユーザーの対話内容で表現したい要素
4. 選択されたカメラワークや構図
5. シーンの雰囲気と設定

プロンプト生成のルール：
- 前後フレームとの連続性を重視
- 具体的で視覚的な描写を使用
- キャラクターの位置、表情、動作を明確に
- 背景や小物の配置を詳細に
- ライティングや影の情報を含める
- カメラアングルと構図を明示
- 感情や雰囲気を視覚的に表現
- 1枚の画像として完結する内容

出力形式：
- 英語で記述（DALL-Eの理解向上のため）
- 簡潔で具体的
- 指定されたスタイル（${finalStylePrompt}）を反映
- 説明不要、プロンプトのみ返答`
          },
                    {
            role: 'user',
            content: `シーン情報：
- 場面: ${situationAnalysis.scenario}
- 登場人物: ${situationAnalysis.characters}
- 場所: ${situationAnalysis.setting}
- 雰囲気: ${situationAnalysis.mood}
- 目的: ${situationAnalysis.objectives}

ユーザーの要望: ${userMessages}

カメラワーク: ${cameraWork}

指定スタイル: ${finalStylePrompt}

前フレームと次フレームの間に配置する中間フレーム1枚の画像生成プロンプトを作成してください。前後フレームとの連続性を保ちながら、ユーザーの要望を反映し、指定されたスタイルで1枚の画像として完結するプロンプトを作成してください。`
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      };

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.dialogue.apiKey}`
        },
        body: JSON.stringify(promptGenerationRequest)
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      let generatedPrompt = data.choices[0]?.message?.content?.trim();

      // プロンプトの品質チェックと調整
      if (!generatedPrompt || generatedPrompt.length < 10) {
        throw new Error('Generated prompt is too short or empty');
      }

             // スタイル指定を追加（選択されたスタイルを優先）
       if (finalStylePrompt && !generatedPrompt.includes(finalStylePrompt)) {
         generatedPrompt += `, ${finalStylePrompt}`;
       } else if (!generatedPrompt.includes('monochrome') && !generatedPrompt.includes('sketch')) {
         generatedPrompt += ', monochrome sketch, hand-drawn style';
       }

      // プロンプトの長さを制限
      if (generatedPrompt.length > 1000) {
        generatedPrompt = generatedPrompt.substring(0, 1000);
      }

      console.log('🤖 AI生成プロンプト:', generatedPrompt);
      return generatedPrompt;

    } catch (error) {
      console.error('AIプロンプト生成エラー:', error);
      // エラー時はフォールバック
      return this.generateFallbackPrompt(context);
    }
  }

  /**
   * フォールバックプロンプト生成（AI生成失敗時）
   * @param {Object} context 
   * @returns {string}
   */
  generateFallbackPrompt(context) {
    const { situationAnalysis, conversationHistory, selectedPresets, stylePrompt } = context;
    
    // ユーザーメッセージを抽出
    const userMessages = conversationHistory
      .filter(msg => msg.type === 'user')
      .map(msg => msg.content)
      .join(', ');

    // カメラワーク情報
    const cameraWork = selectedPresets.length > 0 
      ? selectedPresets.map(p => p.prompt).join(', ')
      : '';

    // 中間フレーム用のシンプルなプロンプトを構築
    let prompt = 'intermediate storyboard frame, ';
    
    if (userMessages) {
      prompt += userMessages;
    }
    
    if (cameraWork) {
      prompt += prompt ? `, ${cameraWork}` : cameraWork;
    }
    
    // 基本的なシーン情報を追加
    if (situationAnalysis.scenario) {
      prompt += prompt ? `, ${situationAnalysis.scenario}` : situationAnalysis.scenario;
    }
    
    // スタイル指定（選択されたスタイルまたはデフォルト）
    const finalStyle = stylePrompt || 'monochrome sketch, hand-drawn style';
    prompt += prompt ? `, ${finalStyle}` : finalStyle;
    
    return prompt;
  }

  /**
   * OpenAI画像生成モデルの選択
   * @param {string} model 
   * @returns {string}
   */
  getOpenAIImageModel(model) {
    // OpenAI 画像生成モデルの選択
    const models = {
      'dall-e-3': 'dall-e-3',
      'dall-e-2': 'dall-e-2',
      'gpt-image-1': 'gpt-image-1' // gpt-image-1も使用可能
    };
    
    console.log('🔍 OpenAI Image Model Lookup:');
    console.log('Requested model:', model);
    console.log('Selected model:', models[model] || 'dall-e-3');
    
    return models[model] || 'dall-e-3';
  }

  /**
   * プレースホルダー画像生成（対話内容を反映）
   * @param {string} prompt 
   * @param {Object} settings 
   * @returns {string}
   */
  generatePlaceholderImage(prompt, settings) {
    const canvas = document.createElement('canvas');
    canvas.width = settings.width || 512;
    canvas.height = settings.height || 256;
    const ctx = canvas.getContext('2d');
    
    // 背景をグラデーションに
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#f8fafc');
    gradient.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // プロンプトからキーワードを抽出してビジュアル要素を決定
    const keywords = prompt.toLowerCase();
    let elements = [];
    let colors = ['#64748b', '#475569', '#334155'];
    
    // キーワード分析
    if (keywords.includes('close') || keywords.includes('クローズ')) {
      elements.push('👤 クローズアップ');
      colors = ['#dc2626', '#b91c1c'];
    }
    if (keywords.includes('wide') || keywords.includes('ワイド')) {
      elements.push('🏞️ ワイドショット');
      colors = ['#059669', '#047857'];
    }
    if (keywords.includes('low') || keywords.includes('ロー')) {
      elements.push('📏 ローアングル');
      colors = ['#7c3aed', '#6d28d9'];
    }
    if (keywords.includes('high') || keywords.includes('ハイ')) {
      elements.push('📐 ハイアングル');
      colors = ['#dc2626', '#b91c1c'];
    }
    if (keywords.includes('緊張') || keywords.includes('tension')) {
      elements.push('⚡ 緊張感');
      colors = ['#dc2626', '#991b1b'];
    }
    if (keywords.includes('明るい') || keywords.includes('bright')) {
      elements.push('☀️ 明るい');
      colors = ['#f59e0b', '#d97706'];
    }
    
    // 要素がない場合のデフォルト
    if (elements.length === 0) {
      elements = ['🎬 ストーリーボード'];
    }
    
    // 枠線（スケッチ風）
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);
    
    // 中央にラフなスケッチ風の図形を描画
    ctx.setLineDash([]);
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = 2;
    
    // 人物のラフスケッチ（角丸四角で表現）
    const figureX = canvas.width * 0.3;
    const figureY = canvas.height * 0.3;
    const figureW = canvas.width * 0.4;
    const figureH = canvas.height * 0.4;
    
    ctx.beginPath();
    ctx.roundRect(figureX, figureY, figureW, figureH, 10);
    ctx.stroke();
    
    // 目（点）
    ctx.fillStyle = colors[0];
    ctx.beginPath();
    ctx.arc(figureX + figureW * 0.3, figureY + figureH * 0.3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(figureX + figureW * 0.7, figureY + figureH * 0.3, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // 口（線）
    ctx.strokeStyle = colors[0];
    ctx.beginPath();
    ctx.arc(figureX + figureW * 0.5, figureY + figureH * 0.6, figureW * 0.15, 0, Math.PI);
    ctx.stroke();
    
    // タイトル
    ctx.fillStyle = colors[0];
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎨 AI構図プレビュー', canvas.width / 2, 35);
    
    // 要素表示
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = colors[1] || colors[0];
    elements.forEach((element, index) => {
      ctx.fillText(element, canvas.width / 2, canvas.height - 60 + (index * 20));
    });
    
    // プロンプト表示（短縮版）
    ctx.font = '11px Arial';
    ctx.fillStyle = '#64748b';
    const shortPrompt = prompt.slice(0, 50) + (prompt.length > 50 ? '...' : '');
    ctx.fillText(shortPrompt, canvas.width / 2, canvas.height - 20);
    
    // 角に「開発版」マーク
    ctx.font = '10px Arial';
    ctx.fillStyle = '#10b981';
    ctx.textAlign = 'right';
    ctx.fillText('開発版プレビュー', canvas.width - 10, canvas.height - 5);
    
    return canvas.toDataURL('image/jpeg', 0.9);
  }
}

/**
 * デフォルトのAI設定を取得
 * @returns {AIConfig}
 */
export const getDefaultAIConfig = () => ({
  dialogue: {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o'
  },
  imageGeneration: {
    provider: 'openai',
    apiKey: '',
    model: 'dall-e-3'
  }
});

/**
 * 利用可能な機能を取得
 * @param {AIConfig} config
 * @returns {Object}
 */
export const getAvailableFeatures = (config) => {
  return {
    imageAnalysis: !!config?.dialogue?.apiKey,
    dialogue: !!config?.dialogue?.apiKey,
    imageGeneration: !!config?.imageGeneration?.apiKey,
    presets: true // 常に利用可能
  };
};

/**
 * API設定の妥当性をチェック
 * @param {AIConfig} config 
 * @returns {Object}
 */
export const validateAIConfig = (config) => {
  const errors = [];
  
  if (!config?.dialogue?.apiKey) {
    errors.push('対話API キーが設定されていません');
  } else if (!config.dialogue.apiKey.startsWith('sk-')) {
    errors.push('対話API キーの形式が正しくありません');
  }
  
  if (!config?.imageGeneration?.apiKey) {
    errors.push('画像生成API キーが設定されていません');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};