import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
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
      'Unlimited manual mind maps',
      '4 AI-generated maps per day',
      '3 saved boards',
      'PNG export',
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
      'Unlimited AI-generated maps',
      '4 AI Analysis messages per day',
      '4 Expand Tool uses per day',
      '20 saved boards',
      'PDF & Markdown export',
      'Vision model support',
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
      'Unlimited AI Analysis & Expand',
      'Full AI editing tools',
      '100 saved boards',
      'JSON & .mm export',
      'No watermark',
      '3 multi-board AI chats',
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
      'Unlimited saved boards',
      'Unlimited AI chat memory',
      'Real-time collaboration',
      'Fastest compute priority',
      'Experimental features',
    ],
    cta: 'Join Creator AI',
    popular: false,
    tier: USER_TIERS.CREATOR_AI
  },
];

export default function PricingTable({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { user, userTier } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processingTier, setProcessingTier] = useState(null);

  const handlePlanSelect = async (plan) => {
    setError(null);
    setProcessingTier(plan.tier);

    try {
      if (plan.tier === USER_TIERS.FREE) {
        onClose();
        return;
      }

      if (!user) {
        // Close modal and redirect to landing page with login query param to open login modal
        onClose();
        navigate('/?login=true');
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
      await StripeService.createCheckoutSession(
        user.uid,
        plan.tier,
        'monthly'
      );
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
        // Close modal and redirect to landing page with login query param to open login modal
        onClose();
        navigate('/?login=true');
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
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="pricing-section">
        <h2>Choose Your Plan</h2>
        {error && (
          <div className="error-message">
            <p>{error.message}</p>
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
    </Modal>
  );
} 