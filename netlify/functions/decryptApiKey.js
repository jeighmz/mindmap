const { decrypt, db } = require('./utils/encryption');

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
    const { userId, encryptedData } = JSON.parse(event.body);

    if (!userId || !encryptedData) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Get user's encryption key
    const userKeysRef = db.collection('userEncryptionKeys').doc(userId);
    const userKeysDoc = await userKeysRef.get();
    
    if (!userKeysDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User encryption key not found' })
      };
    }

    const userKey = userKeysDoc.data().key;
    
    // Decrypt the API key
    const decryptedData = decrypt(encryptedData, userKey);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ decrypted: decryptedData })
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