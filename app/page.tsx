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
import { getAllRecords, searchRecords, deleteRecord } from '@/lib/firestore';
import { deleteImageFromStorage } from '@/lib/storage';
import { ShippingRecord } from '@/lib/types';
import {
  isFirebaseConfigured,
  signInWithGoogle,
  onAuthStateChange,
  getCurrentUserId,
} from '@/lib/firebase';

export default function HomePage() {
  const router = useRouter();

  const [records, setRecords] = useState<ShippingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 検索フィルタ
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState<string>('ALL');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');

  // 選択削除
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ログイン状態監視（自動ログインなし）
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setIsAuthChecking(false);
      return;
    }

    // ログイン状態を監視
    const unsubscribe = onAuthStateChange((user) => {
      setIsAuthChecking(false);
      if (user) {
        console.log('[Home] ログイン済み:', user.email);
        setIsLoggedIn(true);
        loadRecords();
      } else {
        console.log('[Home] 未ログイン');
        setIsLoggedIn(false);
      }
    });

    return () => unsubscribe();
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
      if (datePreset === 'CUSTOM') {
        // カスタム日付範囲
        if (customDateFrom) filter.dateFrom = customDateFrom;
        if (customDateTo) filter.dateTo = customDateTo;
      } else if (datePreset !== 'ALL') {
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
    setCustomDateFrom('');
    setCustomDateTo('');
    loadRecords();
  };

  // 選択モード切り替え
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set());
  };

  // 選択切り替え
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // 全選択
  const selectAll = () => {
    setSelectedIds(new Set(records.map((r) => r.id)));
  };

  // 全解除
  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // 選択削除
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      alert('削除するレコードを選択してください');
      return;
    }

    if (!confirm(`${selectedIds.size}件のレコードを削除しますか？`)) {
      return;
    }

    try {
      setIsLoading(true);

      // 画像とレコードを削除
      for (const id of selectedIds) {
        const record = records.find((r) => r.id === id);
        if (record) {
          // 画像削除
          for (const path of record.storagePaths || []) {
            try {
              await deleteImageFromStorage(path);
            } catch (error) {
              console.error('画像削除エラー:', error);
            }
          }
          // レコード削除
          await deleteRecord(id);
        }
      }

      alert(`${selectedIds.size}件のレコードを削除しました`);
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      await loadRecords();
    } catch (error) {
      console.error('一括削除エラー:', error);
      alert('削除に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 詳細画面へ遷移
  const handleRecordClick = (id: string) => {
    if (isSelectionMode) {
      toggleSelection(id);
    } else {
      router.push(`/detail/${id}`);
    }
  };

  // ログイン確認中
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold text-gray-700 mb-2">
            認証確認中...
          </div>
          <div className="text-sm text-gray-500">
            Googleログインを準備しています
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">📦 発送管理</h1>
            {/* ログイン状態アイコン */}
            <div className="flex items-center gap-2">
              {isLoggedIn ? (
                <div className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1.5 rounded-full">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-semibold">ログイン済み</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-gray-200 text-gray-600 px-3 py-1.5 rounded-full">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-semibold">未ログイン</span>
                </div>
              )}
            </div>
          </div>
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
                <option value="CUSTOM">カレンダーで選択</option>
              </select>
            </div>

            {/* カスタム日付範囲 */}
            {datePreset === 'CUSTOM' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始日
                  </label>
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    終了日
                  </label>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* 検索ボタン */}
            <div className="flex gap-2">
              <button
                onClick={handleSearch}
                disabled={!isLoggedIn}
                className={`flex-1 py-2 px-4 font-semibold rounded-md ${
                  isLoggedIn
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                検索
              </button>
              <button
                onClick={handleReset}
                disabled={!isLoggedIn}
                className={`flex-1 py-2 px-4 font-semibold rounded-md ${
                  isLoggedIn
                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                リセット
              </button>
            </div>
          </div>
        </div>

        {/* 新規作成 + 選択削除ボタン */}
        <div className="mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => isLoggedIn && router.push('/new')}
              disabled={!isLoggedIn}
              className={`flex-[8] py-3 px-4 font-bold rounded-md ${
                isLoggedIn
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isLoggedIn ? '＋ 新規作成' : '🔒 ログインが必要です'}
            </button>
            {isLoggedIn && !isSelectionMode && (
              <button
                onClick={toggleSelectionMode}
                className="flex-[2] py-3 px-2 bg-orange-600 text-white font-semibold rounded-md hover:bg-orange-700 text-sm"
              >
                選択
              </button>
            )}
          </div>
        </div>

        {/* 選択削除操作ボタン */}
        {isLoggedIn && isSelectionMode && (
          <div className="mb-6">
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700"
                >
                  全選択 ({records.length}件)
                </button>
                <button
                  onClick={deselectAll}
                  className="flex-1 py-2 px-4 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700"
                >
                  全解除
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkDelete}
                  disabled={selectedIds.size === 0}
                  className={`flex-1 py-2 px-4 font-semibold rounded-md ${
                    selectedIds.size > 0
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  削除 ({selectedIds.size}件)
                </button>
                <button
                  onClick={toggleSelectionMode}
                  className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 font-semibold rounded-md hover:bg-gray-300"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

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
                className={`bg-white rounded-lg shadow p-4 cursor-pointer transition ${
                  isSelectionMode && selectedIds.has(record.id)
                    ? 'ring-2 ring-blue-500 bg-blue-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* チェックボックス（選択モード時） */}
                  {isSelectionMode && (
                    <div className="flex-shrink-0 pt-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(record.id)}
                        onChange={() => toggleSelection(record.id)}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}

                  {/* サムネイル */}
                  {record.imageUrls && record.imageUrls.length > 0 && (
                    <div className="flex-shrink-0 relative">
                      <img
                        src={record.imageUrls[0]}
                        alt="証跡写真"
                        className="w-20 h-20 object-cover rounded"
                      />
                      {record.imageUrls.length > 1 && (
                        <div className="absolute bottom-0 right-0 bg-black bg-opacity-70 text-white text-xs px-1.5 py-0.5 rounded-tl">
                          +{record.imageUrls.length - 1}
                        </div>
                      )}
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

                  {/* 矢印アイコン（通常モード時） */}
                  {!isSelectionMode && (
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
                  )}
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
