import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../styles/LandingPage.css';
import Login from '../components/Login';
import UserMenu from '../components/UserMenu';
import { useAuth } from '../contexts/AuthContext';

// Import SVG icons
import { ReactComponent as InstantGenerationIcon } from '../assets/icons/instant-generation.svg';
import { ReactComponent as VisualizeConceptsIcon } from '../assets/icons/visualize-concepts.svg';
import { ReactComponent as RealtimeCollaborationIcon } from '../assets/icons/realtime-collaboration.svg';


const LandingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userTier, refreshUserData } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Check for payment success/cancel in URL params
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const sessionId = searchParams.get('session_id');
    const tier = searchParams.get('tier');
    const shouldLogin = searchParams.get('login');

    if (paymentStatus === 'success' && sessionId && user) {
      // Firestore listener will automatically update the tier when webhook processes
      // Just refresh once to get the latest (if webhook already processed)
      if (refreshUserData) {
        // Small delay to let webhook process, then refresh once
        setTimeout(async () => {
          try {
            await refreshUserData();
          } catch (error) {
            console.error('Error refreshing user tier:', error);
          }
        }, 3000); // Wait 3 seconds for webhook to process
      }
      
      // Remove query params immediately
      navigate('/', { replace: true });
    } else if (paymentStatus === 'cancelled') {
      // Remove query params for cancelled payments
      navigate('/', { replace: true });
    } else if (shouldLogin === 'true' && !user) {
      // Open login modal if login query param is present and user is not signed in
      setIsRegistering(false);
      setIsLoginOpen(true);
      // Remove query param from URL
      navigate('/', { replace: true });
    }
  }, [searchParams, user, navigate, refreshUserData]);


  const handleLoginClick = () => {
    setIsRegistering(false);
    setIsLoginOpen(true);
  };

  const handleSignupClick = () => {
    setIsRegistering(true);
    setIsLoginOpen(true);
  };

  return (
    <div className="landing-page">
      {/* Header Section */}
      <header className="header">
        <div className="header-content">
          <div className="header-logo" onClick={() => navigate('/')}>
            <img src="/logo_and_name.png" alt="Mindra" className="header-logo-img" />
          </div>
          <nav className="header-nav">
            <ul className="nav-links">
              <li><a href="/features" onClick={(e) => { e.preventDefault(); navigate('/features'); }}>Features</a></li>
              <li><a href="/use-cases" onClick={(e) => { e.preventDefault(); navigate('/use-cases'); }}>Use Cases</a></li>
              <li><a href="/technology" onClick={(e) => { e.preventDefault(); navigate('/technology'); }}>Technology</a></li>
              <li><a href="/integrations" onClick={(e) => { e.preventDefault(); navigate('/integrations'); }}>Integrations</a></li>
              <li><a href="/pricing" onClick={(e) => { e.preventDefault(); navigate('/pricing'); }}>Pricing</a></li>
            </ul>
          </nav>
          <div className="header-actions">
            {user ? (
              <UserMenu />
            ) : (
              <>
                <button className="login-button" onClick={handleLoginClick}>Log In</button>
                <button className="signup-button" onClick={handleSignupClick}>Sign Up</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Login Modal */}
      <Login 
        isOpen={isLoginOpen} 
        onClose={() => setIsLoginOpen(false)}
        fromLandingPage={true}
        initialMode={isRegistering ? 'register' : 'login'}
      />

      {/* Hero Section */}
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
              <button
                className="hero-cta-button"
                onClick={() => navigate('/whiteboard')}
              >
                <span>Start Mind Mapping Now</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
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

    </div>
  );
};

export default LandingPage; 