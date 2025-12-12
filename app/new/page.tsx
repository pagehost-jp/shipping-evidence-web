'use client';

/**
 * 新規作成画面（アップロード→入力→保存）
 *
 * 【重要】
 * - trackingNumberが空なら保存ボタン無効
 * - 画像は必須
 * - OCRは差し込み口のみ（後回し）
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createRecord, updateRecord } from '@/lib/database';
import { performLocalOCR } from '@/lib/localOcr';
import { uploadImageToStorage } from '@/lib/storage';
import { isFirebaseConfigured } from '@/lib/firebase';

export default function NewPage() {
  const router = useRouter();

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [shipDate, setShipDate] = useState(getTodayDate());
  const [trackingNumber, setTrackingNumber] = useState('');
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrUsed, setOcrUsed] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  // 画像処理（共通処理）
  const processImageFile = async (file: File) => {
    setImageFile(file);

    // プレビュー表示用
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // ローカルOCR実行（Tesseract.js）
    setIsOcrProcessing(true);
    setOcrUsed(false);
    setOcrProgress('OCR準備中...');

    try {
      const result = await performLocalOCR(file, (progress) => {
        // 進捗表示
        const percentage = Math.round(progress.progress * 100);
        setOcrProgress(`${progress.status}: ${percentage}%`);
      });

      if (result.trackingNumberCandidate) {
        setTrackingNumber(result.trackingNumberCandidate);
        setOcrUsed(true);
        console.log('[New] 伝票番号を自動入力:', result.trackingNumberCandidate);
      } else {
        console.log('[New] 伝票番号が見つかりませんでした');
      }
    } catch (error) {
      console.error('[New] OCRエラー:', error);
      // エラーでも処理は続行（手入力へ）
    } finally {
      setIsOcrProcessing(false);
      setOcrProgress('');
    }
  };

  // 画像選択（ファイル入力）
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 画像ファイルチェック
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください');
      return;
    }

    await processImageFile(file);
  };

  // ドラッグ&ドロップ
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // 画像ファイルチェック
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください');
      return;
    }

    await processImageFile(file);
  };

  // 保存（Local-first + バックグラウンド同期）
  const handleSave = async () => {
    if (!imageFile) {
      alert('画像を選択してください');
      return;
    }

    if (!shipDate.trim()) {
      alert('発送日を入力してください');
      return;
    }

    if (!trackingNumber.trim()) {
      alert('伝票番号を入力してください');
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: まずローカルに保存（必ず成功）
      const imageBlob = imageFile;
      const imageDataUrl = imagePreview;

      console.log('[New] ローカルに保存開始...');

      const recordId = await createRecord({
        shipDate: shipDate.trim(),
        trackingNumber: trackingNumber.trim(),
        note: note.trim(),
        imageBlob,
        imageDataUrl,
        syncStatus: 'pending', // 未同期
      });

      console.log('[New] ローカル保存成功:', recordId);

      // Step 2: バックグラウンドでクラウドへアップロード
      uploadImageInBackground(recordId, imageFile);

      alert('保存しました（クラウドに同期中...）');
      router.push('/');
    } catch (error: any) {
      console.error('[New] 保存エラー:', error);

      // IndexedDB ConstraintError の場合
      if (error.name === 'ConstraintError') {
        const shouldReset = window.confirm(
          'データベースエラーが発生しました。\n' +
          'データベースをリセットして再試行しますか？\n\n' +
          '※ 既存のデータは削除されます'
        );

        if (shouldReset) {
          try {
            // IndexedDBを削除して再起動
            await indexedDB.deleteDatabase('ShippingEvidenceDB');
            alert('データベースをリセットしました。ページをリロードします。');
            window.location.reload();
          } catch (resetError) {
            console.error('[New] リセットエラー:', resetError);
            alert('リセットに失敗しました。手動でリロードしてください。');
          }
        }
      } else {
        alert(`保存に失敗しました: ${error.message || '不明なエラー'}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // バックグラウンドでクラウドへアップロード
  const uploadImageInBackground = async (recordId: number, file: File) => {
    // Firebaseが設定されていない場合はスキップ
    if (!isFirebaseConfigured()) {
      console.log('[New] Firebase未設定のためアップロードスキップ');
      return;
    }

    try {
      console.log('[New] クラウドアップロード開始...');

      // syncStatus: 'uploading' に更新
      await updateRecord(recordId, {
        syncStatus: 'uploading',
      });

      // Firebase Storageにアップロード
      const result = await uploadImageToStorage(file);

      if (result.success && result.imageUrl) {
        // 成功: syncStatus: 'synced' に更新
        await updateRecord(recordId, {
          imageUrl: result.imageUrl,
          storagePath: result.storagePath,
          syncStatus: 'synced',
        });

        console.log('[New] クラウド同期成功:', result.imageUrl);
      } else {
        // 失敗: syncStatus: 'failed' に更新
        await updateRecord(recordId, {
          syncStatus: 'failed',
          syncError: result.error || 'Upload failed',
        });

        console.error('[New] クラウド同期失敗:', result.error);
      }
    } catch (error: any) {
      // エラー: syncStatus: 'failed' に更新
      await updateRecord(recordId, {
        syncStatus: 'failed',
        syncError: error.message || 'Unknown error',
      });

      console.error('[New] クラウド同期エラー:', error);
    }
  };

  const canSave =
    imageFile && shipDate.trim() && trackingNumber.trim() && !isProcessing;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">新規作成</h1>

        {/* 画像アップロード */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            証跡写真 <span className="text-red-500">*</span>
          </label>

          {/* ドラッグ&ドロップエリア */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-gray-50'
            }`}
          >
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageChange}
              className="hidden"
              id="file-input"
            />

            <label
              htmlFor="file-input"
              className="cursor-pointer block"
            >
              <div className="space-y-2">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="text-sm text-gray-600">
                  <span className="font-semibold text-blue-600 hover:text-blue-500">
                    クリックして選択
                  </span>
                  <span className="hidden sm:inline"> または ドラッグ&ドロップ</span>
                </div>
                <p className="text-xs text-gray-500">
                  PNG, JPG, HEIC など
                </p>
              </div>
            </label>
          </div>

          {imagePreview && (
            <div className="mt-4">
              <img
                src={imagePreview}
                alt="プレビュー"
                className="max-w-full h-auto rounded-lg"
              />
            </div>
          )}
        </div>

        {/* 注意書き */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <p className="text-sm text-yellow-800">
            ⚠️ 伝票番号とシリアル番号が同一写真に写っていることを確認してください
          </p>
        </div>

        {/* 入力フォーム */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="space-y-4">
            {/* 発送日 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                発送日 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={shipDate}
                onChange={(e) => setShipDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 伝票番号 */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="text-sm font-medium text-gray-700">
                  伝票番号 <span className="text-red-500">*</span>
                </label>
                {isOcrProcessing && (
                  <span className="text-xs text-blue-600 animate-pulse">
                    {ocrProgress || 'OCR処理中...'}
                  </span>
                )}
                {ocrUsed && !isOcrProcessing && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    OCR候補
                  </span>
                )}
              </div>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => {
                  setTrackingNumber(e.target.value);
                  setOcrUsed(false); // 手動編集したらOCRバッジを消す
                }}
                placeholder="例: 123-456-789"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              {ocrUsed && (
                <p className="text-xs text-gray-500 mt-1">
                  ※ OCRで自動入力されました。内容を確認してください。
                </p>
              )}
            </div>

            {/* メモ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メモ（任意）
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例: レンジ、顧客名など"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* ボタン */}
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`flex-1 py-3 px-4 rounded-md font-semibold text-white ${
              canSave
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {isProcessing ? '保存中...' : '保存する'}
          </button>

          <button
            onClick={() => router.push('/')}
            className="flex-1 py-3 px-4 rounded-md font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}

function getTodayDate(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
