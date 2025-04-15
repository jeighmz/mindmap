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
      console.log('Current whiteboard data being saved:', currentWhiteboard);
      
      // Ensure the content has the proper structure
      const boardData = {
        name: newBoardName.trim(),
        content: {
          items: currentWhiteboard?.items || [],
          connections: currentWhiteboard?.connections || [],
          scale: currentWhiteboard?.scale || 1,
          panOffset: currentWhiteboard?.panOffset || { x: 0, y: 0 }
        }
      };
      
      console.log('Structured board data for Firestore:', boardData);

      const savedBoard = await saveBoard(boardData, user.uid);
      console.log('Board saved to Firestore with response:', savedBoard);
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
        📋 Saved Boards
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