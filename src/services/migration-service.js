import { migrateBase64ToStorage, isBase64DataURL } from './storage-service';

/**
 * localStorageから既存データを移行
 */
export const migrateFromLocalStorage = async (userId, createStoryboard) => {
  try {
    // localStorageから既存のページデータを取得
    const storedPages = localStorage.getItem('storyboardPages');
    if (!storedPages) {
      return { success: false, message: 'localStorageに保存されたデータが見つかりません' };
    }

    const pages = JSON.parse(storedPages);
    if (!Array.isArray(pages) || pages.length === 0) {
      return { success: false, message: '無効なデータ形式です' };
    }

    console.log('localStorage移行開始:', pages.length, 'ページ');

    // Base64画像をFirebase Storageに移行
    const migratedPages = await migrateBase64Images(pages, userId);
    
    // 新しいストーリーボードを作成
    const storyboardName = 'localStorageからの移行データ';
    const newId = await createStoryboard(storyboardName, migratedPages);

    console.log('localStorage移行完了:', newId);
    return { 
      success: true, 
      message: 'localStorageからの移行が完了しました',
      storyboardId: newId,
      pagesCount: migratedPages.length
    };

  } catch (error) {
    console.error('localStorage移行エラー:', error);
    return { success: false, message: `移行エラー: ${error.message}` };
  }
};

/**
 * JSONファイル内のBase64画像をFirebase Storageに移行
 */
export const migrateJSONWithBase64Images = async (jsonData, userId) => {
  try {
    if (!jsonData.pages || !Array.isArray(jsonData.pages)) {
      throw new Error('無効なJSONデータです');
    }

    console.log('JSON内Base64画像移行開始');
    
    const migratedPages = await migrateBase64Images(jsonData.pages, userId);
    
    return {
      ...jsonData,
      pages: migratedPages
    };

  } catch (error) {
    console.error('JSON移行エラー:', error);
    throw error;
  }
};

/**
 * ページ配列内のBase64画像をFirebase Storageに移行
 */
const migrateBase64Images = async (pages, userId) => {
  const migratedPages = [];
  let totalImages = 0;
  let migratedImages = 0;

  for (const [pageIndex, page] of pages.entries()) {
    const migratedPage = { ...page };

    // 各カットの画像を確認・移行
    for (const [cutIndex, cutImages] of page.images.entries()) {
      const migratedCutImages = [];

      for (const [imageIndex, imageUrl] of cutImages.entries()) {
        totalImages++;
        
        if (isBase64DataURL(imageUrl)) {
          try {
            console.log(`Base64画像移行中: Page ${pageIndex + 1}, Cut ${cutIndex + 1}, Image ${imageIndex + 1}`);
            
            const frameId = `migrated_page${pageIndex}_cut${cutIndex}_img${imageIndex}`;
            const uploadResult = await migrateBase64ToStorage(imageUrl, userId, frameId);
            
            migratedCutImages.push(uploadResult.url);
            migratedImages++;
            console.log(`移行完了: ${uploadResult.fileName}`);
            
          } catch (error) {
            console.error(`画像移行失敗 (Page ${pageIndex + 1}, Cut ${cutIndex + 1}):`, error);
            // 移行に失敗した場合は元のBase64を保持（後方互換性）
            migratedCutImages.push(imageUrl);
          }
        } else {
          // すでにURLの場合はそのまま保持
          migratedCutImages.push(imageUrl);
        }
      }

      migratedPage.images[cutIndex] = migratedCutImages;
    }

    migratedPages.push(migratedPage);
  }

  console.log(`Base64画像移行完了: ${migratedImages}/${totalImages} 画像`);
  return migratedPages;
};

/**
 * 移行可能なデータがあるかチェック
 */
export const checkMigrationData = () => {
  const storedPages = localStorage.getItem('storyboardPages');
  
  if (!storedPages) {
    return { hasData: false, type: null, count: 0 };
  }

  try {
    const pages = JSON.parse(storedPages);
    if (Array.isArray(pages) && pages.length > 0) {
      // Base64画像の数をカウント
      let base64ImageCount = 0;
      
      pages.forEach(page => {
        page.images.forEach(cutImages => {
          cutImages.forEach(imageUrl => {
            if (isBase64DataURL(imageUrl)) {
              base64ImageCount++;
            }
          });
        });
      });

      return {
        hasData: true,
        type: 'localStorage',
        pagesCount: pages.length,
        base64ImageCount
      };
    }
  } catch (error) {
    console.error('移行データチェックエラー:', error);
  }

  return { hasData: false, type: null, count: 0 };
};

/**
 * 移行後のlocalStorageクリーンアップ（任意）
 */
export const clearLocalStorageData = () => {
  try {
    localStorage.removeItem('storyboardPages');
    console.log('localStorageのデータをクリアしました');
    return true;
  } catch (error) {
    console.error('localStorageクリアエラー:', error);
    return false;
  }
};