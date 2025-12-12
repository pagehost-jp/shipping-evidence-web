/**
 * Firebase Storage機能（画像アップロード）
 *
 * 【設計】
 * - ファイル名は timestamp + uuid（衝突回避）
 * - アップロード進捗を返す
 * - 失敗時はエラーを返す（再試行可能）
 */

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  UploadTask,
} from 'firebase/storage';
import { getFirebaseStorage } from './firebase';

export interface UploadProgress {
  progress: number; // 0-100
  status: 'uploading' | 'success' | 'error';
}

export interface UploadResult {
  success: boolean;
  imageUrl?: string;
  storagePath?: string;
  error?: string;
}

/**
 * 画像をFirebase Storageにアップロード
 */
export async function uploadImageToStorage(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  try {
    // Firebase Storage取得
    const storage = getFirebaseStorage();

    if (!storage) {
      console.warn('[Storage] Firebaseが設定されていません');
      return {
        success: false,
        error: 'Firebase Storage is not configured',
      };
    }

    // ファイル名生成（timestamp + uuid）
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split('.').pop();
    const filename = `${timestamp}_${randomId}.${extension}`;
    const storagePath = `evidence/${filename}`;

    console.log('[Storage] アップロード開始:', storagePath);

    // Storage参照
    const storageRef = ref(storage, storagePath);

    // アップロード開始
    const uploadTask = uploadBytesResumable(storageRef, file);

    // Promise化
    return new Promise((resolve) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // 進捗更新
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`[Storage] 進捗: ${Math.round(progress)}%`);

          if (onProgress) {
            onProgress({
              progress: Math.round(progress),
              status: 'uploading',
            });
          }
        },
        (error) => {
          // エラー
          console.error('[Storage] アップロードエラー:', error);

          if (onProgress) {
            onProgress({
              progress: 0,
              status: 'error',
            });
          }

          resolve({
            success: false,
            error: error.message,
          });
        },
        async () => {
          // 完了
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('[Storage] アップロード成功:', downloadURL);

            if (onProgress) {
              onProgress({
                progress: 100,
                status: 'success',
              });
            }

            resolve({
              success: true,
              imageUrl: downloadURL,
              storagePath,
            });
          } catch (error: any) {
            console.error('[Storage] URL取得エラー:', error);
            resolve({
              success: false,
              error: error.message,
            });
          }
        }
      );
    });
  } catch (error: any) {
    console.error('[Storage] 予期しないエラー:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * 画像削除（将来実装用）
 */
export async function deleteImageFromStorage(
  storagePath: string
): Promise<boolean> {
  try {
    const storage = getFirebaseStorage();
    if (!storage) {
      return false;
    }

    // TODO: 削除実装
    console.log('[Storage] 削除:', storagePath);
    return true;
  } catch (error) {
    console.error('[Storage] 削除エラー:', error);
    return false;
  }
}
