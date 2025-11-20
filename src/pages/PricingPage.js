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
      'Unlimited manual mind maps',
      '4 AI-generated maps per day',
      '3 saved boards',
      'PNG export',
    ],
    fullFeatures: [
      'Manual mind maps: Unlimited',
      'AI-generated maps: 4 per day',
      'AI Analysis Panel messages: 0',
      'Expand Tool: 0',
      'Saved boards (cloud): 3',
      'Autosave: Yes',
      'Vision model support: No',
      'Full AI editing tools: No',
      'Multi-board AI chat memory: No',
      'Exports: PNG',
      'Exports: PDF & Markdown: No',
      'Exports: JSON & .mm: No',
      'No watermark: No',
      'Collaboration (real-time): No',
      'Fastest compute priority: No',
      'Experimental features: No',
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
    fullFeatures: [
      'Manual mind maps: Unlimited',
      'AI-generated maps: Unlimited',
      'AI Analysis Panel messages: 4 per day',
      'Expand Tool: 4 per day',
      'Saved boards (cloud): 20',
      'Autosave: Yes',
      'Vision model support: Yes',
      'Full AI editing tools: No',
      'Multi-board AI chat memory: No',
      'Exports: PNG',
      'Exports: PDF & Markdown: Yes',
      'Exports: JSON & .mm: No',
      'No watermark: No',
      'Collaboration (real-time): No',
      'Fastest compute priority: No',
      'Experimental features: No',
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
    fullFeatures: [
      'Manual mind maps: Unlimited',
      'AI-generated maps: Unlimited',
      'AI Analysis Panel messages: Unlimited',
      'Expand Tool: Unlimited',
      'Saved boards (cloud): 100',
      'Autosave: Yes',
      'Vision model support: Yes',
      'Full AI editing tools: Yes',
      'Multi-board AI chat memory: 3 chats',
      'Exports: PNG',
      'Exports: PDF & Markdown: Yes',
      'Exports: JSON & .mm: Yes',
      'No watermark: Yes',
      'Collaboration (real-time): No',
      'Fastest compute priority: No',
      'Experimental features: No',
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
    fullFeatures: [
      'Manual mind maps: Unlimited',
      'AI-generated maps: Unlimited',
      'AI Analysis Panel messages: Unlimited',
      'Expand Tool: Unlimited',
      'Saved boards (cloud): Unlimited',
      'Autosave: Yes',
      'Vision model support: Yes',
      'Full AI editing tools: Yes',
      'Multi-board AI chat memory: Unlimited',
      'Exports: PNG',
      'Exports: PDF & Markdown: Yes',
      'Exports: JSON & .mm: Yes',
      'No watermark: Yes',
      'Collaboration (real-time): Yes',
      'Fastest compute priority: Yes',
      'Experimental features: Yes',
    ],
    cta: 'Join Creator AI',
    popular: false,
    tier: USER_TIERS.CREATOR_AI
  },
];

// Comparison table data
const comparisonTable = [
  { feature: 'Manual Mind Maps', free: 'Unlimited', starter: 'Unlimited', pro: 'Unlimited', creator: 'Unlimited' },
  { feature: 'AI-Generated Maps', free: '4 per day', starter: 'Unlimited', pro: 'Unlimited', creator: 'Unlimited' },
  { feature: 'AI Analysis Panel (messages per day)', free: '—', starter: '4 per day', pro: 'Unlimited', creator: 'Unlimited' },
  { feature: 'Expand Tool', free: '—', starter: '4 per day', pro: 'Unlimited', creator: 'Unlimited' },
  { feature: 'Saved Boards (Cloud)', free: '3', starter: '20', pro: '100', creator: 'Unlimited' },
  { feature: 'Autosave', free: '✓', starter: '✓', pro: '✓', creator: '✓' },
  { feature: 'Vision Model Support (image → map)', free: '—', starter: '✓', pro: '✓', creator: '✓' },
  { feature: 'Full AI Editing Tools (Rewrite / Summarize / Structure)', free: '—', starter: '—', pro: '✓', creator: '✓' },
  { feature: 'Multi-Board AI Chat Memory', free: '—', starter: '—', pro: '3 chats', creator: 'Unlimited' },
  { feature: 'Exports: PNG', free: '✓', starter: '✓', pro: '✓', creator: '✓' },
  { feature: 'Exports: PDF & Markdown', free: '—', starter: '✓', pro: '✓', creator: '✓' },
  { feature: 'Exports: JSON & .mm', free: '—', starter: '—', pro: '✓', creator: '✓' },
  { feature: 'No Watermark', free: '—', starter: '—', pro: '✓', creator: '✓' },
  { feature: 'Collaboration (Real-Time)', free: '—', starter: '—', pro: '—', creator: '✓' },
  { feature: 'Fastest Compute Priority', free: '—', starter: '—', pro: '—', creator: '✓' },
  { feature: 'Experimental Features', free: '—', starter: '—', pro: '—', creator: '✓' },
  { feature: 'Price', free: '$0', starter: '$9/mo', pro: '$29/mo', creator: '$59/mo' },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const { user, userTier, refreshUserData } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processingTier, setProcessingTier] = useState(null);
  
  // Check for payment success in URL and refresh user data
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const paymentStatus = searchParams.get('payment');
    const sessionId = searchParams.get('session_id');
    
    if (paymentStatus === 'success' && sessionId && user) {
      // Poll for tier update after successful payment
      let pollCount = 0;
      const maxPolls = 10;
      
      const pollForTierUpdate = async () => {
        try {
          await refreshUserData();
          pollCount++;
          
          if (pollCount < maxPolls) {
            setTimeout(pollForTierUpdate, 2000);
          }
        } catch (error) {
          console.error('Error refreshing user tier:', error);
        }
      };
      
      // Start polling after initial delay
      setTimeout(pollForTierUpdate, 2000);
      
      // Clean up URL params
      navigate('/pricing', { replace: true });
    }
  }, [user, refreshUserData, navigate]);
  const [expandedCard, setExpandedCard] = useState(null);

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
        // Redirect to landing page with login query param to open login modal
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
        // Redirect to landing page with login query param to open login modal
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
              {plan.popular && plan.tier !== userTier && <div className="badge">Most Popular</div>}
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
              <button 
                className="expand-features-btn"
                onClick={() => setExpandedCard(expandedCard === plan.tier ? null : plan.tier)}
              >
                {expandedCard === plan.tier ? 'Hide' : 'View'} Full Features
                <span className={`expand-icon ${expandedCard === plan.tier ? 'expanded' : ''}`}>▼</span>
              </button>
            </div>
          ))}
        </div>

        {expandedCard && (
          <div className="feature-details-overlay" onClick={() => setExpandedCard(null)}>
            <div className="feature-details-modal" onClick={(e) => e.stopPropagation()}>
              {plans
                .filter(plan => plan.tier === expandedCard)
                .map(plan => (
                  <div key={plan.tier} className="feature-details-content">
                    <div className="feature-details-header">
                      <div>
                        <h2>{plan.name} Plan</h2>
                        <p className="feature-details-subtitle">Complete feature breakdown</p>
                      </div>
                      <button 
                        className="close-features-btn"
                        onClick={() => setExpandedCard(null)}
                        aria-label="Close"
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                    <div className="full-features-grid">
                      {plan.fullFeatures.map((feature, idx) => {
                        const getIcon = () => {
                          if (feature.includes(': Yes') || feature.includes('Unlimited')) return '✓';
                          if (feature.includes(': No') || feature.includes(': 0')) return '—';
                          return '•';
                        };
                        const isEnabled = !feature.includes(': No') && !feature.includes(': 0');
                        return (
                          <div key={idx} className={`feature-item ${!isEnabled ? 'disabled' : ''}`}>
                            <span className="feature-icon">{getIcon()}</span>
                            <span className="feature-text">{feature}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="comparison-section">
          <h2 className="comparison-title">Feature Comparison</h2>
          <div className="comparison-table-container">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th className="feature-column">Feature</th>
                  <th>Free</th>
                  <th>Starter</th>
                  <th>Pro</th>
                  <th>Creator AI</th>
                </tr>
              </thead>
              <tbody>
                {comparisonTable.map((row, idx) => (
                  <tr key={idx} className={row.feature === 'Price' ? 'price-row' : ''}>
                    <td className="feature-column">{row.feature}</td>
                    <td>{row.free}</td>
                    <td>{row.starter}</td>
                    <td>{row.pro}</td>
                    <td>{row.creator}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


