import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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

const Notifications = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

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

    onClose();

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

  if (!isOpen) return null;

  const unreadNotifications = notifications.filter(n => !n.read);

  const modalContent = !user ? (
    <div className="notifications-modal" onClick={(e) => {
        if (e.target.classList.contains('notifications-modal')) {
          onClose();
        }
      }}>
        <div className="notifications-content-wrapper">
          <div className="notifications-header">
            <h3>Notifications</h3>
            <button className="notifications-close" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="notifications-body">
            <div className="message error">
              Please sign in to view notifications
            </div>
          </div>
        </div>
      </div>
    ) : (
    <div className="notifications-modal" onClick={(e) => {
      if (e.target.classList.contains('notifications-modal')) {
        onClose();
      }
    }}>
      <div className="notifications-content-wrapper">
        <div className="notifications-header">
          <h3>Notifications</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {unreadNotifications.length > 0 && (
              <button
                className="mark-all-read-button"
                onClick={handleMarkAllRead}
                title="Mark all as read"
              >
                Mark all read
              </button>
            )}
            <button className="notifications-close" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <div className="notifications-body">
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
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default Notifications;

// Export hook to get unread count for badge display
export const useNotificationsBadge = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const unsubscribe = subscribeToNotifications(user.uid, (notifications) => {
      const unread = notifications.filter(n => !n.read).length;
      setUnreadCount(unread);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  return unreadCount;
};

