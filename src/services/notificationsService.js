import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { auth, db } from '../firebase-config';

const NOTIFICATIONS_COLLECTION = 'notifications';

// Check if user is authenticated
const checkAuth = () => {
  if (!auth.currentUser) {
    throw new Error('User must be authenticated');
  }
  return auth.currentUser;
};

// Create a notification
export const createNotification = async (notificationData) => {
  try {
    checkAuth();
    
    const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
    const notification = {
      ...notificationData,
      read: false,
      createdAt: serverTimestamp()
    };
    
    const docRef = await addDoc(notificationsRef, notification);
    return {
      id: docRef.id,
      ...notification
    };
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Get user's notifications
export const getUserNotifications = async (userId, limitCount = 50) => {
  try {
    const currentUser = checkAuth();
    if (currentUser.uid !== userId) {
      throw new Error('Unauthorized access');
    }
    
    const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
    
    // Query for notifications by userId
    const q1 = query(
      notificationsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    // Also query for notifications by userEmail (for pending notifications)
    const userEmail = currentUser.email?.toLowerCase().trim();
    let q2 = null;
    if (userEmail) {
      q2 = query(
        notificationsRef,
        where('userEmail', '==', userEmail),
        where('pending', '==', true),
        orderBy('createdAt', 'desc')
      );
    }
    
    // Execute both queries
    const [querySnapshot1, querySnapshot2] = await Promise.all([
      getDocs(q1),
      q2 ? getDocs(q2) : Promise.resolve({ docs: [], empty: true })
    ]);
    
    // Combine and deduplicate notifications
    const notificationsMap = new Map();
    
    // Add notifications by userId
    querySnapshot1.docs.forEach(doc => {
      const data = doc.data();
      notificationsMap.set(doc.id, {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
      });
    });
    
    // Add pending notifications by email and convert them to userId-based
    if (querySnapshot2 && !querySnapshot2.empty) {
      const updatePromises = [];
      querySnapshot2.docs.forEach(doc => {
        const data = doc.data();
        // Convert pending notification to userId-based
        updatePromises.push(
          updateDoc(doc.ref, {
            userId: userId,
            pending: false,
            userEmail: null // Remove email field
          })
        );
        
        notificationsMap.set(doc.id, {
          id: doc.id,
          ...data,
          userId: userId, // Add userId
          pending: false,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
        });
      });
      
      // Update pending notifications in background (don't wait)
      Promise.all(updatePromises).catch(err => {
        console.error('Error updating pending notifications:', err);
      });
    }
    
    // Convert to array and sort by createdAt
    const notifications = Array.from(notificationsMap.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limitCount);
    
    return notifications;
  } catch (error) {
    console.error('Error getting notifications:', error);
    throw error;
  }
};

// Subscribe to user's notifications (real-time)
export const subscribeToNotifications = (userId, callback) => {
  try {
    const currentUser = checkAuth();
    if (currentUser.uid !== userId) {
      throw new Error('Unauthorized access');
    }
    
    const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
    const userEmail = currentUser.email?.toLowerCase().trim();
    
    // Subscribe to notifications by userId
    const q1 = query(
      notificationsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    // Also subscribe to pending notifications by email if available
    let q2 = null;
    let unsubscribe2 = null;
    if (userEmail) {
      q2 = query(
        notificationsRef,
        where('userEmail', '==', userEmail),
        where('pending', '==', true),
        orderBy('createdAt', 'desc')
      );
    }
    
    const mergeAndCallback = (snapshot1, snapshot2 = null) => {
      const notificationsMap = new Map();
      
      // Add notifications by userId
      if (snapshot1) {
        snapshot1.docs.forEach(doc => {
          const data = doc.data();
          notificationsMap.set(doc.id, {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
          });
        });
      }
      
      // Add pending notifications by email
      if (snapshot2 && !snapshot2.empty) {
        snapshot2.docs.forEach(doc => {
          const data = doc.data();
          // Convert to userId-based format
          notificationsMap.set(doc.id, {
            id: doc.id,
            ...data,
            userId: userId,
            pending: false,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
          });
          
          // Update in background to convert to userId-based
          updateDoc(doc.ref, {
            userId: userId,
            pending: false,
            userEmail: null
          }).catch(err => console.error('Error updating pending notification:', err));
        });
      }
      
      const notifications = Array.from(notificationsMap.values())
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 50);
      
      callback(notifications);
    };
    
    // Subscribe to userId-based notifications
    const unsubscribe1 = onSnapshot(q1, (snapshot1) => {
      if (q2) {
        // Get pending notifications too
        getDocs(q2).then(snapshot2 => {
          mergeAndCallback(snapshot1, snapshot2);
        }).catch(err => {
          console.error('Error getting pending notifications:', err);
          mergeAndCallback(snapshot1);
        });
      } else {
        mergeAndCallback(snapshot1);
      }
    }, (error) => {
      console.error('Error in notifications subscription:', error);
      callback([]);
    });
    
    // Return combined unsubscribe function
    return () => {
      unsubscribe1();
      if (unsubscribe2) unsubscribe2();
    };
  } catch (error) {
    console.error('Error subscribing to notifications:', error);
    return () => {}; // Return empty unsubscribe function
  }
};

// Mark notification as read
export const markNotificationRead = async (notificationId) => {
  try {
    const currentUser = checkAuth();
    
    const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    const notificationDoc = await getDoc(notificationRef);
    
    if (!notificationDoc.exists()) {
      throw new Error('Notification not found');
    }
    
    const notificationData = notificationDoc.data();
    if (notificationData.userId !== currentUser.uid) {
      throw new Error('Unauthorized access');
    }
    
    await updateDoc(notificationRef, {
      read: true
    });
    
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

// Mark all notifications as read
export const markAllNotificationsRead = async (userId) => {
  try {
    const currentUser = checkAuth();
    if (currentUser.uid !== userId) {
      throw new Error('Unauthorized access');
    }
    
    const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
    const q = query(
      notificationsRef,
      where('userId', '==', userId),
      where('read', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    const updatePromises = querySnapshot.docs.map(doc => {
      return updateDoc(doc.ref, { read: true });
    });
    
    await Promise.all(updatePromises);
    return true;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

// Delete a notification
export const deleteNotification = async (notificationId) => {
  try {
    const currentUser = checkAuth();
    
    const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    const notificationDoc = await getDoc(notificationRef);
    
    if (!notificationDoc.exists()) {
      throw new Error('Notification not found');
    }
    
    const notificationData = notificationDoc.data();
    if (notificationData.userId !== currentUser.uid) {
      throw new Error('Unauthorized access');
    }
    
    await deleteDoc(notificationRef);
    return true;
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

// Get unread notification count
export const getUnreadCount = async (userId) => {
  try {
    const currentUser = checkAuth();
    if (currentUser.uid !== userId) {
      throw new Error('Unauthorized access');
    }
    
    const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
    const q = query(
      notificationsRef,
      where('userId', '==', userId),
      where('read', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

