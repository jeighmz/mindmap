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
    initializeFirebase();
    const db = admin.firestore();
    console.log('Firebase initialized');

    const { userId, encryptedData } = JSON.parse(event.body);
    console.log('Request parsed, userId exists:', !!userId, 'encryptedData exists:', !!encryptedData);

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing userId' })
      };
    }

    // Get the encrypted API key from userSettings if not provided in request
    let dataToDecrypt = encryptedData;
    
    if (!dataToDecrypt) {
      const settingsRef = db.collection('userSettings').doc(userId);
      const settingsDoc = await settingsRef.get();
      
      if (!settingsDoc.exists || !settingsDoc.data().groqApiKey) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'User settings not found or no API key stored' })
        };
      }
      
      dataToDecrypt = settingsDoc.data().groqApiKey;
    }

    console.log('Data to decrypt format check:', {
      hasColons: dataToDecrypt.includes(':'),
      length: dataToDecrypt.length,
      startsWithBase64: /^[A-Za-z0-9+/=]+$/.test(dataToDecrypt.split(':')[0] || dataToDecrypt)
    });

    // Check if the data is in the encrypted format (iv:encrypted:authTag)
    // or if it's base64 encoded (development mode)
    if (!dataToDecrypt.includes(':')) {
      // This is likely base64 encoded (development mode), try to decode it
      try {
        const decoded = Buffer.from(dataToDecrypt, 'base64').toString('utf8');
        if (decoded.startsWith('gsk_')) {
          console.log('Data is base64 encoded, returning decoded value');
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ decrypted: decoded })
          };
        }
      } catch (e) {
        console.log('Base64 decode failed, treating as encrypted data');
      }
    }

    // Decrypt using the user-specific key
    const decrypted = await decrypt(dataToDecrypt, userId);

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