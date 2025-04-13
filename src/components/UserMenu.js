import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Login from './Login';
import '../styles/UserMenu.css';

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="user-menu-container">
      {user ? (
        <>
          <button 
            className="user-menu-button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <img 
              src={user.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
              alt="Profile" 
              className="user-avatar"
            />
            <span className="user-name">{user.displayName || user.email}</span>
            <span className="dropdown-arrow">▼</span>
          </button>

          {isMenuOpen && (
            <>
              <div 
                className="menu-overlay"
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="user-dropdown">
                <div className="user-info">
                  <img 
                    src={user.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
                    alt="Profile" 
                    className="user-avatar-large"
                  />
                  <div className="user-details">
                    <div className="user-display-name">
                      {user.displayName || 'User'}
                    </div>
                    <div className="user-email">
                      {user.email}
                    </div>
                  </div>
                </div>
                <div className="menu-divider" />
                <button 
                  className="menu-item"
                  onClick={handleLogout}
                >
                  <span className="menu-icon">🚪</span>
                  Sign Out
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <button 
          className="sign-in-button"
          onClick={() => setIsLoginOpen(true)}
        >
          Sign In
        </button>
      )}

      <Login 
        isOpen={isLoginOpen} 
        onClose={() => setIsLoginOpen(false)} 
      />
    </div>
  );
} 