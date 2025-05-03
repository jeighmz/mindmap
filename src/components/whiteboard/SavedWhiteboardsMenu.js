import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserBoards, saveBoard, deleteBoard } from '../../services/boardService';

const SavedWhiteboardsMenu = ({ 
  savedWhiteboards, // This will now be used only for demo boards
  onLoad,
  currentWhiteboard, 
  isOpen, // Receive open state from parent
  onToggle // Receive toggle function from parent
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
    if (item.type === 'chart') {
      return cleanChartConfig(item);
    }

    if (item.type === 'image') {
      return {
        id: String(item.id || Date.now()),
        type: 'image',
        position: {
          x: Number(item.position?.x || 0),
          y: Number(item.position?.y || 0)
        },
        width: Number(item.width || 400),
        height: Number(item.height || 300),
        imageUrl: String(item.imageUrl || '')
      };
    }

    // Clean non-chart items
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

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('Please sign in to save boards');
      return;
    }
    if (!newBoardName.trim()) {
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
        name: String(newBoardName.trim()),
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

      // Log the cleaned data for debugging
      console.log('Cleaned board data for Firestore:', JSON.stringify(boardData, null, 2));

      const savedBoard = await saveBoard(boardData, user.uid);
      console.log('Board saved successfully:', savedBoard);
      
      setUserBoards(prev => [savedBoard, ...prev]);
      setNewBoardName('');
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

  return (
    <div className="saved-whiteboards-container">
      <button 
        className="menu-toggle header-button"
        onClick={onToggle}
      >
        📋 Saved 
      </button>

      {isOpen && (
        <div className="saved-whiteboards-menu">
          <div className="board-tabs">
            <button 
              type="button"
              className={`tab-button ${activeTab === 'demo' ? 'active' : ''}`}
              onClick={() => handleTabChange('demo')}
            >
              Demo Boards
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
              {error}
            </div>
          )}

          {activeTab === 'personal' && user && (
            <form 
              className="save-new-board" 
              onSubmit={handleSave}
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
                {isLoading ? 'Saving...' : 'Save Current'}
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
                    <div key={board.id} className="saved-board-item">
                      <span>{board.name}</span>
                      <span className="saved-date">
                        {new Date(board.savedAt).toLocaleDateString()}
                      </span>
                      <div className="board-actions">
                        <button 
                          type="button"
                          onClick={() => {
                            console.log(`Loading board ${board.id}:`, board);
                            console.log('Board content structure:', board.content);
                            onLoad(board.id, board.content);
                            onToggle(); // Close menu after loading
                          }}
                          disabled={isLoading}
                        >
                          Load
                        </button>
                        {(activeTab === 'personal' && user?.uid === board.userId) && (
                          <button 
                            type="button"
                            className="delete-btn"
                            onClick={() => handleDelete(board.id)}
                            disabled={isLoading}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-boards-message">
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