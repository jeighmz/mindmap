const { encrypt, generateUserKey } = require('./utils/encryption');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { userId, apiKey } = JSON.parse(event.body);

    if (!userId || !apiKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Get or create user's encryption key
    const userKeysRef = doc(db, 'userEncryptionKeys', userId);
    const userKeysDoc = await getDoc(userKeysRef);
    
    let userKey;
    if (userKeysDoc.exists()) {
      userKey = userKeysDoc.data().key;
    } else {
      userKey = generateUserKey();
      await setDoc(userKeysRef, { key: userKey });
    }

    // Encrypt the API key
    const encryptedData = encrypt(apiKey, userKey);

    return {
      statusCode: 200,
      body: JSON.stringify({ encrypted: encryptedData })
    };
  } catch (error) {
    console.error('Encryption error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 