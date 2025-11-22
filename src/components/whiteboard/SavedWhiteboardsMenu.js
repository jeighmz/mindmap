import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getUserBoards, saveBoard, deleteBoard } from '../../services/boardService';
import { getSharedBoards } from '../../services/sharingService';
import { createFolder, getUserFolders, updateFolder, deleteFolder, moveBoardToFolder, getFolderStructure } from '../../services/folderService';
import { serverTimestamp, doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase-config';
import ShareBoardModal from './ShareBoardModal';
import { TIER_FEATURES, USER_TIERS } from '../../config/userTiers';
import '../../styles/SavedWhiteboardsMenu.css';

const SavedWhiteboardsMenu = ({ 
  savedWhiteboards, // This will now be used only for demo boards
  onLoad,
  currentWhiteboard, 
  isOpen, // Receive open state from parent
  onToggle, // Receive toggle function from parent
  currentBoardId // Add this prop to track current board
}) => {
  const { user, userTier } = useAuth();
  const [newBoardName, setNewBoardName] = useState('');
  const [activeTab, setActiveTab] = useState(user ? 'personal' : 'demo');
  const [userBoards, setUserBoards] = useState([]);
  const [folders, setFolders] = useState([]);
  const [folderStructure, setFolderStructure] = useState({ folders: new Map(), rootFolders: [], flatList: [] });
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [selectedFolderId, setSelectedFolderId] = useState(null); // null = root, 'folderId' = specific folder
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedBoardForShare, setSelectedBoardForShare] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState(null);
  const [isDeletingOwnedBoard, setIsDeletingOwnedBoard] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [showMoveMenu, setShowMoveMenu] = useState(null); // boardId when showing move menu
  const [moveMenuPosition, setMoveMenuPosition] = useState({ x: 0, y: 0 }); // Position for move menu portal

  // Helper function to safely convert timestamp to Date for display
  const getDisplayDate = (timestamp) => {
    if (!timestamp) {
      // Return a fallback date instead of current date to avoid showing "Invalid Date"
      // Use a date far in the past to indicate missing timestamp
      return new Date(0); // Jan 1, 1970 - will show as a very old date
    }
    
    // Handle Firestore Timestamp
    if (typeof timestamp.toDate === 'function') {
      const date = timestamp.toDate();
      return isNaN(date.getTime()) ? new Date(0) : date;
    }
    
    // Handle Date object
    if (timestamp instanceof Date) {
      return isNaN(timestamp.getTime()) ? new Date(0) : timestamp;
    }
    
    // Handle string or number
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? new Date(0) : date;
  };

  // Update activeTab when user logs in/out
  useEffect(() => {
    if (user && activeTab === 'demo') {
      setActiveTab('personal');
    } else if (!user && activeTab === 'personal') {
      setActiveTab('demo');
    }
  }, [user]);


  // Fetch boards and folders when the menu is opened and tab is personal
  useEffect(() => {
    if (isOpen && activeTab === 'personal' && user) {
      fetchUserBoards();
      fetchFolders();
    }
  }, [isOpen, activeTab, user]); // Removed hasLoadedBoards to allow refresh on open

  // Close move menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMoveMenu && !event.target.closest('.move-menu') && !event.target.closest('.move-btn')) {
        setShowMoveMenu(null);
      }
    };

    if (showMoveMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showMoveMenu]);

  const fetchFolders = async () => {
    if (!user) return;
    
    try {
      const structure = await getFolderStructure(user.uid);
      console.log('Fetched folder structure:', structure); // Debug log
      setFolderStructure(structure);
      setFolders(structure.flatList || []);
    } catch (error) {
      console.error('Error fetching folders:', error);
      setError(error.message || 'Failed to load folders');
    }
  };

  const fetchUserBoards = async () => {
    if (!user) {
      setError('Please sign in to view your boards');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const boards = await getUserBoards(user.uid);
      
      // CRITICAL: Keep the raw Firestore timestamps - don't convert them
      // getDisplayDate will handle conversion when displaying
      // This preserves the actual Firestore data and prevents timestamp changes
      
      // Sort by lastEditedAt descending (most recent edit first)
      // Sort boards by date (most recent first)
      // Uses savedAt (creation time) for primary sorting, falls back to lastEditedAt
      const sortedBoards = [...boards].sort((a, b) => {
        // Get the primary timestamp (savedAt) or fallback to lastEditedAt
        const timestampA = a.savedAt || a.lastEditedAt;
        const timestampB = b.savedAt || b.lastEditedAt;
        
        // If both are null/invalid, maintain order
        if (!timestampA && !timestampB) return 0;
        
        // If only A is null, put it at the bottom
        if (!timestampA) return 1;
        
        // If only B is null, put it at the bottom
        if (!timestampB) return -1;
        
        // Both have timestamps, compare them
        const dateA = getDisplayDate(timestampA);
        const dateB = getDisplayDate(timestampB);
        
        // Sort descending (most recent first)
        return dateB.getTime() - dateA.getTime();
      });
      
      setUserBoards(sortedBoards);
    } catch (error) {
      setError(error.message || 'Failed to load boards');
      setUserBoards([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError(null);
    setSearchQuery(''); // Clear search when switching tabs
    // Fetching is now handled by useEffect
  };

  const cleanChartConfig = (item) => {
    // Base chart properties that all charts should have
    const baseConfig = {
      id: String(item.id || Date.now()),
      type: 'chart',
      chartType: item.chartType || 'xy',
      position: {
        x: Number(item.position?.x || 0),
        y: Number(item.position?.y || 0)
      },
      width: Number(item.width || 400),
      height: Number(item.height || 300),
      text: String(item.text || ''),
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

  // Helper function to clean items for Firestore (ensures all values are serializable)
  const cleanItemForFirestore = (item) => {
    if (!item || typeof item !== 'object') {
      return item;
    }

    const cleaned = {};
    
    for (const key in item) {
      const value = item[key];
      
      // Skip undefined values
      if (value === undefined) {
        continue;
      }
      
      // Handle null
      if (value === null) {
        cleaned[key] = null;
        continue;
      }
      
      // Handle primitives (string, number, boolean)
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        cleaned[key] = value;
        continue;
      }
      
      // Handle arrays
      if (Array.isArray(value)) {
        cleaned[key] = value.map(cleanItemForFirestore);
        continue;
      }
      
      // Handle Date objects - convert to ISO string
      if (value instanceof Date) {
        cleaned[key] = value.toISOString();
        continue;
      }
      
      // Handle plain objects (but not class instances or special objects)
      if (typeof value === 'object') {
        // Check if it's a plain object (not a class instance or special object)
        const isPlainObject = Object.prototype.toString.call(value) === '[object Object]' &&
                             value.constructor === Object;
        
        if (isPlainObject) {
          // Recursively clean nested objects
          cleaned[key] = cleanItemForFirestore(value);
        } else {
          // Skip non-plain objects (functions, class instances, etc.)
          // These can cause "invalid nested entity" errors
          console.warn(`Skipping non-serializable property "${key}" in item:`, value);
          continue;
        }
        continue;
      }
      
      // Skip functions and other non-serializable types
      if (typeof value === 'function') {
        console.warn(`Skipping function property "${key}" in item`);
        continue;
      }
      
      // For any other type, try to convert to string as fallback
      try {
        cleaned[key] = String(value);
      } catch (e) {
        console.warn(`Could not serialize property "${key}" in item, skipping:`, e);
      }
    }
    
    return cleaned;
  };

  const cleanItem = (item) => {
    if (!item || typeof item !== 'object') {
      return null;
    }

    if (item.type === 'chart') {
      const cleaned = cleanChartConfig(item);
      return cleanItemForFirestore(cleaned);
    }

    if (item.type === 'image') {
      const cleanedImage = {
        id: String(item.id || Date.now()),
        type: 'image',
        position: {
          x: Number(item.position?.x || 0),
          y: Number(item.position?.y || 0)
        },
        width: Number(item.width || 400),
        height: Number(item.height || 300)
      };

      // Preserve storageRef for Firebase Storage images
      if (item.storageRef) {
        cleanedImage.storageRef = String(item.storageRef);
      }

      // Preserve imageUrl for data URLs (local images)
      if (item.imageUrl && item.imageUrl.startsWith('data:')) {
        cleanedImage.imageUrl = String(item.imageUrl);
      } else if (item.imageUrl) {
        cleanedImage.imageUrl = String(item.imageUrl);
      }

      return cleanItemForFirestore(cleanedImage);
    }

    // For all other items, use the comprehensive cleaning function
    // This preserves all valid properties while ensuring they're serializable
    return cleanItemForFirestore(item);
  };

  const cleanConnection = (conn) => {
    const cleaned = {
      id: String(conn.id || `connection-${Date.now()}`),
      from: String(conn.from),
      to: String(conn.to),
      // Always save customization properties (use defaults if not set)
      color: String(conn.color || '#2196F3'),
      strokeWidth: Number(conn.strokeWidth || 2),
      lineType: String(conn.lineType || 'straight'),
      lineDesign: String(conn.lineDesign || 'curved'),
      arrowDirection: String(conn.arrowDirection || '->'),
      arrowHeadStyle: String(conn.arrowHeadStyle || 'medium')
    };
    return cleaned;
  };

  const handleSave = async (e, boardName, existingBoardId = null) => {
    e.preventDefault();
    if (!user) {
      setError('Please sign in to save boards');
      return;
    }
    if (!boardName.trim()) {
      setError('Please enter a board name');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Clean and validate all items
      const processedItems = (currentWhiteboard?.items || [])
        .map(cleanItem)
        .filter(Boolean); // Remove any null/undefined items

      // Clean and validate all connections
      const processedConnections = (currentWhiteboard?.connections || [])
        .map(cleanConnection)
        .filter(conn => 
          processedItems.some(item => item.id === conn.from) && 
          processedItems.some(item => item.id === conn.to)
        );

      // Get the existing board's folderId if updating, or use selected folder for new boards
      let folderIdToUse = null;
      if (existingBoardId) {
        // Preserve existing folderId when updating
        const existingBoard = userBoards.find(b => b.id === existingBoardId);
        folderIdToUse = existingBoard?.folderId || null;
      } else if (selectedFolderId) {
        // Use selected folder for new boards
        folderIdToUse = selectedFolderId;
      }

      // Create the board data with cleaned values
      const boardData = {
        name: String(boardName.trim()),
        userId: String(user.uid),
        lastEditedAt: serverTimestamp(), // Update last edited time on manual save
        folderId: folderIdToUse, // Include folderId
        content: {
          items: processedItems,
          connections: processedConnections,
          scale: Number(currentWhiteboard?.scale || 1),
          panOffset: {
            x: Number(currentWhiteboard?.panOffset?.x || 0),
            y: Number(currentWhiteboard?.panOffset?.y || 0)
          }
        }
      };

      // If we have an existing board ID, include it in the data
      if (existingBoardId) {
        boardData.id = existingBoardId;
      } else {
        // Only set savedAt for new boards
        boardData.savedAt = serverTimestamp();
      }

      const savedBoard = await saveBoard(boardData, user.uid);
      
      if (existingBoardId) {
        // Update existing board in the list and re-sort by lastEditedAt
        setUserBoards(prev => {
          // Find the board being updated to preserve ALL its original properties
          const boardToUpdate = prev.find(board => board.id === existingBoardId);
          if (!boardToUpdate) {
            // Board not found in list, return unchanged
            return prev;
          }
          
          // CRITICAL: Preserve the original Firestore timestamps - don't convert them
          // Keep the raw savedAt and lastEditedAt from the board's Firestore data
          const originalSavedAt = boardToUpdate.savedAt; // Keep raw Firestore timestamp
          const originalLastEditedAt = boardToUpdate.lastEditedAt; // Keep raw Firestore timestamp
          
          // Use the new lastEditedAt from savedBoard if we got one, otherwise keep original
          // Don't convert - keep it as it comes from Firestore
          const newLastEditedAt = savedBoard.lastEditedAt || originalLastEditedAt;
          
          // Create updated board with preserved Firestore timestamps
          const updatedBoard = {
            ...boardToUpdate, // Preserve all existing properties including raw timestamps
            name: savedBoard.name || boardToUpdate.name,
            content: savedBoard.content || boardToUpdate.content,
            folderId: savedBoard.folderId !== undefined ? savedBoard.folderId : boardToUpdate.folderId, // Preserve folderId
            // CRITICAL: Always preserve the original savedAt from Firestore - never change it
            savedAt: originalSavedAt,
            // Use the new lastEditedAt from Firestore if we got one, otherwise keep original
            lastEditedAt: newLastEditedAt
          };
          
          // Create new array with updated board, preserving all other boards exactly as they were
          const updated = prev.map(board => {
            if (board.id === existingBoardId) {
              return updatedBoard;
            }
            // CRITICAL: Return the exact same object reference for unchanged boards
            // This prevents React from re-rendering them
            return board;
          });
          
          // Sort by lastEditedAt descending (most recent edit first)
          // Sort boards by date (most recent first)
          const sorted = [...updated].sort((a, b) => {
            // Get the primary timestamp (savedAt) or fallback to lastEditedAt
            const timestampA = a.savedAt || a.lastEditedAt;
            const timestampB = b.savedAt || b.lastEditedAt;
            
            // If both are null/invalid, maintain order
            if (!timestampA && !timestampB) return 0;
            
            // If only A is null, put it at the bottom
            if (!timestampA) return 1;
            
            // If only B is null, put it at the bottom
            if (!timestampB) return -1;
            
            // Both have timestamps, compare them
            const dateA = getDisplayDate(timestampA);
            const dateB = getDisplayDate(timestampB);
            
            // Sort descending (most recent first)
            return dateB.getTime() - dateA.getTime();
          });
          
          return sorted;
        });
      } else {
        // Add new board to the list and re-sort
        setUserBoards(prev => {
          const updated = [savedBoard, ...prev];
          // Sort by lastEditedAt descending (most recent edit first)
          return updated.sort((a, b) => {
            // Get the primary timestamp (savedAt) or fallback to lastEditedAt
            const timestampA = a.savedAt || a.lastEditedAt;
            const timestampB = b.savedAt || b.lastEditedAt;
            
            // If both are null/invalid, maintain order
            if (!timestampA && !timestampB) return 0;
            
            // If only A is null, put it at the bottom
            if (!timestampA) return 1;
            
            // If only B is null, put it at the bottom
            if (!timestampB) return -1;
            
            // Both have timestamps, compare them
            const dateA = getDisplayDate(timestampA);
            const dateB = getDisplayDate(timestampB);
            
            // Sort descending (most recent first)
            return dateB.getTime() - dateA.getTime();
          });
        });
        setNewBoardName('');
      }
      onToggle(); // Close menu after save
    } catch (error) {
      setError(error.message || 'Failed to save board');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (boardId, boardName, isOwner) => {
    setBoardToDelete({ id: boardId, name: boardName });
    setIsDeletingOwnedBoard(isOwner);
    setDeleteConfirmOpen(true);
  };

  const removeSharedBoardAccess = async (boardId) => {
    // Remove user from sharedWith array
    const boardRef = doc(db, 'boards', boardId);
    const boardDoc = await getDoc(boardRef);
    
    if (!boardDoc.exists()) {
      throw new Error('Board not found');
    }
    
    const boardData = boardDoc.data();
    const sharedWith = (boardData.sharedWith || []).filter(uid => uid !== user.uid);
    
    await updateDoc(boardRef, {
      sharedWith,
      isShared: sharedWith.length > 0
    });
    
    // Delete share document from boardShares collection
    const sharesRef = collection(db, 'boardShares');
    const shareQuery = query(
      sharesRef,
      where('boardId', '==', boardId),
      where('sharedWithUserId', '==', user.uid)
    );
    const shareDocs = await getDocs(shareQuery);
    
    // Delete all share documents for this user and board
    const deletePromises = shareDocs.docs.map(shareDoc => deleteDoc(shareDoc.ref));
    await Promise.all(deletePromises);
  };

  const handleDeleteConfirm = async () => {
    if (!boardToDelete) return;
    
    const boardId = boardToDelete.id;
    if (!user) {
      setError('Please sign in to delete boards');
      setDeleteConfirmOpen(false);
      setBoardToDelete(null);
      setIsDeletingOwnedBoard(false);
      return;
    }
    if (!boardId) {
      setError('Invalid board selected');
      setDeleteConfirmOpen(false);
      setBoardToDelete(null);
      setIsDeletingOwnedBoard(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Find the board to check if user is owner
      const board = userBoards.find(b => b.id === boardId);
      const isOwner = board && board.userId === user.uid;
      
      if (isOwner) {
        // User owns the board - delete it completely
        await deleteBoard(boardId);
      } else {
        // User doesn't own the board - just remove their access
        await removeSharedBoardAccess(boardId);
      }
      
      setUserBoards(prev => prev.filter(board => board.id !== boardId));
      setDeleteConfirmOpen(false);
      setBoardToDelete(null);
      setIsDeletingOwnedBoard(false);
    } catch (error) {
      setError(error.message || 'Failed to delete board');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setBoardToDelete(null);
    setIsDeletingOwnedBoard(false);
  };

  // Folder management functions
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim() || !user) return;

    setIsLoading(true);
    setError(null);
    try {
      const parentId = selectedFolderId || null;
      console.log('Creating folder:', newFolderName.trim(), 'parent:', parentId); // Debug
      const newFolder = await createFolder(newFolderName.trim(), parentId);
      console.log('Created folder:', newFolder); // Debug
      
      setNewFolderName('');
      setShowCreateFolder(false);
      
      // Refresh folders - wait for it to complete
      await fetchFolders();
      
      // Expand the parent folder if the new folder has a parent
      if (parentId) {
        setExpandedFolders(prev => new Set([...prev, parentId]));
      }
      
      // Select the newly created folder
      setSelectedFolderId(newFolder.id);
    } catch (error) {
      console.error('Error creating folder:', error);
      setError(error.message || 'Failed to create folder');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenameFolder = async (folderId, newName) => {
    if (!newName.trim() || !user) return;

    setIsLoading(true);
    setError(null);
    try {
      await updateFolder(folderId, newName.trim());
      setEditingFolderId(null);
      setEditingFolderName('');
      await fetchFolders();
    } catch (error) {
      setError(error.message || 'Failed to rename folder');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFolder = async (folderId) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);
    try {
      await deleteFolder(folderId, true); // Move boards to parent
      if (selectedFolderId === folderId) {
        setSelectedFolderId(null);
      }
      await fetchFolders();
      await fetchUserBoards(); // Refresh boards to update folderId
    } catch (error) {
      setError(error.message || 'Failed to delete folder');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoveBoard = async (boardId, targetFolderId) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);
    try {
      await moveBoardToFolder(boardId, targetFolderId || null);
      setShowMoveMenu(null);
      await fetchUserBoards();
    } catch (error) {
      setError(error.message || 'Failed to move board');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const getFolderPath = (folderId) => {
    if (!folderId) return [];
    const path = [];
    let currentFolderId = folderId;
    
    while (currentFolderId) {
      const folder = folders.find(f => f.id === currentFolderId);
      if (!folder) break;
      path.unshift(folder);
      currentFolderId = folder.parentFolderId;
    }
    
    return path;
  };

  const getBoardsInFolder = (folderId) => {
    return userBoards.filter(board => board.folderId === folderId);
  };

  const renderFolderTree = (folderList, level = 0) => {
    return folderList.map(folder => {
      const isExpanded = expandedFolders.has(folder.id);
      const isSelected = selectedFolderId === folder.id;
      const boardsInFolder = getBoardsInFolder(folder.id);
      const hasChildren = folder.children && folder.children.length > 0;

      return (
        <div key={folder.id} className="folder-item-wrapper">
          <div 
            className={`folder-item ${isSelected ? 'selected' : ''}`}
            style={{ paddingLeft: `${12 + level * 20}px` }}
          >
            <button
              type="button"
              className="folder-toggle"
              onClick={() => toggleFolder(folder.id)}
              disabled={!hasChildren}
            >
              {hasChildren ? (
                <svg 
                  width="12" 
                  height="12" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              ) : (
                <span style={{ width: '12px', display: 'inline-block' }} />
              )}
            </button>
            <button
              type="button"
              className="folder-name-button"
              onClick={() => setSelectedFolderId(isSelected ? null : folder.id)}
            >
              <svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: '6px' }}
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              {editingFolderId === folder.id ? (
                <input
                  type="text"
                  value={editingFolderName}
                  onChange={(e) => setEditingFolderName(e.target.value)}
                  onBlur={() => {
                    if (editingFolderName.trim()) {
                      handleRenameFolder(folder.id, editingFolderName);
                    } else {
                      setEditingFolderId(null);
                      setEditingFolderName('');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (editingFolderName.trim()) {
                        handleRenameFolder(folder.id, editingFolderName);
                      }
                    } else if (e.key === 'Escape') {
                      setEditingFolderId(null);
                      setEditingFolderName('');
                    }
                  }}
                  autoFocus
                  className="folder-rename-input"
                />
              ) : (
                <>
                  <span className="folder-name">{folder.name}</span>
                  <span className="folder-count">({boardsInFolder.length})</span>
                </>
              )}
            </button>
            {editingFolderId !== folder.id && (
              <div className="folder-actions">
                <button
                  type="button"
                  className="folder-edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingFolderId(folder.id);
                    setEditingFolderName(folder.name);
                  }}
                  title="Rename folder"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="folder-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete folder "${folder.name}"? Boards will be moved to parent folder.`)) {
                      handleDeleteFolder(folder.id);
                    }
                  }}
                  title="Delete folder"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            )}
          </div>
          {isExpanded && hasChildren && (
            <div className="folder-children">
              {renderFolderTree(folder.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  // Filter boards based on search query
  const getFilteredBoards = (boards) => {
    if (!searchQuery.trim() || activeTab === 'demo') {
      return boards;
    }
    const query = searchQuery.toLowerCase().trim();
    return boards.filter(board => 
      board.name.toLowerCase().includes(query)
    );
  };

  // Sort boards by lastEditedAt descending (most recent edit first)
  // Sort boards by date (most recent first)
  // Uses savedAt (creation time) for primary sorting, falls back to lastEditedAt
  // Boards with null/invalid timestamps go to the bottom
  const sortBoardsByDate = (boards) => {
    return [...boards].sort((a, b) => {
      // Get the primary timestamp (savedAt) or fallback to lastEditedAt
      const timestampA = a.savedAt || a.lastEditedAt;
      const timestampB = b.savedAt || b.lastEditedAt;
      
      // If both are null/invalid, maintain order
      if (!timestampA && !timestampB) return 0;
      
      // If only A is null, put it at the bottom
      if (!timestampA) return 1;
      
      // If only B is null, put it at the bottom
      if (!timestampB) return -1;
      
      // Both have timestamps, compare them
      const dateA = getDisplayDate(timestampA);
      const dateB = getDisplayDate(timestampB);
      
      // Sort descending (most recent first)
      return dateB.getTime() - dateA.getTime();
    });
  };

  // Categorize demo boards by use case
  const categorizeDemoBoards = (boards) => {
    const categories = {
      'Business Strategy': [],
      'Product & Development': [],
      'Customer Experience': [],
      'Personal Finances': [],
      'Other': []
    };

    boards.forEach(board => {
      const name = board.name?.toLowerCase() || '';
      
      if (name.includes('finance') || name.includes('budget') || name.includes('investment') || name.includes('debt') || name.includes('savings') || name.includes('retirement') || name.includes('portfolio')) {
        categories['Personal Finances'].push(board);
      } else if (name.includes('monetization') || name.includes('marketing') || name.includes('campaign') || name.includes('strategy')) {
        categories['Business Strategy'].push(board);
      } else if (name.includes('product') || name.includes('development') || name.includes('roadmap') || name.includes('technology') || name.includes('stack') || name.includes('architecture')) {
        categories['Product & Development'].push(board);
      } else if (name.includes('customer') || name.includes('journey') || name.includes('experience') || name.includes('user')) {
        categories['Customer Experience'].push(board);
      } else {
        categories['Other'].push(board);
      }
    });

    // Remove empty categories
    return Object.entries(categories).filter(([_, boards]) => boards.length > 0);
  };

  // Get boards filtered by selected folder and search
  const getFilteredAndGroupedBoards = () => {
    let boards = activeTab === 'demo' 
      ? sortBoardsByDate(savedWhiteboards)
      : sortBoardsByDate(getFilteredBoards(userBoards));

    // Filter by selected folder (only for personal tab)
    if (activeTab === 'personal') {
      if (selectedFolderId === null) {
        // Show all boards (no folder filter)
        return boards;
      } else {
        // Show boards in selected folder
        return boards.filter(board => board.folderId === selectedFolderId);
      }
    }

    return boards;
  };

  const displayedBoards = getFilteredAndGroupedBoards();
  const categorizedDemoBoards = activeTab === 'demo' ? categorizeDemoBoards(displayedBoards) : null;

  const styles = {
    menuContainer: {
      // ... existing styles ...
    },
    savedBoardItem: {
      display: 'flex',
      alignItems: 'center',
      padding: '8px 16px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      '&:hover': {
        backgroundColor: 'var(--hover-bg, rgba(0, 0, 0, 0.05))',
      },
      '&.selected': {
        backgroundColor: 'var(--highlight-bg, rgba(62, 184, 255, 0.1))',
        borderLeft: '3px solid var(--highlight-color, #3eb8ff)',
      }
    },
    // ... existing code ...
  };

  return (
    <div className={`saved-whiteboards-container ${isOpen ? 'menu-open' : ''}`}>
      <button 
        className="menu-toggle header-button"
        onClick={onToggle}
        title="Library"
        aria-label="Open library"
      >
        <svg 
          width="18" 
          height="18" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginRight: '6px' }}
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        <span className="menu-toggle-text">Library</span>
      </button>

      {isOpen && createPortal(
        <>
          <div 
            className="saved-whiteboards-menu-overlay"
            onClick={onToggle}
            style={{ display: 'block' }}
          />
          <div 
            className="saved-whiteboards-menu"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              display: 'flex',
              width: '90%',
              maxWidth: '1000px',
              height: '80vh',
              maxHeight: '80vh',
              borderRadius: '16px'
            }}
          >
            <div className="menu-header">
              <h2 className="menu-title">Library</h2>
              <button 
                className="saved-whiteboards-menu-close"
                onClick={onToggle}
                aria-label="Close menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="board-tabs">
            <button 
              type="button"
              className={`tab-button ${activeTab === 'demo' ? 'active' : ''}`}
              onClick={() => handleTabChange('demo')}
            >
              Templates
            </button>
            <button 
              type="button"
              className={`tab-button ${activeTab === 'personal' ? 'active' : ''}`}
              onClick={() => handleTabChange('personal')}
            >
              My Boards
            </button>
          </div>

          {error && (
            <div className="error-message">
              <svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: '#f44336' }}
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {activeTab === 'personal' && user && (
            <>
              {/* Folder Navigation */}
              <div className="folder-navigation">
                <button
                  type="button"
                  className={`folder-nav-item ${selectedFolderId === null ? 'active' : ''}`}
                  onClick={() => setSelectedFolderId(null)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  All Boards
                </button>
                {(folderStructure.rootFolders && folderStructure.rootFolders.length > 0) || folders.length > 0 ? (
                  <div className="folder-tree">
                    {folderStructure.rootFolders && folderStructure.rootFolders.length > 0 
                      ? renderFolderTree(folderStructure.rootFolders)
                      : renderFolderTree(folders.map(f => ({ ...f, children: [] })))
                    }
                  </div>
                ) : null}
                <button
                  type="button"
                  className="create-folder-btn"
                  onClick={() => {
                    setShowCreateFolder(true);
                    setNewFolderName('');
                  }}
                  disabled={isLoading}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  New Folder
                </button>
                {showCreateFolder && (
                  <form onSubmit={handleCreateFolder} className="create-folder-form">
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Folder name..."
                      autoFocus
                      className="folder-name-input"
                      onBlur={() => {
                        if (!newFolderName.trim()) {
                          setShowCreateFolder(false);
                        }
                      }}
                    />
                    <div className="folder-form-actions">
                      <button type="submit" disabled={!newFolderName.trim() || isLoading}>Create</button>
                      <button type="button" onClick={() => {
                        setShowCreateFolder(false);
                        setNewFolderName('');
                      }}>Cancel</button>
                    </div>
                  </form>
                )}
              </div>

              {/* Search */}
              <div className="search-boards">
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="search-icon"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search boards..."
                  disabled={isLoading}
                  className="search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="clear-search"
                    title="Clear search"
                  >
                    <svg 
                      width="14" 
                      height="14" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            </>
          )}

          <div className="saved-boards-list">
            {isLoading ? (
              <div className="loading-message">Loading...</div>
            ) : (
              <>
                {activeTab === 'demo' && categorizedDemoBoards ? (
                  // Render demo boards with section headers
                  categorizedDemoBoards.length > 0 ? (
                    <>
                      {categorizedDemoBoards.map(([categoryName, categoryBoards]) => (
                        <div key={categoryName} className="demo-board-section">
                          <h3 className="demo-section-header">{categoryName}</h3>
                          {categoryBoards.map((board) => {
                            const isCurrentlyOpen = board.id === currentBoardId;
                            
                            return (
                              <div 
                                key={board.id} 
                                className={`saved-board-item board-item ${isCurrentlyOpen ? 'selected' : ''}`}
                              >
                                <div className="board-item-content">
                                  <div className="board-item-header">
                                    <h3 className="board-name">{board.name}</h3>
                                    {isCurrentlyOpen && (
                                      <span className="current-badge">Current</span>
                                    )}
                                  </div>
                                  <div className="board-item-meta">
                                    <svg 
                                      width="12" 
                                      height="12" 
                                      viewBox="0 0 24 24" 
                                      fill="none" 
                                      stroke="currentColor" 
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      className="meta-icon"
                                    >
                                      <circle cx="12" cy="12" r="10" />
                                      <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    <span className="saved-date">
                                      {getDisplayDate(board.savedAt || board.lastEditedAt).toLocaleString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                </div>
                                <div className="board-actions">
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      onLoad(board.id);
                                      onToggle();
                                    }}
                                    disabled={isLoading || isCurrentlyOpen}
                                    title={isCurrentlyOpen ? "Already loaded" : "Load board"}
                                    className="load-btn"
                                  >
                                    <svg 
                                      width="16" 
                                      height="16" 
                                      viewBox="0 0 24 24" 
                                      fill="none" 
                                      stroke="currentColor" 
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4" />
                                      <polyline points="17 8 12 3 7 8" />
                                      <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="no-boards-message">
                      <svg 
                        width="24" 
                        height="24" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ opacity: 0.5 }}
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                      </svg>
                      No templates available
                    </div>
                  )
                ) : displayedBoards.length > 0 ? (
                  <>
                    {displayedBoards.map((board) => {
                      const isCurrentlyOpen = board.id === currentBoardId;
                      
                      return (
                      <div 
                        key={board.id} 
                        className={`saved-board-item board-item ${isCurrentlyOpen ? 'selected' : ''}`}
                      >
                        <div className="board-item-content">
                          <div className="board-item-header">
                            <h3 className="board-name">{board.name}</h3>
                            {isCurrentlyOpen && (
                              <span className="current-badge">Current</span>
                            )}
                          </div>
                          <div className="board-item-meta">
                            <svg 
                              width="12" 
                              height="12" 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              stroke="currentColor" 
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="meta-icon"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            <span className="saved-date">
                              {getDisplayDate(board.savedAt || board.lastEditedAt).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                        <div className="board-actions">
                          <button 
                            type="button"
                            onClick={() => {
                              onLoad(board.id);
                              onToggle();
                            }}
                            disabled={isLoading || isCurrentlyOpen}
                            title={isCurrentlyOpen ? "Already loaded" : "Load board"}
                            className="load-btn"
                          >
                            <svg 
                              width="16" 
                              height="16" 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              stroke="currentColor" 
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                          </button>
                          {activeTab === 'personal' && user && (() => {
                            const isOwner = board.userId === user.uid;
                            const tierFeatures = TIER_FEATURES[userTier] || TIER_FEATURES[USER_TIERS.FREE];
                            const canCollaborate = tierFeatures.features.realTimeCollaboration;
                            
                            return (
                              <>
                                {isOwner && canCollaborate && (
                                  <button 
                                    type="button"
                                    className="share-btn"
                                    onClick={() => {
                                      setSelectedBoardForShare({ id: board.id, name: board.name });
                                      setShareModalOpen(true);
                                    }}
                                    disabled={isLoading}
                                    title="Share board"
                                  >
                                <svg 
                                  width="16" 
                                  height="16" 
                                  viewBox="0 0 24 24" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <circle cx="18" cy="5" r="3"></circle>
                                  <circle cx="6" cy="12" r="3"></circle>
                                  <circle cx="18" cy="19" r="3"></circle>
                                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                                </svg>
                                  </button>
                                )}
                            <button 
                              type="button"
                              className="move-btn"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  if (showMoveMenu === board.id) {
                                    setShowMoveMenu(null);
                                  } else {
                                    // Refresh folders before opening menu to ensure latest folders are shown
                                    await fetchFolders();
                                    const target = e.currentTarget || e.target;
                                    if (!target) return;
                                    
                                    const rect = target.getBoundingClientRect();
                                    if (!rect) return;
                                    
                                    setMoveMenuPosition({
                                      x: rect.right - 180, // Position to the left of button
                                      y: rect.top
                                    });
                                    setShowMoveMenu(board.id);
                                  }
                                } catch (error) {
                                  console.error('Error opening move menu:', error);
                                  // Still try to open the menu even if positioning fails
                                  setShowMoveMenu(board.id);
                                }
                              }}
                              disabled={isLoading}
                              title="Move to folder"
                            >
                              <svg 
                                width="16" 
                                height="16" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                              </svg>
                            </button>
                            <button 
                              type="button"
                              className="delete-btn"
                              onClick={() => handleDeleteClick(board.id, board.name, isOwner)}
                              disabled={isLoading}
                              title={isOwner ? "Delete board" : "Remove from my boards"}
                            >
                              <svg 
                                width="16" 
                                height="16" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </>
                            );
                          })()}
                        </div>
                      </div>
                      );
                    })}
                    {activeTab === 'personal' && user && (() => {
                      const tierFeatures = TIER_FEATURES[userTier] || TIER_FEATURES[USER_TIERS.FREE];
                      const maxBoards = tierFeatures.maxMindMaps;
                      if (maxBoards !== -1 && userBoards.length >= maxBoards) {
                        return (
                          <div className="board-limit-message">
                            You've reached your limit of {maxBoards} saved board{maxBoards !== 1 ? 's' : ''}. Upgrade your plan to save more boards.
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </>
                ) : (
                  <div className="no-boards-message">
                    <svg 
                      width="24" 
                      height="24" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ opacity: 0.5 }}
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    {activeTab === 'demo' 
                      ? 'No demo boards available' 
                      : 'No personal boards saved yet'}
                  </div>
                )}
              </>
            )}
          </div>
          </div>
        </>,
        document.body
      )}
      {selectedBoardForShare && (
        <ShareBoardModal
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setSelectedBoardForShare(null);
          }}
          boardId={selectedBoardForShare.id}
          boardName={selectedBoardForShare.name}
        />
      )}

      {/* Move Menu - Rendered via Portal */}
      {showMoveMenu && (() => {
        const board = userBoards.find(b => b.id === showMoveMenu);
        if (!board) return null;
        
        // Use folderStructure.flatList to ensure we have the latest folders
        const currentFolders = folderStructure.flatList || folders;
        
        return createPortal(
          <>
            <div 
              className="move-menu-overlay"
              onClick={() => setShowMoveMenu(null)}
            />
            <div 
              className="move-menu"
              style={{
                position: 'fixed',
                left: `${moveMenuPosition.x}px`,
                top: `${moveMenuPosition.y}px`,
                transform: 'translateY(8px)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="move-menu-header">Move to folder</div>
              <button
                type="button"
                className={`move-menu-item ${!board.folderId ? 'active' : ''}`}
                onClick={() => handleMoveBoard(board.id, null)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Root (No folder)
              </button>
              {currentFolders.map(folder => (
                <button
                  key={folder.id}
                  type="button"
                  className={`move-menu-item ${board.folderId === folder.id ? 'active' : ''}`}
                  onClick={() => handleMoveBoard(board.id, folder.id)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  {folder.name}
                </button>
              ))}
              {currentFolders.length === 0 && (
                <div className="move-menu-empty">No folders yet</div>
              )}
            </div>
          </>,
          document.body
        );
      })()}

      {/* Delete Confirmation Dialog - Rendered via Portal */}
      {deleteConfirmOpen && createPortal(
        <>
          <div 
            className="delete-confirm-overlay"
            onClick={handleDeleteCancel}
          />
          <div className="delete-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-header">
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="delete-confirm-icon"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <h3 className="delete-confirm-title">Delete Board?</h3>
            </div>
            <p className="delete-confirm-message">
              {isDeletingOwnedBoard ? (
                <>
                  Are you sure you want to delete <strong>"{boardToDelete?.name}"</strong>? This action cannot be undone and will permanently delete the board for all users.
                </>
              ) : (
                <>
                  Remove <strong>"{boardToDelete?.name}"</strong> from your boards? You'll lose access to this board, but it will remain available to the owner and other collaborators.
                </>
              )}
            </p>
            <div className="delete-confirm-actions">
              <button
                type="button"
                className="delete-confirm-cancel"
                onClick={handleDeleteCancel}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="delete-confirm-delete"
                onClick={handleDeleteConfirm}
                disabled={isLoading}
              >
                {isLoading 
                  ? (isDeletingOwnedBoard ? 'Deleting...' : 'Removing...') 
                  : (isDeletingOwnedBoard ? 'Delete' : 'Remove')
                }
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default SavedWhiteboardsMenu; 