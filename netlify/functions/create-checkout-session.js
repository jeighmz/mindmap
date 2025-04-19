const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

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