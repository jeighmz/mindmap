import React, { useState } from 'react';
import { useDrag } from 'react-dnd';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { storage } from '../../firebase-config';
import { useAuth } from '../../contexts/AuthContext';

import AgentChat from './agent/AgentChat';

const ToolbarItem = ({ type, icon, chartType }) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'WHITEBOARD_ITEM',
    item: { type, chartType },
    collect: monitor => ({
      isDragging: monitor.isDragging()
    })
  }));

  const handleImageClick = async () => {
    if (!user) {
      alert('Please sign in to add images');
      return;
    }

    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      
      input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          setIsUploading(true);
          
          // Validate file type and size
          if (!file.type.startsWith('image/')) {
            throw new Error('Please select an image file');
          }
          if (file.size > 10 * 1024 * 1024) { // 10MB limit
            throw new Error('Image size must be less than 10MB');
          }

          // Create temporary URL for preview
          const tempUrl = URL.createObjectURL(file);
          
          // Create a new image element to get dimensions
          const img = new Image();
          img.onload = async () => {
            try {
              // Calculate dimensions while maintaining aspect ratio
              const maxWidth = 400;
              const maxHeight = 300;
              let width = img.width;
              let height = img.height;
              
              if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
              }
              if (height > maxHeight) {
                width = (maxHeight / height) * width;
                height = maxHeight;
              }

              // Create sanitized filename
              const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
              const storagePath = `mindmap-images/${user.uid}/${fileName}`;
              
              // Verify storage is properly initialized
              if (!storage) {
                throw new Error('Firebase Storage is not properly initialized');
              }

              // Verify storage bucket is configured
              const storageBucket = storage.app?.options?.storageBucket;
              if (!storageBucket) {
                throw new Error('Storage bucket is not configured. Please check your Firebase configuration.');
              }

              const imageRef = ref(storage, storagePath);

              // Upload with better error handling
              // A 412 error can occur due to metadata issues or auth token problems
              let uploadResult;
              try {
                // Get the Firebase user from auth to access getIdToken method
                const auth = getAuth();
                const firebaseUser = auth.currentUser;
                
                if (firebaseUser) {
                  // Verify user auth token is still valid before upload
                  try {
                    await firebaseUser.getIdToken(true); // Force refresh
                  } catch (tokenError) {
                    // Continue with upload even if token refresh fails
                  }
                }
                
                // Try upload with just contentType (metadata can cause 412 errors)
                uploadResult = await uploadBytes(imageRef, file, {
                  contentType: file.type
                });
              } catch (uploadError) {
                throw uploadError;
              }

              if (!uploadResult || !uploadResult.ref) {
                throw new Error('Storage upload failed - no reference returned');
              }

              // Get the download URL with error handling
              const downloadUrl = await getDownloadURL(imageRef).catch(error => {
                throw new Error(`Failed to get download URL: ${error.message}`);
              });

              const newItem = {
                type: 'image',
                imageUrl: downloadUrl,
                width,
                height,
                position: { x: 100, y: 100 },
                storageRef: storagePath
              };

              // Dispatch event to add image to canvas
              const event = new CustomEvent('addImageItem', { detail: newItem });
              window.dispatchEvent(event);
            } catch (error) {
              // Provide more specific error messages
              let errorMessage = 'Failed to upload image';
              if (error.code === 'storage/unauthorized') {
                errorMessage = 'You are not authorized to upload images. Please check your permissions.';
              } else if (error.code === 'storage/quota-exceeded') {
                errorMessage = 'Storage quota exceeded. Please try a smaller image or contact support.';
              } else if (error.code === 'storage/unauthenticated') {
                errorMessage = 'Please sign in again to upload images.';
              } else if (error.code === 'storage/unknown') {
                // Check if it's a 412 error specifically
                if (error.message && error.message.includes('412')) {
                  errorMessage = 'Upload failed due to authentication or permissions. Please try signing out and signing back in, or contact support if the issue persists.';
                } else {
                  errorMessage = 'An unknown storage error occurred. Please check your internet connection and try again.';
                }
              } else {
                errorMessage = `Upload failed: ${error.message}`;
              }
              
              alert(errorMessage);
              URL.revokeObjectURL(tempUrl);
            }
          };
          
          img.onerror = () => {
            alert('Failed to process image. Please try a different image file.');
            setIsUploading(false);
          };
          
          img.src = tempUrl;
        } catch (error) {
          alert('Failed to add image: ' + error.message);
        } finally {
          setIsUploading(false);
        }
      }
    };
    
    // Add error handler for file input
    input.onerror = (e) => {
      setIsUploading(false);
      alert('Error opening file picker. Please try again.');
    };
    
    // Add cancel handler (when user closes file picker without selecting)
    input.oncancel = () => {
      setIsUploading(false);
    };
    
    input.click();
    } catch (error) {
      alert('Failed to open file picker: ' + error.message);
    }
  };

  return (
    <div
      ref={type === 'image' ? null : drag}
      className={`toolbar-item ${isUploading ? 'uploading' : ''}`}
      style={{ opacity: isDragging ? 0.5 : 1, cursor: type === 'image' ? 'pointer' : 'grab' }}
      onClick={type === 'image' ? handleImageClick : undefined}
    >
      {icon}
      {isUploading && <div className="upload-spinner"></div>}
    </div>
  );
};

