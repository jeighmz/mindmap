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
  serverTimestamp,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase-config';

const BOARD_PRESENCE_COLLECTION = 'boardPresence';

// Check if user is authenticated
const checkAuth = () => {
  if (!auth.currentUser) {
    throw new Error('User must be authenticated');
  }
  return auth.currentUser;
};

// Join a board (set presence)
export const joinBoard = async (boardId, userData) => {
  try {
    const currentUser = checkAuth();
    
    if (!boardId) {
      throw new Error('Board ID is required');
    }
    
    // Check if presence already exists
    const presenceRef = collection(db, BOARD_PRESENCE_COLLECTION);
    const q = query(
      presenceRef,
      where('boardId', '==', boardId),
      where('userId', '==', currentUser.uid)
    );
    const existingPresence = await getDocs(q);
    
    if (!existingPresence.empty) {
      // Update existing presence
      const presenceDoc = existingPresence.docs[0];
      const existingData = presenceDoc.data();
      // Preserve existing photoURL if new one is not provided
      const photoURL = userData.photoURL || existingData.userPhotoURL || null;
      await updateDoc(presenceDoc.ref, {
        isActive: true,
        lastSeen: serverTimestamp(),
        userName: userData.displayName || userData.email || existingData.userName,
        userEmail: userData.email || existingData.userEmail,
        userPhotoURL: photoURL
      });
      return presenceDoc.id;
    }
    
    // Create new presence
    const presenceData = {
      boardId,
      userId: currentUser.uid,
      userName: userData.displayName || userData.email,
      userEmail: userData.email,
      userPhotoURL: userData.photoURL || null,
      lastSeen: serverTimestamp(),
      isActive: true,
      cursorPosition: null,
      cursorColor: userData.cursorColor || null
    };
    
    const docRef = await addDoc(presenceRef, presenceData);
    return docRef.id;
  } catch (error) {
    console.error('Error joining board:', error);
    throw error;
  }
};

// Leave a board (remove presence)
export const leaveBoard = async (boardId, presenceId) => {
  try {
    const currentUser = checkAuth();
    
    if (presenceId) {
      const presenceRef = doc(db, BOARD_PRESENCE_COLLECTION, presenceId);
      const presenceDoc = await getDoc(presenceRef);
      
      if (presenceDoc.exists() && presenceDoc.data().userId === currentUser.uid) {
        await deleteDoc(presenceRef);
      }
    } else {
      // Fallback: find and delete by boardId and userId
      const presenceRef = collection(db, BOARD_PRESENCE_COLLECTION);
      const q = query(
        presenceRef,
        where('boardId', '==', boardId),
        where('userId', '==', currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    }
    
    return true;
  } catch (error) {
    console.error('Error leaving board:', error);
    throw error;
  }
};

// Update presence (heartbeat)
export const updatePresence = async (boardId, presenceId, cursorPosition = null) => {
  try {
    const currentUser = checkAuth();
    
    if (!presenceId) {
      // Try to find existing presence
      const presenceRef = collection(db, BOARD_PRESENCE_COLLECTION);
      const q = query(
        presenceRef,
        where('boardId', '==', boardId),
        where('userId', '==', currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        presenceId = querySnapshot.docs[0].id;
      } else {
        // No presence found, create one
        const user = auth.currentUser;
        return await joinBoard(boardId, {
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL
        });
      }
    }
    
    const presenceRef = doc(db, BOARD_PRESENCE_COLLECTION, presenceId);
    const presenceDoc = await getDoc(presenceRef);
    
    if (presenceDoc.exists() && presenceDoc.data().userId === currentUser.uid) {
      const updateData = {
        lastSeen: serverTimestamp(),
        isActive: true
      };
      
      // Update cursor position if provided
      if (cursorPosition !== null) {
        updateData.cursorPosition = cursorPosition;
      }
      
      await updateDoc(presenceRef, updateData);
    }
    
    return presenceId;
  } catch (error) {
    console.error('Error updating presence:', error);
    throw error;
  }
};

// Get active collaborators for a board
export const getActiveCollaborators = async (boardId) => {
  try {
    checkAuth();
    
    const presenceRef = collection(db, BOARD_PRESENCE_COLLECTION);
    const q = query(
      presenceRef,
      where('boardId', '==', boardId),
      where('isActive', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    const collaborators = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        userName: data.userName,
        userEmail: data.userEmail,
        userPhotoURL: data.userPhotoURL,
        lastSeen: data.lastSeen?.toDate ? data.lastSeen.toDate() : new Date(data.lastSeen),
        cursorPosition: data.cursorPosition || null,
        cursorColor: data.cursorColor || null
      };
    });
    
    // Filter out inactive (last seen > 2 minutes ago)
    const now = new Date();
    const activeCollaborators = collaborators.filter(collab => {
      const timeSinceLastSeen = now - collab.lastSeen;
      return timeSinceLastSeen < 120000; // 2 minutes
    });
    
    return activeCollaborators;
  } catch (error) {
    console.error('Error getting active collaborators:', error);
    return [];
  }
};

// Subscribe to active collaborators (real-time)
export const subscribeToCollaborators = (boardId, callback) => {
  try {
    checkAuth();
    
    const presenceRef = collection(db, BOARD_PRESENCE_COLLECTION);
    const q = query(
      presenceRef,
      where('boardId', '==', boardId),
      where('isActive', '==', true)
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const now = new Date();
      const collaborators = querySnapshot.docs
        .map(doc => {
          const data = doc.data();
          const lastSeen = data.lastSeen?.toDate ? data.lastSeen.toDate() : new Date(data.lastSeen);
          return {
            id: doc.id,
            userId: data.userId,
            userName: data.userName,
            userEmail: data.userEmail,
            userPhotoURL: data.userPhotoURL,
            lastSeen,
            cursorPosition: data.cursorPosition || null,
            cursorColor: data.cursorColor || null
          };
        })
        .filter(collab => {
          // Filter out inactive (last seen > 2 minutes ago)
          const timeSinceLastSeen = now - collab.lastSeen;
          return timeSinceLastSeen < 120000; // 2 minutes
        });
      
      callback(collaborators);
    }, (error) => {
      console.error('Error in collaborators subscription:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to collaborators:', error);
    return () => {}; // Return empty unsubscribe function
  }
};

// Clean up inactive presences (should be called periodically)
export const cleanupInactivePresences = async (boardId) => {
  try {
    checkAuth();
    
    const presenceRef = collection(db, BOARD_PRESENCE_COLLECTION);
    const q = query(
      presenceRef,
      where('boardId', '==', boardId)
    );
    
    const querySnapshot = await getDocs(q);
    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 120000);
    
    const deletePromises = querySnapshot.docs
      .filter(doc => {
        const data = doc.data();
        const lastSeen = data.lastSeen?.toDate ? data.lastSeen.toDate() : new Date(data.lastSeen);
        return lastSeen < twoMinutesAgo;
      })
      .map(doc => deleteDoc(doc.ref));
    
    await Promise.all(deletePromises);
    return true;
  } catch (error) {
    console.error('Error cleaning up inactive presences:', error);
    throw error;
  }
};

