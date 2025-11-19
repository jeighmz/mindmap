import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  joinBoard,
  leaveBoard,
  updatePresence,
  subscribeToCollaborators
} from '../../services/collaborationService';
import { getUserProfilePicture, handleImageError } from '../../utils/profilePicture';
import '../../styles/CollaboratorsBar.css';

const CollaboratorsBar = ({ boardId }) => {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState([]);
  const [presenceId, setPresenceId] = useState(null);
  const heartbeatIntervalRef = useRef(null);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    if (!boardId || !user) return;

    // Join board
    const initializePresence = async () => {
      try {
        const id = await joinBoard(boardId, {
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL
        });
        setPresenceId(id);
      } catch (error) {
        console.error('Error joining board:', error);
      }
    };

    initializePresence();

    // Set up heartbeat (update presence every 30 seconds)
    heartbeatIntervalRef.current = setInterval(async () => {
      if (presenceId) {
        try {
          await updatePresence(boardId, presenceId);
        } catch (error) {
          console.error('Error updating presence:', error);
        }
      }
    }, 30000);

    // Subscribe to collaborators
    unsubscribeRef.current = subscribeToCollaborators(boardId, (collabs) => {
      // Filter out current user
      const otherCollaborators = collabs.filter(
        collab => collab.userId !== user.uid
      );
      setCollaborators(otherCollaborators);
    });

    // Cleanup on unmount
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      // Leave board
      if (presenceId) {
        leaveBoard(boardId, presenceId).catch(console.error);
      }
    };
  }, [boardId, user]);

  // Update presence ID when it changes
  useEffect(() => {
    if (presenceId && boardId) {
      // Update heartbeat to use new presence ID
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      heartbeatIntervalRef.current = setInterval(async () => {
        try {
          await updatePresence(boardId, presenceId);
        } catch (error) {
          console.error('Error updating presence:', error);
        }
      }, 30000);
    }
  }, [presenceId, boardId]);

  // Cleanup on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (presenceId && boardId) {
        leaveBoard(boardId, presenceId).catch(console.error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [presenceId, boardId]);


  if (collaborators.length === 0) {
    return null;
  }

  return (
    <div className="collaborators-island">
      <div className="collaborators-island-label">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      </div>
      <div className="collaborators-avatars">
        {collaborators.map((collab) => (
          <div
            key={collab.id || collab.userId}
            className="collaborator-avatar-wrapper"
            title={collab.userName || collab.userEmail}
          >
            <img
              src={getUserProfilePicture({
                photoURL: collab.userPhotoURL,
                email: collab.userEmail
              })}
              alt={collab.userName || collab.userEmail}
              className="collaborator-avatar-small"
              onError={(e) => handleImageError(e, { email: collab.userEmail })}
            />
            <div className="collaborator-status-indicator" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CollaboratorsBar;

