import { loadStripe } from '@stripe/stripe-js';
import { db } from '../firebase-config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { USER_TIERS, TIER_FEATURES } from '../config/userTiers';

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
const getApiUrl = () => {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:8888/.netlify/functions';
  }
  return '/.netlify/functions';
};

// Map our tiers to Stripe product IDs
const STRIPE_PRODUCT_IDS = {
  [USER_TIERS.STARTER]: 'prod_S9iMpACtlPv8kv',
  [USER_TIERS.PRO]: 'prod_S9iNjKTuDUKWLZ',
  [USER_TIERS.CREATOR_AI]: 'prod_S9iOBu7jGBIJyp',
};

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

      // Create checkout session through Firebase Function
      const response = await fetch(`${getApiUrl()}/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          productId,
          interval: INTERVAL_MAPPING[interval],
          customerEmail: userData.email,
          currentTier: userData.tier,
          newTier: tier,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Checkout session creation failed: ${errorData}`);
      }

      const { sessionId } = await response.json();
      
      // Get Stripe instance and redirect to checkout
      const stripe = await getStripe();
      const { error } = await stripe.redirectToCheckout({ sessionId });
      
      if (error) {
        throw new Error(error.message);
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

      const response = await fetch(`${getApiUrl()}/create-portal-session`, {
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

      const response = await fetch(`${getApiUrl()}/cancel-subscription`, {
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