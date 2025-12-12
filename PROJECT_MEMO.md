# 📦 Shipping Evidence Web - プロジェクトメモ

## プロジェクト概要

**Amazon自己発送 証跡記録Webアプリ（PWA）**

外注さん・納品スタッフが**ブラウザで使える**証跡記録システム。
URL共有するだけで、誰でもすぐに使える。

### 主な目的
- 発送時の証跡を残し、トラブルに備える
- 伝票番号と商品シリアルが同一写真に写っている証拠を保管
- **外注さんにURL共有→すぐ使える**

---

## 📱 技術スタック

### フロントエンド
- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **PWA対応**（オフラインでも動作）

### データ管理
- **Local-first**: IndexedDB (Dexie)
- **Cloud準備**: Firestore（差し込み口あり、後で有効化）
- **画像保存**: IndexedDB（Blob保存）→ 将来Storage差し替え可能

### エクスポート
- JSON/CSV ワンタップダウンロード（必須）

---

## 📂 プロジェクト構造

```
shipping-evidence-web/
├── app/
│   ├── page.tsx              # Home（一覧＋検索）✅
│   ├── new/
│   │   └── page.tsx          # 新規作成（アップロード→入力＋OCR）✅
│   ├── detail/
│   │   └── [id]/
│   │       └── page.tsx      # 詳細（編集・削除）✅
│   ├── settings/
│   │   └── page.tsx          # 設定（注意書き＋エクスポート）✅
│   ├── api/
│   │   └── ocr/
│   │       └── route.ts      # OCR APIルート（サーバーサイド）✅
│   └── layout.tsx
├── lib/
│   ├── db.ts                 # Dexie setup ✅
│   ├── database.ts           # CRUD operations ✅
│   ├── exportUtils.ts        # JSON/CSV export ✅
│   ├── gemini.ts             # Gemini API共通ヘルパー ✅
│   └── types.ts              # TypeScript types ✅
├── components/
│   └── ...                   # 共通コンポーネント（今後追加予定）
├── PROJECT_MEMO.md           # このファイル
└── README.md
```

---

## ✅ 完成した機能

### Phase 1: プロジェクト初期化
- [x] Next.js (App Router) + TypeScript プロジェクト作成
- [x] Dexie (IndexedDB) インストール
- [x] PROJECT_MEMO.md 作成

### Phase 2: コア機能（完了）
- [x] TypeScript 型定義作成
- [x] Dexie (IndexedDB) セットアップ
- [x] データベースサービス作成（CRUD）
- [x] エクスポート機能（JSON/CSV）
- [x] Home画面（一覧＋検索＋日付フィルタ）
- [x] New画面（画像アップロード→入力→保存）
- [x] Detail画面（詳細＋編集＋削除）
- [x] Settings画面（注意書き＋エクスポート）
- [ ] PWA設定（manifest.json + Service Worker）※Phase 3へ

### Phase 3: クラウド同期（未実装）
- [ ] Firestore セットアップ
- [ ] オフラインファースト同期ロジック
- [ ] 匿名認証

---

## 🔧 解決した問題と原因

（開発中に記録）

---

## 🛡️ 設計思想：外部API安全設計

このプロジェクトでは、**「外部APIは必ず壊れる前提」**で設計しています。

### OCRの位置づけ
- **OCRは「候補を出すだけ」** ← 実装済み！✅
- Gemini Vision APIでサーバーサイド実装
- APIキーはブラウザに露出しない（セキュア）
- OCRが無くても必ず保存できる設計
- モデル名・エンドポイントは `lib/gemini.ts` で一元管理
- プライマリ失敗時はフォールバックモデルに自動切り替え
- タイムアウト・リトライ・エラー分類ログ完備

### データの安全性
- **Local-first**: IndexedDBに全データ保存
- **エクスポート必須**: JSON/CSVでいつでも取り出せる
- **Firestore同期**: 「移行完了まで古い保存を消さない」

---

## 📝 次にやること

### ✅ MVP完成（2025-12-12）
- [x] TypeScript 型定義作成
- [x] Dexie (IndexedDB) セットアップ
- [x] データベースサービス作成（CRUD）
- [x] エクスポート機能（JSON/CSV）
- [x] Home画面実装
- [x] New画面実装
- [x] Detail画面実装
- [x] Settings画面実装

### Phase 3: 次の拡張（優先度順）
1. **PWA設定** (manifest.json + Service Worker)
2. **動作確認＋テスト** 実機で動作確認
3. **デプロイ** Vercelへデプロイ
4. **Firestore同期** クラウドバックアップ
5. **OCR機能** Gemini Vision API統合
6. **認証機能** Firebase Auth（匿名認証）

---

## 🚀 使い方

### セットアップ
```bash
cd ~/Desktop/shipping-evidence-web
npm install
```

### 開発サーバー起動
```bash
npm run dev
```

→ http://localhost:3000 で開く

### ビルド（本番用）
```bash
npm run build
npm start
```

---

## 🔮 将来の拡張案

1. **Firestore同期**: 複数デバイス間での同期
2. **OCR機能**: Gemini Vision API 統合
3. **認証機能**: Firebase Auth（匿名認証）
4. **画像最適化**: 自動リサイズ・圧縮
5. **PWA完全対応**: Service Worker + オフライン
6. **インポート機能**: バックアップからの復元

---

## 📌 仮定・前提

1. **ユーザー運用**: 発送前に必ず「伝票＋シリアル番号」を同一写真で撮影
2. **OCRの精度**: 印刷が不鮮明な伝票は読み取れない可能性がある
3. **保存先**: ブラウザのIndexedDB（将来的にFirestore同期）
4. **認証**: MVP版は認証なし（Firestore同期時に追加予定）

---

## 📅 開発ログ

### 2025-12-12（初日）
- プロジェクト初期化完了（Next.js + TypeScript）
- Dexie (IndexedDB) インストール完了
- PROJECT_MEMO.md 作成
- TypeScript 型定義作成（lib/types.ts）
- Dexie (IndexedDB) セットアップ（lib/db.ts）
- データベースサービス作成（lib/database.ts）
- エクスポート機能実装（lib/exportUtils.ts）
- New画面実装（app/new/page.tsx）
- Home画面実装（app/page.tsx）
- Detail画面実装（app/detail/[id]/page.tsx）
- Settings画面実装（app/settings/page.tsx）
- **🎉 MVP完成！**
- OCR自動入力機能実装（サーバーサイドAPI経由）
  - lib/gemini.ts: 外部API壊れる前提の共通ヘルパー
  - app/api/ocr/route.ts: サーバーサイドOCR APIルート
  - Gemini Vision APIで伝票番号自動抽出
  - APIキーはブラウザに露出しない（セキュア）
  - フォールバック・タイムアウト・エラー分類ログ完備

---

## 📧 開発者情報

- **GitHubユーザー名**: pagehost-jp
- **メール**: akyfrh0406@gmail.com
- **保存場所**: ~/Desktop/shipping-evidence-web
