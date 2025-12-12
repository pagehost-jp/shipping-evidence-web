/**
 * Firebase設定（ベタ書き禁止・環境変数から読み込み）
 *
 * 【Local-first + クラウド同期】
 * - まずローカルに保存（必ず成功）
 * - バックグラウンドでFirebaseへ同期
 * - 失敗しても再試行可能
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import {
  getAuth,
  Auth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirestore as getFirestoreSDK, Firestore } from 'firebase/firestore';

// ────────────────────────────
// Firebase設定（環境変数から読み込み）
// ────────────────────────────

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ────────────────────────────
// Firebase初期化（シングルトン）
// ────────────────────────────

let app: FirebaseApp | null = null;
let storage: FirebaseStorage | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;

/**
 * Firebaseが設定されているか確認
 */
export function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket
  );
}

/**
 * Firebase初期化
 */
export function initializeFirebase() {
  if (!isFirebaseConfigured()) {
    console.warn('[Firebase] 環境変数が設定されていません。クラウド同期は無効です。');
    return;
  }

  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    storage = getStorage(app);
    auth = getAuth(app);
    firestore = getFirestoreSDK(app);
    console.log('[Firebase] 初期化成功');
  } else {
    app = getApps()[0];
    storage = getStorage(app);
    auth = getAuth(app);
    firestore = getFirestoreSDK(app);
  }
}

/**
 * Firebase Storage取得
 */
export function getFirebaseStorage(): FirebaseStorage | null {
  if (!storage) {
    initializeFirebase();
  }
  return storage;
}

/**
 * Firebase Auth取得
 */
export function getFirebaseAuth(): Auth | null {
  if (!auth) {
    initializeFirebase();
  }
  return auth;
}

/**
 * Firestore取得
 */
export function getFirestore(): Firestore | null {
  if (!firestore) {
    initializeFirebase();
  }
  return firestore;
}

/**
 * Googleログイン（ポップアップ）
 */
export async function signInWithGoogle(): Promise<boolean> {
  try {
    const authInstance = getFirebaseAuth();
    if (!authInstance) {
      return false;
    }

    // 既にサインイン済みならスキップ
    if (authInstance.currentUser) {
      console.log('[Firebase] 既にログイン済み:', authInstance.currentUser.email);
      return true;
    }

    // Googleログイン
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(authInstance, provider);
    console.log('[Firebase] Googleログイン成功:', result.user.email);
    return true;
  } catch (error: any) {
    console.error('[Firebase] Googleログインエラー:', error);
    return false;
  }
}

/**
 * ログアウト
 */
export async function signOut(): Promise<void> {
  try {
    const authInstance = getFirebaseAuth();
    if (!authInstance) {
      return;
    }
    await authInstance.signOut();
    console.log('[Firebase] ログアウト成功');
  } catch (error) {
    console.error('[Firebase] ログアウトエラー:', error);
  }
}

/**
 * 認証状態の監視
 */
export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  const authInstance = getFirebaseAuth();
  if (!authInstance) {
    return () => {};
  }
  return onAuthStateChanged(authInstance, callback);
}

/**
 * 現在のユーザーUID取得
 */
export function getCurrentUserId(): string | null {
  const authInstance = getFirebaseAuth();
  return authInstance?.currentUser?.uid || null;
}
