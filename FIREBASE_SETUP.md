# Firebase セットアップ手順

## 1. Firebase プロジェクト作成

https://console.firebase.google.com/

1. 「プロジェクトを追加」
2. プロジェクト名を入力（例: shipping-evidence）
3. Google アナリティクスは不要（スキップ可）

---

## 2. Firebase サービスを有効化

### 2-1. Firestore Database

1. **Firestore Database** を選択
2. 「データベースを作成」
3. **本番環境モード** で開始
4. ロケーション: `asia-northeast1`（東京）
5. 「有効にする」

### 2-2. Firebase Storage

1. **Storage** を選択
2. 「始める」
3. **本番環境モード** で開始
4. ロケーション: `asia-northeast1`（東京）
5. 「完了」

### 2-3. Authentication（匿名認証）

1. **Authentication** を選択
2. 「始める」
3. **Sign-in method** タブ
4. **匿名** を選択
5. 「有効にする」をON
6. 「保存」

---

## 3. Firebase 設定値を取得

1. プロジェクト設定（⚙️アイコン）を開く
2. 「マイアプリ」セクションで `</>`（ウェブ）を選択
3. アプリのニックネーム入力（例: shipping-evidence-web）
4. 「アプリを登録」
5. **firebaseConfig** が表示される
6. この値を `.env.local` にコピー

---

## 4. .env.local を作成

```bash
cp .env.local.example .env.local
```

`.env.local` を編集：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

---

## 5. Firestore ルールをデプロイ

### ⚠️ テスト用ルール（まず動かす）

Firebase Console で：

1. **Firestore Database** → **ルール** タブ
2. 以下をコピペ：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /shippingRecords/{docId} {
      allow read, write: if true;
    }
  }
}
```

3. 「公開」をクリック

---

## 6. Storage ルールをデプロイ

### ⚠️ テスト用ルール（まず動かす）

Firebase Console で：

1. **Storage** → **ルール** タブ
2. 以下をコピペ：

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /evidence/{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

3. 「公開」をクリック

---

## 7. 開発サーバー再起動

```bash
# Ctrl+C でサーバー停止
npm run dev
```

---

## 8. 動作確認（成功判定）

### ✅ 確認項目

1. **New画面で画像を選んで保存**
2. Firebase Console を開く
3. **Storage** → 画像が増えている
4. **Firestore Database** → `shippingRecords` にレコードが増えている
5. `imageUrl` フィールドが入っている

### ✅ 全端末テスト

1. PCで1件保存
2. スマホで同じURLを開く
3. リロードして一覧に表示される → **成功**

---

## 9. 運用ルール（後で締める）

テストが成功したら、以下のルールに切り替えてください：

### Firestore（運用ルール）

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /shippingRecords/{docId} {
      // 読み取り: 全員可能（外注が見る）
      allow read: if true;

      // 書き込み: 認証済みユーザーのみ
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null
        && request.auth.uid == resource.data.createdBy;
    }
  }
}
```

### Storage（運用ルール）

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /evidence/{allPaths=**} {
      // 読み取り: 全員可能（外注が見る）
      allow read: if true;

      // 書き込み: 認証済みユーザーのみ
      allow write: if request.auth != null;
    }
  }
}
```

---

## トラブルシューティング

### エラー: "Firebaseが設定されていません"

→ `.env.local` が正しく設定されているか確認
→ 開発サーバーを再起動

### エラー: "認証に失敗しました"

→ Authentication で匿名認証が有効化されているか確認

### エラー: "画像のアップロードに失敗しました"

→ Storage が有効化されているか確認
→ Storage ルールが正しくデプロイされているか確認

### レコードが表示されない

→ Firestore Database が有効化されているか確認
→ Firestore ルールが正しくデプロイされているか確認
→ ブラウザのConsoleでエラーを確認
