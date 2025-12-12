/**
 * TypeScript 型定義
 */

// ────────────────────────────
// データベースレコード型
// ────────────────────────────

/**
 * 同期ステータス型
 */
export type SyncStatus = 'pending' | 'uploading' | 'synced' | 'failed';

/**
 * 発送記録レコード
 */
export interface ShippingRecord {
  id: number;                  // 自動採番ID
  createdAt: string;          // 保存日時（ISO 8601形式）
  shipDate: string;           // 発送日（YYYY-MM-DD形式）
  trackingNumber: string;     // 伝票番号（必須）
  note?: string;              // 任意メモ
  imageBlob?: Blob;           // 画像Blob（IndexedDB保存用・Local-first）
  imageDataUrl?: string;      // 画像Data URL（表示用・フォールバック）
  imageUrl?: string;          // 画像URL（Firebase Storage・クラウド同期後）
  storagePath?: string;       // Storage保存パス（削除時に使用）
  syncStatus?: SyncStatus;    // 同期ステータス（pending/uploading/synced/failed）
  syncError?: string;         // 同期エラーメッセージ
}

/**
 * 新規レコード作成用（IDなし）
 */
export interface NewShippingRecord {
  shipDate: string;
  trackingNumber: string;
  note?: string;
  imageBlob?: Blob;
  imageDataUrl?: string;
  imageUrl?: string;
  storagePath?: string;
  syncStatus?: SyncStatus;
  syncError?: string;
}

// ────────────────────────────
// OCR結果型
// ────────────────────────────

/**
 * OCR抽出結果
 */
export interface OCRResult {
  trackingNumber: string;     // 伝票番号
  date: string;              // 日付（YYYY-MM-DD形式）
}

// ────────────────────────────
// 検索フィルター型
// ────────────────────────────

/**
 * 検索条件
 */
export interface SearchFilter {
  trackingNumber?: string;    // 伝票番号の部分一致検索
  dateFrom?: string;         // 日付範囲（開始日）
  dateTo?: string;           // 日付範囲（終了日）
}

/**
 * 日付フィルタープリセット
 */
export enum DateFilterPreset {
  TODAY = 'TODAY',           // 今日
  THIS_WEEK = 'THIS_WEEK',   // 今週
  THIS_MONTH = 'THIS_MONTH', // 今月
  CUSTOM = 'CUSTOM',         // カスタム範囲
}

// ────────────────────────────
// エクスポート型
// ────────────────────────────

/**
 * エクスポート用レコード（Blob除外）
 */
export interface ExportRecord {
  id: number;
  createdAt: string;
  shipDate: string;
  trackingNumber: string;
  note?: string;
  imageDataUrl?: string;
  imageUrl?: string; // クラウド画像URL
  syncStatus?: SyncStatus;
}
