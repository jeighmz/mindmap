const admin = require('firebase-admin');

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
    
    // Remove any quotes from the beginning and end
    privateKey = privateKey.replace(/^["']|["']$/g, '');
    
    // Ensure proper line breaks
    if (!privateKey.includes('\n')) {
      privateKey = privateKey
        .replace(/\\n/g, '\n')
        .replace(/ /g, '\n');
    }

    console.log('Private key format check:');
    console.log('- Starts with BEGIN:', privateKey.trim().startsWith('-----BEGIN PRIVATE KEY-----'));
    console.log('- Ends with END:', privateKey.trim().endsWith('-----END PRIVATE KEY-----'));
    console.log('- Contains newlines:', privateKey.includes('\n'));

    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey.trim()
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
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    console.log('Function started');
    
    // Initialize Firebase and get db instance
    const db = await initializeFirebase();
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

    // Simple encryption for testing (we'll make it more secure later)
    const encrypted = Buffer.from(apiKey).toString('base64');
    
    // Store in Firestore
    await db.collection('userSettings').doc(userId).set({
      groqApiKey: encrypted,
      updatedAt: new Date().toISOString()
    });

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