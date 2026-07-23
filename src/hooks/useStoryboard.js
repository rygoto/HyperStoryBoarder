import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './useAuth';
import { deserializePages, serializePages } from '../services/storyboard-serialization';

const COLLECTION_NAME = 'storyboards';

export const useStoryboard = () => {
  const { user } = useAuth();
  const [storyboards, setStoryboards] = useState([]);
  const [currentStoryboard, setCurrentStoryboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  
  const unsubscribeRef = useRef(null);

  // ユーザーのストーリーボード一覧を監視
  useEffect(() => {
    if (!user) {
      setStoryboards([]);
      setCurrentStoryboard(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const userStoryboardsRef = collection(db, COLLECTION_NAME, user.uid, 'projects');
    
    const unsubscribe = onSnapshot(
      query(userStoryboardsRef, orderBy('updatedAt', 'desc')),
      (snapshot) => {
        const storyboardList = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            pages: deserializePages(data.pages),
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate()
          };
        });
        
        setStoryboards(storyboardList);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('Storyboards監視エラー:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 特定のストーリーボードを監視
  const watchStoryboard = useCallback((storyboardId) => {
    if (!user || !storyboardId) return;

    // 既存の監視を停止
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    const docRef = doc(db, COLLECTION_NAME, user.uid, 'projects', storyboardId);
    
    unsubscribeRef.current = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setCurrentStoryboard({
            id: snapshot.id,
            ...data,
            pages: deserializePages(data.pages),
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate()
          });
        } else {
          setCurrentStoryboard(null);
        }
        setError(null);
      },
      (error) => {
        console.error('Storyboard監視エラー:', error);
        setError(error.message);
      }
    );
  }, [user]);

  // 新しいストーリーボードを作成
  const createStoryboard = useCallback(async (
    name,
    initialPages = [],
    dialogueCharsPerSecond = 5
  ) => {
    if (!user) throw new Error('ユーザーがログインしていません');

    try {
      setSaving(true);
      const newId = `storyboard_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const docRef = doc(db, COLLECTION_NAME, user.uid, 'projects', newId);
      const rate = parseFloat(dialogueCharsPerSecond);
      
      const storyboardData = {
        name: name || '新しい絵コンテ',
        pages: serializePages(initialPages),
        dialogueCharsPerSecond: !isNaN(rate) && rate > 0 ? rate : 5,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
        version: 1
      };

      await setDoc(docRef, storyboardData);
      
      console.log('新しいストーリーボード作成:', newId);
      setLastSaved(new Date());
      return newId;
      
    } catch (error) {
      console.error('ストーリーボード作成エラー:', error);
      setError(error.message);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [user]);

  // 手動保存は即時実行し、呼び出し元が完了・失敗を判定できるようにする
  const saveStoryboard = useCallback(async (storyboardId, pages, name, dialogueCharsPerSecond) => {
    if (!user) throw new Error('ユーザーがログインしていません');
    if (!storyboardId) throw new Error('保存先のストーリーボードが見つかりません');

    try {
      setSaving(true);
      const docRef = doc(db, COLLECTION_NAME, user.uid, 'projects', storyboardId);

      // 現在のバージョンを取得してインクリメント
      const currentDoc = await getDoc(docRef);
      const currentVersion = currentDoc.exists() ? (currentDoc.data().version || 1) : 1;

      const updateData = {
        pages: serializePages(pages),
        updatedAt: serverTimestamp(),
        version: currentVersion + 1
      };

      // 名前が指定されている場合は追加
      if (name !== undefined) {
        updateData.name = name;
      }

      if (dialogueCharsPerSecond !== undefined) {
        const rate = parseFloat(dialogueCharsPerSecond);
        updateData.dialogueCharsPerSecond = !isNaN(rate) && rate > 0 ? rate : 5;
      }

      await setDoc(docRef, updateData, { merge: true });

      console.log('ストーリーボード保存完了:', storyboardId);
      setLastSaved(new Date());
      setError(null);
    } catch (error) {
      console.error('ストーリーボード保存エラー:', error);
      setError(error.message);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [user]);

  // ストーリーボードを削除
  const deleteStoryboard = useCallback(async (storyboardId) => {
    if (!user) throw new Error('ユーザーがログインしていません');

    try {
      setSaving(true);
      const docRef = doc(db, COLLECTION_NAME, user.uid, 'projects', storyboardId);
      await deleteDoc(docRef);
      
      console.log('ストーリーボード削除完了:', storyboardId);
      
      // 削除されたものが現在のストーリーボードの場合はクリア
      if (currentStoryboard?.id === storyboardId) {
        setCurrentStoryboard(null);
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      }
      
    } catch (error) {
      console.error('ストーリーボード削除エラー:', error);
      setError(error.message);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [user, currentStoryboard]);

  // ストーリーボードのグループ・順番を更新
  const updateStoryboardGroup = useCallback(async (storyboardId, group, order) => {
    if (!user) throw new Error('ユーザーがログインしていません');

    try {
      setSaving(true);
      const docRef = doc(db, COLLECTION_NAME, user.uid, 'projects', storyboardId);
      const currentDoc = await getDoc(docRef);
      const currentVersion = currentDoc.exists() ? (currentDoc.data().version || 1) : 1;

      await setDoc(docRef, {
        group: group ?? null,
        order: order ?? null,
        updatedAt: serverTimestamp(),
        version: currentVersion + 1
      }, { merge: true });

      setLastSaved(new Date());
      setError(null);
    } catch (error) {
      console.error('グループ更新エラー:', error);
      setError(error.message);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [user]);

  // ストーリーボードを複製
  const duplicateStoryboard = useCallback(async (sourceStoryboardId, newName) => {
    if (!user) throw new Error('ユーザーがログインしていません');

    try {
      setSaving(true);
      const sourceRef = doc(db, COLLECTION_NAME, user.uid, 'projects', sourceStoryboardId);
      const sourceDoc = await getDoc(sourceRef);
      
      if (!sourceDoc.exists()) {
        throw new Error('複製元のストーリーボードが見つかりません');
      }

      const sourceData = sourceDoc.data();
      const newId = await createStoryboard(
        newName || `${sourceData.name}のコピー`,
        deserializePages(sourceData.pages),
        sourceData.dialogueCharsPerSecond
      );
      
      console.log('ストーリーボード複製完了:', newId);
      return newId;
      
    } catch (error) {
      console.error('ストーリーボード複製エラー:', error);
      setError(error.message);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [user, createStoryboard]);

  // 既存JSONデータからインポート
  const importFromJSON = useCallback(async (jsonData, storyboardName) => {
    if (!user) throw new Error('ユーザーがログインしていません');

    try {
      setSaving(true);
      
      // JSONデータの形式を検証
      if (!jsonData.pages || !Array.isArray(jsonData.pages)) {
        throw new Error('無効なJSONデータです（pagesが見つかりません）');
      }

      const name = storyboardName || jsonData.name || 'インポートされた絵コンテ';
      const newId = await createStoryboard(
        name,
        jsonData.pages,
        jsonData.dialogueCharsPerSecond
      );
      
      console.log('JSONインポート完了:', newId);
      return newId;
      
    } catch (error) {
      console.error('JSONインポートエラー:', error);
      setError(error.message);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [user, createStoryboard]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return {
    // State
    storyboards,
    currentStoryboard,
    loading,
    saving,
    error,
    lastSaved,
    
    // Actions
    createStoryboard,
    saveStoryboard,
    deleteStoryboard,
    duplicateStoryboard,
    importFromJSON,
    watchStoryboard,
    updateStoryboardGroup,
    
    // Utils
    isConnected: !error
  };
};