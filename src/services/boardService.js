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
  serverTimestamp,
  updateDoc,
  onSnapshot
} from 'firebase/firestore';
import { auth, db } from '../firebase-config';
import { getApiBaseUrl } from '../utils/api';

const BOARDS_COLLECTION = 'boards';

// Check if user is authenticated
const checkAuth = () => {
  if (!auth.currentUser) {
    throw new Error('User must be authenticated');
  }
  return auth.currentUser;
};

// Safely convert savedAt to Date object
const convertSavedAtToDate = (savedAt) => {
  if (!savedAt) {
    return null; // Return null instead of new Date() to avoid creating fake timestamps
  }
  
  // Check if it's a serverTimestamp placeholder (shouldn't happen when reading from Firestore, but handle it)
  if (savedAt._methodName === 'serverTimestamp') {
    return null; // Return null instead of creating a fake timestamp
  }
  
  if (typeof savedAt.toDate === 'function') {
    // Firestore Timestamp
    return savedAt.toDate();
  } else if (savedAt instanceof Date) {
    // Already a Date object
    return savedAt;
  } else if (typeof savedAt === 'string') {
    // ISO string
    const date = new Date(savedAt);
    return isNaN(date.getTime()) ? null : date; // Validate the date
  } else if (typeof savedAt === 'number') {
    // Timestamp number
    const date = new Date(savedAt);
    return isNaN(date.getTime()) ? null : date; // Validate the date
  }
  
  // If we can't convert it, return null instead of creating a fake timestamp
  return null;
};

// Get all boards for a specific user (including owned and shared)
export const getUserBoards = async (userId) => {
  try {
    // Verify the requesting user matches the userId
    const currentUser = checkAuth();
    if (currentUser.uid !== userId) {
      throw new Error('Unauthorized access');
    }

    const boardsRef = collection(db, BOARDS_COLLECTION);
    
    // Get owned boards
    const ownedBoardsQuery = query(
      boardsRef,
      where('userId', '==', userId),
      orderBy('savedAt', 'desc')
    );
    
    // Get shared boards (where user is in sharedWith array)
    // Note: Firestore doesn't support array-contains with orderBy on different fields
    // So we'll fetch shared boards separately and merge
    const sharedBoardsQuery = query(
      boardsRef,
      where('sharedWith', 'array-contains', userId)
    );
    
    const [ownedSnapshot, sharedSnapshot] = await Promise.all([
      getDocs(ownedBoardsQuery),
      getDocs(sharedBoardsQuery)
    ]);
    
    // Process owned boards
    const ownedBoards = ownedSnapshot.docs.map(doc => {
      const data = doc.data();
      const convertedSavedAt = convertSavedAtToDate(data.savedAt);
      
      const board = {
        id: doc.id,
        ...data,
        ...(convertedSavedAt && { savedAt: convertedSavedAt }),
        isOwned: true
      };
      
      if (data.lastEditedAt) {
        const convertedLastEditedAt = convertSavedAtToDate(data.lastEditedAt);
        if (convertedLastEditedAt) {
          board.lastEditedAt = convertedLastEditedAt;
        }
      }
      
      return board;
    });
    
    // Process shared boards (exclude duplicates - boards user owns)
    const ownedBoardIds = new Set(ownedBoards.map(b => b.id));
    const sharedBoards = sharedSnapshot.docs
      .filter(doc => !ownedBoardIds.has(doc.id))
      .map(doc => {
        const data = doc.data();
        const convertedSavedAt = convertSavedAtToDate(data.savedAt);
        
        const board = {
          id: doc.id,
          ...data,
          ...(convertedSavedAt && { savedAt: convertedSavedAt }),
          isOwned: false,
          isShared: true
        };
        
        if (data.lastEditedAt) {
          const convertedLastEditedAt = convertSavedAtToDate(data.lastEditedAt);
          if (convertedLastEditedAt) {
            board.lastEditedAt = convertedLastEditedAt;
          }
        }
        
        return board;
      });
    
    // Combine and return all boards
    return [...ownedBoards, ...sharedBoards];
  } catch (error) {
    throw error;
  }
};

// Remove undefined values from object (Firestore doesn't accept undefined)
const removeUndefined = (obj) => {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined).filter(item => item !== undefined);
  }
  if (typeof obj === 'object') {
    const cleaned = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        cleaned[key] = removeUndefined(obj[key]);
      }
    }
    return cleaned;
  }
  return obj;
};

