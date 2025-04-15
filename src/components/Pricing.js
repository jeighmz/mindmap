import React from 'react';
import Modal from './Modal';
import './Pricing.css';

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
  },
];

export default function PricingTable({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="pricing-section">
        <h2>Choose Your Plan</h2>
        <div className="pricing-grid">
          {plans.map((plan) => (
            <div key={plan.name} className={`pricing-card ${plan.popular ? 'popular' : ''}`}>
              {plan.popular && <div className="badge">Most Popular</div>}
              <h3>{plan.name}</h3>
              <p className="price">{plan.price}/mo</p>
              <p className="desc">{plan.description}</p>
              <ul>
                {plan.features.map((feature, idx) => (
                  <li key={idx}>{feature}</li>
                ))}
              </ul>
              <button className="cta">{plan.cta}</button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
} 