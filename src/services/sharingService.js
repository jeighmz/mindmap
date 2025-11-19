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
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase-config';

const BOARD_SHARES_COLLECTION = 'boardShares';
const BOARDS_COLLECTION = 'boards';
const USERS_COLLECTION = 'users';
const NOTIFICATIONS_COLLECTION = 'notifications';

// Check if user is authenticated
const checkAuth = () => {
  if (!auth.currentUser) {
    throw new Error('User must be authenticated');
  }
  return auth.currentUser;
};

// Find user by email in Firestore
const findUserByEmail = async (email) => {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, where('email', '==', email.toLowerCase().trim()));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const userDoc = querySnapshot.docs[0];
    return {
      uid: userDoc.id,
      ...userDoc.data()
    };
  } catch (error) {
    console.error('Error finding user by email:', error);
    throw error;
  }
};

// Share a board with a user by email
export const shareBoard = async (boardId, email, permission = 'viewer') => {
  try {
    const currentUser = checkAuth();
    
    if (!boardId) {
      throw new Error('Board ID is required');
    }
    
    if (!email || !email.trim()) {
      throw new Error('Email is required');
    }
    
    // Verify board exists and user owns it
    const boardRef = doc(db, BOARDS_COLLECTION, boardId);
    const boardDoc = await getDoc(boardRef);
    
    if (!boardDoc.exists()) {
      throw new Error('Board not found');
    }
    
    const boardData = boardDoc.data();
    if (boardData.userId !== currentUser.uid) {
      throw new Error('You do not have permission to share this board');
    }
    
    // Check if already shared with this email
    const sharesRef = collection(db, BOARD_SHARES_COLLECTION);
    const existingShareQuery = query(
      sharesRef,
      where('boardId', '==', boardId),
      where('boardOwnerId', '==', currentUser.uid),
      where('sharedWithEmail', '==', email.toLowerCase().trim())
    );
    const existingShares = await getDocs(existingShareQuery);
    
    if (!existingShares.empty) {
      throw new Error('Board is already shared with this email');
    }
    
    // Find user by email
    const targetUser = await findUserByEmail(email);
    
    const shareData = {
      boardId,
      boardOwnerId: currentUser.uid,
      sharedWithEmail: email.toLowerCase().trim(),
      sharedWithUserId: targetUser ? targetUser.uid : null,
      permission: permission === 'editor' ? 'editor' : 'viewer',
      status: targetUser ? 'accepted' : 'pending',
      sharedAt: serverTimestamp(),
      invitedBy: currentUser.uid
    };
    
    // Create share document
    const shareDocRef = await addDoc(sharesRef, shareData);
    
    // Update board to include sharedWith array
    const sharedWith = boardData.sharedWith || [];
    if (targetUser && !sharedWith.includes(targetUser.uid)) {
      sharedWith.push(targetUser.uid);
    }
    
    await updateDoc(boardRef, {
      sharedWith,
      isShared: true
    });
    
    // Create notification - try to find user, but create notification even if not found
    // This handles cases where user exists but isn't in users collection yet
    const boardName = boardData.name || 'Untitled Board';
    const fromUserName = currentUser.displayName || currentUser.email;
    
    if (targetUser) {
      // User found - create notification with userId
      await createShareNotification(
        targetUser.uid,
        currentUser.uid,
        fromUserName,
        boardId,
        boardName,
        permission
      );
    } else {
      // User not found in users collection - try to create notification by email
      // This will work if the user signs up later and we can match by email
      console.warn(`User not found for email: ${email}. Creating notification by email.`);
      await createShareNotificationByEmail(
        email.toLowerCase().trim(),
        currentUser.uid,
        fromUserName,
        boardId,
        boardName,
        permission
      );
    }
    
    return {
      id: shareDocRef.id,
      ...shareData
    };
  } catch (error) {
    console.error('Error sharing board:', error);
    throw error;
  }
};

// Create notification helper (by userId)
const createShareNotification = async (userId, fromUserId, fromUserName, boardId, boardName, permission) => {
  try {
    const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
    const notificationData = {
      userId,
      type: 'board_shared',
      title: 'Board Shared',
      message: `${fromUserName} shared "${boardName}" with you (${permission})`,
      boardId,
      boardName,
      fromUserId,
      fromUserName,
      read: false,
      createdAt: serverTimestamp(),
      actionUrl: `/whiteboard/${boardId}`
    };
    
    const docRef = await addDoc(notificationsRef, notificationData);
    console.log('Notification created successfully:', docRef.id, 'for user:', userId);
    return docRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    console.error('Notification data:', { userId, boardId, boardName });
    // Don't throw - notification failure shouldn't break sharing
    // But log it so we can debug
  }
};

