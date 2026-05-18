import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  // KEEP YOUR EXISTING KEYS HERE
  apiKey: "AIzaSyBindYoC30G17AhQ9J0o0LLoyfpOGFmj6c",
  authDomain: "fms-ai-dev.firebaseapp.com",
  projectId: "fms-ai-dev",
  storageBucket: "fms-ai-dev.firebasestorage.app",
  messagingSenderId: "202974067813",
  appId: "1:202974067813:web:a1e78a3ceb421353685a8c",
  measurementId: "G-YHDY7PEX2Z"
};

let app;
let db;

// 1. SINGLETON CHECK: Prevents Expo hot-reloads from crashing the live network socket
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  
  // 2. STABLE CACHE: Uses SingleTabManager to prevent local IndexedDB lockouts that force the app offline
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager()
    })
  });
} else {
  // If hot-reloaded, gracefully retrieve the existing active network connection
  app = getApp();
  db = getFirestore(app);
}

export { db };