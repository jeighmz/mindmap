import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';
import UserMenu from '../components/UserMenu';
import { useAuth } from '../contexts/AuthContext';
import Login from '../components/Login';

const IntegrationsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

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

      {/* Integrations Section */}
      <section id="integrations" className="integrations-section">
        <div className="coming-soon-container">
          <h2 className="coming-soon-heading">Coming Soon...</h2>
          <p className="coming-soon-description">
            We're working on exciting integrations to enhance your workflow. Stay tuned!
          </p>
        </div>
      </section>
    </div>
  );
};

export default IntegrationsPage;

