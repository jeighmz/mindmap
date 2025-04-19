import React, { useState } from 'react';
import Modal from './Modal';
import './Pricing.css';
import { useAuth } from '../contexts/AuthContext';
import StripeService from '../services/stripeService';
import { USER_TIERS } from '../config/userTiers';

const plans = [
  {
    name: 'Free',
    price: '$0',
    description: 'Perfect for trying out and basic mind mapping.',
    features: [
      '✅ Create unlimited mind maps',
      '✅ Basic PNG export',
      '✅ 1 saved map',
      '✅ Core features',
    ],
    cta: 'Get Started Free',
    popular: false,
    tier: USER_TIERS.FREE
  },
  {
    name: 'Starter',
    price: '$9',
    description: 'For light users who want to map ideas manually.',
    features: [
      '✅ Everything in Free',
      '✅ 5 saved maps',
      '✅ PDF & Markdown export',
      '✅ Community templates',
    ],
    cta: 'Get Starter',
    popular: false,
    tier: USER_TIERS.STARTER
  },
  {
    name: 'Pro',
    price: '$29',
    description: 'Unlock AI expansion and advanced features.',
    features: [
      '✅ Everything in Starter',
      '✅ AI "Expand" tool',
      '✅ 20 saved maps',
      '✅ JSON & .mm export',
      '✅ Priority support',
    ],
    cta: 'Upgrade to Pro',
    popular: true,
    tier: USER_TIERS.PRO
  },
  {
    name: 'Creator AI',
    price: '$59',
    description: 'Full AI capabilities for power users.',
    features: [
      '✅ Everything in Pro',
      '✅ Full AI-generated maps',
      '✅ AI analysis panel',
      '✅ Unlimited saved maps',
      '✅ Early access features',
    ],
    cta: 'Join Creator AI',
    popular: false,
    tier: USER_TIERS.CREATOR_AI
  },
];

export default function PricingTable({ isOpen, onClose }) {
  const { user, userTier } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePlanSelect = async (plan) => {
    // If selecting free plan, no Stripe checkout needed
    if (plan.tier === USER_TIERS.FREE) {
      onClose();
      return;
    }

    // Require authentication before checkout
    if (!user) {
      // You might want to redirect to login or show login modal
      setError('Please log in to upgrade your plan');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Start Stripe checkout process
      await StripeService.createCheckoutSession(
        user.uid,
        plan.tier,
        'monthly' // You could add a toggle for annual/monthly
      );
      
      // Note: No need to close modal here as we're redirecting to Stripe
    } catch (err) {
      console.error('Error starting checkout:', err);
      setError('Failed to start checkout process. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="pricing-section">
        <h2>Choose Your Plan</h2>
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        <div className="pricing-grid">
          {plans.map((plan) => (
            <div key={plan.name} className={`pricing-card ${plan.popular ? 'popular' : ''} ${plan.tier === userTier ? 'current' : ''}`}>
              {plan.popular && <div className="badge">Most Popular</div>}
              {plan.tier === userTier && <div className="badge current">Current Plan</div>}
              <h3>{plan.name}</h3>
              <p className="price">{plan.price}/mo</p>
              <p className="desc">{plan.description}</p>
              <ul>
                {plan.features.map((feature, idx) => (
                  <li key={idx}>{feature}</li>
                ))}
              </ul>
              <button 
                className="cta"
                onClick={() => handlePlanSelect(plan)}
                disabled={isLoading || plan.tier === userTier}
              >
                {isLoading ? 'Loading...' : plan.tier === userTier ? 'Current Plan' : plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
} 