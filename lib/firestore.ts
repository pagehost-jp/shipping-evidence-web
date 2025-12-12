/**
 * Firestore CRUD操作（Cloud-first）
 *
 * 【設計】
 * - 全データはFirestoreに保存
 * - IndexedDBは使用しない
 * - imageUrlは必須（Storage先行アップロード）
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  Timestamp,
} from 'firebase/firestore';
import { getFirestore } from './firebase';
import { ShippingRecord, NewShippingRecord } from './types';

/**
 * Firestoreインスタンス取得
 */
function getFirestoreInstance() {
  const firestore = getFirestore();
  if (!firestore) {
    throw new Error('Firestore is not configured');
  }
  return firestore;
}

// ────────────────────────────
// CRUD操作
// ────────────────────────────

/**
 * 新規レコードを作成
 */
export async function createRecord(
  record: NewShippingRecord
): Promise<string> {
  try {
    const firestore = getFirestoreInstance();
    const createdAt = new Date().toISOString();

    const docRef = await addDoc(collection(firestore, 'shippingRecords'), {
      createdAt,
      createdBy: record.createdBy,
      shipDate: record.shipDate,
      trackingNumber: record.trackingNumber,
      note: record.note || '',
      imageUrl: record.imageUrl,
      storagePath: record.storagePath,
    });

    console.log('[Firestore] レコード作成成功:', docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error('[Firestore] レコード作成エラー:', error);
    throw error;
  }
}

/**
 * 全レコードを取得（日付降順）
 */
export async function getAllRecords(): Promise<ShippingRecord[]> {
  try {
    const firestore = getFirestoreInstance();
    const q = query(
      collection(firestore, 'shippingRecords'),
      orderBy('shipDate', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const records: ShippingRecord[] = [];

    querySnapshot.forEach((doc) => {
      records.push({
        id: doc.id,
        ...doc.data(),
      } as ShippingRecord);
    });

    console.log(`[Firestore] 全レコード取得: ${records.length}件`);
    return records;
  } catch (error: any) {
    console.error('[Firestore] レコード取得エラー:', error);
    throw error;
  }
}

/**
 * IDでレコードを取得
 */
export async function getRecordById(id: string): Promise<ShippingRecord | null> {
  try {
    const firestore = getFirestoreInstance();
    const docRef = doc(firestore, 'shippingRecords', id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as ShippingRecord;
    } else {
      return null;
    }
  } catch (error: any) {
    console.error('[Firestore] レコード取得エラー:', error);
    throw error;
  }
}

/**
 * レコードを更新
 */
export async function updateRecord(
  id: string,
  updates: Partial<Omit<ShippingRecord, 'id' | 'createdAt' | 'createdBy'>>
): Promise<void> {
  try {
    const firestore = getFirestoreInstance();
    const docRef = doc(firestore, 'shippingRecords', id);

    await updateDoc(docRef, updates);
    console.log('[Firestore] レコード更新成功:', id);
  } catch (error: any) {
    console.error('[Firestore] レコード更新エラー:', error);
    throw error;
  }
}

/**
 * レコードを削除
 */
export async function deleteRecord(id: string): Promise<void> {
  try {
    const firestore = getFirestoreInstance();
    const docRef = doc(firestore, 'shippingRecords', id);

    await deleteDoc(docRef);
    console.log('[Firestore] レコード削除成功:', id);
  } catch (error: any) {
    console.error('[Firestore] レコード削除エラー:', error);
    throw error;
  }
}

/**
 * 検索（伝票番号・日付範囲）
 */
export async function searchRecords(filter: {
  trackingNumber?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<ShippingRecord[]> {
  try {
    const firestore = getFirestoreInstance();
    let q = query(collection(firestore, 'shippingRecords'));

    // 伝票番号検索（部分一致はFirestoreでは難しいので、完全一致）
    if (filter.trackingNumber) {
      q = query(q, where('trackingNumber', '==', filter.trackingNumber));
    }

    // 日付範囲
    if (filter.dateFrom) {
      q = query(q, where('shipDate', '>=', filter.dateFrom));
    }
    if (filter.dateTo) {
      q = query(q, where('shipDate', '<=', filter.dateTo));
    }

    // 日付降順
    q = query(q, orderBy('shipDate', 'desc'));

    const querySnapshot = await getDocs(q);
    const records: ShippingRecord[] = [];

    querySnapshot.forEach((doc) => {
      records.push({
        id: doc.id,
        ...doc.data(),
      } as ShippingRecord);
    });

    console.log(`[Firestore] 検索結果: ${records.length}件`);
    return records;
  } catch (error: any) {
    console.error('[Firestore] 検索エラー:', error);
    throw error;
  }
}
