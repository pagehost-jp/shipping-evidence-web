'use client';

/**
 * 設定画面（注意書き＋エクスポート）
 *
 * 【機能】
 * - 使い方の注意書き
 * - JSONエクスポート（ワンタップバックアップ）
 * - CSVエクスポート（表計算ソフト用）
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAllRecords } from '@/lib/firestore';
import { exportToJSON, exportToCSV } from '@/lib/exportUtils';
import { ShippingRecord } from '@/lib/types';
import {
  onAuthStateChange,
  signInWithGoogle,
  signOut,
  getCurrentUserId,
} from '@/lib/firebase';

export default function SettingsPage() {
  const router = useRouter();

  const [recordCount, setRecordCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // ログイン状態監視
  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      if (user) {
        setIsLoggedIn(true);
        setUserEmail(user.email);
      } else {
        setIsLoggedIn(false);
        setUserEmail(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // 初回読み込み
  useEffect(() => {
    if (isLoggedIn) {
      loadRecordCount();
    }
  }, [isLoggedIn]);

  const loadRecordCount = async () => {
    try {
      const records = await getAllRecords();
      setRecordCount(records.length);
    } catch (error) {
      console.error('レコード数取得エラー:', error);
    }
  };

  // JSONエクスポート
  const handleExportJSON = async () => {
    try {
      setIsExporting(true);
      const records = await getAllRecords();

      if (records.length === 0) {
        alert('エクスポートするデータがありません');
        return;
      }

      exportToJSON(records);
      alert(`${records.length}件のデータをJSONでエクスポートしました`);
    } catch (error) {
      console.error('JSONエクスポートエラー:', error);
      alert('エクスポートに失敗しました');
    } finally {
      setIsExporting(false);
    }
  };

  // CSVエクスポート
  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const records = await getAllRecords();

      if (records.length === 0) {
        alert('エクスポートするデータがありません');
        return;
      }

      exportToCSV(records);
      alert(`${records.length}件のデータをCSVでエクスポートしました`);
    } catch (error) {
      console.error('CSVエクスポートエラー:', error);
      alert('エクスポートに失敗しました');
    } finally {
      setIsExporting(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900">設定</h1>
        </div>

        {/* 使い方・注意書き */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            📋 このアプリについて
          </h2>
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              このアプリは、Amazon自己配送の発送証跡を記録するためのツールです。
            </p>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="font-semibold text-yellow-800 mb-2">
                ⚠️ 重要：証跡写真の撮影方法
              </p>
              <ul className="list-disc list-inside space-y-1 text-yellow-800">
                <li>伝票番号とシリアル番号が同一写真に写っていること</li>
                <li>両方の番号が明確に読み取れること</li>
                <li>写真がぼやけていないこと</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ログイン・ログアウト */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            🔐 ログイン
          </h2>
          {isLoggedIn ? (
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                <span className="font-semibold">ログイン中:</span> {userEmail}
              </div>
              <button
                onClick={async () => {
                  await signOut();
                  alert('ログアウトしました');
                }}
                className="w-full py-2 px-4 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700"
              >
                ログアウト
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                アプリを使用するにはGoogleアカウントでログインしてください。
              </p>
              <button
                onClick={async () => {
                  const success = await signInWithGoogle();
                  if (success) {
                    alert('ログインしました');
                  } else {
                    alert('ログインに失敗しました');
                  }
                }}
                className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700"
              >
                Googleでログイン
              </button>
            </div>
          )}
        </div>

        {/* データ情報 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            💾 データ情報
          </h2>
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex justify-between">
              <span>保存件数:</span>
              <span className="font-semibold">{recordCount}件</span>
            </div>
            <div className="flex justify-between">
              <span>保存場所:</span>
              <span className="font-semibold">Firebase Cloud</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ※ データはクラウドに保存され、全端末で同期されます。
            </p>
          </div>
        </div>

        {/* エクスポート（バックアップ） */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            📤 データのバックアップ
          </h2>
          <div className="space-y-3">
            <p className="text-sm text-gray-700 mb-4">
              定期的にバックアップを取ることをおすすめします。
            </p>

            {/* JSON エクスポート */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">
                JSON形式でエクスポート
              </h3>
              <p className="text-xs text-gray-600 mb-3">
                画像データも含む完全なバックアップ（推奨）
              </p>
              <button
                onClick={handleExportJSON}
                disabled={isExporting || recordCount === 0}
                className={`w-full py-2 px-4 rounded-md font-semibold ${
                  isExporting || recordCount === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isExporting ? 'エクスポート中...' : 'JSONでエクスポート'}
              </button>
            </div>

            {/* CSV エクスポート */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">
                CSV形式でエクスポート
              </h3>
              <p className="text-xs text-gray-600 mb-3">
                Excelなどの表計算ソフトで開ける形式（画像は含まれません）
              </p>
              <button
                onClick={handleExportCSV}
                disabled={isExporting || recordCount === 0}
                className={`w-full py-2 px-4 rounded-md font-semibold ${
                  isExporting || recordCount === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isExporting ? 'エクスポート中...' : 'CSVでエクスポート'}
              </button>
            </div>
          </div>
        </div>

        {/* アプリ情報 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            ℹ️ アプリ情報
          </h2>
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex justify-between">
              <span>バージョン:</span>
              <span className="font-semibold">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>動作環境:</span>
              <span className="font-semibold">ブラウザ（PWA対応）</span>
            </div>
          </div>
        </div>

        {/* ホームに戻る */}
        <button
          onClick={() => router.push('/')}
          className="w-full py-3 px-4 bg-gray-200 text-gray-700 font-semibold rounded-md hover:bg-gray-300"
        >
          ホームに戻る
        </button>
      </div>
    </div>
  );
}
