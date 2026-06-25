const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const {
  getCorsHeaders,
  handlePreflight,
  requireAuth,
  authErrorResponse,
  safeErrorBody,
} = require('./utils/auth');

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  if (process.env.FIREBASE_PRIVATE_KEY) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    initializeApp();
  }
}

const db = getFirestore();

exports.handler = async (event, context) => {
  const origin = event.headers.origin || event.headers.Origin;
  const headers = getCorsHeaders(origin);

  const preflight = handlePreflight(event);
  if (preflight) return preflight;

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { userId } = JSON.parse(event.body);

    const authResult = await requireAuth(event, userId);
    if (authResult.error) {
      return authErrorResponse(authResult, headers);
    }

    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData?.stripeCustomerId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No Stripe customer found for this user' }),
      };
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: userData.stripeCustomerId,
      return_url: process.env.STRIPE_PORTAL_RETURN_URL || process.env.SITE_URL || 'https://aimindmap.netlify.app/settings',
      configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error) {
    console.error('Error creating portal session:', error);
    return {
      statusCode: 500,
      headers,
      body: safeErrorBody(error.message, 500),
    };
  }
};
