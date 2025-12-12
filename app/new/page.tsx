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
import { createRecord } from '@/lib/firestore';
import { performLocalOCR } from '@/lib/localOcr';
import { uploadImageToStorage } from '@/lib/storage';
import {
  isFirebaseConfigured,
  getCurrentUserId,
} from '@/lib/firebase';

const MAX_IMAGES = 3;

export default function NewPage() {
  const router = useRouter();

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [shipDate, setShipDate] = useState(getTodayDate());
  const [trackingNumber, setTrackingNumber] = useState('');
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrUsed, setOcrUsed] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  // 画像処理（共通処理）
  const processImageFile = async (file: File) => {
    // 最大3枚チェック
    if (imageFiles.length >= MAX_IMAGES) {
      alert(`画像は最大${MAX_IMAGES}枚までです`);
      return;
    }

    // 画像ファイル配列に追加
    setImageFiles(prev => [...prev, file]);

    // プレビュー表示用
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreviews(prev => [...prev, reader.result as string]);
    };
    reader.readAsDataURL(file);

    // ローカルOCR実行（1枚目のみ）
    if (imageFiles.length === 0 && !trackingNumber.trim()) {
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
    }
  };

  // 画像削除
  const handleRemoveImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
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

  // 保存（Cloud-first）
  const handleSave = async () => {
    if (imageFiles.length === 0) {
      alert('画像を最低1枚選択してください');
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

    // Firebase設定チェック
    if (!isFirebaseConfigured()) {
      alert(
        'Firebaseが設定されていません。\n' +
        '.env.localファイルでFirebase環境変数を設定してください。'
      );
      return;
    }

    setIsProcessing(true);

    try {
      // ユーザーID取得（既にログイン済み）
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error('ログインしていません。ホーム画面に戻ってログインしてください。');
      }

      console.log('[New] ユーザーID:', userId);

      // Step 1: 全画像をStorageにアップロード
      console.log(`[New] ${imageFiles.length}枚の画像アップロード開始...`);
      const uploadedUrls: string[] = [];
      const uploadedPaths: string[] = [];

      for (let i = 0; i < imageFiles.length; i++) {
        console.log(`[New] 画像 ${i + 1}/${imageFiles.length} アップロード中...`);
        const uploadResult = await uploadImageToStorage(imageFiles[i]);

        if (!uploadResult.success || !uploadResult.imageUrl) {
          throw new Error(uploadResult.error || `画像${i + 1}のアップロードに失敗しました`);
        }

        uploadedUrls.push(uploadResult.imageUrl);
        uploadedPaths.push(uploadResult.storagePath!);
        console.log(`[New] 画像 ${i + 1} アップロード成功:`, uploadResult.imageUrl);
      }

      // Step 2: Firestoreに保存
      console.log('[New] Firestoreに保存開始...');
      const recordId = await createRecord({
        shipDate: shipDate.trim(),
        trackingNumber: trackingNumber.trim(),
        note: note.trim(),
        imageUrls: uploadedUrls,
        storagePaths: uploadedPaths,
        createdBy: userId,
      });

      console.log('[New] Firestore保存成功:', recordId);

      alert('保存しました');
      router.push('/');
    } catch (error: any) {
      console.error('[New] 保存エラー:', error);
      alert(`保存に失敗しました: ${error.message || '不明なエラー'}\n\n再試行してください。`);
    } finally {
      setIsProcessing(false);
    }
  };

  const canSave =
    imageFiles.length > 0 && shipDate.trim() && trackingNumber.trim() && !isProcessing;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">新規作成</h1>

        {/* 画像アップロード */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            証跡写真（最大{MAX_IMAGES}枚） <span className="text-red-500">*</span>
            <span className="ml-2 text-xs text-gray-500">
              {imageFiles.length} / {MAX_IMAGES}
            </span>
          </label>

          {/* ドラッグ&ドロップエリア */}
          {imageFiles.length < MAX_IMAGES && (
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
          )}

          {imageFiles.length >= MAX_IMAGES && (
            <div className="border-2 border-gray-300 rounded-lg p-6 text-center bg-gray-100">
              <p className="text-sm text-gray-600">
                最大{MAX_IMAGES}枚まで登録できます
              </p>
            </div>
          )}

          {/* 画像プレビュー（複数対応） */}
          {imagePreviews.length > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {imagePreviews.map((preview, index) => (
                <div key={index} className="relative">
                  <img
                    src={preview}
                    alt={`プレビュー ${index + 1}`}
                    onClick={() => setSelectedImageIndex(index)}
                    className="w-full h-auto rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage(index);
                    }}
                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-2 hover:bg-red-700 z-10"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                    {index + 1} / {imagePreviews.length}
                  </div>
                </div>
              ))}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
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

      {/* 画像拡大モーダル */}
      {selectedImageIndex !== null && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImageIndex(null)}
        >
          <div className="relative max-w-full max-h-full">
            <img
              src={imagePreviews[selectedImageIndex]}
              alt={`拡大表示 ${selectedImageIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setSelectedImageIndex(null)}
              className="absolute top-4 right-4 bg-white text-gray-900 rounded-full p-3 hover:bg-gray-200 shadow-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg">
              {selectedImageIndex + 1} / {imagePreviews.length}
            </div>
          </div>
        </div>
      )}
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
