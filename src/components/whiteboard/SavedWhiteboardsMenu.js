import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserBoards, saveBoard, deleteBoard } from '../../services/boardService';

const SavedWhiteboardsMenu = ({ 
  savedWhiteboards, // This will now be used only for demo boards
  onLoad,
  currentWhiteboard, 
  isOpen, // Receive open state from parent
  onToggle, // Receive toggle function from parent
  currentBoardId // Add this prop to track current board
}) => {
  const { user } = useAuth();
  const [newBoardName, setNewBoardName] = useState('');
  const [activeTab, setActiveTab] = useState('demo');
  const [userBoards, setUserBoards] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasLoadedBoards, setHasLoadedBoards] = useState(false);

  // Fetch boards when the menu is opened and tab is personal (if not already loaded)
  useEffect(() => {
    if (isOpen && activeTab === 'personal' && user && !hasLoadedBoards) {
      fetchUserBoards();
    }
  }, [isOpen, activeTab, user, hasLoadedBoards]); // Dependencies for fetching

  const fetchUserBoards = async () => {
    if (!user) {
      setError('Please sign in to view your boards');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const boards = await getUserBoards(user.uid);
      console.log('Fetched user boards:', boards);
      setUserBoards(boards);
      setHasLoadedBoards(true);
    } catch (error) {
      console.error('Error fetching user boards:', error);
      setError(error.message || 'Failed to load boards');
      setUserBoards([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError(null);
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

  const cleanItem = (item) => {
    if (!item || typeof item !== 'object') {
      console.warn('Invalid item:', item);
      return null;
    }

    if (item.type === 'chart') {
      return cleanChartConfig(item);
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

      // Always preserve the storageRef for images
      if (item.storageRef) {
        cleanedImage.storageRef = String(item.storageRef);
      } else {
        console.error('Image item missing storage reference:', {
          itemId: cleanedImage.id,
          type: cleanedImage.type,
          position: cleanedImage.position
        });
      }

      return cleanedImage;
    }

    // Clean non-chart items (rectangles, circles, sticky notes)
    return {
      id: String(item.id || Date.now()),
      type: String(item.type || 'sticky'),
      position: {
        x: Number(item.position?.x || 0),
        y: Number(item.position?.y || 0)
      },
      width: Number(item.width || 200),
      height: Number(item.height || 200),
      text: String(item.text || '')
    };
  };

  const cleanConnection = (conn) => {
    return {
      id: String(conn.id || `connection-${Date.now()}`),
      from: String(conn.from),
      to: String(conn.to)
    };
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

      // Create the board data with cleaned values
      const boardData = {
        name: String(boardName.trim()),
        savedAt: new Date().toISOString(),
        userId: String(user.uid),
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
      }

      // Log the cleaned data for debugging
      console.log('Cleaned board data for Firestore:', JSON.stringify(boardData, null, 2));

      const savedBoard = await saveBoard(boardData, user.uid);
      console.log('Board saved successfully:', savedBoard);
      
      if (existingBoardId) {
        // Update existing board in the list
        setUserBoards(prev => prev.map(board => 
          board.id === existingBoardId ? savedBoard : board
        ));
      } else {
        // Add new board to the list
        setUserBoards(prev => [savedBoard, ...prev]);
        setNewBoardName('');
      }
      onToggle(); // Close menu after save
    } catch (error) {
      console.error('Error saving board:', error);
      setError(error.message || 'Failed to save board');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (boardId) => {
    if (!user) {
      setError('Please sign in to delete boards');
      return;
    }
    if (!boardId) {
      setError('Invalid board selected');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await deleteBoard(boardId);
      setUserBoards(prev => prev.filter(board => board.id !== boardId));
    } catch (error) {
      console.error('Error deleting board:', error);
      setError(error.message || 'Failed to delete board');
    } finally {
      setIsLoading(false);
    }
  };

  const displayedBoards = activeTab === 'demo' ? savedWhiteboards : userBoards;

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
    <div className="saved-whiteboards-container">
      <button 
        className="menu-toggle header-button"
        onClick={onToggle}
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
          style={{ marginRight: '4px' }}
        >
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        Saved 
      </button>

      {isOpen && (
        <div className="saved-whiteboards-menu">
          <div className="board-tabs">
            <button 
              type="button"
              className={`tab-button ${activeTab === 'demo' ? 'active' : ''}`}
              onClick={() => handleTabChange('demo')}
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
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <path d="M3.3 7l8.7 5 8.7-5" />
              </svg>
              Demo Boards
            </button>
            <button 
              type="button"
              className={`tab-button ${activeTab === 'personal' ? 'active' : ''}`}
              onClick={() => handleTabChange('personal')}
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
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
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
            <form 
              className="save-new-board" 
              onSubmit={(e) => handleSave(e, newBoardName)}
            >
              <input
                type="text"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="Enter board name"
                disabled={isLoading}
              />
              <button 
                type="submit"
                disabled={isLoading || !newBoardName.trim()}
              >
                {isLoading ? (
                  <span className="loading-spinner" />
                ) : (
                  <>
                    <svg 
                      width="14" 
                      height="14" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ marginRight: '4px' }}
                    >
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <line x1="12" y1="9" x2="12" y2="15" />
                      <line x1="9" y1="12" x2="15" y2="12" />
                    </svg>
                    Save Current
                  </>
                )}
              </button>
            </form>
          )}

          <div className="saved-boards-list">
            {isLoading ? (
              <div className="loading-message">Loading...</div>
            ) : (
              <>
                {displayedBoards.length > 0 ? (
                  displayedBoards.map((board) => (
                    <div 
                      key={board.id} 
                      className={`saved-board-item ${board.id === currentBoardId ? 'selected' : ''}`}
                    >
                      <span>
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
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <line x1="10" y1="9" x2="8" y2="9" />
                        </svg>
                        {board.name}
                      </span>
                      <span className="saved-date">
                        <svg 
                          width="12" 
                          height="12" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {new Date(board.savedAt).toLocaleDateString()}
                      </span>
                      <div className="board-actions">
                        <button 
                          type="button"
                          onClick={() => {
                            onLoad(board.id, board.content);
                            onToggle();
                          }}
                          disabled={isLoading}
                          title="Load board"
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
                            <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                        </button>
                        {(activeTab === 'personal' && user?.uid === board.userId) && (
                          <>
                            <button 
                              type="button"
                              className="save-btn"
                              onClick={(e) => handleSave(e, board.name, board.id)}
                              disabled={isLoading}
                              title="Update this board"
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
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                <polyline points="17 21 17 13 7 13 7 21" />
                                <polyline points="7 3 7 8 15 8" />
                              </svg>
                            </button>
                            <button 
                              type="button"
                              className="delete-btn"
                              onClick={() => handleDelete(board.id)}
                              disabled={isLoading}
                              title="Delete board"
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
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
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
      )}
    </div>
  );
};

export default SavedWhiteboardsMenu; 