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
} from '@/lib/firestore';
import { ShippingRecord } from '@/lib/types';

export default function DetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [record, setRecord] = useState<ShippingRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

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
        {record.imageUrls && record.imageUrls.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="space-y-4">
              {record.imageUrls.map((imageUrl, index) => (
                <div key={index}>
                  <div className="text-sm text-gray-600 mb-2">
                    画像 {index + 1} / {record.imageUrls.length}
                  </div>
                  <img
                    src={imageUrl}
                    alt={`証跡写真 ${index + 1}`}
                    className="w-full h-auto rounded border border-gray-300"
                  />
                </div>
              ))}
            </div>
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
