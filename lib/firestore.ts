/**
 * Firestore CRUD操作（Cloud-first）
 *
 * 【設計】
 * - 全データはFirestoreに保存
 * - IndexedDBは使用しない
 * - imageUrlsは必須（Storage先行アップロード・最大3枚）
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
      imageUrls: record.imageUrls,
      storagePaths: record.storagePaths,
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

    // 日付範囲検索のみFirestoreで実行
    if (filter.dateFrom) {
      q = query(q, where('shipDate', '>=', filter.dateFrom));
    }
    if (filter.dateTo) {
      q = query(q, where('shipDate', '<=', filter.dateTo));
    }

    const querySnapshot = await getDocs(q);
    let records: ShippingRecord[] = [];

    querySnapshot.forEach((doc) => {
      records.push({
        id: doc.id,
        ...doc.data(),
      } as ShippingRecord);
    });

    // 伝票番号検索（クライアント側で部分一致）
    if (filter.trackingNumber) {
      const searchQuery = filter.trackingNumber.replace(/[-\s]/g, ''); // ハイフンとスペース削除
      records = records.filter((record) => {
        const trackingNumber = record.trackingNumber.replace(/[-\s]/g, ''); // ハイフンとスペース削除
        return trackingNumber.includes(searchQuery);
      });
    }

    // クライアント側でソート（発送日降順）
    records.sort((a, b) => {
      const dateA = new Date(a.shipDate).getTime();
      const dateB = new Date(b.shipDate).getTime();
      return dateB - dateA; // 降順
    });

    console.log(`[Firestore] 検索結果: ${records.length}件`);
    return records;
  } catch (error: any) {
    console.error('[Firestore] 検索エラー:', error);
    throw error;
  }
}
