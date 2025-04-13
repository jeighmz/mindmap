import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where,
  orderBy,
  serverTimestamp
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

// Get all boards for a specific user
export const getUserBoards = async (userId) => {
  try {
    // Verify the requesting user matches the userId
    const currentUser = checkAuth();
    if (currentUser.uid !== userId) {
      throw new Error('Unauthorized access');
    }

    console.log('Fetching boards for user:', userId);
    const boardsRef = collection(db, BOARDS_COLLECTION);
    const q = query(
      boardsRef,
      where('userId', '==', userId),
      orderBy('savedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const boards = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      savedAt: doc.data().savedAt?.toDate() || new Date()
    }));
    
    console.log(`Retrieved ${boards.length} boards from Firestore:`, boards);
    
    // Check if content has the right structure
    for (const board of boards) {
      console.log(`Board ${board.id} content structure:`, {
        hasContent: !!board.content,
        contentType: typeof board.content,
        hasItems: Array.isArray(board.content?.items),
        itemsLength: board.content?.items?.length || 0
      });
    }
    
    return boards;
  } catch (error) {
    console.error('Error fetching user boards:', error);
    throw error;
  }
};

// Save a new board
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

    console.log('Saving board data to Firestore:', boardData);
    console.log('Board content structure check:', {
      hasContent: !!boardData.content,
      contentType: typeof boardData.content,
      hasItems: Array.isArray(boardData.content?.items),
      itemsLength: boardData.content?.items?.length || 0
    });

    const data = {
      name: boardData.name,
      content: boardData.content || {},
      userId: currentUser.uid,
      savedAt: serverTimestamp()
    };

    const boardsRef = collection(db, BOARDS_COLLECTION);
    const docRef = await addDoc(boardsRef, data);
    
    const savedBoard = {
      id: docRef.id,
      ...data,
      savedAt: new Date()
    };
    
    console.log('Board saved successfully with ID:', docRef.id);
    
    return savedBoard;
  } catch (error) {
    console.error('Error saving board:', error);
    throw error;
  }
};

// Delete a board
export const deleteBoard = async (boardId) => {
  try {
    // First, verify the user owns this board
    const currentUser = checkAuth();
    const boardRef = doc(db, BOARDS_COLLECTION, boardId);
    
    // You might want to add a check here to verify ownership
    // by first fetching the document and checking userId
    
    console.log('Deleting board with ID:', boardId);
    await deleteDoc(boardRef);
    console.log('Board deleted successfully');
  } catch (error) {
    console.error('Error deleting board:', error);
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
    const boards = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      savedAt: doc.data().savedAt?.toDate() || new Date()
    }));
    
    console.log(`Retrieved ${boards.length} demo boards from Firestore`);
    
    return boards;
  } catch (error) {
    console.error('Error fetching demo boards:', error);
    throw error;
  }
}; 