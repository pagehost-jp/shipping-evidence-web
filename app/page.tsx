'use client';

/**
 * ホーム画面（一覧＋検索＋日付フィルタ）
 *
 * 【機能】
 * - 発送記録一覧（日付降順）
 * - 伝票番号検索（部分一致）
 * - 日付フィルタ（今日/今週/今月）
 * - 新規作成ボタン
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAllRecords, searchRecords } from '@/lib/firestore';
import { ShippingRecord } from '@/lib/types';

export default function HomePage() {
  const router = useRouter();

  const [records, setRecords] = useState<ShippingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 検索フィルタ
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState<string>('ALL');

  // 初回読み込み
  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      setIsLoading(true);
      const data = await getAllRecords();
      setRecords(data);
    } catch (error) {
      console.error('レコード取得エラー:', error);
      alert('データの読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 検索実行
  const handleSearch = async () => {
    try {
      setIsLoading(true);

      let filter: any = {};

      // 伝票番号検索（完全一致）
      if (searchQuery.trim()) {
        filter.trackingNumber = searchQuery.trim();
      }

      // 日付フィルタ
      if (datePreset !== 'ALL') {
        const range = getDateRangeFromPreset(datePreset);
        filter.dateFrom = range.dateFrom;
        filter.dateTo = range.dateTo;
      }

      // 検索実行
      if (Object.keys(filter).length > 0) {
        const results = await searchRecords(filter);
        setRecords(results);
      } else {
        // フィルタなし→全件表示
        await loadRecords();
      }
    } catch (error) {
      console.error('検索エラー:', error);
      alert('検索に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 日付範囲取得（ヘルパー関数）
  function getDateRangeFromPreset(preset: string): {
    dateFrom: string;
    dateTo: string;
  } {
    const today = new Date();
    let dateFrom = '';
    let dateTo = formatDate(today);

    switch (preset) {
      case 'TODAY':
        dateFrom = formatDate(today);
        break;
      case 'THIS_WEEK': {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        dateFrom = formatDate(weekStart);
        break;
      }
      case 'THIS_MONTH': {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        dateFrom = formatDate(monthStart);
        break;
      }
    }

    return { dateFrom, dateTo };
  }

  function formatDate(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // リセット
  const handleReset = () => {
    setSearchQuery('');
    setDatePreset('ALL');
    loadRecords();
  };

  // 詳細画面へ遷移
  const handleRecordClick = (id: number) => {
    router.push(`/detail/${id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">発送証跡記録</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 検索フォーム */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="space-y-3">
            {/* 伝票番号検索 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                伝票番号で検索
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="例: 123-456-789"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 日付フィルタ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                期間で絞り込み
              </label>
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">すべて</option>
                <option value="TODAY">今日</option>
                <option value="THIS_WEEK">今週</option>
                <option value="THIS_MONTH">今月</option>
              </select>
            </div>

            {/* 検索ボタン */}
            <div className="flex gap-2">
              <button
                onClick={handleSearch}
                className="flex-1 py-2 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700"
              >
                検索
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 font-semibold rounded-md hover:bg-gray-300"
              >
                リセット
              </button>
            </div>
          </div>
        </div>

        {/* 新規作成ボタン */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/new')}
            className="w-full py-3 px-4 bg-green-600 text-white font-bold rounded-md hover:bg-green-700"
          >
            ＋ 新規作成
          </button>
        </div>

        {/* レコード一覧 */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">読み込み中...</div>
          ) : records.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
              レコードがありません
            </div>
          ) : (
            records.map((record) => (
              <div
                key={record.id}
                onClick={() => handleRecordClick(record.id)}
                className="bg-white rounded-lg shadow p-4 cursor-pointer hover:bg-gray-50 transition"
              >
                <div className="flex items-start gap-4">
                  {/* サムネイル */}
                  {record.imageUrl && (
                    <div className="flex-shrink-0">
                      <img
                        src={record.imageUrl}
                        alt="証跡写真"
                        className="w-20 h-20 object-cover rounded"
                      />
                    </div>
                  )}

                  {/* 情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-bold text-gray-900">
                        {record.trackingNumber}
                      </span>
                    </div>

                    <div className="text-sm text-gray-600 space-y-1">
                      <div>発送日: {record.shipDate}</div>
                      {record.note && (
                        <div className="text-gray-500">
                          メモ: {record.note}
                        </div>
                      )}
                      <div className="text-xs text-gray-400">
                        保存日時: {formatDateTime(record.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* 矢印アイコン */}
                  <div className="flex-shrink-0 text-gray-400">
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
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 設定ボタン */}
        <div className="mt-6">
          <button
            onClick={() => router.push('/settings')}
            className="w-full py-2 px-4 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700"
          >
            設定
          </button>
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
