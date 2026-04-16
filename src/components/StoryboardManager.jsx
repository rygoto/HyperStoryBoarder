import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useStoryboard } from '../hooks/useStoryboard';
import StoryboardViewer from './StoryboardViewer';
import { 
  migrateFromLocalStorage, 
  migrateJSONWithBase64Images, 
  checkMigrationData, 
  clearLocalStorageData 
} from '../services/migration-service';

const StoryboardManager = () => {
  const { user } = useAuth();
  const {
    storyboards,
    currentStoryboard,
    loading,
    saving,
    error,
    lastSaved,
    createStoryboard,
    deleteStoryboard,
    duplicateStoryboard,
    importFromJSON,
    watchStoryboard
  } = useStoryboard();
  
  const [selectedStoryboardId, setSelectedStoryboardId] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newStoryboardName, setNewStoryboardName] = useState('');
  const [importFile, setImportFile] = useState(null);
  
  // 移行機能用のstate
  const [migrationData, setMigrationData] = useState(null);
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [migrating, setMigrating] = useState(false);

  // 移行可能なデータをチェック
  useEffect(() => {
    const checkData = checkMigrationData();
    setMigrationData(checkData);
  }, []);

  // localStorageからの移行
  const handleMigrateFromLocalStorage = async () => {
    if (!user || migrating) return;

    setMigrating(true);
    try {
      const result = await migrateFromLocalStorage(user.uid, createStoryboard);
      
      if (result.success) {
        alert(`移行完了！\n• ${result.pagesCount}ページのデータを移行しました\n• 新しいストーリーボード「${result.message}」が作成されました`);
        
        // 移行したストーリーボードを開く
        setSelectedStoryboardId(result.storyboardId);
        watchStoryboard(result.storyboardId);
        setShowMigrationDialog(false);
        
        // localStorageをクリアするか確認
        if (confirm('移行が完了しました。古いlocalStorageデータを削除しますか？\n（削除しても新しいFirebaseデータは影響を受けません）')) {
          clearLocalStorageData();
          setMigrationData({ hasData: false, type: null, count: 0 });
        }
      } else {
        alert(`移行失敗: ${result.message}`);
      }
    } catch (error) {
      alert(`移行エラー: ${error.message}`);
    } finally {
      setMigrating(false);
    }
  };

  // 新しいストーリーボードを作成
  const handleCreateStoryboard = async () => {
    if (!newStoryboardName.trim()) return;
    
    try {
      const newId = await createStoryboard(newStoryboardName.trim());
      setSelectedStoryboardId(newId);
      watchStoryboard(newId);
      setShowCreateDialog(false);
      setNewStoryboardName('');
    } catch (error) {
      alert(`ストーリーボード作成エラー: ${error.message}`);
    }
  };

  // ストーリーボードを選択
  const handleSelectStoryboard = (storyboardId) => {
    setSelectedStoryboardId(storyboardId);
    watchStoryboard(storyboardId);
  };

  // ストーリーボードを削除
  const handleDeleteStoryboard = async (storyboardId, storyboardName) => {
    if (!confirm(`「${storyboardName}」を削除しますか？この操作は取り消せません。`)) {
      return;
    }
    
    try {
      await deleteStoryboard(storyboardId);
      if (selectedStoryboardId === storyboardId) {
        setSelectedStoryboardId(null);
      }
    } catch (error) {
      alert(`削除エラー: ${error.message}`);
    }
  };

  // ストーリーボードを複製
  const handleDuplicateStoryboard = async (storyboardId, storyboardName) => {
    try {
      const newId = await duplicateStoryboard(storyboardId, `${storyboardName}のコピー`);
      setSelectedStoryboardId(newId);
      watchStoryboard(newId);
    } catch (error) {
      alert(`複製エラー: ${error.message}`);
    }
  };

  // JSONファイルからインポート（Base64画像移行付き）
  const handleImportJSON = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        
        // Base64画像が含まれている場合は移行処理を実行
        let processedData = jsonData;
        const hasBase64Images = jsonData.pages?.some(page => 
          page.images?.some(cutImages => 
            cutImages?.some(imageUrl => imageUrl?.startsWith('data:image/'))
          )
        );

        if (hasBase64Images && user) {
          alert('Base64画像が検出されました。Firebase Storageに移行します...');
          setMigrating(true);
          
          try {
            processedData = await migrateJSONWithBase64Images(jsonData, user.uid);
            alert('Base64画像の移行が完了しました！');
          } catch (error) {
            console.error('Base64移行エラー:', error);
            alert(`Base64移行中にエラーが発生しましたが、インポートを続行します: ${error.message}`);
          } finally {
            setMigrating(false);
          }
        }

        const newId = await importFromJSON(processedData);
        setSelectedStoryboardId(newId);
        watchStoryboard(newId);
        alert('JSONファイルのインポートが完了しました！');
      } catch (error) {
        setMigrating(false);
        alert(`インポートエラー: ${error.message}`);
      }
    };
    reader.readAsText(file);
  };

  // 現在のストーリーボードが選択されている場合はビューアーを表示
  if (selectedStoryboardId && currentStoryboard) {
    return (
      <div>
        {/* ヘッダー */}
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setSelectedStoryboardId(null)}
              style={{
                padding: '6px 12px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ← 一覧に戻る
            </button>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#333' }}>
              {currentStoryboard.name}
            </h2>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            {saving && <span style={{ color: '#007bff' }}>保存中...</span>}
            {lastSaved && !saving && (
              <span style={{ color: '#28a745' }}>
                最終保存: {lastSaved.toLocaleTimeString()}
              </span>
            )}
            {error && <span style={{ color: '#dc3545' }}>エラー: {error}</span>}
          </div>
        </div>

        {/* ストーリーボードビューアー */}
        <StoryboardViewer 
          storyboardId={selectedStoryboardId}
          initialPages={currentStoryboard.pages}
          storyboardName={currentStoryboard.name}
        />
      </div>
    );
  }

  // ストーリーボード一覧画面
  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px' 
      }}>
        <h1 style={{ margin: 0, color: '#333' }}>絵コンテ一覧</h1>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* 移行ボタン（移行可能なデータがある場合のみ表示） */}
          {migrationData?.hasData && (
            <button
              onClick={() => setShowMigrationDialog(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#ffc107',
                color: '#212529',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              🔄 データ移行 ({migrationData.pagesCount}ページ)
            </button>
          )}
          
          {/* JSONインポート */}
          <label style={{
            padding: '8px 16px',
            backgroundColor: '#17a2b8',
            color: 'white',
            borderRadius: '4px',
            cursor: migrating ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            opacity: migrating ? 0.6 : 1
          }}>
            {migrating ? '移行中...' : 'JSONインポート'}
            <input
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              disabled={migrating}
              style={{ display: 'none' }}
            />
          </label>
          
          {/* 新規作成ボタン */}
          <button
            onClick={() => setShowCreateDialog(true)}
            disabled={migrating}
            style={{
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: migrating ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              opacity: migrating ? 0.6 : 1
            }}
          >
            + 新規作成
          </button>
        </div>
      </div>

      {/* 移行ダイアログ */}
      {showMigrationDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            minWidth: '500px'
          }}>
            <h3 style={{ marginTop: 0, color: '#333' }}>既存データの移行</h3>
            
            {migrationData && (
              <div style={{
                backgroundColor: '#e8f4fd',
                padding: '16px',
                borderRadius: '6px',
                marginBottom: '20px',
                fontSize: '14px'
              }}>
                <strong>移行可能なデータが見つかりました：</strong>
                <ul style={{ marginBottom: 0, paddingLeft: '20px' }}>
                  <li>{migrationData.pagesCount}ページの絵コンテデータ</li>
                  {migrationData.base64ImageCount > 0 && (
                    <li>{migrationData.base64ImageCount}個のBase64画像（Firebase Storageに移行されます）</li>
                  )}
                </ul>
              </div>
            )}
            
            <p style={{ color: '#666', lineHeight: '1.6', margin: '0 0 20px 0' }}>
              localStorageに保存されている既存の絵コンテデータをFirebaseに移行します。<br/>
              移行後は複数デバイスでアクセスできるようになります。
            </p>
            
            {migrating && (
              <div style={{
                textAlign: 'center',
                padding: '20px',
                backgroundColor: '#f8f9fa',
                borderRadius: '6px',
                marginBottom: '16px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid #f3f3f3',
                  borderTop: '4px solid #007bff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 12px'
                }}></div>
                <p style={{ margin: 0, color: '#666' }}>
                  データを移行中です...<br/>
                  Base64画像をFirebase Storageにアップロードしています
                </p>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowMigrationDialog(false)}
                disabled={migrating}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: migrating ? 'not-allowed' : 'pointer',
                  opacity: migrating ? 0.6 : 1
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleMigrateFromLocalStorage}
                disabled={migrating}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ffc107',
                  color: '#212529',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: migrating ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  opacity: migrating ? 0.6 : 1
                }}
              >
                {migrating ? '移行中...' : '移行を実行'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新規作成ダイアログ */}
      {showCreateDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            minWidth: '400px'
          }}>
            <h3 style={{ marginTop: 0 }}>新しい絵コンテを作成</h3>
            <input
              type="text"
              value={newStoryboardName}
              onChange={(e) => setNewStoryboardName(e.target.value)}
              placeholder="絵コンテの名前を入力"
              style={{
                width: '100%',
                padding: '8px',
                marginBottom: '16px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateStoryboard()}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewStoryboardName('');
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                キャンセル
              </button>
              <button
                onClick={handleCreateStoryboard}
                disabled={!newStoryboardName.trim()}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: newStoryboardName.trim() ? 'pointer' : 'not-allowed',
                  opacity: newStoryboardName.trim() ? 1 : 0.5
                }}
              >
                作成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ロード中 */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#666' }}>絵コンテ一覧を読み込み中...</p>
        </div>
      )}

      {/* エラー表示 */}
      {error && !loading && (
        <div style={{
          padding: '16px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          エラー: {error}
        </div>
      )}

      {/* ストーリーボード一覧 */}
      {!loading && storyboards.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#666'
        }}>
          <p style={{ fontSize: '18px', marginBottom: '16px' }}>
            まだ絵コンテがありません
          </p>
          <p style={{ marginBottom: '24px' }}>
            「新規作成」ボタンで最初の絵コンテを作成しましょう
          </p>
        </div>
      )}

      {!loading && storyboards.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '16px'
        }}>
          {storyboards.map((storyboard) => (
            <div
              key={storyboard.id}
              style={{
                backgroundColor: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'}
              onMouseLeave={(e) => e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'}
              onClick={() => handleSelectStoryboard(storyboard.id)}
            >
              <h3 style={{ 
                margin: '0 0 8px 0', 
                color: '#333',
                fontSize: '16px',
                fontWeight: '600'
              }}>
                {storyboard.name}
              </h3>
              <p style={{ 
                margin: '0 0 12px 0', 
                color: '#666',
                fontSize: '14px'
              }}>
                ページ数: {storyboard.pages?.length || 0}
              </p>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px',
                color: '#888'
              }}>
                <span>
                  {storyboard.updatedAt 
                    ? `最終更新: ${storyboard.updatedAt.toLocaleDateString()}`
                    : '作成日不明'
                  }
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateStoryboard(storyboard.id, storyboard.name);
                    }}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    複製
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteStoryboard(storyboard.id, storyboard.name);
                    }}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StoryboardManager;