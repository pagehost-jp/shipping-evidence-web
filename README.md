# 📦 Shipping Evidence Web

**Amazon自己発送 証跡記録Webアプリ（PWA）**

外注さん・納品スタッフがブラウザで使える証跡記録システム。Googleログインで安全にアクセス管理。

## 🔐 Access Control

This app requires Google Authentication.
Only specific Google accounts are allowed via Firebase Security Rules.

**重要**: URLを知っているだけではアクセスできません。許可されたGoogleアカウントでのログインが必須です。

## 主な機能

- 📸 **証跡写真の記録**: 伝票番号とシリアル番号を同一写真で撮影・保存（最大3枚）
- 🤖 **OCR自動入力**: 画像から伝票番号を自動抽出（Tesseract.js - ブラウザ内処理）
- 🔍 **検索機能**: 伝票番号検索（部分一致）、日付フィルタ（今日/今週/今月/カレンダー選択）
- ✏️ **編集・削除**: 記録の修正や削除が可能
- 📱 **ブラウザで動作**: インストール不要、URL共有だけで使える
- ☁️ **Cloud-first**: Firebaseに保存、デバイス間で自動同期
- 🔒 **Googleログイン**: 許可されたアカウントのみアクセス可能

## 技術スタック

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Firebase** (Authentication, Firestore, Storage)
- **Tesseract.js** (ローカルOCR)
- **PWA対応** (Progressive Web App)

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Firebase環境変数の設定

`.env.local` ファイルを作成し、Firebase設定を追加：

```bash
# .env.local
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 3. Firebase設定

#### Authentication
- Google認証プロバイダを有効化
- 匿名認証は **無効** にすること（セキュリティ要件）

#### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /shippingRecords/{docId} {
      // Only allow specific Gmail addresses
      allow read, write: if request.auth != null
        && request.auth.token.email in [
          'your-email@gmail.com'
        ];
    }
  }
}
```

#### Storage Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /evidence/{allPaths=**} {
      // Only allow specific Gmail addresses
      allow read, write: if request.auth != null
        && request.auth.token.email in [
          'your-email@gmail.com'
        ];
    }
  }
}
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## 使い方

1. **Googleログイン**: アプリを開くと自動的にGoogleログイン画面が表示されます
2. **新規作成**: トップページの「＋ 新規作成」ボタンから証跡を記録
3. **写真撮影**: 伝票番号とシリアル番号が同一写真に写るように撮影（最大3枚）
4. **情報入力**: 発送日、伝票番号、メモを入力して保存
   - OCRが1枚目の画像から伝票番号を自動抽出（候補として表示）
   - 内容を確認・修正してから保存
5. **検索**: トップページで伝票番号や日付で絞り込み
   - 伝票番号は部分一致検索（下4桁だけでもヒット）
   - ハイフンやスペースは自動的に無視されます
6. **詳細表示**: レコードをタップして詳細表示・編集・削除

## プロジェクト構造

```
shipping-evidence-web/
├── app/                    # Next.js App Router
│   ├── page.tsx           # ホーム画面（一覧・検索）
│   ├── new/               # 新規作成画面
│   ├── detail/[id]/       # 詳細・編集・削除画面
│   └── settings/          # 設定画面
├── lib/                   # ビジネスロジック
│   ├── firebase.ts        # Firebase初期化・認証
│   ├── firestore.ts       # Firestore CRUD操作
│   ├── storage.ts         # Firebase Storage画像アップロード
│   ├── localOcr.ts        # Tesseract.js OCR処理
│   └── types.ts           # TypeScript型定義
└── components/           # 共通コンポーネント
```

## 設計思想

### Cloud-first アーキテクチャ

- **Firebase Firestore**に全データを保存（リアルタイム同期）
- **Firebase Storage**に画像を保存（最大3枚/レコード）
- **デバイス間同期**が自動的に行われる
- オフライン対応は今後の拡張予定

### セキュリティ設計

- **Googleログイン必須**: 匿名アクセス不可
- **メールアドレスホワイトリスト**: Firebase Rulesで厳格に制御
- **画像とデータの両方を保護**: Firestore/Storage両方にルール適用
- **APIキーは環境変数**: .env.localはgitignoreで除外

### データ設計

- 伝票番号は必須項目（空では保存不可）
- 画像も必須（証跡として重要）
- OCRは補助機能（失敗しても手動入力可能）

## OCR機能について

- **Tesseract.js**をブラウザ内で実行（サーバー不要）
- 1枚目の画像から伝票番号を自動抽出
- 進捗状況をリアルタイム表示
- 候補として表示されるため、必ず内容を確認してください
- OCR失敗時も手動入力で問題なく使用できます

## デプロイ

Vercelへのデプロイが推奨されます：

```bash
npm run build
```

**環境変数の設定**:
- Vercelダッシュボードで `.env.local` の内容を設定
- Firebase環境変数（NEXT_PUBLIC_FIREBASE_*）を追加

## セキュリティ注意事項

⚠️ **重要**: 以下を必ず守ってください

1. **.env.localをGitHubにpushしない** - .gitignoreで除外済み
2. **匿名認証を有効にしない** - Googleログインのみ
3. **Firebase Rulesを両方設定** - Firestore と Storage
4. **許可するメールアドレスを限定** - ホワイトリストを厳格に管理

## ライセンス

MIT

## 開発者

- **GitHub**: pagehost-jp
- **Email**: akyfrh0406@gmail.com
