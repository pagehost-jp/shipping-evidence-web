/**
 * エクスポートユーティリティ（JSON/CSV）
 *
 * 【ルール2: ワンタップでバックアップ】
 * - JSONエクスポート（全データ保存）
 * - CSVエクスポート（表計算ソフトで開ける）
 * - ブラウザでファイルダウンロード
 */

import { ShippingRecord, ExportRecord } from './types';

// ────────────────────────────
// JSONエクスポート
// ────────────────────────────

/**
 * 全レコードをJSON形式でエクスポート
 */
export function exportToJSON(records: ShippingRecord[]): void {
  try {
    console.log('[Export] JSON エクスポート開始:', records.length, '件');

    // Blob除外（imageDataUrlは含める）
    const exportRecords: ExportRecord[] = records.map((record) => ({
      id: record.id,
      createdAt: record.createdAt,
      shipDate: record.shipDate,
      trackingNumber: record.trackingNumber,
      note: record.note,
      imageDataUrl: record.imageDataUrl,
    }));

    const jsonData = {
      exportDate: new Date().toISOString(),
      recordCount: exportRecords.length,
      records: exportRecords,
    };

    const jsonString = JSON.stringify(jsonData, null, 2);

    // ファイル名生成（YYYYMMDD-HHMMSS形式）
    const timestamp = getTimestamp();
    const filename = `shipping-records_${timestamp}.json`;

    // ダウンロード
    downloadFile(jsonString, filename, 'application/json');

    console.log('[Export] JSON エクスポート成功');
  } catch (error) {
    console.error('[Export] JSON エクスポートエラー:', error);
    throw new Error('JSONエクスポートに失敗しました');
  }
}

// ────────────────────────────
// CSVエクスポート
// ────────────────────────────

/**
 * 全レコードをCSV形式でエクスポート
 */
export function exportToCSV(records: ShippingRecord[]): void {
  try {
    console.log('[Export] CSV エクスポート開始:', records.length, '件');

    // CSVヘッダー
    const headers = ['ID', '保存日時', '発送日', '伝票番号', 'メモ'];

    // CSVデータ行
    const rows = records.map((record) => [
      record.id.toString(),
      record.createdAt,
      record.shipDate,
      escapeCSV(record.trackingNumber),
      escapeCSV(record.note || ''),
    ]);

    // CSV文字列生成
    const csvLines = [headers.join(','), ...rows.map((row) => row.join(','))];

    const csvString = csvLines.join('\n');

    // BOM付きUTF-8（Excel対応）
    const bom = '\uFEFF';
    const csvWithBom = bom + csvString;

    // ファイル名生成（YYYYMMDD-HHMMSS形式）
    const timestamp = getTimestamp();
    const filename = `shipping-records_${timestamp}.csv`;

    // ダウンロード
    downloadFile(csvWithBom, filename, 'text/csv');

    console.log('[Export] CSV エクスポート成功');
  } catch (error) {
    console.error('[Export] CSV エクスポートエラー:', error);
    throw new Error('CSVエクスポートに失敗しました');
  }
}

// ────────────────────────────
// ヘルパー関数
// ────────────────────────────

/**
 * タイムスタンプ生成（YYYYMMDD-HHMMSS形式）
 */
function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * CSV用に文字列をエスケープ
 */
function escapeCSV(value: string): string {
  if (!value) return '';

  // ダブルクォートをエスケープ
  const escaped = value.replace(/"/g, '""');

  // カンマ、改行、ダブルクォートを含む場合はダブルクォートで囲む
  if (
    escaped.includes(',') ||
    escaped.includes('\n') ||
    escaped.includes('"')
  ) {
    return `"${escaped}"`;
  }

  return escaped;
}

/**
 * ファイルダウンロード
 */
function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  // クリーンアップ
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
