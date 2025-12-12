# 📦 Shipping Evidence Web

**Amazon自己発送 証跡記録Webアプリ（PWA）**

外注さん・納品スタッフがブラウザで使える証跡記録システム。URL共有するだけで、誰でもすぐに使える。

## 主な機能

- 📸 **証跡写真の記録**: 伝票番号とシリアル番号を同一写真で撮影・保存
- 🤖 **OCR自動入力**: 画像から伝票番号を自動抽出（Gemini Vision）
- 🔍 **検索機能**: 伝票番号検索、日付フィルタ（今日/今週/今月）
- ✏️ **編集・削除**: 記録の修正や削除が可能
- 💾 **バックアップ**: JSON/CSV形式でワンタップエクスポート
- 📱 **ブラウザで動作**: インストール不要、URL共有だけで使える
- 🔒 **Local-first**: IndexedDBに保存、オフラインでも動作

## 技術スタック

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Dexie** (IndexedDB wrapper)
- **PWA対応** (Progressive Web App)

## セットアップ

```bash
# 依存関係のインストール
npm install

# 環境変数の設定（OCR機能を使う場合）
cp .env.local.example .env.local
# .env.local を編集してGemini API Keyを設定

# 開発サーバーの起動
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

### OCR機能の有効化（任意）

伝票番号の自動入力機能を使用する場合：

1. [Google AI Studio](https://aistudio.google.com/app/apikey) でAPIキーを取得
2. `.env.local` ファイルを作成
3. `GEMINI_API_KEY=your_api_key` を設定

```bash
# .env.local
GEMINI_API_KEY=your_gemini_api_key_here
```

**重要事項:**
- APIキーはサーバーサイド専用（`NEXT_PUBLIC_` なし）
- ブラウザには露出されません（セキュア）
- OCRはオプション機能です。APIキーがなくても手動入力で使用できます
- 失敗しても無言でスキップされ、手入力できます

**外部API壊れる前提の設計:**
- モデル名・エンドポイントは `lib/gemini.ts` で一元管理
- プライマリモデル失敗時はフォールバックモデルに自動切り替え
- タイムアウト・リトライ機能付き
- エラー分類ログで原因特定が容易

## 使い方

1. **新規作成**: トップページの「＋ 新規作成」ボタンから証跡を記録
2. **写真撮影**: 伝票番号とシリアル番号が同一写真に写るように撮影
3. **情報入力**: 発送日、伝票番号、メモを入力して保存
4. **検索**: トップページで伝票番号や日付で絞り込み
5. **バックアップ**: 設定画面からJSON/CSV形式でエクスポート

## プロジェクト構造

```
shipping-evidence-web/
├── app/                    # Next.js App Router
│   ├── page.tsx           # ホーム画面（一覧・検索）
│   ├── new/               # 新規作成画面
│   ├── detail/[id]/       # 詳細・編集・削除画面
│   └── settings/          # 設定画面（エクスポート）
├── lib/                   # ビジネスロジック
│   ├── db.ts             # Dexie (IndexedDB) セットアップ
│   ├── database.ts       # CRUD操作
│   ├── exportUtils.ts    # エクスポート機能
│   └── types.ts          # TypeScript型定義
└── components/           # 共通コンポーネント
```

## 設計思想

### Local-first アーキテクチャ

- **IndexedDB**に全データを保存（高速・オフライン対応）
- **エクスポート機能**でいつでもバックアップ可能
- 将来的にFirestore同期を追加予定（Phase 2）

### 安全設計

- 伝票番号は必須項目（空では保存不可）
- 画像も必須（証跡として重要）
- OCRは将来追加予定（差し込み口あり）

## デプロイ

Vercelへのデプロイが推奨されます：

```bash
npm run build
```

## ライセンス

MIT

## 開発者

- **GitHub**: pagehost-jp
- **Email**: akyfrh0406@gmail.com
