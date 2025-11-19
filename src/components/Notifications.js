import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getUserNotifications,
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification
} from '../services/notificationsService';
import '../styles/Notifications.css';

const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    // Initial load - load notifications first, then count will be synced
    loadNotifications();

    // Subscribe to real-time updates
    const unsubscribe = subscribeToNotifications(user.uid, (updatedNotifications) => {
      setNotifications(updatedNotifications);
      // Always sync unread count with the actual notifications array
      const unread = updatedNotifications.filter(n => !n.read).length;
      setUnreadCount(unread);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  // Position dropdown dynamically
  useEffect(() => {
    if (!isOpen || !containerRef.current || !dropdownRef.current) return;

    const updatePosition = () => {
      const containerRect = containerRef.current.getBoundingClientRect();
      const dropdown = dropdownRef.current;
      if (!dropdown) return;
      
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        const dropdownHeight = dropdown.offsetHeight || 600; // fallback to max-height
        const dropdownWidth = dropdown.offsetWidth || 380;
        
        // Calculate position
        let top = containerRect.bottom + 8;
        let right = window.innerWidth - containerRect.right;
        
        // Adjust if dropdown would go off bottom of screen
        if (top + dropdownHeight > window.innerHeight - 20) {
          top = containerRect.top - dropdownHeight - 8;
          // If still off screen, position from top
          if (top < 20) {
            top = 20;
          }
        }
        
        // Adjust if dropdown would go off right side of screen
        if (right + dropdownWidth > window.innerWidth - 20) {
          right = window.innerWidth - containerRect.right - dropdownWidth;
          // If still off screen, position from right edge
          if (right < 20) {
            right = 20;
          }
        }
        
        dropdown.style.top = `${top}px`;
        dropdown.style.right = `${right}px`;
      });
    };

    // Initial position
    updatePosition();

    // Update on window resize
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, notifications]);

  const loadNotifications = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const notifs = await getUserNotifications(user.uid);
      setNotifications(notifs);
      // Sync unread count with loaded notifications
      const unread = notifs.filter(n => !n.read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };


  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      try {
        await markNotificationRead(notification.id);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    setIsOpen(false);

    // Navigate if actionUrl exists
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;

    try {
      await markAllNotificationsRead(user.uid);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleDelete = async (e, notificationId) => {
    e.stopPropagation();
    
    if (!user) return;

    try {
      await deleteNotification(notificationId);
      setNotifications(prev => {
        const filtered = prev.filter(n => n.id !== notificationId);
        const unread = filtered.filter(n => !n.read).length;
        setUnreadCount(unread);
        return filtered;
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const formatTime = (date) => {
    if (!date) return '';
    
    const now = new Date();
    const notificationDate = date instanceof Date ? date : new Date(date);
    const diffMs = now - notificationDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return notificationDate.toLocaleDateString();
  };

  if (!user) return null;

  const unreadNotifications = notifications.filter(n => !n.read);

  return (
    <div className="notifications-container" ref={containerRef}>
      <button
        className="notifications-menu-item"
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
      >
        <span className="menu-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </span>
        <span className="notifications-menu-text">Notifications</span>
        {unreadCount > 0 && (
          <span className="notifications-badge-menu">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="notifications-overlay" onClick={() => setIsOpen(false)} />
          <div className="notifications-dropdown" ref={dropdownRef}>
            <div className="notifications-header">
              <h3>Notifications</h3>
              {unreadNotifications.length > 0 && (
                <button
                  className="mark-all-read-button"
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="notifications-list">
              {isLoading ? (
                <div className="notifications-loading">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="notifications-empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                  <p>No notifications</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${!notification.read ? 'unread' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="notification-content">
                      <div className="notification-title">{notification.title}</div>
                      <div className="notification-message">{notification.message}</div>
                      <div className="notification-time">{formatTime(notification.createdAt)}</div>
                    </div>
                    <div className="notification-actions">
                      {!notification.read && (
                        <div className="unread-indicator" />
                      )}
                      <button
                        className="delete-notification-button"
                        onClick={(e) => handleDelete(e, notification.id)}
                        title="Delete notification"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Notifications;

