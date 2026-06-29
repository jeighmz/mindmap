const admin = require('firebase-admin');
const { encrypt } = require('./utils/encryption');
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

  try {
    initFirebase();
    const db = admin.firestore();

    // Parse request
    const { userId, apiKey } = JSON.parse(event.body);
    console.log('Request parsed, userId exists:', !!userId);

    const authResult = await requireAuth(event, userId);
    if (authResult.error) {
      return authErrorResponse(authResult, headers);
    }

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
      notionApiKey: encrypted,
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
      body: safeErrorBody(error.message, 500)
    };
  }
}; 