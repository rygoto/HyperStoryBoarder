import { ref as storageRef, getBytes } from 'firebase/storage';
import { storage, auth } from '../config/firebase';

const FIREBASE_STORAGE_HOSTS = [
  'firebasestorage.googleapis.com',
  'firebasestorage.app'
];

const isFirebaseStorageUrl = (url) =>
  FIREBASE_STORAGE_HOSTS.some((host) => url.includes(host));

// Firebase Storage URLからストレージパスを抽出する
const parseStoragePath = (url) => {
  try {
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(/\/v0\/b\/[^/]+\/o\/(.+)/);
    if (!match) return null;
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};

const guessMimeFromUrl = (url) => {
  const lower = url.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.gif')) return 'image/gif';
  if (lower.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
};

const extFromMime = (mime) => {
  switch (mime) {
    case 'image/png': return 'png';
    case 'image/gif': return 'gif';
    case 'image/webp': return 'webp';
    default: return 'jpg';
  }
};

const blobToDataURL = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const toBlobResult = (blob, urlHint = '') => {
  const mime = blob.type || guessMimeFromUrl(urlHint);
  return { blob, mime, ext: extFromMime(mime) };
};

/**
 * 開発環境: Viteプロキシ経由でFirebase Storageから取得（CORS回避）。
 * 認証付きのため Storage Rules も通る。
 */
const fetchViaDevProxy = async (url) => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('画像取得にはログインが必要です');
  }

  const token = await user.getIdToken();
  const parsed = new URL(url);
  const search = parsed.search || '?alt=media';
  const proxyUrl = `/__firebase_storage${parsed.pathname}${search}`;

  const res = await fetch(proxyUrl, {
    headers: { Authorization: `Firebase ${token}` }
  });

  if (!res.ok) {
    throw new Error(`Storage fetch failed: ${res.status}`);
  }

  return toBlobResult(await res.blob(), url);
};

/**
 * 本番環境: Firebase SDK getBytes（バケットCORS設定が必要）。
 */
const fetchViaGetBytes = async (url) => {
  const path = parseStoragePath(url);
  if (!path) {
    throw new Error('Storage path could not be parsed');
  }

  const imageRef = storageRef(storage, path);
  const bytes = await getBytes(imageRef);
  const mime = guessMimeFromUrl(url);
  const blob = new Blob([bytes], { type: mime });
  return { blob, mime, ext: extFromMime(mime) };
};

/**
 * 画像URLをBlobとして取得する。
 * - 開発: Viteプロキシ経由（CORS不要）
 * - 本番: getBytes（Firebase StorageバケットのCORS設定が必要）
 */
export const fetchImageAsBlob = async (url) => {
  if (!url) {
    throw new Error('画像URLが空です');
  }

  if (url.startsWith('data:') || url.startsWith('blob:')) {
    const res = await fetch(url);
    return toBlobResult(await res.blob(), url);
  }

  if (isFirebaseStorageUrl(url)) {
    if (import.meta.env.DEV) {
      return fetchViaDevProxy(url);
    }
    return fetchViaGetBytes(url);
  }

  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status}`);
  }
  return toBlobResult(await res.blob(), url);
};

/** PDF出力など Data URL が必要な場合 */
export const fetchImageAsDataURL = async (url) => {
  const { blob } = await fetchImageAsBlob(url);
  return blobToDataURL(blob);
};
