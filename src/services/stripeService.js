import { loadStripe } from '@stripe/stripe-js';
import { db } from '../firebase-config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { USER_TIERS, TIER_FEATURES } from '../config/userTiers';
import { getApiBaseUrl } from '../utils/api';

// Ensure Stripe is loaded only once
let stripePromise;
const getStripe = () => {
  if (!stripePromise) {
    if (!process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY) {
      throw new Error('Stripe publishable key is not configured');
    }
    stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

// Get the base URL for API calls
const getBaseUrl = () => {
  // Check if we're in development mode
  if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
    // In development, call Netlify Functions directly
    return 'http://localhost:8888/.netlify/functions';
  }
  
  // In production, use the /api redirect (handled by netlify.toml)
  // This will redirect /api/* to /.netlify/functions/*
  return '/api';
};

// Detect if we're using live/production Stripe keys
const isProductionMode = () => {
  const publishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
  return publishableKey && publishableKey.startsWith('pk_live_');
};

// Get Stripe product IDs based on environment
// Production product IDs can be set via environment variables
// Falls back to test product IDs for development
//
// Production Product IDs (set via environment variables):
// - Starter: prod_TNlcRbyRR0NBAU
// - Pro: prod_TNlcHMU8qci7qi
// - Creator AI: prod_TNlcORK76OVe4q
//
// Test Product IDs (hardcoded fallback):
// - Starter: prod_TSG73qEwSrGdpr
// - Pro: prod_TSG8miwSS3czd7
// - Creator AI: prod_TSG8Fh0h21SEhc
const getStripeProductIds = () => {
  const isProduction = isProductionMode();
  
  if (isProduction) {
    // Use production product IDs from environment variables
    // If not set, will use test IDs as fallback (should be set in production!)
    return {
      [USER_TIERS.STARTER]: process.env.REACT_APP_STRIPE_PRODUCT_ID_STARTER || 'prod_TSG73qEwSrGdpr',
      [USER_TIERS.PRO]: process.env.REACT_APP_STRIPE_PRODUCT_ID_PRO || 'prod_TSG8miwSS3czd7',
      [USER_TIERS.CREATOR_AI]: process.env.REACT_APP_STRIPE_PRODUCT_ID_CREATOR_AI || 'prod_TSG8Fh0h21SEhc',
    };
  } else {
    // Use test product IDs for development
    return {
      [USER_TIERS.STARTER]: 'prod_TSG73qEwSrGdpr',
      [USER_TIERS.PRO]: 'prod_TSG8miwSS3czd7',
      [USER_TIERS.CREATOR_AI]: 'prod_TSG8Fh0h21SEhc',
    };
  }
};

// Map our tiers to Stripe product IDs (environment-aware)
const STRIPE_PRODUCT_IDS = getStripeProductIds();

// Log product IDs being used (for debugging)
if (process.env.NODE_ENV === 'development' || process.env.REACT_APP_DEBUG_STRIPE) {
  const isProduction = isProductionMode();
  console.log(`[Stripe] Using ${isProduction ? 'PRODUCTION' : 'TEST'} product IDs:`, {
    STARTER: STRIPE_PRODUCT_IDS[USER_TIERS.STARTER],
    PRO: STRIPE_PRODUCT_IDS[USER_TIERS.PRO],
    CREATOR_AI: STRIPE_PRODUCT_IDS[USER_TIERS.CREATOR_AI],
    mode: isProduction ? 'LIVE' : 'TEST'
  });
  
  // Warn if in production mode but using test product IDs
  if (isProduction) {
    const testProductIds = ['prod_TSG73qEwSrGdpr', 'prod_TSG8miwSS3czd7', 'prod_TSG8Fh0h21SEhc'];
    const usingTestIds = Object.values(STRIPE_PRODUCT_IDS).some(id => testProductIds.includes(id));
    if (usingTestIds) {
      console.warn('[Stripe] ⚠️ WARNING: Production mode detected but using TEST product IDs!');
      console.warn('[Stripe] Set REACT_APP_STRIPE_PRODUCT_ID_STARTER, REACT_APP_STRIPE_PRODUCT_ID_PRO, and REACT_APP_STRIPE_PRODUCT_ID_CREATOR_AI environment variables.');
    }
  }
}

// Stripe uses 'month' and 'year' for intervals
const INTERVAL_MAPPING = {
  monthly: 'month',
  annual: 'year'
};

class StripeService {
  /**
   * Create a checkout session for subscription
   * @param {string} userId - Firebase user ID
   * @param {string} tier - Target subscription tier
   * @param {string} interval - 'monthly' or 'annual'
   * @returns {Promise<void>} Redirects to Stripe Checkout
   * @throws {Error} If the process fails
   */
  static async createCheckoutSession(userId, tier, interval = 'monthly') {
    try {
      // Validate inputs
      if (!userId) throw new Error('User ID is required');
      if (!tier) throw new Error('Subscription tier is required');
      if (!STRIPE_PRODUCT_IDS[tier]) throw new Error('Invalid subscription tier');
      if (!INTERVAL_MAPPING[interval]) throw new Error('Invalid interval. Must be "monthly" or "annual"');

      // Get the product ID for the selected tier
      const productId = STRIPE_PRODUCT_IDS[tier];

      // Get user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }
      const userData = userDoc.data();

      // Create checkout session through Netlify Function
      const baseUrl = getBaseUrl();
      const apiUrl = `${baseUrl}/create-checkout-session`;
      
      // Fallback URL: try direct function path if /api redirect doesn't work
      const fallbackUrl = `/.netlify/functions/create-checkout-session`;
      
      console.log('[Stripe] Creating checkout session:', {
        url: apiUrl,
        fallbackUrl,
        baseUrl,
        environment: process.env.NODE_ENV,
        hostname: window.location.hostname
      });
      
      // Try the primary URL first
      let response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          productId,
          interval: INTERVAL_MAPPING[interval],
          customerEmail: userData.email,
          currentTier: userData.tier || 'FREE',
          newTier: tier,
        }),
      });

      // If 404, try the fallback direct function path
      if (response.status === 404 && baseUrl === '/api') {
        console.log('[Stripe] Primary URL returned 404, trying fallback:', fallbackUrl);
        response = await fetch(fallbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            productId,
            interval: INTERVAL_MAPPING[interval],
            customerEmail: userData.email,
            currentTier: userData.tier || 'FREE',
            newTier: tier,
          }),
        });
      }

      if (!response.ok) {
        const errorData = await response.text();
        console.error('[Stripe] Checkout session creation failed:', {
          status: response.status,
          statusText: response.statusText,
          url: apiUrl,
          fallbackTried: response.status === 404 && baseUrl === '/api',
          error: errorData.substring(0, 500) // Limit error message length
        });
        
        // Provide more helpful error message
        if (response.status === 404) {
          throw new Error(`API endpoint not found (404). 

Troubleshooting steps:
1. Go to Netlify Dashboard → Deploys → Trigger deploy → Deploy site
2. Wait for deployment to complete
3. Verify the function exists: Netlify Dashboard → Functions → create-checkout-session
4. Check build logs for any errors

URLs tried:
- ${apiUrl}
- ${fallbackUrl}`);
        }
        
        throw new Error(`Checkout session creation failed (${response.status}): ${errorData.substring(0, 200)}`);
      }

      const responseData = await response.json();
      
      // Always redirect to checkout - even for upgrades/downgrades
      // Stripe will handle payment confirmation and subscription updates
      const { sessionId } = responseData;
      
      if (!sessionId) {
        throw new Error('No session ID returned from checkout session creation');
      }
      
      // Verify publishable key is set
      const publishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
      if (!publishableKey) {
        throw new Error('Stripe publishable key is not configured. Please set REACT_APP_STRIPE_PUBLISHABLE_KEY in your environment variables.');
      }
      
      // Verify key mode matches
      const isTestKey = publishableKey.startsWith('pk_test_');
      const isLiveKey = publishableKey.startsWith('pk_live_');
      
      if (!isTestKey && !isLiveKey) {
        throw new Error(`Invalid publishable key format. Must start with pk_test_ or pk_live_. Got: ${publishableKey.substring(0, 10)}...`);
      }
      
      // Log for debugging
      console.log('Redirecting to checkout:', {
        sessionId,
        publishableKeyPrefix: publishableKey.substring(0, 12) + '...',
        keyMode: isTestKey ? 'TEST' : 'LIVE',
        sessionCreatedInMode: 'test' // From backend logs
      });
      
      // Get Stripe instance and redirect to checkout
      const stripe = await getStripe();
      
      // Double-check the key matches
      if (isTestKey && responseData.stripeKeyMode && responseData.stripeKeyMode !== 'test') {
        console.warn('WARNING: Publishable key is TEST but session was created in different mode');
      }
      
      const { error } = await stripe.redirectToCheckout({ sessionId });
      
      if (error) {
        console.error('Stripe redirect error details:', {
          error: error.message,
          type: error.type,
          publishableKeyPrefix: publishableKey.substring(0, 12) + '...',
          sessionId
        });
        throw new Error(`Checkout redirect failed: ${error.message}. 
        
Troubleshooting:
1. Verify REACT_APP_STRIPE_PUBLISHABLE_KEY is set correctly
2. Make sure it's a TEST key (pk_test_...) if using test mode
3. Ensure it's from the same Stripe account as STRIPE_SECRET_KEY
4. Check browser console for the publishable key being used`);
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error; // Re-throw to handle in the component
    }
  }

  /**
   * Create a billing portal session
   * @param {string} userId - Firebase user ID
   * @returns {Promise<string>} Portal URL
   * @throws {Error} If the process fails
   */
  static async createPortalSession(userId) {
    try {
      if (!userId) throw new Error('User ID is required');

      // Get user's Stripe customer ID from Firestore
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }
      const userData = userDoc.data();

      if (!userData?.stripeCustomerId) {
        throw new Error('No active subscription found for this user');
      }

      const response = await fetch(`${getBaseUrl()}/create-portal-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Portal session creation failed: ${errorData}`);
      }

      const { url } = await response.json();
      return url;
    } catch (error) {
      console.error('Error creating portal session:', error);
      throw error; // Re-throw to handle in the component
    }
  }

  /**
   * Update user's subscription status in Firestore
   * @param {string} userId - Firebase user ID
   * @param {string} tier - New subscription tier
   * @param {string} subscriptionId - Stripe subscription ID
   * @param {string} customerId - Stripe customer ID
   * @throws {Error} If the update fails
   */
  static async updateSubscriptionStatus(userId, tier, subscriptionId, customerId) {
    try {
      if (!userId) throw new Error('User ID is required');
      if (!tier) throw new Error('Subscription tier is required');
      
      await updateDoc(doc(db, 'users', userId), {
        tier,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating subscription status:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription and revert to FREE tier
   * @param {string} userId - Firebase user ID
   * @throws {Error} If the cancellation fails
   */
  static async cancelSubscription(userId) {
    try {
      if (!userId) throw new Error('User ID is required');

      const response = await fetch(`${getBaseUrl()}/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Subscription cancellation failed: ${errorData}`);
      }

      // Update user's tier in Firestore
      await updateDoc(doc(db, 'users', userId), {
        tier: USER_TIERS.FREE,
        stripeSubscriptionId: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

}

export default StripeService; 