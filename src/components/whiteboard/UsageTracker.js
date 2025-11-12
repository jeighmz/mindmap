import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getUsageStats } from '../../utils/usageTracker';
import '../../styles/UsageTracker.css';

const UsageTracker = ({ isSearchPanelOpen = false }) => {
  const { user } = useAuth();
  const [usageStats, setUsageStats] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Check if any modal is open
  useEffect(() => {
    const checkModal = () => {
      // Check for modal overlay or modal container
      const modalOverlay = document.querySelector('.modal-overlay');
      const modalContainer = document.querySelector('.modal-container');
      const hasModal = !!(modalOverlay || modalContainer);
      setIsModalOpen(hasModal);
    };

    // Check immediately
    checkModal();

    // Use MutationObserver to watch for modal changes
    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    // Also poll as a fallback
    const interval = setInterval(checkModal, 200);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    // Immediately clear and return if user is signed in
    if (user) {
      setUsageStats(null);
      return;
    }

    // Only set up tracking for non-signed-in users
    const updateStats = () => {
      // Double-check user is still not signed in
      if (!user) {
        setUsageStats(getUsageStats());
      }
    };

    // Initial load
    updateStats();

    // Update when storage changes (in case of multiple tabs)
    const handleStorageChange = (e) => {
      if (e.key === 'mindmap_usage_tracker' || !e.key) {
        if (!user) {
          updateStats();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Poll for changes (since localStorage events don't fire in same tab)
    const interval = setInterval(() => {
      if (!user) {
        updateStats();
      }
    }, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [user]);

  // CRITICAL: Always check user first - don't render if user is signed in
  if (user) {
    return null;
  }

  // Don't render if modal is open
  if (isModalOpen) {
    return null;
  }

  // Don't render if stats haven't loaded yet
  if (!usageStats) {
    return null;
  }

  const { mindMapsGenerated, conceptsExpanded, queriesSent, mindMapLimit, expandLimit, queryLimit, remainingMindMaps, remainingExpands, remainingQueries } = usageStats;

  return (
    <div className={`usage-tracker ${isSearchPanelOpen ? 'panel-open' : ''}`}>
      <div className="usage-tracker-header">
        <span className="usage-tracker-title">Usage Limit</span>
        <span className="usage-tracker-signin-hint">Sign in for unlimited access</span>
      </div>
      <div className="usage-tracker-stats">
        <div className="usage-stat">
          <div className="usage-stat-label">
            <span>Mind Maps</span>
            <span className="usage-stat-count">{mindMapsGenerated}/{mindMapLimit}</span>
          </div>
          <div className="usage-stat-bar">
            <div 
              className="usage-stat-fill" 
              style={{ 
                width: `${(mindMapsGenerated / mindMapLimit) * 100}%`,
                backgroundColor: remainingMindMaps === 0 ? '#f44336' : remainingMindMaps <= 1 ? '#ff9800' : '#4caf50'
              }}
            />
          </div>
          <div className="usage-stat-remaining">
            {remainingMindMaps > 0 ? `${remainingMindMaps} remaining` : 'Limit reached'}
          </div>
        </div>
        <div className="usage-stat">
          <div className="usage-stat-label">
            <span>Expansions</span>
            <span className="usage-stat-count">{conceptsExpanded}/{expandLimit}</span>
          </div>
          <div className="usage-stat-bar">
            <div 
              className="usage-stat-fill" 
              style={{ 
                width: `${(conceptsExpanded / expandLimit) * 100}%`,
                backgroundColor: remainingExpands === 0 ? '#f44336' : remainingExpands <= 1 ? '#ff9800' : '#4caf50'
              }}
            />
          </div>
          <div className="usage-stat-remaining">
            {remainingExpands > 0 ? `${remainingExpands} remaining` : 'Limit reached'}
          </div>
        </div>
        <div className="usage-stat">
          <div className="usage-stat-label">
            <span>AI Queries</span>
            <span className="usage-stat-count">{queriesSent}/{queryLimit}</span>
          </div>
          <div className="usage-stat-bar">
            <div 
              className="usage-stat-fill" 
              style={{ 
                width: `${(queriesSent / queryLimit) * 100}%`,
                backgroundColor: remainingQueries === 0 ? '#f44336' : remainingQueries <= 1 ? '#ff9800' : '#4caf50'
              }}
            />
          </div>
          <div className="usage-stat-remaining">
            {remainingQueries > 0 ? `${remainingQueries} remaining` : 'Limit reached'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageTracker;

