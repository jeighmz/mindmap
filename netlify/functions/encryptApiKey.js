const admin = require('firebase-admin');
const { encrypt } = require('./utils/encryption');

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
    
    // Replace escaped newlines with actual newlines (handle both \\n and \n)
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    // If the key already has proper PEM headers, use it as-is
    if (privateKey.includes('-----BEGIN PRIVATE KEY-----') && privateKey.includes('-----END PRIVATE KEY-----')) {
      // Key already has headers, just ensure proper formatting
      // Extract the key content between headers
      const beginMatch = privateKey.match(/-----BEGIN PRIVATE KEY-----\s*/);
      const endMatch = privateKey.match(/\s*-----END PRIVATE KEY-----/);
      
      if (beginMatch && endMatch) {
        // Get the key content (base64 encoded part)
        const keyContent = privateKey
          .replace(/-----BEGIN PRIVATE KEY-----\s*/, '')
          .replace(/\s*-----END PRIVATE KEY-----/, '')
          .replace(/\s+/g, ''); // Remove all whitespace
        
        if (keyContent && keyContent.length > 0) {
          // Reformat with proper PEM structure (64 chars per line)
          const formattedContent = keyContent.match(/.{1,64}/g)?.join('\n') || keyContent;
          privateKey = `-----BEGIN PRIVATE KEY-----\n${formattedContent}\n-----END PRIVATE KEY-----`;
        }
      }
    } else {
      // Key doesn't have headers, add them
      // Remove any existing whitespace/newlines from the key content
      const keyContent = privateKey.replace(/\s+/g, '');
      
      if (keyContent && keyContent.length > 0) {
        // Format with proper PEM structure (64 chars per line)
        const formattedContent = keyContent.match(/.{1,64}/g)?.join('\n') || keyContent;
        privateKey = `-----BEGIN PRIVATE KEY-----\n${formattedContent}\n-----END PRIVATE KEY-----`;
      } else {
        throw new Error('Private key content is empty after formatting');
      }
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
  // Set CORS headers - must be set for all responses including errors
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    };
  }

  try {
    console.log('Function started');
    
    // Initialize Firebase and get db instance
    initializeFirebase();
    const db = admin.firestore();
    console.log('Firebase initialized');

    // Parse request
    const { userId, apiKey } = JSON.parse(event.body);
    console.log('Request parsed, userId exists:', !!userId);

    if (!userId || !apiKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing userId or apiKey' })
      };
    }

    // Encrypt the API key using the user-specific encryption
    const encrypted = await encrypt(apiKey, userId);
    
    // Store in Firestore
    await db.collection('userSettings').doc(userId).set({
      groqApiKey: encrypted,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ encrypted })
    };

  } catch (error) {
    console.error('Function error:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message,
        type: error.constructor.name
      })
    };
  }
}; 