// Clean chart configuration
const cleanChartConfig = (item) => {
  if (item.type !== 'chart') return item;

  const baseConfig = {
    ...item,
    title: String(item.title || ''),
    xAxisTitle: String(item.xAxisTitle || ''),
    yAxisTitle: String(item.yAxisTitle || ''),
    xAxisUnit: Number(item.xAxisUnit || 1),
    yAxisUnit: Number(item.yAxisUnit || 1),
    xAxisStart: Number(item.xAxisStart || 0),
    yAxisStart: Number(item.yAxisStart || 0),
    xAxisEnd: Number(item.xAxisEnd || 10),
    yAxisEnd: Number(item.yAxisEnd || 10),
    xAxisMode: String(item.xAxisMode || 'number'),
    yAxisMode: String(item.yAxisMode || 'number'),
    showXAxisLabels: Boolean(item.showXAxisLabels !== false),
    showYAxisLabels: Boolean(item.showYAxisLabels !== false),
    xAxisCustomValues: Array.isArray(item.xAxisCustomValues) ? item.xAxisCustomValues.map(String) : [],
    yAxisCustomValues: Array.isArray(item.yAxisCustomValues) ? item.yAxisCustomValues.map(String) : []
  };

  // Add sine wave specific properties if it's a sine chart
  if (item.chartType === 'sine') {
    return {
      ...baseConfig,
      frequency: Number(item.frequency || 1),
      amplitude: Number(item.amplitude || 1),
      periods: Number(item.periods || 1),
      waveType: String(item.waveType || 'sine'),
      phaseShift: Number(item.phaseShift || 0),
      harmonics: Number(item.harmonics || 1),
      enableModulation: Boolean(item.enableModulation),
      modulationDepth: Number(item.modulationDepth || 0.5)
    };
  }

  return baseConfig;
};

// Save a new board or update an existing one
export const saveBoard = async (boardData, userId) => {
  try {
    const currentUser = checkAuth();
    
    // Validate board data
    if (!boardData.name) {
      throw new Error('Board name is required');
    }

    // Clean and validate items, ensuring chart configurations are properly saved
    const cleanedItems = (boardData.content?.items || []).map(item => {
      if (item.type === 'chart') {
        return cleanChartConfig(item);
      }
      return item;
    });

    // If boardData has an id, it's an existing board - check permissions
    if (boardData.id) {
      const boardRef = doc(db, BOARDS_COLLECTION, boardData.id);
      const existingDoc = await getDoc(boardRef);
      
      if (!existingDoc.exists()) {
        throw new Error('Board not found');
      }
      
      const existingData = existingDoc.data();
      const isOwner = existingData.userId === currentUser.uid;
      const isShared = (existingData.sharedWith || []).includes(currentUser.uid);
      
      // Only allow save if user is owner or shared user
      // Note: Firestore rules will enforce editor permission for shared users
      if (!isOwner && !isShared) {
        throw new Error('Unauthorized access');
      }
      
      // Preserve the original owner's userId - never change it
      userId = existingData.userId;
    } else {
      // For new boards, verify the requesting user matches the userId
      if (currentUser.uid !== userId) {
        throw new Error('Unauthorized access');
      }
    }

    const data = {
      name: boardData.name,
      content: {
        ...boardData.content,
        items: cleanedItems
      },
      userId: userId // Use the original owner's userId for existing boards
    };

    // Handle savedAt (creation/first save time)
    // Only set savedAt for new boards or when explicitly provided
    if (boardData.savedAt !== undefined) {
      // savedAt was explicitly provided (new board creation)
      data.savedAt = serverTimestamp();
    } else if (!boardData.id) {
      // New board without savedAt - set it
      data.savedAt = serverTimestamp();
    }
    // If boardData.id exists and savedAt is undefined, don't set it (preserve existing timestamp)

    // Handle lastEditedAt (tracks when content actually changed)
    // Set lastEditedAt if explicitly provided (both auto-save and manual save can set this)
    if (boardData.lastEditedAt !== undefined && boardData.lastEditedAt !== null) {
      data.lastEditedAt = boardData.lastEditedAt;
    }
    // If not provided, don't include lastEditedAt - preserves existing value

    // Remove all undefined values before saving to Firestore
    const cleanedData = removeUndefined(data);

    // If boardData has an id, update existing board
    if (boardData.id) {
      const boardRef = doc(db, BOARDS_COLLECTION, boardData.id);
      
      // Fetch the document BEFORE updating to preserve the original savedAt
      // savedAt should never change for existing boards UNLESS it's invalid
      const existingDoc = await getDoc(boardRef);
      const existingData = existingDoc.data();
      const originalSavedAt = existingData?.savedAt 
        ? convertSavedAtToDate(existingData.savedAt)
        : null;
      
      // FIX: If savedAt is invalid (null or placeholder), set it to serverTimestamp()
      // This fixes boards that have invalid timestamps in Firestore
      if (!originalSavedAt || 
          (existingData?.savedAt && existingData.savedAt._methodName === 'serverTimestamp')) {
        cleanedData.savedAt = serverTimestamp();
      }
      
      await updateDoc(boardRef, cleanedData);
      
      // Fetch the updated document to get the actual server timestamp for lastEditedAt
      const updatedDoc = await getDoc(boardRef);
      const updatedData = updatedDoc.data();
      
      // Build return value with actual Date objects from Firestore
      // If we fixed savedAt, use the new value from Firestore, otherwise preserve original
      const finalSavedAt = (!originalSavedAt || 
                            (existingData?.savedAt && existingData.savedAt._methodName === 'serverTimestamp'))
        ? convertSavedAtToDate(updatedData.savedAt) // Use the newly set timestamp
        : originalSavedAt; // Preserve the original valid timestamp
      
      const returnValue = {
        id: boardData.id,
        name: data.name,
        content: data.content,
        userId: data.userId,
        savedAt: finalSavedAt
      };
      
      // Set lastEditedAt from Firestore if it exists, otherwise preserve existing
      if (updatedData.lastEditedAt) {
        returnValue.lastEditedAt = convertSavedAtToDate(updatedData.lastEditedAt);
      } else if (boardData.lastEditedAt) {
        // Fallback to provided value if Firestore doesn't have it yet
        returnValue.lastEditedAt = boardData.lastEditedAt instanceof Date ? boardData.lastEditedAt : new Date(boardData.lastEditedAt);
      }
      
      return returnValue;
    }

    // Otherwise, create new board
    const boardsRef = collection(db, BOARDS_COLLECTION);
    const docRef = await addDoc(boardsRef, cleanedData);
    
    const savedBoard = {
      id: docRef.id,
      name: data.name,
      content: data.content,
      userId: data.userId,
      savedAt: new Date(),
      lastEditedAt: new Date()
    };
    
    return savedBoard;
  } catch (error) {
    throw error;
  }
};

