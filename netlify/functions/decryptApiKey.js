const admin = require('firebase-admin');
const { decrypt } = require('./utils/encryption');
const { initFirebase } = require('./utils/firebase');
const {
  getCorsHeaders,
  handlePreflight,
  requireAuth,
  authErrorResponse,
  safeErrorBody,
} = require('./utils/auth');

exports.handler = async (event, context) => {
  const origin = event.headers.origin || event.headers.Origin;
  const headers = getCorsHeaders(origin);

  const preflight = handlePreflight(event);
  if (preflight) return preflight;

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    initFirebase();
    const db = admin.firestore();

    const { userId, encryptedData } = JSON.parse(event.body);

    const authResult = await requireAuth(event, userId);
    if (authResult.error) {
      return authErrorResponse(authResult, headers);
    }

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing userId' })
      };
    }

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

    if (!dataToDecrypt.includes(':')) {
      try {
        const decoded = Buffer.from(dataToDecrypt, 'base64').toString('utf8');
        if (decoded.startsWith('gsk_')) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ decrypted: decoded })
          };
        }
      } catch (e) {
        // Fall through to AES decrypt
      }
    }

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
      body: safeErrorBody(error.message, 500)
    };
  }
};
