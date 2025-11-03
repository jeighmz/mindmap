import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where,
  orderBy,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from '../firebase-config';

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
    return new Date();
  }
  
  if (typeof savedAt.toDate === 'function') {
    // Firestore Timestamp
    return savedAt.toDate();
  } else if (savedAt instanceof Date) {
    // Already a Date object
    return savedAt;
  } else if (typeof savedAt === 'string') {
    // ISO string
    return new Date(savedAt);
  } else if (typeof savedAt === 'number') {
    // Timestamp number
    return new Date(savedAt);
  }
  
  // Fallback
  return new Date();
};

// Get all boards for a specific user
export const getUserBoards = async (userId) => {
  try {
    // Verify the requesting user matches the userId
    const currentUser = checkAuth();
    if (currentUser.uid !== userId) {
      throw new Error('Unauthorized access');
    }

    const boardsRef = collection(db, BOARDS_COLLECTION);
    const q = query(
      boardsRef,
      where('userId', '==', userId),
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
    // Verify the requesting user matches the userId
    const currentUser = checkAuth();
    if (currentUser.uid !== userId) {
      throw new Error('Unauthorized access');
    }

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

    const data = {
      name: boardData.name,
      content: {
        ...boardData.content,
        items: cleanedItems
      },
      userId: currentUser.uid,
      savedAt: serverTimestamp()
    };

    // Remove all undefined values before saving to Firestore
    const cleanedData = removeUndefined(data);

    // If boardData has an id, update existing board
    if (boardData.id) {
      const boardRef = doc(db, BOARDS_COLLECTION, boardData.id);
      await updateDoc(boardRef, cleanedData);
      
      return {
        id: boardData.id,
        ...data,
        savedAt: new Date()
      };
    }

    // Otherwise, create new board
    const boardsRef = collection(db, BOARDS_COLLECTION);
    const docRef = await addDoc(boardsRef, cleanedData);
    
    const savedBoard = {
      id: docRef.id,
      ...data,
      savedAt: new Date()
    };
    
    return savedBoard;
  } catch (error) {
    throw error;
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