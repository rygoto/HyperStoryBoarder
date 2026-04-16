// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, enableNetwork, disableNetwork } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration object
// ここにFirebase コンソールから取得した設定を入力してください
const firebaseConfig = {
  apiKey: "AIzaSyCcpp3x-n8W-4j6WWnDQabL0uiQ--hN2J8",
  authDomain: "storyboard-bd947.firebaseapp.com",
  projectId: "storyboard-bd947",
  storageBucket: "storyboard-bd947.firebasestorage.app",
  messagingSenderId: "7525645081",
  appId: "1:7525645081:web:c928603364a9f161e2e388",
  measurementId: "G-SVYFRY8FDJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Firestore settings for better performance
export const firestoreSettings = {
  cacheSizeBytes: 40 * 1024 * 1024, // 40MB cache
};

// Enable offline persistence (will be called when user logs in)
export const enableFirestoreOffline = async () => {
  try {
    await enableNetwork(db);
    console.log('Firestore offline persistence enabled');
  } catch (error) {
    console.error('Failed to enable Firestore offline persistence:', error);
  }
};

// Disable offline persistence
export const disableFirestoreOffline = async () => {
  try {
    await disableNetwork(db);
    console.log('Firestore offline persistence disabled');
  } catch (error) {
    console.error('Failed to disable Firestore offline persistence:', error);
  }
};

export default app;