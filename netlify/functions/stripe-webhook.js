const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  // Check if running locally or in production
  if (process.env.FIREBASE_PRIVATE_KEY) {
    // Local development - use environment variables
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // The private key comes as a string with "\n" characters
        // We need to replace them with actual newlines
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    // Production - Netlify will handle the credentials
    initializeApp();
  }
}

const db = getFirestore();

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    // Verify webhook signature
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: err.message }),
    };
  }

  try {
    // Handle different event types
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const { firebaseUserId, newTier } = session.metadata;
        
        // Update user's subscription status in Firestore
        await db.collection('users').doc(firebaseUserId).update({
          tier: newTier,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          updatedAt: new Date().toISOString(),
        });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = stripeEvent.data.object;
        const { firebaseUserId, tier } = subscription.metadata;
        
        if (firebaseUserId && tier) {
          await db.collection('users').doc(firebaseUserId).update({
            tier,
            stripeSubscriptionStatus: subscription.status,
            updatedAt: new Date().toISOString(),
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        const { firebaseUserId } = subscription.metadata;
        
        if (firebaseUserId) {
          await db.collection('users').doc(firebaseUserId).update({
            tier: 'FREE',
            stripeSubscriptionId: null,
            stripeSubscriptionStatus: 'canceled',
            updatedAt: new Date().toISOString(),
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const { firebaseUserId } = subscription.metadata;
        
        if (firebaseUserId) {
          await db.collection('users').doc(firebaseUserId).update({
            stripeSubscriptionStatus: 'past_due',
            updatedAt: new Date().toISOString(),
          });
        }
        break;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}; 