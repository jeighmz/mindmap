import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Log configuration (without sensitive data)
console.log('🔧 FIREBASE CONFIG: Initializing with:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  storageBucket: firebaseConfig.storageBucket,
  hasApiKey: !!firebaseConfig.apiKey,
  hasAppId: !!firebaseConfig.appId,
  hasMessagingSenderId: !!firebaseConfig.messagingSenderId
});

// Initialize Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log('✅ FIREBASE: App initialized successfully');
} catch (error) {
  console.error('❌ FIREBASE INIT ERROR:', error);
  throw new Error(`Failed to initialize Firebase: ${error.message}`);
}

// Initialize Firebase Authentication and get a reference to the service
let auth, db, storage;

try {
  auth = getAuth(app);
  console.log('✅ FIREBASE AUTH: Initialized successfully');
} catch (error) {
  console.error('❌ FIREBASE AUTH ERROR:', error);
  throw new Error(`Failed to initialize Firebase Auth: ${error.message}`);
}

try {
  db = getFirestore(app);
  console.log('✅ FIRESTORE: Initialized successfully');
} catch (error) {
  console.error('❌ FIRESTORE ERROR:', error);
  throw new Error(`Failed to initialize Firestore: ${error.message}`);
}

try {
  storage = getStorage(app);
  if (!storage) {
    throw new Error('Storage instance is null');
  }
  
  // Validate storage bucket is configured
  const bucket = firebaseConfig.storageBucket || app.options.storageBucket;
  if (!bucket) {
    console.error('❌ FIREBASE STORAGE ERROR: Storage bucket is not configured');
    console.error('Please ensure REACT_APP_FIREBASE_STORAGE_BUCKET is set in your environment variables');
    throw new Error('Storage bucket is not configured. Please set REACT_APP_FIREBASE_STORAGE_BUCKET environment variable.');
  }
  
  console.log('✅ FIREBASE STORAGE: Initialized successfully', {
    bucket: bucket,
    storageInstance: !!storage
  });
} catch (error) {
  console.error('❌ FIREBASE STORAGE ERROR:', error);
  console.error('Storage bucket config:', firebaseConfig.storageBucket);
  console.error('App options:', app?.options);
  throw new Error(`Failed to initialize Firebase Storage: ${error.message}`);
}

// Add initialization logging
console.log('📦 FIREBASE STORAGE: Configuration details:', {
  storageBucket: firebaseConfig.storageBucket,
  isStorageInitialized: !!storage,
  isAuthInitialized: !!auth,
  isFirestoreInitialized: !!db,
  appName: app.name,
  appOptions: {
    projectId: app.options.projectId,
    storageBucket: app.options.storageBucket,
    authDomain: app.options.authDomain
  }
});

// Export the initialized app if needed elsewhere, or export specific services
export { app, auth, db, storage };

// If you need analytics (optional)
// import { getAnalytics } from "firebase/analytics";
// const analytics = getAnalytics(app); 