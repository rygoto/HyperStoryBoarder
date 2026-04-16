import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * 画像を圧縮してBase64データURLを生成
 * Firebase無料枠を考慮して積極的に圧縮
 */
export const compressImage = (file, maxWidth = 400, quality = 0.5) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // アスペクト比を保持しながらリサイズ
      const aspectRatio = img.width / img.height;
      let newWidth = maxWidth;
      let newHeight = maxWidth / aspectRatio;

      if (newHeight > maxWidth) {
        newHeight = maxWidth;
        newWidth = maxWidth * aspectRatio;
      }

      canvas.width = newWidth;
      canvas.height = newHeight;

      // 画像を描画
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      // 圧縮されたデータURLを取得
      const compressedDataURL = canvas.toDataURL('image/jpeg', quality);
      
      // Data URLをBlobに変換
      fetch(compressedDataURL)
        .then(res => res.blob())
        .then(blob => {
          console.log(`画像圧縮完了: ${Math.round(file.size / 1024)}KB → ${Math.round(blob.size / 1024)}KB`);
          resolve({ dataURL: compressedDataURL, blob });
        })
        .catch(reject);
    };

    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Firebase Storageに画像をアップロード
 */
export const uploadImage = async (file, userId, frameId = null) => {
  try {
    // ファイルサイズチェック (5MB制限)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('ファイルサイズが大きすぎます（5MB以下にしてください）');
    }

    // 画像形式チェック
    if (!file.type.startsWith('image/')) {
      throw new Error('画像ファイルのみアップロード可能です');
    }

    console.log('画像圧縮を開始...');
    const { blob: compressedBlob } = await compressImage(file);

    // ファイル名を生成（UUIDの代替として現在時刻を使用）
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2);
    const fileName = frameId ? 
      `frame_${frameId}_${timestamp}_${randomId}.jpg` : 
      `image_${timestamp}_${randomId}.jpg`;

    // Storage参照を作成
    const imageRef = ref(storage, `images/${userId}/${fileName}`);

    console.log('Firebase Storageにアップロード中...');
    const snapshot = await uploadBytes(imageRef, compressedBlob, {
      contentType: 'image/jpeg',
      customMetadata: {
        originalName: file.name,
        originalSize: file.size.toString(),
        compressedSize: compressedBlob.size.toString(),
        uploadedAt: new Date().toISOString()
      }
    });

    console.log('ダウンロードURL取得中...');
    const downloadURL = await getDownloadURL(snapshot.ref);

    console.log('画像アップロード完了:', fileName);
    return {
      url: downloadURL,
      path: snapshot.ref.fullPath,
      fileName,
      originalSize: file.size,
      compressedSize: compressedBlob.size
    };

  } catch (error) {
    console.error('画像アップロードエラー:', error);
    throw error;
  }
};

/**
 * Firebase Storageから画像を削除
 */
export const deleteImage = async (imagePath) => {
  try {
    const imageRef = ref(storage, imagePath);
    await deleteObject(imageRef);
    console.log('画像削除完了:', imagePath);
  } catch (error) {
    console.error('画像削除エラー:', error);
    throw error;
  }
};

/**
 * 複数画像の一括アップロード
 */
export const uploadMultipleImages = async (files, userId, onProgress = null) => {
  const results = [];
  const total = files.length;

  for (let i = 0; i < files.length; i++) {
    try {
      const result = await uploadImage(files[i], userId);
      results.push({ success: true, ...result });
      
      if (onProgress) {
        onProgress(i + 1, total, result);
      }
    } catch (error) {
      results.push({ 
        success: false, 
        error: error.message,
        fileName: files[i].name 
      });
      
      if (onProgress) {
        onProgress(i + 1, total, null, error);
      }
    }
  }

  return results;
};

/**
 * Base64データURLの場合の後方互換性サポート
 */
export const isBase64DataURL = (imageUrl) => {
  return imageUrl && imageUrl.startsWith('data:image/');
};

/**
 * Base64画像をFirebase Storageに移行
 */
export const migrateBase64ToStorage = async (base64DataURL, userId, frameId = null) => {
  try {
    // Base64をBlobに変換
    const response = await fetch(base64DataURL);
    const blob = await response.blob();
    
    // Fileオブジェクトとして扱う
    const file = new File([blob], 'migrated_image.jpg', { type: 'image/jpeg' });
    
    // 通常のアップロード処理を使用
    return await uploadImage(file, userId, frameId);
  } catch (error) {
    console.error('Base64画像移行エラー:', error);
    throw error;
  }
};