// Create notification helper (by email - for users not yet in users collection)
const createShareNotificationByEmail = async (email, fromUserId, fromUserName, boardId, boardName, permission) => {
  try {
    // Try to find user again (might have been created between share and notification)
    const targetUser = await findUserByEmail(email);
    
    if (targetUser) {
      // User found now - create with userId
      return await createShareNotification(
        targetUser.uid,
        fromUserId,
        fromUserName,
        boardId,
        boardName,
        permission
      );
    }
    
    // User still not found - create notification with email as identifier
    // This will be matched when user signs up
    const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
    const notificationData = {
      userEmail: email, // Store email instead of userId
      type: 'board_shared',
      title: 'Board Shared',
      message: `${fromUserName} shared "${boardName}" with you (${permission})`,
      boardId,
      boardName,
      fromUserId,
      fromUserName,
      read: false,
      createdAt: serverTimestamp(),
      actionUrl: `/whiteboard/${boardId}`,
      pending: true // Mark as pending until user signs up
    };
    
    const docRef = await addDoc(notificationsRef, notificationData);
    console.log('Pending notification created by email:', docRef.id, 'for email:', email);
    return docRef.id;
  } catch (error) {
    console.error('Error creating notification by email:', error);
    console.error('Notification data:', { email, boardId, boardName });
    // Don't throw - notification failure shouldn't break sharing
  }
};

// Unshare a board (remove user's access)
export const unshareBoard = async (boardId, shareId) => {
  try {
    const currentUser = checkAuth();
    
    // Verify share exists and user owns the board
    const shareRef = doc(db, BOARD_SHARES_COLLECTION, shareId);
    const shareDoc = await getDoc(shareRef);
    
    if (!shareDoc.exists()) {
      throw new Error('Share not found');
    }
    
    const shareData = shareDoc.data();
    if (shareData.boardOwnerId !== currentUser.uid) {
      throw new Error('You do not have permission to unshare this board');
    }
    
    // Remove from board's sharedWith array
    const boardRef = doc(db, BOARDS_COLLECTION, boardId);
    const boardDoc = await getDoc(boardRef);
    
    if (boardDoc.exists()) {
      const boardData = boardDoc.data();
      const sharedWith = (boardData.sharedWith || []).filter(
        uid => uid !== shareData.sharedWithUserId
      );
      
      await updateDoc(boardRef, {
        sharedWith,
        isShared: sharedWith.length > 0
      });
    }
    
    // Delete share document
    await deleteDoc(shareRef);
    
    return true;
  } catch (error) {
    console.error('Error unsharing board:', error);
    throw error;
  }
};

// Get boards shared with current user
export const getSharedBoards = async (userId) => {
  try {
    const currentUser = checkAuth();
    if (currentUser.uid !== userId) {
      throw new Error('Unauthorized access');
    }
    
    const sharesRef = collection(db, BOARD_SHARES_COLLECTION);
    const q = query(
      sharesRef,
      where('sharedWithUserId', '==', userId),
      where('status', '==', 'accepted')
    );
    
    const querySnapshot = await getDocs(q);
    const shareIds = querySnapshot.docs.map(doc => doc.data().boardId);
    
    if (shareIds.length === 0) {
      return [];
    }
    
    // Fetch board documents
    const boards = [];
    for (const boardId of shareIds) {
      try {
        const boardRef = doc(db, BOARDS_COLLECTION, boardId);
        const boardDoc = await getDoc(boardRef);
        
        if (boardDoc.exists()) {
          const shareDoc = querySnapshot.docs.find(
            doc => doc.data().boardId === boardId
          );
          const shareData = shareDoc?.data();
          
          boards.push({
            id: boardDoc.id,
            ...boardDoc.data(),
            shareId: shareDoc?.id,
            sharePermission: shareData?.permission || 'viewer',
            isShared: true
          });
        }
      } catch (error) {
        console.error(`Error fetching board ${boardId}:`, error);
      }
    }
    
    return boards;
  } catch (error) {
    console.error('Error getting shared boards:', error);
    throw error;
  }
};

