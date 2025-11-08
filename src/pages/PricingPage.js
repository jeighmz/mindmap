import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Pricing.css';
import { useAuth } from '../contexts/AuthContext';
import StripeService from '../services/stripeService';
import { USER_TIERS } from '../config/userTiers';

const plans = [
  {
    name: 'Free',
    price: '0',
    description: 'Perfect for trying out and basic mind mapping.',
    features: [
      'Create unlimited mind maps',
      'Basic PNG export',
      '1 saved map',
      'Core features',
    ],
    cta: 'Get Started Free',
    popular: false,
    tier: USER_TIERS.FREE
  },
  {
    name: 'Starter',
    price: '9',
    description: 'For light users who want to map ideas manually.',
    features: [
      'Everything in Free',
      '5 saved maps',
      'PDF & Markdown export',
      'Community templates',
    ],
    cta: 'Get Starter',
    popular: false,
    tier: USER_TIERS.STARTER
  },
  {
    name: 'Pro',
    price: '29',
    description: 'Unlock AI expansion and advanced features.',
    features: [
      'Everything in Starter',
      'AI "Expand" tool',
      '20 saved maps',
      'JSON & .mm export',
      'Priority support',
    ],
    cta: 'Upgrade to Pro',
    popular: true,
    tier: USER_TIERS.PRO
  },
  {
    name: 'Creator AI',
    price: '59',
    description: 'Full AI capabilities for power users.',
    features: [
      'Everything in Pro',
      'Full AI-generated maps',
      'AI analysis panel',
      'Unlimited saved maps',
      'Early access features',
    ],
    cta: 'Join Creator AI',
    popular: false,
    tier: USER_TIERS.CREATOR_AI
  },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const { user, userTier, refreshUserData } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processingTier, setProcessingTier] = useState(null);

  // Firestore listener in AuthContext will automatically update tier
  // No need to manually refresh on mount

  const handlePlanSelect = async (plan) => {
    setError(null);
    setProcessingTier(plan.tier);

    try {
      if (plan.tier === USER_TIERS.FREE) {
        navigate('/whiteboard');
        return;
      }

      if (!user) {
        setError({
          message: 'Please log in to upgrade your plan',
          action: 'login',
          tier: plan.tier
        });
        return;
      }

      if (plan.tier === userTier) {
        setError({
          message: 'You are already subscribed to this plan',
          action: 'manage',
          tier: plan.tier
        });
        return;
      }

      setIsLoading(true);
      // Always redirect to checkout - Stripe will handle payment confirmation
      // This applies to both new subscriptions and upgrades/downgrades
      await StripeService.createCheckoutSession(
        user.uid,
        plan.tier,
        'monthly'
      );
      // Note: User will be redirected to Stripe Checkout, so code below won't execute
      // The webhook will handle updating the tier after payment confirmation
    } catch (err) {
      console.error('Error starting checkout:', err);
      setError({
        message: err.message || 'Failed to start checkout process. Please try again.',
        action: 'retry',
        tier: plan.tier
      });
    } finally {
      setIsLoading(false);
      setProcessingTier(null);
    }
  };

  const handleErrorAction = async (error) => {
    switch (error.action) {
      case 'login':
        window.location.href = '/login?redirect=pricing&plan=' + error.tier;
        break;
      case 'manage':
        try {
          setIsLoading(true);
          const portalUrl = await StripeService.createPortalSession(user.uid);
          window.location.href = portalUrl;
        } catch (err) {
          setError({
            message: 'Failed to access billing portal. Please try again.',
            action: 'retry',
            tier: error.tier
          });
        } finally {
          setIsLoading(false);
        }
        break;
      case 'retry':
        setError(null);
        handlePlanSelect({ tier: error.tier });
        break;
      default:
        setError(null);
    }
  };

  return (
    <div className="pricing-page">
      <div className="pricing-container">
        <div className="pricing-header">
          <button className="back-button" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h1>Choose Your Plan</h1>
          <p className="pricing-subtitle">Select the plan that best fits your needs</p>
        </div>
        
        {error && (
          <div className={`error-message ${error.type === 'success' ? 'success-message' : ''}`}>
            <p>{error.message}</p>
            {error.action && (
              <button 
                onClick={() => handleErrorAction(error)}
                className="error-action-button"
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 
                  error.action === 'login' ? 'Log In' :
                  error.action === 'manage' ? 'Manage Subscription' :
                  'Try Again'}
              </button>
            )}
          </div>
        )}
        
        <div className="pricing-grid">
          {plans.map((plan) => (
            <div 
              key={plan.name} 
              className={`pricing-card ${plan.popular ? 'popular' : ''} ${plan.tier === userTier ? 'current' : ''}`}
            >
              {plan.popular && <div className="badge">Most Popular</div>}
              {plan.tier === userTier && <div className="badge current">Current Plan</div>}
              <h3>{plan.name}</h3>
              <div className="price">${plan.price}</div>
              <p className="desc">{plan.description}</p>
              <ul>
                {plan.features.map((feature, idx) => (
                  <li key={idx}>
                    <span>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button 
                className={`cta ${isLoading && processingTier === plan.tier ? 'loading' : ''}`}
                onClick={() => handlePlanSelect(plan)}
                disabled={isLoading || plan.tier === userTier}
              >
                {isLoading && processingTier === plan.tier ? 
                  'Processing...' : 
                  plan.tier === userTier ? 
                    'Current Plan' : 
                    plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


