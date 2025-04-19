const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { userId, productId, interval, customerEmail, currentTier, newTier } = JSON.parse(event.body);

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

    // Get the prices for the product
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
    });

    // Find the correct price based on the interval
    const price = prices.data.find(p => 
      p.recurring.interval === interval && 
      p.recurring.interval_count === 1
    );

    if (!price) {
      throw new Error(`No ${interval} price found for product ${productId}`);
    }

    // Create checkout session with enhanced features
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      customer_email: !customer ? customerEmail : undefined, // Only set if new customer
      tax_id_collection: {
        enabled: true,
      },
      automatic_tax: {
        enabled: true,
      },
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
      consent_collection: {
        terms_of_service: 'required',
      },
      phone_number_collection: {
        enabled: true,
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ sessionId: session.id }),
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}; 