// Subscribe to real-time board content updates
export const subscribeToBoardContent = (boardId, callback) => {
  try {
    checkAuth();
    
    if (!boardId) {
      console.warn('Board ID is required for subscription');
      return () => {}; // Return empty unsubscribe function
    }
    
    const boardRef = doc(db, BOARDS_COLLECTION, boardId);
    
    return onSnapshot(boardRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const boardData = docSnapshot.data();
        const content = boardData.content || {};
        
        // Convert Firestore timestamps to dates
        const convertedContent = {
          items: content.items || [],
          connections: content.connections || [],
          scale: content.scale || 1,
          panOffset: content.panOffset || { x: 0, y: 0 }
        };
        
        callback(convertedContent);
      } else {
        console.warn('Board document does not exist');
        callback(null);
      }
    }, (error) => {
      console.error('Error in board content subscription:', error);
      callback(null);
    });
  } catch (error) {
    console.error('Error subscribing to board content:', error);
    return () => {}; // Return empty unsubscribe function
  }
};

// Delete a board
export const deleteBoard = async (boardId) => {
  try {
    // First, verify the user owns this board
    checkAuth();
    const boardRef = doc(db, BOARDS_COLLECTION, boardId);
    
    // You might want to add a check here to verify ownership
    // by first fetching the document and checking userId
    
    await deleteDoc(boardRef);
  } catch (error) {
    throw error;
  }
};

// Get demo boards (boards without userId)
export const getDemoBoards = async () => {
  try {
    const q = query(
      collection(db, BOARDS_COLLECTION),
      where('userId', '==', null),
      orderBy('savedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const boards = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        savedAt: convertSavedAtToDate(data.savedAt)
      };
    });
    
    return boards;
  } catch (error) {
    throw error;
  }
};

