// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, enableNetwork, disableNetwork } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
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