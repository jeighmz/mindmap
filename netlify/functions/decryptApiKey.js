const admin = require('firebase-admin');
const { decrypt } = require('./utils/encryption');

// Initialize Firebase Admin with explicit error handling
const initializeFirebase = () => {
  if (admin.apps.length) return admin.firestore();

  try {
    // Log environment variables (safely)
    console.log('Checking environment variables...');
    console.log('Project ID:', process.env.FIREBASE_PROJECT_ID);
    console.log('Client Email exists:', !!process.env.FIREBASE_CLIENT_EMAIL);
    console.log('Private Key exists:', !!process.env.FIREBASE_PRIVATE_KEY);

    if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PROJECT_ID) {
      throw new Error('Missing Firebase credentials');
    }

    // Handle private key formatting
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    // Remove any surrounding quotes and spaces
    privateKey = privateKey.trim().replace(/^["']|["']$/g, '');
    
    // Replace escaped newlines with actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    // Ensure the key has the proper PEM format
    if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
      privateKey = '-----BEGIN PRIVATE KEY-----\n' + privateKey;
    }
    if (!privateKey.endsWith('-----END PRIVATE KEY-----')) {
      privateKey = privateKey + '\n-----END PRIVATE KEY-----';
    }

    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log('Firebase initialized successfully');
    return admin.firestore();
  } catch (error) {
    console.error('Firebase initialization error:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    throw error;
  }
};

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('Function started');
    
    // Initialize Firebase and get db instance
    const db = await initializeFirebase();
    console.log('Firebase initialized');

    const { userId, encryptedData } = JSON.parse(event.body);
    console.log('Request parsed, userId exists:', !!userId);

    if (!userId || !encryptedData) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Get the encrypted API key from userSettings
    const settingsRef = db.collection('userSettings').doc(userId);
    const settingsDoc = await settingsRef.get();
    
    if (!settingsDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User settings not found' })
      };
    }

    // Decrypt using the user-specific key
    const decrypted = await decrypt(settingsDoc.data().groqApiKey, userId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ decrypted })
    };
  } catch (error) {
    console.error('Decryption error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      })
    };
  }
}; 