// Get collaborators for a board
export const getBoardCollaborators = async (boardId) => {
  try {
    const currentUser = checkAuth();
    
    // Verify user has access to board
    const boardRef = doc(db, BOARDS_COLLECTION, boardId);
    const boardDoc = await getDoc(boardRef);
    
    if (!boardDoc.exists()) {
      throw new Error('Board not found');
    }
    
    const boardData = boardDoc.data();
    const hasAccess = boardData.userId === currentUser.uid || 
                     (boardData.sharedWith || []).includes(currentUser.uid);
    
    if (!hasAccess) {
      throw new Error('You do not have access to this board');
    }
    
    // Get all shares for this board
    // Query by boardOwnerId to ensure we can read them (user owns the board)
    const sharesRef = collection(db, BOARD_SHARES_COLLECTION);
    const q = query(
      sharesRef, 
      where('boardId', '==', boardId),
      where('boardOwnerId', '==', currentUser.uid)
    );
    const querySnapshot = await getDocs(q);
    
    const collaborators = [];
    
    // Add owner
    if (boardData.userId) {
      try {
        const ownerRef = doc(db, USERS_COLLECTION, boardData.userId);
        const ownerDoc = await getDoc(ownerRef);
        if (ownerDoc.exists()) {
          const ownerData = ownerDoc.data();
          collaborators.push({
            userId: boardData.userId,
            email: ownerData.email,
            displayName: ownerData.displayName,
            photoURL: ownerData.photoURL,
            permission: 'owner',
            isOwner: true
          });
        }
      } catch (error) {
        console.error('Error fetching owner:', error);
      }
    }
    
    // Add shared users
    for (const shareDoc of querySnapshot.docs) {
      const shareData = shareDoc.data();
      if (shareData.sharedWithUserId && shareData.status === 'accepted') {
        try {
          const userRef = doc(db, USERS_COLLECTION, shareData.sharedWithUserId);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            collaborators.push({
              userId: shareData.sharedWithUserId,
              email: userData.email,
              displayName: userData.displayName,
              photoURL: userData.photoURL,
              permission: shareData.permission || 'viewer',
              shareId: shareDoc.id,
              isOwner: false
            });
          }
        } catch (error) {
          console.error('Error fetching collaborator:', error);
        }
      }
    }
    
    return collaborators;
  } catch (error) {
    console.error('Error getting board collaborators:', error);
    throw error;
  }
};

// Update share permission
export const updateSharePermission = async (shareId, permission) => {
  try {
    const currentUser = checkAuth();
    
    if (permission !== 'viewer' && permission !== 'editor') {
      throw new Error('Invalid permission. Must be "viewer" or "editor"');
    }
    
    const shareRef = doc(db, BOARD_SHARES_COLLECTION, shareId);
    const shareDoc = await getDoc(shareRef);
    
    if (!shareDoc.exists()) {
      throw new Error('Share not found');
    }
    
    const shareData = shareDoc.data();
    if (shareData.boardOwnerId !== currentUser.uid) {
      throw new Error('You do not have permission to update this share');
    }
    
    await updateDoc(shareRef, {
      permission: permission
    });
    
    return true;
  } catch (error) {
    console.error('Error updating share permission:', error);
    throw error;
  }
};

// Accept a board share invitation
export const acceptBoardShare = async (shareId) => {
  try {
    const currentUser = checkAuth();
    
    const shareRef = doc(db, BOARD_SHARES_COLLECTION, shareId);
    const shareDoc = await getDoc(shareRef);
    
    if (!shareDoc.exists()) {
      throw new Error('Share not found');
    }
    
    const shareData = shareDoc.data();
    if (shareData.sharedWithUserId !== currentUser.uid) {
      throw new Error('This share is not for you');
    }
    
    // Update share status
    await updateDoc(shareRef, {
      status: 'accepted'
    });
    
    // Update board's sharedWith array
    const boardRef = doc(db, BOARDS_COLLECTION, shareData.boardId);
    const boardDoc = await getDoc(boardRef);
    
    if (boardDoc.exists()) {
      const boardData = boardDoc.data();
      const sharedWith = boardData.sharedWith || [];
      if (!sharedWith.includes(currentUser.uid)) {
        sharedWith.push(currentUser.uid);
      }
      
      await updateDoc(boardRef, {
        sharedWith,
        isShared: true
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error accepting board share:', error);
    throw error;
  }
};

