import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const savedConfig = localStorage.getItem('fms_firebase_config');

// Use official Firebase safe-strings to prevent SDK '.replace()' crashes on boot
let config = {
  apiKey: "demo-api-key-12345678901234567890",
  authDomain: "demo-project.firebaseapp.com",
  projectId: "demo-project",
  storageBucket: "demo-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:1234567890abcdef"
};

// Only override the safe-config if the user actually saved a REAL, non-empty API key
if (savedConfig) {
  try {
    const parsed = JSON.parse(savedConfig);
    // Strict check: Ensure the fields are not empty strings before injecting
    if (parsed && parsed.apiKey && parsed.apiKey.trim() !== "" && parsed.projectId.trim() !== "") {
        config = parsed;
    }
  } catch (e) { 
    console.error("Failed to parse Firebase config"); 
  }
}

// Safely initialize the bridge
const app = initializeApp(config);
export const db = getFirestore(app);