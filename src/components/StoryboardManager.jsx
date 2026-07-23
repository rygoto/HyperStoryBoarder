import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useStoryboard } from '../hooks/useStoryboard';
import StoryboardViewer from './StoryboardViewer';
import GroupCombinedViewer from './GroupCombinedViewer';
import { 
  migrateFromLocalStorage, 
  migrateJSONWithBase64Images, 
  checkMigrationData, 
  clearLocalStorageData 
} from '../services/migration-service';

const GROUP_OPTIONS = ['A', 'B', 'C', 'D', 'E'];
const ORDER_OPTIONS = [1, 2, 3, 4, 5];

const GroupBadge = ({ group, order }) => {
  if (!group) return null;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '2px',
      backgroundColor: '#4a90d9',
      color: 'white',
      borderRadius: '4px',
      padding: '2px 7px',
      fontSize: '12px',
      fontWeight: '700',
      letterSpacing: '0.5px'
    }}>
      {group}{order ? `-${order}` : ''}
    </span>
  );
};

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
    watchStoryboard,
    updateStoryboardGroup,
    saveStoryboard
  } = useStoryboard();
  
  const [selectedStoryboardId, setSelectedStoryboardId] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newStoryboardName, setNewStoryboardName] = useState('');
  
  // タブ（一覧 / グループ結合ビュー）
  const [activeTab, setActiveTab] = useState('list');

  // グループ設定モーダル
  const [groupEditTarget, setGroupEditTarget] = useState(null); // storyboard オブジェクト
  const [editGroup, setEditGroup] = useState('');
  const [editOrder, setEditOrder] = useState('');
  const [groupSaving, setGroupSaving] = useState(false);

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
        
        setSelectedStoryboardId(result.storyboardId);
        watchStoryboard(result.storyboardId);
        setShowMigrationDialog(false);
        
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

  // ストーリーボードを選択（一覧 or グループビューから）
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

  // グループ設定モーダルを開く
  const handleOpenGroupEdit = (e, storyboard) => {
    e.stopPropagation();
    setGroupEditTarget(storyboard);
    setEditGroup(storyboard.group || '');
    setEditOrder(storyboard.order != null ? String(storyboard.order) : '');
  };

  // グループ設定を保存
  const handleSaveGroup = async () => {
    if (!groupEditTarget) return;
    setGroupSaving(true);
    try {
      await updateStoryboardGroup(
        groupEditTarget.id,
        editGroup || null,
        editOrder ? Number(editOrder) : null
      );
      setGroupEditTarget(null);
    } catch (error) {
      alert(`グループ設定エラー: ${error.message}`);
    } finally {
      setGroupSaving(false);
    }
  };

  // グループ設定をクリア
  const handleClearGroup = async () => {
    if (!groupEditTarget) return;
    if (!confirm('このコンテのグループ設定を解除しますか？')) return;
    setGroupSaving(true);
    try {
      await updateStoryboardGroup(groupEditTarget.id, null, null);
      setGroupEditTarget(null);
    } catch (error) {
      alert(`グループ解除エラー: ${error.message}`);
    } finally {
      setGroupSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // ビューア表示（コンテを開いている時）
  // -----------------------------------------------------------------------
  if (selectedStoryboardId && currentStoryboard) {
    return (
      <div>
        <div style={{
          padding: '8px 16px',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: '34px',
          zIndex: 950
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
            {currentStoryboard.group && (
              <GroupBadge group={currentStoryboard.group} order={currentStoryboard.order} />
            )}
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

        <StoryboardViewer 
          storyboardId={selectedStoryboardId}
          initialPages={currentStoryboard.pages}
          storyboardName={currentStoryboard.name}
          initialDialogueCharsPerSecond={currentStoryboard.dialogueCharsPerSecond ?? 5}
          saveStoryboard={saveStoryboard}
          saving={saving}
          lastSaved={lastSaved}
        />
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // 一覧・グループビュー画面
  // -----------------------------------------------------------------------
  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* ヘッダー行 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '16px' 
      }}>
        <h1 style={{ margin: 0, color: '#333' }}>絵コンテ管理</h1>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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

      {/* タブ */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '20px',
        borderBottom: '2px solid #e0e0e0'
      }}>
        {[
          { key: 'list', label: '絵コンテ一覧', icon: '📄' },
          { key: 'group', label: 'グループ結合ビュー', icon: '🗂️' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 18px',
              border: 'none',
              backgroundColor: activeTab === tab.key ? '#4a90d9' : '#f0f0f0',
              color: activeTab === tab.key ? 'white' : '#555',
              borderRadius: '6px 6px 0 0',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === tab.key ? '600' : '400',
              borderBottom: activeTab === tab.key ? '2px solid #4a90d9' : 'none',
              marginBottom: activeTab === tab.key ? '-2px' : '0',
              transition: 'all 0.15s'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ===== 絵コンテ一覧タブ ===== */}
      {activeTab === 'list' && (
        <>
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
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                  }}
                  onClick={() => handleSelectStoryboard(storyboard.id)}
                >
                  {/* タイトル行 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px', gap: '8px' }}>
                    <h3 style={{ 
                      margin: 0,
                      color: '#333',
                      fontSize: '16px',
                      fontWeight: '600',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {storyboard.name}
                    </h3>
                    {storyboard.group && (
                      <GroupBadge group={storyboard.group} order={storyboard.order} />
                    )}
                  </div>

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
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {/* グループ設定ボタン */}
                      <button
                        onClick={(e) => handleOpenGroupEdit(e, storyboard)}
                        title="グループ・番号を設定"
                        style={{
                          padding: '4px 8px',
                          backgroundColor: storyboard.group ? '#4a90d9' : '#e0e0e0',
                          color: storyboard.group ? 'white' : '#555',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        {storyboard.group ? `${storyboard.group}-${storyboard.order ?? '?'}` : 'グループ設定'}
                      </button>
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
        </>
      )}

      {/* ===== グループ結合ビュータブ ===== */}
      {activeTab === 'group' && (
        <GroupCombinedViewer
          storyboards={storyboards}
          onOpenStoryboard={handleSelectStoryboard}
        />
      )}

      {/* ===== グループ設定モーダル ===== */}
      {groupEditTarget && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
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
            minWidth: '360px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ marginTop: 0, color: '#333', marginBottom: '4px' }}>
              グループ・番号の設定
            </h3>
            <p style={{ color: '#888', fontSize: '13px', marginTop: 0, marginBottom: '20px' }}>
              「{groupEditTarget.name}」
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#444', fontSize: '14px' }}>
                グループ（A〜E）
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['', ...GROUP_OPTIONS].map(g => (
                  <button
                    key={g}
                    onClick={() => setEditGroup(g)}
                    style={{
                      padding: '6px 14px',
                      border: '2px solid',
                      borderColor: editGroup === g ? '#4a90d9' : '#ddd',
                      backgroundColor: editGroup === g ? '#4a90d9' : 'white',
                      color: editGroup === g ? 'white' : '#555',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: editGroup === g ? '700' : '400'
                    }}
                  >
                    {g === '' ? 'なし' : g}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#444', fontSize: '14px' }}>
                番号（1〜5）
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['', ...ORDER_OPTIONS].map(o => (
                  <button
                    key={o}
                    onClick={() => setEditOrder(o === '' ? '' : String(o))}
                    style={{
                      padding: '6px 14px',
                      border: '2px solid',
                      borderColor: editOrder === (o === '' ? '' : String(o)) ? '#4a90d9' : '#ddd',
                      backgroundColor: editOrder === (o === '' ? '' : String(o)) ? '#4a90d9' : 'white',
                      color: editOrder === (o === '' ? '' : String(o)) ? 'white' : '#555',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: editOrder === (o === '' ? '' : String(o)) ? '700' : '400'
                    }}
                  >
                    {o === '' ? 'なし' : o}
                  </button>
                ))}
              </div>
            </div>

            {/* プレビュー */}
            {editGroup && (
              <div style={{
                backgroundColor: '#f0f7ff',
                border: '1px solid #c8dff8',
                borderRadius: '6px',
                padding: '8px 14px',
                marginBottom: '20px',
                fontSize: '13px',
                color: '#444'
              }}>
                設定内容: グループ <strong>{editGroup}</strong>
                {editOrder ? <>、番号 <strong>{editOrder}</strong></> : '（番号なし）'}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
              <button
                onClick={handleClearGroup}
                disabled={groupSaving || (!groupEditTarget.group)}
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#f8d7da',
                  color: '#721c24',
                  border: '1px solid #f5c6cb',
                  borderRadius: '4px',
                  cursor: (groupSaving || !groupEditTarget.group) ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  opacity: (groupSaving || !groupEditTarget.group) ? 0.5 : 1
                }}
              >
                設定を解除
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setGroupEditTarget(null)}
                  disabled={groupSaving}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: groupSaving ? 'not-allowed' : 'pointer',
                    opacity: groupSaving ? 0.6 : 1
                  }}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveGroup}
                  disabled={groupSaving}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: groupSaving ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                    opacity: groupSaving ? 0.6 : 1
                  }}
                >
                  {groupSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 移行ダイアログ ===== */}
      {showMigrationDialog && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
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

      {/* ===== 新規作成ダイアログ ===== */}
      {showCreateDialog && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
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
                fontSize: '14px',
                boxSizing: 'border-box'
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
    </div>
  );
};

export default StoryboardManager;
