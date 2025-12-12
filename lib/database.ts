/**
 * データベースサービス（CRUD操作）
 *
 * 【Local-first設計】
 * - IndexedDBに即座に保存（速い！）
 * - 将来Firestoreと同期（バックグラウンド）
 */

import { db } from './db';
import { ShippingRecord, NewShippingRecord, SearchFilter } from './types';

// ────────────────────────────
// CRUD操作
// ────────────────────────────

/**
 * 新規レコードを作成
 */
export async function createRecord(
  record: NewShippingRecord
): Promise<number> {
  try {
    const createdAt = new Date().toISOString();

    const id = await db.records.add({
      id: 0, // auto-increment
      createdAt,
      shipDate: record.shipDate,
      trackingNumber: record.trackingNumber,
      note: record.note || '',
      imageBlob: record.imageBlob,
      imageDataUrl: record.imageDataUrl,
      imageUrl: record.imageUrl,
      storagePath: record.storagePath,
      syncStatus: record.syncStatus || 'pending',
      syncError: record.syncError,
    });

    console.log('[DB] レコード作成成功:', id);
    return id;
  } catch (error: any) {
    console.error('[DB] レコード作成エラー:', error);
    // 元のエラーをそのまま投げる（ConstraintErrorなど）
    throw error;
  }
}

/**
 * 全レコードを取得（日付降順）
 */
export async function getAllRecords(): Promise<ShippingRecord[]> {
  try {
    const records = await db.records
      .orderBy('shipDate')
      .reverse()
      .toArray();

    console.log(`[DB] 全レコード取得: ${records.length}件`);
    return records;
  } catch (error) {
    console.error('[DB] レコード取得エラー:', error);
    throw new Error('レコードの取得に失敗しました');
  }
}

/**
 * IDでレコードを取得
 */
export async function getRecordById(id: number): Promise<ShippingRecord | undefined> {
  try {
    const record = await db.records.get(id);
    return record;
  } catch (error) {
    console.error('[DB] レコード取得エラー:', error);
    throw new Error('レコードの取得に失敗しました');
  }
}

/**
 * レコードを更新
 */
export async function updateRecord(
  id: number,
  updates: Partial<Omit<ShippingRecord, 'id' | 'createdAt'>>
): Promise<void> {
  try {
    await db.records.update(id, updates);
    console.log('[DB] レコード更新成功:', id);
  } catch (error) {
    console.error('[DB] レコード更新エラー:', error);
    throw new Error('レコードの更新に失敗しました');
  }
}

/**
 * レコードを削除
 */
export async function deleteRecord(id: number): Promise<void> {
  try {
    await db.records.delete(id);
    console.log('[DB] レコード削除成功:', id);
  } catch (error) {
    console.error('[DB] レコード削除エラー:', error);
    throw new Error('レコードの削除に失敗しました');
  }
}

// ────────────────────────────
// 検索機能
// ────────────────────────────

/**
 * レコードを検索
 */
export async function searchRecords(
  filter: SearchFilter
): Promise<ShippingRecord[]> {
  try {
    let query = db.records.toCollection();

    // 伝票番号の部分一致検索
    if (filter.trackingNumber) {
      query = db.records.filter((record) =>
        record.trackingNumber.includes(filter.trackingNumber!)
      );
    }

    // 日付範囲フィルタ
    if (filter.dateFrom || filter.dateTo) {
      query = query.filter((record) => {
        const recordDate = record.shipDate;
        if (filter.dateFrom && recordDate < filter.dateFrom) return false;
        if (filter.dateTo && recordDate > filter.dateTo) return false;
        return true;
      });
    }

    const results = await query.reverse().sortBy('shipDate');

    console.log(`[DB] 検索結果: ${results.length}件`, filter);
    return results;
  } catch (error) {
    console.error('[DB] 検索エラー:', error);
    throw new Error('レコードの検索に失敗しました');
  }
}

/**
 * 日付プリセットから検索条件を生成
 */
export function getDateRangeFromPreset(preset: string): {
  dateFrom: string;
  dateTo: string;
} {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  switch (preset) {
    case 'TODAY':
      return { dateFrom: todayStr, dateTo: todayStr };

    case 'THIS_WEEK': {
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      const startStr = startOfWeek.toISOString().split('T')[0];
      return { dateFrom: startStr, dateTo: todayStr };
    }

    case 'THIS_MONTH': {
      const startOfMonth = `${yyyy}-${mm}-01`;
      return { dateFrom: startOfMonth, dateTo: todayStr };
    }

    default:
      return { dateFrom: '', dateTo: '' };
  }
}
