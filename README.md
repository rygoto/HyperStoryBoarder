# Piyopiyo StoryBoard Maker

複数デバイスで絵コンテを共有・編集できるWebアプリケーションです。

## 🚀 機能

- ✨ **マルチデバイス対応**: PC、タブレット、スマートフォンからアクセス
- 🔄 **リアルタイム同期**: 複数デバイス間でデータを自動同期
- 🖼️ **画像管理**: Firebase Storageで画像を安全に保存
- 👤 **ユーザー認証**: Googleアカウントでログイン
- 💾 **自動保存**: 編集内容を自動的にクラウドに保存
- 📤 **データ移行**: 既存のlocalStorageデータをクラウドに移行
- 📋 **JSONインポート**: 既存のJSONファイルからデータをインポート

## 🛠️ 技術スタック

- **フロントエンド**: React 19 + Vite
- **認証**: Firebase Authentication
- **データベース**: Cloud Firestore
- **ストレージ**: Firebase Storage
- **ホスティング**: Vercel

## 📋 セットアップ手順

### 1. Firebaseプロジェクトの作成

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. 「プロジェクトを作成」をクリック
3. プロジェクト名を入力（例: piyopiyo-storyboard）
4. Google Analytics は任意で設定

### 2. Firebase サービスの有効化

#### Authentication
1. Firebase Console の「Authentication」を選択
2. 「始める」をクリック
3. 「Sign-in method」タブでGoogleを有効化
4. 承認済みドメインに本番URLを追加

#### Firestore Database
1. Firebase Console の「Firestore Database」を選択
2. 「データベースを作成」をクリック
3. 本番モードで開始
4. ロケーションを選択（asia-northeast1推奨）

#### Storage
1. Firebase Console の「Storage」を選択
2. 「始める」をクリック
3. 本番モードで開始
4. ロケーションを選択（Firestoreと同じ）

### 3. セキュリティルールの設定

#### Firestore Rules
Firebase Console の「Firestore Database」→「ルール」タブで以下を設定：

\`\`\`javascript
// firestore.rules の内容をコピー
\`\`\`

#### Storage Rules
Firebase Console の「Storage」→「ルール」タブで以下を設定：

\`\`\`javascript
// storage.rules の内容をコピー
\`\`\`

### 4. Firebase設定の取得

1. Firebase Console の「プロジェクトの設定」（歯車アイコン）
2. 「全般」タブの「マイアプリ」でWebアプリを追加
3. アプリ名を入力（例: Piyopiyo StoryBoard）
4. Firebase設定オブジェクトをコピー

### 5. 環境変数の設定

\`src/config/firebase.js\` ファイルの設定を更新：

\`\`\`javascript
const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "your-auth-domain-here",
  projectId: "your-project-id-here", 
  storageBucket: "your-storage-bucket-here",
  messagingSenderId: "your-sender-id-here",
  appId: "your-app-id-here"
};
\`\`\`

### 6. 依存関係のインストールと開発サーバー起動

\`\`\`bash
# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev
\`\`\`

## 🚀 Vercelへのデプロイ

### 1. GitHubリポジトリの作成
プロジェクトをGitHubにプッシュ

### 2. Vercelでのデプロイ
1. [Vercel](https://vercel.com/) にアクセス
2. GitHubアカウントでログイン
3. 「New Project」からリポジトリを選択
4. デプロイを実行

### 3. Firebase認証ドメインの追加
1. Firebase Console の「Authentication」→「Settings」
2. 「承認済みドメイン」にVercelのドメインを追加
3. 例: \`your-app.vercel.app\`

## 📱 使用方法

### 初回セットアップ
1. Googleアカウントでログイン
2. 「新規作成」で最初の絵コンテを作成

### データ移行（既存ユーザー）
1. ログイン後、「🔄 データ移行」ボタンが表示された場合はクリック
2. localStorageからFirebaseにデータを移行
3. Base64画像は自動的にFirebase Storageに移行

### 絵コンテ編集
1. 一覧から絵コンテを選択
2. フレームをクリックして画像をアップロード
3. 変更は自動的にクラウドに保存
4. 他のデバイスでも同じアカウントでログインすれば同期される

## 🔧 開発者向け情報

### プロジェクト構造
\`\`\`
src/
├── components/          # Reactコンポーネント
│   ├── StoryboardManager.jsx    # プロジェクト管理UI
│   ├── StoryboardViewer.jsx     # 絵コンテ編集UI
│   └── LoginButton.jsx          # ログインUI
├── hooks/              # カスタムフック
│   ├── useAuth.js      # 認証管理
│   └── useStoryboard.js # Firestore操作
├── services/           # サービス層
│   ├── storage-service.js    # 画像アップロード
│   └── migration-service.js  # データ移行
└── config/
    └── firebase.js     # Firebase設定
\`\`\`

### 主要な機能

#### 画像処理
- 最大幅400px、品質50%で自動圧縮
- Firebase Storageに保存
- 5MB制限

#### データ構造
\`\`\`javascript
{
  name: "絵コンテ名",
  pages: [
    {
      images: [[url1, url2], [url3], ...],  // 各カットの画像配列
      imageIndices: [0, 0, 0, 0, 0],        // 表示中の画像インデックス
      faceTexts: ["", "", "", "", ""],      // 表情テキスト
      dialogueTexts: ["", "", "", "", ""],  // セリフテキスト
      timeValues: ["", "", "", "", ""],     // 時間値
      blendFiles: ["", "", "", "", ""]      // Blenderファイル
    }
  ]
}
\`\`\`

### Firebase無料枠の制限
- **Firestore**: 読み取り50,000/日、書き込み20,000/日
- **Storage**: 容量5GB、転送量1GB/日
- **Authentication**: 無制限

## 🆘 トラブルシューティング

### よくある問題

**1. ログインできない**
- Firebase Authenticationが有効化されているか確認
- 承認済みドメインにホストが追加されているか確認

**2. 画像がアップロードできない**  
- Firebase Storageが有効化されているか確認
- セキュリティルールが正しく設定されているか確認
- ファイルサイズが5MB以下か確認

**3. データが保存されない**
- Firestore Databaseが有効化されているか確認
- セキュリティルールが正しく設定されているか確認
- ネットワーク接続を確認

**4. 他のデバイスで表示されない**
- 同じGoogleアカウントでログインしているか確認
- ブラウザのキャッシュをクリア

## 📄 ライセンス

MIT License

## 🤝 コントリビューション

Issue や Pull Request をお気軽にお送りください。

---

**開発者**: Cursor AI Assistant  
**バージョン**: 1.0.0  
**最終更新**: 2026年4月10日