import React, { useState, useEffect } from 'react';
import '../styles/DevelopmentBanner.css';

const DevelopmentBanner = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [isHidden, setIsHidden] = useState(false);

  const handleClose = () => {
    setIsHidden(true);
    // Add classes to adjust layout
    document.querySelector('.whiteboard-header')?.classList.add('no-banner');
    document.querySelector('.whiteboard-canvas')?.classList.add('no-banner');
    
    // Remove banner after transition
    setTimeout(() => {
      setIsVisible(false);
    }, 300);
  };

  useEffect(() => {
    // Remove classes when banner is shown
    if (isVisible) {
      document.querySelector('.whiteboard-header')?.classList.remove('no-banner');
      document.querySelector('.whiteboard-canvas')?.classList.remove('no-banner');
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className={`development-banner ${isHidden ? 'hidden' : ''}`}>
      <span>🚧 This app is under active development. Some features may not be fully functional yet. 🚧</span>
      <button 
        className="banner-close-button"
        onClick={handleClose}
        aria-label="Close banner"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  );
};

export default DevelopmentBanner; 