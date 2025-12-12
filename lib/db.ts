/**
 * Dexie (IndexedDB) セットアップ
 *
 * 【Local-first設計】
 * - ブラウザのIndexedDBに全データを保存
 * - オフラインでも動作
 * - 将来Firestoreと同期可能（差し込み口あり）
 */

import Dexie, { Table } from 'dexie';
import { ShippingRecord } from './types';

// ────────────────────────────
// Dexie Database クラス
// ────────────────────────────

export class ShippingEvidenceDB extends Dexie {
  records!: Table<ShippingRecord, number>;

  constructor() {
    super('ShippingEvidenceDB');

    // データベーススキーマ定義（バージョン1）
    this.version(1).stores({
      records: '++id, createdAt, shipDate, trackingNumber, note',
    });
  }
}

// ────────────────────────────
// シングルトンインスタンス
// ────────────────────────────

export const db = new ShippingEvidenceDB();
