import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import '../styles/LandingPage.css';
import Login from '../components/Login';
import UserMenu from '../components/UserMenu';
import { useAuth } from '../contexts/AuthContext';

export default function MarketingLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const isHome = location.pathname === '/';

  useEffect(() => {
    if (searchParams.get('login') === 'true' && !user) {
      setIsRegistering(false);
      setIsLoginOpen(true);
      navigate({ pathname: location.pathname, search: '' }, { replace: true });
    }
  }, [searchParams, user, navigate, location.pathname]);

  const openLogin = (register = false) => {
    setIsRegistering(register);
    setIsLoginOpen(true);
  };

  return (
    <div className={`landing-page${isHome ? ' landing-page-over-hero' : ''}`}>
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
            <a
              href="https://x.com/aimindmap"
              target="_blank"
              rel="noopener noreferrer"
              className="header-x-link"
              aria-label="Follow us on X"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            {user ? (
              <UserMenu />
            ) : (
              <>
                <button type="button" className="login-button" onClick={() => openLogin(false)}>Log In</button>
                <button type="button" className="signup-button" onClick={() => openLogin(true)}>Sign Up</button>
              </>
            )}
          </div>
        </div>
      </header>

      <Login
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        fromLandingPage
        initialMode={isRegistering ? 'register' : 'login'}
      />

      <Outlet context={{ openLogin }} />
    </div>
  );
}
