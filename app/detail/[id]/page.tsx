'use client';

/**
 * 詳細画面（表示＋編集＋削除）
 *
 * 【機能】
 * - レコード詳細表示
 * - 画像拡大表示
 * - 編集モード（発送日・伝票番号・メモ）
 * - 削除（確認ダイアログ付き）
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  getRecordById,
  updateRecord,
  deleteRecord,
} from '@/lib/database';
import { ShippingRecord } from '@/lib/types';
import { uploadImageToStorage } from '@/lib/storage';
import { isFirebaseConfigured } from '@/lib/firebase';

export default function DetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [record, setRecord] = useState<ShippingRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // 編集用state
  const [shipDate, setShipDate] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [note, setNote] = useState('');

  // 初回読み込み
  useEffect(() => {
    loadRecord();
  }, [id]);

  const loadRecord = async () => {
    try {
      setIsLoading(true);
      const data = await getRecordById(id);

      if (!data) {
        alert('レコードが見つかりません');
        router.push('/');
        return;
      }

      setRecord(data);
      setShipDate(data.shipDate);
      setTrackingNumber(data.trackingNumber);
      setNote(data.note || '');
    } catch (error) {
      console.error('レコード取得エラー:', error);
      alert('データの読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 編集モード切替
  const handleEditToggle = () => {
    if (isEditing) {
      // キャンセル→元に戻す
      if (record) {
        setShipDate(record.shipDate);
        setTrackingNumber(record.trackingNumber);
        setNote(record.note || '');
      }
    }
    setIsEditing(!isEditing);
  };

  // 更新保存
  const handleSave = async () => {
    if (!shipDate.trim()) {
      alert('発送日を入力してください');
      return;
    }

    if (!trackingNumber.trim()) {
      alert('伝票番号を入力してください');
      return;
    }

    try {
      await updateRecord(id, {
        shipDate: shipDate.trim(),
        trackingNumber: trackingNumber.trim(),
        note: note.trim(),
      });

      alert('更新しました');
      setIsEditing(false);
      await loadRecord();
    } catch (error) {
      console.error('更新エラー:', error);
      alert('更新に失敗しました');
    }
  };

  // 削除
  const handleDelete = async () => {
    const confirmed = window.confirm(
      '本当に削除しますか？\nこの操作は取り消せません。'
    );

    if (!confirmed) return;

    try {
      await deleteRecord(id);
      alert('削除しました');
      router.push('/');
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました');
    }
  };

  // 再アップロード
  const handleRetryUpload = async () => {
    if (!record?.imageBlob) {
      alert('画像データがありません');
      return;
    }

    if (!isFirebaseConfigured()) {
      alert('Firebaseが設定されていません');
      return;
    }

    setIsRetrying(true);

    try {
      console.log('[Detail] 再アップロード開始...');

      // syncStatus: 'uploading' に更新
      await updateRecord(id, {
        syncStatus: 'uploading',
      });

      await loadRecord(); // UI更新

      // Firebase Storageにアップロード
      const result = await uploadImageToStorage(record.imageBlob as unknown as File);

      if (result.success && result.imageUrl) {
        // 成功: syncStatus: 'synced' に更新
        await updateRecord(id, {
          imageUrl: result.imageUrl,
          storagePath: result.storagePath,
          syncStatus: 'synced',
          syncError: undefined,
        });

        console.log('[Detail] 再アップロード成功:', result.imageUrl);
        alert('クラウドに同期しました');
      } else {
        // 失敗: syncStatus: 'failed' に更新
        await updateRecord(id, {
          syncStatus: 'failed',
          syncError: result.error || 'Upload failed',
        });

        console.error('[Detail] 再アップロード失敗:', result.error);
        alert('同期に失敗しました: ' + result.error);
      }

      await loadRecord(); // 最新状態を再読み込み
    } catch (error: any) {
      console.error('[Detail] 再アップロードエラー:', error);
      alert('エラーが発生しました: ' + error.message);
    } finally {
      setIsRetrying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!record) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* ヘッダー */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push('/')}
            className="text-gray-600 hover:text-gray-900"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">詳細表示</h1>
        </div>

        {/* 画像表示 */}
        {(record.imageUrl || record.imageDataUrl) && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            {/* 同期ステータス表示 */}
            {record.syncStatus && (
              <div className="mb-3 flex items-center gap-2">
                {record.syncStatus === 'pending' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                    クラウド未同期
                  </span>
                )}
                {record.syncStatus === 'uploading' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 animate-pulse">
                    同期中...
                  </span>
                )}
                {record.syncStatus === 'synced' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                    クラウド同期済
                  </span>
                )}
                {record.syncStatus === 'failed' && (
                  <>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                      同期失敗
                    </span>
                    {record.imageBlob && (
                      <button
                        onClick={handleRetryUpload}
                        disabled={isRetrying}
                        className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {isRetrying ? '再試行中...' : '再アップロード'}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* 同期待ちの場合も再アップロードボタン表示 */}
            {record.syncStatus === 'pending' && record.imageBlob && (
              <div className="mb-3">
                <button
                  onClick={handleRetryUpload}
                  disabled={isRetrying}
                  className="inline-flex items-center px-3 py-1.5 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isRetrying ? '同期中...' : '今すぐ同期する'}
                </button>
              </div>
            )}

            {/* 画像表示（クラウド優先、ローカルフォールバック） */}
            <img
              src={record.imageUrl || record.imageDataUrl}
              alt="証跡写真"
              className="w-full h-auto rounded"
            />
          </div>
        )}

        {/* 情報表示/編集 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="space-y-4">
            {/* 発送日 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                発送日 <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <input
                  type="date"
                  value={shipDate}
                  onChange={(e) => setShipDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              ) : (
                <div className="text-lg text-gray-900">{record.shipDate}</div>
              )}
            </div>

            {/* 伝票番号 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                伝票番号 <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              ) : (
                <div className="text-lg font-bold text-gray-900">
                  {record.trackingNumber}
                </div>
              )}
            </div>

            {/* メモ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メモ（任意）
              </label>
              {isEditing ? (
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              ) : (
                <div className="text-gray-700">
                  {record.note || '（なし）'}
                </div>
              )}
            </div>

            {/* 保存日時 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                保存日時
              </label>
              <div className="text-sm text-gray-500">
                {formatDateTime(record.createdAt)}
              </div>
            </div>
          </div>
        </div>

        {/* ボタン */}
        <div className="space-y-3">
          {isEditing ? (
            // 編集モード
            <>
              <button
                onClick={handleSave}
                className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700"
              >
                保存する
              </button>
              <button
                onClick={handleEditToggle}
                className="w-full py-3 px-4 bg-gray-200 text-gray-700 font-semibold rounded-md hover:bg-gray-300"
              >
                キャンセル
              </button>
            </>
          ) : (
            // 表示モード
            <>
              <button
                onClick={handleEditToggle}
                className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700"
              >
                編集する
              </button>
              <button
                onClick={handleDelete}
                className="w-full py-3 px-4 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700"
              >
                削除する
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ISO日時をフォーマット
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}
