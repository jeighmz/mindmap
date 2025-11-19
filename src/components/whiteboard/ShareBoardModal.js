import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  shareBoard, 
  unshareBoard, 
  getBoardCollaborators, 
  updateSharePermission 
} from '../../services/sharingService';
import { getUserProfilePicture, handleImageError } from '../../utils/profilePicture';
import '../../styles/ShareBoardModal.css';

const ShareBoardModal = ({ isOpen, onClose, boardId, boardName }) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState('viewer');
  const [collaborators, setCollaborators] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (isOpen && boardId) {
      fetchCollaborators();
    }
  }, [isOpen, boardId]);

  const fetchCollaborators = async () => {
    if (!boardId) return;
    
    setIsLoadingCollaborators(true);
    setError(null);
    try {
      const collabs = await getBoardCollaborators(boardId);
      setCollaborators(collabs);
    } catch (err) {
      console.error('Error fetching collaborators:', err);
      setError(err.message || 'Failed to load collaborators');
    } finally {
      setIsLoadingCollaborators(false);
    }
  };

  const handleShare = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await shareBoard(boardId, email.trim(), permission);
      setSuccess(`Board shared with ${email.trim()}!`);
      setEmail('');
      setPermission('viewer');
      await fetchCollaborators();
    } catch (err) {
      setError(err.message || 'Failed to share board');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnshare = async (shareId, collaboratorEmail) => {
    if (!window.confirm(`Remove ${collaboratorEmail} from this board?`)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await unshareBoard(boardId, shareId);
      setSuccess(`${collaboratorEmail} removed from board`);
      await fetchCollaborators();
    } catch (err) {
      setError(err.message || 'Failed to remove collaborator');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermissionChange = async (shareId, newPermission) => {
    setIsLoading(true);
    setError(null);

    try {
      await updateSharePermission(shareId, newPermission);
      await fetchCollaborators();
    } catch (err) {
      setError(err.message || 'Failed to update permission');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <h3>Share Board</h3>
          <button className="share-modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="share-modal-body">
          {error && (
            <div className="share-message error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {error}
            </div>
          )}

          {success && (
            <div className="share-message success">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              {success}
            </div>
          )}

          <form onSubmit={handleShare} className="share-form">
            <div className="form-group">
              <label htmlFor="share-email">Share with</label>
              <div className="share-input-group">
                <input
                  id="share-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  disabled={isLoading}
                  className="share-email-input"
                />
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value)}
                  disabled={isLoading}
                  className="share-permission-select"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="share-submit-button"
                >
                  {isLoading ? 'Sharing...' : 'Share'}
                </button>
              </div>
              <small>Viewers can view the board. Editors can make changes.</small>
            </div>
          </form>

          <div className="collaborators-section">
            <h4>Collaborators</h4>
            {isLoadingCollaborators ? (
              <div className="loading-collaborators">Loading...</div>
            ) : collaborators.length === 0 ? (
              <div className="no-collaborators">No collaborators yet</div>
            ) : (
              <div className="collaborators-list">
                {collaborators.map((collab) => (
                  <div key={collab.userId || collab.shareId} className="collaborator-item">
                    <div className="collaborator-info">
                      <img
                        src={getUserProfilePicture({
                          photoURL: collab.photoURL,
                          email: collab.email
                        })}
                        alt={collab.displayName || collab.email}
                        className="collaborator-avatar"
                        onError={(e) => handleImageError(e, { email: collab.email })}
                      />
                      <div className="collaborator-details">
                        <div className="collaborator-name">
                          {collab.displayName || collab.email}
                          {collab.isOwner && (
                            <span className="owner-badge">Owner</span>
                          )}
                        </div>
                        <div className="collaborator-email">{collab.email}</div>
                      </div>
                    </div>
                    <div className="collaborator-actions">
                      {!collab.isOwner && (
                        <>
                          <select
                            value={collab.permission}
                            onChange={(e) => handlePermissionChange(collab.shareId, e.target.value)}
                            disabled={isLoading}
                            className="permission-select"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </select>
                          <button
                            onClick={() => handleUnshare(collab.shareId, collab.email)}
                            disabled={isLoading}
                            className="remove-collaborator-button"
                            title="Remove collaborator"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ShareBoardModal;

