const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  try {
    // Debug logging
    console.log('Firebase initialization starting...');
    console.log('Environment check:', {
      hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
      hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
    });

    // Handle private key formatting
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    if (privateKey) {
      console.log('Private key format before processing:', {
        length: privateKey.length,
        startsWithQuotes: privateKey.startsWith('"') || privateKey.startsWith("'"),
        endsWithQuotes: privateKey.endsWith('"') || privateKey.endsWith("'"),
        containsBeginMarker: privateKey.includes('-----BEGIN PRIVATE KEY-----'),
        containsEndMarker: privateKey.includes('-----END PRIVATE KEY-----'),
      });

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

      console.log('Private key format after processing:', {
        length: privateKey.length,
        startsWithBeginMarker: privateKey.startsWith('-----BEGIN PRIVATE KEY-----'),
        endsWithEndMarker: privateKey.endsWith('-----END PRIVATE KEY-----'),
        newlineCount: (privateKey.match(/\n/g) || []).length,
      });

      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey
      };

      console.log('Initializing Firebase with service account:', {
        projectId: serviceAccount.projectId,
        clientEmail: serviceAccount.clientEmail,
        privateKeyLength: serviceAccount.privateKey.length,
      });

      initializeApp({
        credential: cert(serviceAccount)
      });
    } else {
      console.log('No private key found, using default initialization');
      // For production environment where credentials are handled by Netlify
      initializeApp();
    }

    console.log('Firebase initialization successful');
  } catch (error) {
    console.error('Firebase initialization error:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

const db = getFirestore();

// CORS headers for development
const headers = {
  'Access-Control-Allow-Origin': 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event, context) => {
  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { userId, productId, interval, customerEmail, currentTier, newTier } = JSON.parse(event.body);

    // Validate interval
    if (!['month', 'year'].includes(interval)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid interval. Must be "month" or "year"' })
      };
    }

    // Get or create customer
    let customer;
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (userData.stripeCustomerId) {
      customer = await stripe.customers.retrieve(userData.stripeCustomerId);
    } else {
      customer = await stripe.customers.create({
        email: customerEmail,
        metadata: {
          firebaseUserId: userId,
        },
      });
      
      // Save Stripe customer ID to Firestore
      await db.collection('users').doc(userId).update({
        stripeCustomerId: customer.id,
      });
    }

    // Get all prices for the product
    const { data: prices } = await stripe.prices.list({
      product: productId,
      active: true,
      type: 'recurring',
    });

    if (prices.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `No prices found for product ${productId}. Please set up prices in Stripe dashboard.` })
      };
    }

    // Find the correct price based on the interval
    const price = prices.find(p => 
      p.recurring.interval === interval && 
      p.recurring.interval_count === 1
    );

    if (!price) {
      const availableIntervals = [...new Set(prices.map(p => p.recurring.interval))];
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: `No ${interval} price found for product ${productId}. Available intervals are: ${availableIntervals.join(', ')}`
        })
      };
    }

    console.log(`Found price ${price.id} for product ${productId} (${interval})`);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      customer_email: !customer ? customerEmail : undefined,
      line_items: [
        {
          price: price.id,
          quantity: 1,
          adjustable_quantity: {
            enabled: false,
          },
        },
      ],
      mode: 'subscription',
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          firebaseUserId: userId,
          tier: newTier,
        },
        trial_period_days: process.env.STRIPE_TRIAL_PERIOD_DAYS,
      },
      success_url: `${process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/settings'}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/settings',
      metadata: {
        firebaseUserId: userId,
        currentTier,
        newTier,
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ sessionId: session.id })
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}; 