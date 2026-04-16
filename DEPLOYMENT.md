# 🚀 デプロイ手順書

## ✅ デプロイ前チェックリスト

### 1. Firebase プロジェクト設定
- [ ] Firebaseプロジェクト作成済み
- [ ] Authentication（Google）有効化済み  
- [ ] Firestore Database作成済み
- [ ] Firebase Storage有効化済み
- [ ] セキュリティルール設定済み

### 2. ローカル設定
- [ ] `src/config/firebase.js` に正しい設定値を入力
- [ ] `npm install` 実行済み
- [ ] `npm run dev` でローカル動作確認済み
- [ ] Googleログインテスト完了

### 3. コード準備
- [ ] Git リポジトリ作成済み
- [ ] 全ファイルコミット済み
- [ ] GitHubにプッシュ済み

## 🔧 Firebase設定手順

### 1. Firebase Console での設定

#### Authentication設定
```
Firebase Console → Authentication → Sign-in method
→ Google プロバイダを有効化
→ 承認済みドメインにVercelドメイン追加
```

#### Firestore Rules設定
```javascript
// firestore.rulesの内容をFirebase Consoleに貼り付け
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /storyboards/{userId}/projects/{projectId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      // ... 完全なルールはfirestore.rulesを参照
    }
  }
}
```

#### Storage Rules設定
```javascript  
// storage.rulesの内容をFirebase Consoleに貼り付け
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /images/{userId}/{imageId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      // ... 完全なルールはstorage.rulesを参照
    }
  }
}
```

### 2. 設定値の取得と設定

#### Firebase設定の取得
1. Firebase Console → プロジェクト設定（⚙️）
2. 「マイアプリ」でWebアプリを追加
3. 設定オブジェクトをコピー

#### src/config/firebase.js の更新
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",           // ← ここを更新
  authDomain: "project.firebaseapp.com",   // ← ここを更新  
  projectId: "project-id",       // ← ここを更新
  storageBucket: "project.appspot.com",    // ← ここを更新
  messagingSenderId: "123456",   // ← ここを更新
  appId: "1:123456:web:abc123"   // ← ここを更新
};
```

## 🌐 Vercelデプロイ手順

### 1. Vercelアカウント準備
- [Vercel](https://vercel.com) でGitHubアカウント連携

### 2. プロジェクトデプロイ
1. Vercel Dashboard → New Project
2. GitHubリポジトリを選択
3. Framework Preset: Vite
4. Root Directory: ./
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. Install Command: `npm install`

### 3. デプロイ後設定
1. Vercelドメイン（例: `app-name.vercel.app`）をコピー
2. Firebase Console → Authentication → Settings  
3. 承認済みドメインにVercelドメインを追加

## 🔍 動作確認

### 必須テスト項目
- [ ] Googleログイン動作
- [ ] 新規絵コンテ作成
- [ ] 画像アップロード
- [ ] データ自動保存
- [ ] 複数デバイス同期（可能な場合）

### トラブルシューティング

**ログインできない**
→ Firebase承認済みドメイン確認

**画像アップロードエラー**  
→ Storage Rules確認、5MB制限確認

**データ保存されない**
→ Firestore Rules確認、ネットワーク接続確認

**ビルドエラー**
→ `npm run build` でローカル確認

## 📊 監視・メンテナンス

### Firebase使用量監視
- Authentication: 無制限（無料）
- Firestore: 読み取り50,000/日、書き込み20,000/日
- Storage: 5GB容量、1GB/日転送

### 定期確認事項
- [ ] Firebase使用量チェック
- [ ] セキュリティルール更新
- [ ] 依存関係の更新
- [ ] バックアップ（必要に応じて）

---

## 🆘 緊急時対応

**サービス停止時**
1. Vercel Dashboard でデプロイ状況確認
2. Firebase Console でサービス状況確認  
3. GitHub Actions でビルドログ確認

**データ消失時**
1. Firebase Console → Firestore → バックアップ確認
2. 必要に応じてデータ復旧

**セキュリティインシデント**
1. Firebase Rules の緊急無効化
2. 問題調査と修正
3. Rules再有効化

---

✅ **このチェックリスト完了後、本格運用開始！**