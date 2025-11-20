const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
let db = null;

const initializeFirebase = () => {
  if (db) return db;
  
  if (!getApps().length) {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
      
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        initializeApp({
          credential: cert(serviceAccount)
        });
      } else if (process.env.FIREBASE_PRIVATE_KEY) {
        let privateKey = process.env.FIREBASE_PRIVATE_KEY.trim();
        if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
            (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
          privateKey = privateKey.slice(1, -1).trim();
        }
        privateKey = privateKey.replace(/\\n/g, '\n');
        
        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
          }),
        });
      } else {
        initializeApp();
      }
    } catch (error) {
      console.error('Firebase initialization error:', error);
      throw new Error(`Failed to initialize Firebase: ${error.message}`);
    }
  }
  
  db = getFirestore();
  return db;
};

// Map Stripe product IDs to tiers
const PRODUCT_TO_TIER = {
  'prod_S9iMpACtlPv8kv': 'STARTER',
  'prod_S9iNjKTuDUKWLZ': 'PRO',
  'prod_S9iOBu7jGBlJyp': 'CREATOR_AI',
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

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
    db = initializeFirebase();
    
    const { userId } = JSON.parse(event.body);
    
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'userId is required' })
      };
    }

    // Get user from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    const userData = userDoc.data();
    const stripeCustomerId = userData.stripeCustomerId;
    const currentTier = userData.tier || 'FREE';

    if (!stripeCustomerId) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: 'No Stripe customer ID found. User is on FREE tier.',
          tier: 'FREE',
          updated: false
        })
      };
    }

    // Get customer's active subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      // No active subscription - should be FREE
      if (currentTier !== 'FREE') {
        await db.collection('users').doc(userId).set({
          tier: 'FREE',
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            message: 'No active subscription found. Tier updated to FREE.',
            tier: 'FREE',
            updated: true,
            previousTier: currentTier
          })
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: 'No active subscription. User is already on FREE tier.',
          tier: 'FREE',
          updated: false
        })
      };
    }

    // Get the subscription
    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0].price.id;
    
    // Get the price to find the product
    const price = await stripe.prices.retrieve(priceId);
    const productId = price.product;
    
    // Map product to tier
    const newTier = PRODUCT_TO_TIER[productId];
    
    if (!newTier) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: `Unknown product ID: ${productId}. Please update PRODUCT_TO_TIER mapping.`,
          productId
        })
      };
    }

    // Update tier if different
    if (currentTier !== newTier) {
      await db.collection('users').doc(userId).set({
        tier: newTier,
        stripeSubscriptionId: subscription.id,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: `Tier updated from ${currentTier} to ${newTier}`,
          tier: newTier,
          updated: true,
          previousTier: currentTier,
          subscriptionId: subscription.id,
          productId
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: `Tier is already correct: ${newTier}`,
        tier: newTier,
        updated: false,
        subscriptionId: subscription.id
      })
    };

  } catch (error) {
    console.error('Error syncing subscription:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.stack
      })
    };
  }
};

