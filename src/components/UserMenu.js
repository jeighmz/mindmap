import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfilePicture, handleImageError } from '../utils/profilePicture';
import Login from './Login';
import Settings from './Settings';
import Notifications, { useNotificationsBadge } from './Notifications';
import '../styles/UserMenu.css';

export default function UserMenu({ onSettingsOpen }) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const unreadCount = useNotificationsBadge();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const isWhiteboardPage = location.pathname === '/whiteboard' || location.pathname.startsWith('/whiteboard/');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleUpgradeClick = () => {
    setIsSettingsOpen(false);
    navigate('/pricing');
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
              src={getUserProfilePicture(user)} 
              alt="Profile" 
              className="user-avatar"
              onError={(e) => handleImageError(e, user)}
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
                    src={getUserProfilePicture(user)} 
                    alt="Profile" 
                    className="user-avatar-large"
                    onError={(e) => handleImageError(e, user)}
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
                  onClick={() => setIsNotificationsOpen(true)}
                  title="Notifications"
                  style={{ position: 'relative' }}
                >
                  <span className="menu-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                  </span>
                  Notifications
                  {unreadCount > 0 && (
                    <span style={{
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      color: 'white',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '10px',
                      minWidth: '18px',
                      textAlign: 'center',
                      boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)',
                      lineHeight: '1.2',
                      marginLeft: 'auto'
                    }}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                {isWhiteboardPage && (
                  <button 
                    className="menu-item"
                    onClick={() => {
                      if (onSettingsOpen) {
                        onSettingsOpen();
                      }
                      setIsSettingsOpen(true);
                      setIsMenuOpen(false);
                    }}
                  >
                    <span className="menu-icon">
                      <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                    </span>
                    Settings
                  </button>
                )}
                <button 
                  className="menu-item"
                  onClick={handleLogout}
                >
                  <span className="menu-icon">
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </span>
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
      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onUpgradeClick={handleUpgradeClick}
      />
      <Notifications
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
    </div>
  );
} 