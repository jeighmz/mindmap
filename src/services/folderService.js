import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase-config';

const FOLDERS_COLLECTION = 'folders';
const BOARDS_COLLECTION = 'boards';

// Check if user is authenticated
const checkAuth = () => {
  if (!auth.currentUser) {
    throw new Error('User must be authenticated');
  }
  return auth.currentUser;
};

// Create a new folder
export const createFolder = async (name, parentFolderId = null) => {
  try {
    const currentUser = checkAuth();
    
    if (!name || !name.trim()) {
      throw new Error('Folder name is required');
    }

    const folderData = {
      name: name.trim(),
      userId: currentUser.uid,
      parentFolderId: parentFolderId || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const folderRef = await addDoc(collection(db, FOLDERS_COLLECTION), folderData);
    
    return {
      id: folderRef.id,
      ...folderData
    };
  } catch (error) {
    console.error('Error creating folder:', error);
    throw error;
  }
};

// Get all folders for a user
export const getUserFolders = async (userId) => {
  try {
    const currentUser = checkAuth();
    if (currentUser.uid !== userId) {
      throw new Error('Unauthorized access');
    }

    const foldersRef = collection(db, FOLDERS_COLLECTION);
    const foldersQuery = query(
      foldersRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(foldersQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting folders:', error);
    throw error;
  }
};

// Update folder name
export const updateFolder = async (folderId, newName) => {
  try {
    const currentUser = checkAuth();
    
    if (!newName || !newName.trim()) {
      throw new Error('Folder name is required');
    }

    const folderRef = doc(db, FOLDERS_COLLECTION, folderId);
    const folderDoc = await getDoc(folderRef);

    if (!folderDoc.exists()) {
      throw new Error('Folder not found');
    }

    const folderData = folderDoc.data();
    if (folderData.userId !== currentUser.uid) {
      throw new Error('You do not have permission to update this folder');
    }

    await updateDoc(folderRef, {
      name: newName.trim(),
      updatedAt: serverTimestamp()
    });

    return {
      id: folderId,
      ...folderData,
      name: newName.trim()
    };
  } catch (error) {
    console.error('Error updating folder:', error);
    throw error;
  }
};

// Delete a folder (and move its boards to parent or root)
export const deleteFolder = async (folderId, moveBoardsToParent = true) => {
  try {
    const currentUser = checkAuth();

    const folderRef = doc(db, FOLDERS_COLLECTION, folderId);
    const folderDoc = await getDoc(folderRef);

    if (!folderDoc.exists()) {
      throw new Error('Folder not found');
    }

    const folderData = folderDoc.data();
    if (folderData.userId !== currentUser.uid) {
      throw new Error('You do not have permission to delete this folder');
    }

    // Get all boards in this folder
    const boardsRef = collection(db, BOARDS_COLLECTION);
    const boardsQuery = query(
      boardsRef,
      where('userId', '==', currentUser.uid),
      where('folderId', '==', folderId)
    );
    const boardsSnapshot = await getDocs(boardsQuery);

    // Move boards to parent folder or root (null)
    const newFolderId = moveBoardsToParent && folderData.parentFolderId 
      ? folderData.parentFolderId 
      : null;

    const updatePromises = boardsSnapshot.docs.map(boardDoc => {
      return updateDoc(boardDoc.ref, {
        folderId: newFolderId,
        updatedAt: serverTimestamp()
      });
    });

    await Promise.all(updatePromises);

    // Delete the folder
    await deleteDoc(folderRef);

    return true;
  } catch (error) {
    console.error('Error deleting folder:', error);
    throw error;
  }
};

// Move a board to a folder
export const moveBoardToFolder = async (boardId, folderId) => {
  try {
    const currentUser = checkAuth();

    const boardRef = doc(db, BOARDS_COLLECTION, boardId);
    const boardDoc = await getDoc(boardRef);

    if (!boardDoc.exists()) {
      throw new Error('Board not found');
    }

    const boardData = boardDoc.data();
    
    // Check if user owns the board or has access
    if (boardData.userId !== currentUser.uid && 
        !(boardData.sharedWith || []).includes(currentUser.uid)) {
      throw new Error('You do not have permission to move this board');
    }

    // If folderId is provided, verify the folder exists and user owns it
    if (folderId) {
      const folderRef = doc(db, FOLDERS_COLLECTION, folderId);
      const folderDoc = await getDoc(folderRef);

      if (!folderDoc.exists()) {
        throw new Error('Folder not found');
      }

      const folderData = folderDoc.data();
      if (folderData.userId !== currentUser.uid) {
        throw new Error('You do not have permission to use this folder');
      }
    }

    await updateDoc(boardRef, {
      folderId: folderId || null,
      updatedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error moving board:', error);
    throw error;
  }
};

// Get folder structure (folders organized by parent)
export const getFolderStructure = async (userId) => {
  try {
    const folders = await getUserFolders(userId);
    
    // Build folder tree
    const folderMap = new Map();
    const rootFolders = [];

    // First pass: create map of all folders
    folders.forEach(folder => {
      folderMap.set(folder.id, {
        ...folder,
        children: []
      });
    });

    // Second pass: build tree structure
    folders.forEach(folder => {
      const folderNode = folderMap.get(folder.id);
      if (folder.parentFolderId && folderMap.has(folder.parentFolderId)) {
        const parent = folderMap.get(folder.parentFolderId);
        parent.children.push(folderNode);
      } else {
        rootFolders.push(folderNode);
      }
    });

    return {
      folders: folderMap,
      rootFolders,
      flatList: folders
    };
  } catch (error) {
    console.error('Error getting folder structure:', error);
    throw error;
  }
};

