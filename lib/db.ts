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
    // 注: syncStatusはインデックス不要（検索に使わない）
    this.version(2)
      .stores({
        records: '++id, createdAt, shipDate, trackingNumber, note',
      })
      .upgrade((tx) => {
        // 既存データにsyncStatusフィールドを追加
        return tx
          .table('records')
          .toCollection()
          .modify((record) => {
            // syncStatusがない場合はpendingに設定
            if (!record.syncStatus) {
              record.syncStatus = 'pending';
            }
          });
      });

    // バージョン3：エラー修正のための再マイグレーション
    this.version(3).stores({
      records: '++id, createdAt, shipDate, trackingNumber, note',
    });
  }
}

// ────────────────────────────
// シングルトンインスタンス
// ────────────────────────────

export const db = new ShippingEvidenceDB();
