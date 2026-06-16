import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../styles/LandingPage.css';
import { useAuth } from '../contexts/AuthContext';

// Import SVG icons
import { ReactComponent as InstantGenerationIcon } from '../assets/icons/instant-generation.svg';
import { ReactComponent as VisualizeConceptsIcon } from '../assets/icons/visualize-concepts.svg';
import { ReactComponent as RealtimeCollaborationIcon } from '../assets/icons/realtime-collaboration.svg';


const LandingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userTier, refreshUserData } = useAuth();

  // Check for payment success/cancel in URL params
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const sessionId = searchParams.get('session_id');
    const tier = searchParams.get('tier');

    if (paymentStatus === 'success' && sessionId && user) {
      const expectedTier = tier || 'CREATOR_AI';
      let pollCount = 0;
      const maxPolls = 10;

      const pollForTierUpdate = async () => {
        try {
          await refreshUserData();
          pollCount++;

          const currentTier = userTier;
          if (currentTier === expectedTier || pollCount >= maxPolls) {
            return;
          }

          if (pollCount < maxPolls) {
            setTimeout(pollForTierUpdate, 2000);
          }
        } catch (error) {
          console.error('Error refreshing user tier:', error);
        }
      };

      setTimeout(pollForTierUpdate, 2000);
      navigate('/', { replace: true });
    } else if (paymentStatus === 'cancelled') {
      navigate('/', { replace: true });
    }
  }, [searchParams, user, navigate, refreshUserData, userTier]);

  return (
    <>
      <section className="hero-section">
        <div className="hero-background">
          <div className="hero-gradient-orb hero-gradient-orb-1"></div>
          <div className="hero-gradient-orb hero-gradient-orb-2"></div>
          <div className="hero-gradient-orb hero-gradient-orb-3"></div>
        </div>
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              <span>AI-Powered Mind Mapping</span>
            </div>
            <h1 className="hero-title">
              <span className="hero-title-line">Unlock Your</span>
              <span className="hero-title-gradient">Ideas</span>
            </h1>
            <p className="hero-subtitle">
              Visually organize thoughts, brainstorm concepts, and collaborate in real-time with cutting-edge AI technology.
            </p>
            <div className="hero-cta-group">
              <div className="hero-cta-buttons">
                <button
                  className="hero-cta-button"
                  onClick={() => navigate('/whiteboard')}
                >
                  <span>Start Mind Mapping Now</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
                <button
                  className="hero-contact-button"
                  onClick={() => window.location.href = 'mailto:aimindmap22@gmail.com'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <span>Contact the Team</span>
                </button>
              </div>
              <div className="hero-features-preview">
                <span className="feature-pill">
                  <InstantGenerationIcon className="feature-pill-icon" />
                  Instant Generation
                </span>
                <span className="feature-pill">
                  <VisualizeConceptsIcon className="feature-pill-icon" />
                  Visualize Concepts
                </span>
                <span className="feature-pill">
                  <RealtimeCollaborationIcon className="feature-pill-icon" />
                  Real-time Collaboration
                </span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-visual-wrapper">
              <div className="hero-visual-glow"></div>
              <video 
                src="/videos/Generate-button.mov" 
                className="hero-screenshot"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default LandingPage; 