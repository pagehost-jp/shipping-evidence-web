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

  // 画像選択
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
    } catch (error) {
      console.error('[New] 保存エラー:', error);
      alert('保存に失敗しました');
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

          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />

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