const WhiteboardToolbar = ({ onOpenMindMapPanel, onOpenSearchPanel, items, connections, highlightedItems = [], isLibraryOpen = false }) => {
  const tools = [
    { 
      type: 'sticky', 
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <line x1="8" y1="10" x2="16" y2="10" />
          <line x1="8" y1="14" x2="16" y2="14" />
        </svg>
      )
    },
    { 
      type: 'rectangle', 
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="1" />
        </svg>
      )
    },
    { 
      type: 'circle', 
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="8" />
        </svg>
      )
    },
    { 
      type: 'chart', 
      chartType: 'xy',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="20" x2="20" y2="20" />
          <line x1="4" y1="20" x2="4" y2="4" />
          <path d="M7 14l3-3 4 4 4-8" />
        </svg>
      )
    },
    { 
      type: 'chart', 
      chartType: 'sine',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 12c2-2.67 4-4 6-4s4 1.33 6 4c2 2.67 4 4 6 4s4-1.33 6-4" />
        </svg>
      )
    },
    { 
      type: 'image', 
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      )
    },
  ];

  const [isAgentChatOpen, setIsAgentChatOpen] = useState(false);

  return (
    <div className={`whiteboard-toolbar ${isLibraryOpen ? 'hidden' : ''}`}>
      {tools.map((tool, index) => (
        <ToolbarItem
          key={`${tool.type}-${index}`}
          type={tool.type}
          icon={tool.icon}
          chartType={tool.chartType}
        />
      ))}
      <div className="toolbar-item separator"></div>
      <button 
        className="toolbar-item mind-map-button"
        onClick={onOpenMindMapPanel}
        title="Generate Mind Map"
        style={{
          cursor: 'pointer',
          transition: 'transform 0.2s ease, background-color 0.2s ease'
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 4v4" />
          <path d="M12 16v4" />
          <path d="M4 12h4" />
          <path d="M16 12h4" />
          <path d="M7 7l2 2" />
          <path d="M15 15l2 2" />
          <path d="M15 7l-2 2" />
          <path d="M7 15l2 2" />
        </svg>
      </button>
      <button 
        className="toolbar-item ai-button"
        onClick={onOpenSearchPanel}
        title="AI Analysis Chat"
        style={{
          cursor: 'pointer',
          transition: 'transform 0.2s ease, background-color 0.2s ease'
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M8 10h.01" />
          <path d="M12 10h.01" />
          <path d="M16 10h.01" />
        </svg>
      </button>
      {/* Agent chat button temporarily disabled
      <button 
        className="toolbar-item"
        onClick={() => setIsAgentChatOpen(true)}
        title="Open AI Agent Chat"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z" />
          <path d="M12 6v6l4 2" />
        </svg>
      </button>
      <AgentChat
        isOpen={isAgentChatOpen}
        onClose={() => setIsAgentChatOpen(false)}
        mindMapItems={items}
        connections={connections}
        highlightedItems={highlightedItems}
      />
      */}
    </div>
    
  );
};

export default WhiteboardToolbar; 