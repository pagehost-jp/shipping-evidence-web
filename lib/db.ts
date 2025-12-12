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

    // バージョン2：クラウド同期フィールド追加
    this.version(2).stores({
      records: '++id, createdAt, shipDate, trackingNumber, note, syncStatus',
    });
  }
}

// ────────────────────────────
// シングルトンインスタンス
// ────────────────────────────

export const db = new ShippingEvidenceDB();