// Helper function to encrypt chat history
const encryptChatHistory = async (chatHistory, userId) => {
  try {
    // In development mode, use base64 encoding (for easier debugging)
    // This allows the decrypt function to handle it properly
    if (process.env.NODE_ENV === 'development') {
      return btoa(JSON.stringify(chatHistory));
    }

    const response = await fetch(`${getApiBaseUrl()}/encrypt-chat-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        chatHistory
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to encrypt chat history');
    }

    const { encrypted } = await response.json();
    return encrypted;
  } catch (error) {
    console.error('Error encrypting chat history:', error);
    throw error;
  }
};

// Helper function to decrypt chat history
const decryptChatHistory = async (encryptedData, userId) => {
  try {
    // Check if data is already unencrypted (backward compatibility)
    // Encrypted data should have the format: iv:encrypted:authTag (contains colons)
    if (!encryptedData || typeof encryptedData !== 'string') {
      // If it's not a string, it might already be decrypted (backward compatibility)
      if (Array.isArray(encryptedData)) {
        return encryptedData;
      }
      return [];
    }

    // If it doesn't contain colons, it might be unencrypted JSON (backward compatibility)
    if (!encryptedData.includes(':')) {
      try {
        const parsed = JSON.parse(encryptedData);
        // If parsing succeeds and it's an array, it's unencrypted
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        // If parsing fails, continue with decryption
      }
    }

    // In development mode, try to decode as base64 first
    if (process.env.NODE_ENV === 'development') {
      try {
        const decoded = atob(encryptedData);
        const parsed = JSON.parse(decoded);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        // If base64 decode fails, continue with decryption
      }
    }

    // Attempt to decrypt
    const response = await fetch(`${getApiBaseUrl()}/decrypt-chat-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        encryptedData
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // If decryption fails and data looks unencrypted, try to parse as JSON
      if (errorData.error && errorData.error.includes('Invalid encrypted data format')) {
        try {
          const parsed = JSON.parse(encryptedData);
          if (Array.isArray(parsed)) {
            console.warn('Chat history appears to be unencrypted, returning as-is');
            return parsed;
          }
        } catch (e) {
          // If parsing fails, throw the original error
        }
      }
      throw new Error(errorData.error || 'Failed to decrypt chat history');
    }

    const { decrypted } = await response.json();
    return decrypted;
  } catch (error) {
    console.error('Error decrypting chat history:', error);
    // For backward compatibility, try to return the data as-is if it's an array
    if (Array.isArray(encryptedData)) {
      console.warn('Returning chat history as-is (backward compatibility)');
      return encryptedData;
    }
    // If it's a string, try to parse it as JSON
    if (typeof encryptedData === 'string') {
      try {
        const parsed = JSON.parse(encryptedData);
        if (Array.isArray(parsed)) {
          console.warn('Returning parsed chat history (backward compatibility)');
          return parsed;
        }
      } catch (e) {
        // If parsing fails, return empty array
      }
    }
    // Return empty array as fallback
    return [];
  }
};

// Save chat history for a board (stored directly in board document)
export const saveChatHistory = async (boardId, chatHistory) => {
  try {
    const currentUser = checkAuth();
    
    if (!boardId) {
      throw new Error('Board ID is required');
    }

    // Verify the user owns this board
    const boardRef = doc(db, BOARDS_COLLECTION, boardId);
    const boardDoc = await getDoc(boardRef);
    
    if (!boardDoc.exists()) {
      throw new Error('Board not found');
    }
    
    const boardData = boardDoc.data();
    // Allow owner or shared users to save chat history
    const hasAccess = boardData.userId === currentUser.uid || 
                     (boardData.sharedWith || []).includes(currentUser.uid);
    if (!hasAccess) {
      throw new Error('Unauthorized access');
    }

    // Save chat history directly in the board document
    // Ensure messages arrays, tabNames, and highlightedItems are preserved (don't filter them out)
    const cleanedHistory = (chatHistory || []).map(chat => {
      return {
        tabId: chat.tabId || chat.id,
        tabName: chat.tabName || 'Untitled Chat', // Preserve historical tabName
        messages: chat.messages || [], // Preserve historical messages
        highlightedItems: chat.highlightedItems || [], // Preserve historical highlighted items
        saved: chat.saved || false, // Preserve saved status
        savedAt: chat.savedAt || null // Preserve saved timestamp
      };
    });
    
    // Encrypt the chat history before saving
    const encryptedHistory = await encryptChatHistory(cleanedHistory, currentUser.uid);
    
    const updateData = {
      chatHistory: encryptedHistory
    };
    
    await updateDoc(boardRef, removeUndefined(updateData));
  } catch (error) {
    console.error('Error saving chat history:', error);
    throw error;
  }
};

// Load chat history for a board
export const loadChatHistory = async (boardId) => {
  try {
    const currentUser = checkAuth();
    
    if (!boardId) {
      return [];
    }

    const boardRef = doc(db, BOARDS_COLLECTION, boardId);
    const boardDoc = await getDoc(boardRef);
    
    if (!boardDoc.exists()) {
      return [];
    }
    
    const boardData = boardDoc.data();
    
    // Verify the user has access to this board (owner or shared)
    const hasAccess = boardData.userId === currentUser.uid || 
                     (boardData.sharedWith || []).includes(currentUser.uid);
    if (!hasAccess) {
      return [];
    }
    
    // Get chat history from board document
    const chatHistoryData = boardData.chatHistory;
    
    // If no chat history exists, return empty array
    if (!chatHistoryData) {
      return [];
    }
    
    // Decrypt the chat history
    const decryptedHistory = await decryptChatHistory(chatHistoryData, currentUser.uid);
    
    return decryptedHistory || [];
  } catch (error) {
    console.error('Error loading chat history:', error);
    // Return empty array on error instead of throwing
    return [];
  }
}; 