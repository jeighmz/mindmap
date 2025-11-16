import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserBoards, saveBoard, deleteBoard } from '../../services/boardService';
import '../../styles/SavedWhiteboardsMenu.css';

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
  const [activeTab, setActiveTab] = useState(user ? 'personal' : 'demo');
  const [userBoards, setUserBoards] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Update activeTab when user logs in/out
  useEffect(() => {
    if (user && activeTab === 'demo') {
      setActiveTab('personal');
    } else if (!user && activeTab === 'personal') {
      setActiveTab('demo');
    }
  }, [user]);

  // Fetch boards when the menu is opened and tab is personal
  useEffect(() => {
    if (isOpen && activeTab === 'personal' && user) {
      fetchUserBoards();
    }
  }, [isOpen, activeTab, user]); // Removed hasLoadedBoards to allow refresh on open

  const fetchUserBoards = async () => {
    if (!user) {
      setError('Please sign in to view your boards');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const boards = await getUserBoards(user.uid);
      // Sort by savedAt descending (most recent first)
      const sortedBoards = [...boards].sort((a, b) => {
        const dateA = new Date(a.savedAt || 0);
        const dateB = new Date(b.savedAt || 0);
        return dateB - dateA;
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

  const cleanItem = (item) => {
    if (!item || typeof item !== 'object') {
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

      // Preserve storageRef for Firebase Storage images
      if (item.storageRef) {
        cleanedImage.storageRef = String(item.storageRef);
      }

      // Preserve imageUrl for data URLs (local images)
      if (item.imageUrl && item.imageUrl.startsWith('data:')) {
        cleanedImage.imageUrl = String(item.imageUrl);
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
      text: String(item.text || ''),
      title: String(item.title || ''),
    };
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

      const savedBoard = await saveBoard(boardData, user.uid);
      
      if (existingBoardId) {
        // Update existing board in the list and re-sort by savedAt
        setUserBoards(prev => {
          const updated = prev.map(board => 
            board.id === existingBoardId ? savedBoard : board
          );
          // Sort by savedAt descending (most recent first)
          return updated.sort((a, b) => {
            const dateA = new Date(a.savedAt || 0);
            const dateB = new Date(b.savedAt || 0);
            return dateB - dateA;
          });
        });
      } else {
        // Add new board to the list and re-sort
        setUserBoards(prev => {
          const updated = [savedBoard, ...prev];
          // Sort by savedAt descending (most recent first)
          return updated.sort((a, b) => {
            const dateA = new Date(a.savedAt || 0);
            const dateB = new Date(b.savedAt || 0);
            return dateB - dateA;
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
      setError(error.message || 'Failed to delete board');
    } finally {
      setIsLoading(false);
    }
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

  // Sort boards by savedAt descending (most recent first)
  const sortBoardsByDate = (boards) => {
    return [...boards].sort((a, b) => {
      const dateA = new Date(a.savedAt || 0);
      const dateB = new Date(b.savedAt || 0);
      return dateB - dateA;
    });
  };

  const displayedBoards = activeTab === 'demo' 
    ? sortBoardsByDate(savedWhiteboards)
    : sortBoardsByDate(getFilteredBoards(userBoards));

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
        title="Library"
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
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        Library 
      </button>

      {isOpen && (
        <>
          <div 
            className="saved-whiteboards-menu-overlay"
            onClick={onToggle}
          />
          <div 
            className="saved-whiteboards-menu"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="saved-whiteboards-menu-close"
              onClick={onToggle}
              aria-label="Close menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
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
                        {board.name}
                      </span>
                      <span className="saved-date">
                        {new Date(board.savedAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </span>
                      <div className="board-actions">
                        <button 
                          type="button"
                          onClick={() => {
                            onLoad(board.id);
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
        </>
      )}
    </div>
  );
};

export default SavedWhiteboardsMenu; 