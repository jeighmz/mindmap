const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin lazily
let db = null;

const initializeFirebase = () => {
  if (db) return db;
  
  if (!getApps().length) {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Try to use service account JSON file first (easier and more reliable)
      const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
      
      if (fs.existsSync(serviceAccountPath)) {
        console.log('Using firebase-service-account.json file');
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        initializeApp({
          credential: cert(serviceAccount)
        });
      } else if (process.env.FIREBASE_PRIVATE_KEY) {
        // Fall back to environment variables
        console.log('Using environment variables for Firebase');
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;
        
        // Remove surrounding quotes if present (common in .env files)
        privateKey = privateKey.trim();
        if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
            (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
          privateKey = privateKey.slice(1, -1).trim();
        }
        
        // Replace escaped newlines with actual newlines
        privateKey = privateKey.replace(/\\n/g, '\n');
        
        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
          }),
        });
      } else {
        // Production - Netlify will handle the credentials
        console.log('Using default Firebase initialization');
        initializeApp();
      }
    } catch (error) {
      console.error('Firebase initialization error:', error);
      // Return a more helpful error message
      const errorMessage = error.message || 'Unknown error';
      throw new Error(`Failed to parse private key: ${errorMessage}`);
    }
  }
  
  db = getFirestore();
  return db;
};

// CORS headers - allow all origins in development, specific in production
const getHeaders = (origin) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8888',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8888'
  ];
  
  // In development, allow any localhost origin
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const allowOrigin = isDevelopment 
    ? (origin && origin.includes('localhost') ? origin : '*')
    : (allowedOrigins.includes(origin) ? origin : allowedOrigins[0]);
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
};

