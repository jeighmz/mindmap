const { encrypt, generateUserKey, db } = require('./utils/encryption');

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
    const { userId, apiKey } = JSON.parse(event.body);

    if (!userId || !apiKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Get or create user's encryption key
    const userKeysRef = db.collection('userEncryptionKeys').doc(userId);
    const userKeysDoc = await userKeysRef.get();
    
    let userKey;
    if (userKeysDoc.exists) {
      userKey = userKeysDoc.data().key;
    } else {
      userKey = generateUserKey();
      await userKeysRef.set({ key: userKey });
    }

    // Encrypt the API key
    const encryptedData = encrypt(apiKey, userKey);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ encrypted: encryptedData })
    };
  } catch (error) {
    console.error('Encryption error:', error);
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