import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyCjF9l1yGQoQsqAR8Jw0Sn7tzkCfSl1gcA",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "mindmap-87b6f.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "mindmap-87b6f",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "mindmap-87b6f.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "839727913932",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:839727913932:web:0420e93a6bc78b550d5b69",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-DLP1JKC2DE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Export the initialized app if needed elsewhere, or export specific services
export { app, auth, db, storage };

// If you need analytics (optional)
// import { getAnalytics } from "firebase/analytics";
// const analytics = getAnalytics(app); 