exports.handler = async (event, context) => {
  const origin = event.headers.origin || event.headers.Origin || '*';
  const headers = getHeaders(origin);
  
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
    // Initialize Firebase - this might throw if credentials are invalid
    let db;
    try {
      db = initializeFirebase();
    } catch (firebaseError) {
      console.error('Firebase initialization failed:', firebaseError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: firebaseError.message || 'Firebase initialization failed',
          type: 'api_error',
          details: 'Please check your Firebase credentials in environment variables'
        })
      };
    }
    
    const { userId, productId, interval, customerEmail, currentTier, newTier } = JSON.parse(event.body);
    
    // Log the tier values for debugging
    console.log('Checkout session creation:', {
      userId,
      productId,
      currentTier,
      newTier,
      interval,
      newTierType: typeof newTier,
      newTierValue: JSON.stringify(newTier)
    });
    
    // Validate newTier is provided
    if (!newTier) {
      console.error('Missing newTier value');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Subscription tier is required' })
      };
    }
    
    // Validate newTier is a valid tier (not FREE for paid subscriptions)
    const validTiers = ['STARTER', 'PRO', 'CREATOR_AI'];
    if (!validTiers.includes(newTier)) {
      console.error(`Invalid tier: ${newTier}. Must be one of: ${validTiers.join(', ')}`);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Invalid subscription tier: ${newTier}. Must be STARTER, PRO, or CREATOR_AI` })
      };
    }
    
    // Warn if trying to upgrade to FREE (shouldn't happen for paid subscriptions)
    if (newTier === 'FREE') {
      console.warn('Warning: newTier is FREE. This is unusual for a paid subscription.');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Cannot create paid subscription for FREE tier' })
      };
    }
    
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
      try {
        customer = await stripe.customers.retrieve(userData.stripeCustomerId);
        console.log('Retrieved existing customer:', customer.id);
      } catch (err) {
        // Customer doesn't exist in Stripe (may have been deleted or wrong mode)
        console.warn(`Customer ${userData.stripeCustomerId} not found in Stripe:`, err.message);
        console.log('Creating new customer...');
        
        // Create a new customer
        customer = await stripe.customers.create({
          email: customerEmail,
          metadata: {
            firebaseUserId: userId,
          },
        });
        
        // Update Firestore with new customer ID
        await db.collection('users').doc(userId).update({
          stripeCustomerId: customer.id,
        });
        
        console.log('Created new customer:', customer.id);
      }
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
      
      console.log('Created new customer:', customer.id);
    }

    // Check if user has an existing active subscription (for upgrades)
    let existingSubscription = null;
    
    // First, try to get subscription from Firestore
    if (userData.stripeSubscriptionId) {
      try {
        existingSubscription = await stripe.subscriptions.retrieve(userData.stripeSubscriptionId);
        console.log('Found existing subscription from Firestore:', {
          subscriptionId: existingSubscription.id,
          status: existingSubscription.status,
          currentProductId: existingSubscription.items.data[0]?.price?.product,
          currentPriceId: existingSubscription.items.data[0]?.price?.id
        });
      } catch (err) {
        console.log('Could not retrieve subscription from Firestore (may have been cancelled):', err.message);
        existingSubscription = null;
      }
    }
    
    // If no subscription found in Firestore, try to find it by customer ID
    if (!existingSubscription && customer.id) {
      try {
        console.log('No subscription ID in Firestore, searching by customer ID:', customer.id);
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          status: 'active',
          limit: 1
        });
        
        if (subscriptions.data.length > 0) {
          existingSubscription = subscriptions.data[0];
          console.log('Found active subscription by customer ID:', {
            subscriptionId: existingSubscription.id,
            status: existingSubscription.status,
            currentProductId: existingSubscription.items.data[0]?.price?.product,
            currentPriceId: existingSubscription.items.data[0]?.price?.id
          });
          
          // Update Firestore with the subscription ID for future reference
          await db.collection('users').doc(userId).update({
            stripeSubscriptionId: existingSubscription.id
          });
          console.log('Updated Firestore with subscription ID:', existingSubscription.id);
        } else {
          console.log('No active subscriptions found for customer');
        }
      } catch (err) {
        console.log('Error searching for subscription by customer ID:', err.message);
      }
    }
    
    if (!existingSubscription) {
      console.log('No existing subscription found, will create new checkout session');
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

    // Always use checkout session for tier changes - this ensures payment confirmation
    // Stripe will handle upgrades/downgrades and proration automatically
    // Even if user has existing subscription, we redirect to checkout for confirmation
    if (existingSubscription && ['active', 'trialing'].includes(existingSubscription.status)) {
      console.log('User has active subscription, creating checkout session for tier change...', {
        currentTier,
        newTier,
        subscriptionStatus: existingSubscription.status,
        note: 'Checkout will handle upgrade/downgrade with proration'
      });
      
      // Continue to create checkout session below - Stripe will handle the upgrade/downgrade
      // The checkout session will update the existing subscription when payment is confirmed
    }

    // No existing subscription - create new checkout session
    // Prepare subscription data
    const subscriptionData = {
      metadata: {
        firebaseUserId: userId,
        tier: newTier,
      },
    };

    // Add trial period if configured
    if (process.env.STRIPE_TRIAL_PERIOD_DAYS) {
      const trialDays = parseInt(process.env.STRIPE_TRIAL_PERIOD_DAYS, 10);
      if (!isNaN(trialDays) && trialDays > 0) {
        subscriptionData.trial_period_days = trialDays;
      }
    }

    // Simple success and cancel URLs - route to landing page
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://aimindmap.netlify.app'
      : 'http://localhost:3000';
    
    const successUrl = `${baseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}&tier=${newTier}`;
    const cancelUrl = `${baseUrl}/?payment=cancelled`;

    // Create checkout session
    // If user has existing subscription, we need to handle it differently
    // Stripe Checkout will create a new subscription, so we'll update the existing one after checkout
    // OR we can use the billing portal, but for now we'll use checkout and handle in webhook
    const sessionParams = {
      customer: customer.id,
      payment_method_types: ['card'],
      billing_address_collection: 'required',
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
      subscription_data: subscriptionData,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        firebaseUserId: userId,
        currentTier: currentTier || 'FREE',
        newTier: newTier,
        hasExistingSubscription: existingSubscription ? 'true' : 'false',
        existingSubscriptionId: existingSubscription?.id || null,
      },
    };
    
    const session = await stripe.checkout.sessions.create(sessionParams);
    
    // Log the created session metadata to verify
    console.log('Created checkout session:', {
      sessionId: session.id,
      sessionMetadata: session.metadata,
      subscriptionMetadata: subscriptionData.metadata,
      stripeKeyMode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'test' : 'live'
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        sessionId: session.id,
        stripeKeyMode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'test' : 'live'
      })
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    
    // Handle Stripe-specific errors according to API documentation
    // https://docs.stripe.com/api/errors
    let statusCode = 500;
    let errorMessage = error.message;

    if (error.type) {
      switch (error.type) {
        case 'StripeCardError':
          // Card errors (402) - card was declined
          statusCode = 402;
          errorMessage = error.message || 'Your card was declined.';
          break;
        case 'StripeRateLimitError':
          // Rate limit errors (429)
          statusCode = 429;
          errorMessage = 'Too many requests. Please try again later.';
          break;
        case 'StripeInvalidRequestError':
          // Invalid request errors (400)
          statusCode = 400;
          errorMessage = error.message || 'Invalid request parameters.';
          break;
        case 'StripeAPIError':
          // API errors (500)
          statusCode = 500;
          errorMessage = 'An error occurred with our payment processor. Please try again.';
          break;
        case 'StripeConnectionError':
        case 'StripeAuthenticationError':
          // Connection/auth errors (401/500)
          statusCode = error.statusCode || 500;
          errorMessage = 'Unable to process payment. Please try again.';
          break;
        default:
          statusCode = error.statusCode || 500;
      }
    }

    return {
      statusCode,
      headers,
      body: JSON.stringify({ 
        error: errorMessage,
        type: error.type || 'api_error'
      })
    };
  }
}; 