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

    console.log('Starting image addition process...', { 
      userId: user.uid,
      userEmail: user.email,
      isAuthenticated: !!user
    });

    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      
      console.log('File input created, setting up handler...');
      
      input.onchange = async (e) => {
        console.log('File input changed event fired');
      const file = e.target.files[0];
      if (file) {
        try {
          setIsUploading(true);
          console.log('File selected:', {
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified
          });
          
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
                console.error('❌ STORAGE CONFIG ERROR: Storage bucket is not configured');
                throw new Error('Storage bucket is not configured. Please check your Firebase configuration.');
              }

              console.log('📦 STORAGE: Using storage instance:', {
                app: storage.app.name,
                bucket: storageBucket,
                isInitialized: !!storage
              });

              const imageRef = ref(storage, storagePath);
              
              console.log('📦 STORAGE: Starting immediate image upload:', {
                path: storagePath,
                contentType: file.type,
                fileSize: file.size,
                storageRef: imageRef.fullPath
              });

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
                    const authToken = await firebaseUser.getIdToken(true); // Force refresh
                    console.log('📦 STORAGE: User authenticated, token obtained');
                  } catch (tokenError) {
                    console.warn('📦 STORAGE: Could not refresh token, proceeding with upload:', tokenError);
                  }
                } else {
                  console.warn('📦 STORAGE: No Firebase user found, proceeding with upload');
                }
                
                // Try upload with just contentType (metadata can cause 412 errors)
                console.log('📦 STORAGE: Attempting upload...');
                uploadResult = await uploadBytes(imageRef, file, {
                  contentType: file.type
                });
              } catch (uploadError) {
                console.error('📦 STORAGE ERROR: Upload failed with details:', {
                  code: uploadError.code,
                  message: uploadError.message,
                  serverResponse: uploadError.serverResponse,
                  name: uploadError.name,
                  stack: uploadError.stack,
                  fullError: uploadError,
                  storageBucket: storageBucket,
                  storagePath: storagePath,
                  userUID: user.uid,
                  authTokenExists: !!user
                });
                
                // 412 Precondition Failed - usually means storage rules or metadata issue
                if (uploadError.code === 'storage/unknown' && uploadError.message.includes('412')) {
                  console.error('❌ 412 Precondition Failed - Possible causes:');
                  console.error('1. Storage rules may be rejecting the request');
                  console.error('2. Authentication token may be invalid or expired');
                  console.error('3. Storage bucket CORS configuration may need updating');
                  console.error('4. Try deploying storage rules: firebase deploy --only storage');
                } else if (!uploadError.code) {
                  console.error('❌ No error code provided - this might be a network or CORS issue');
                  console.error('Check:');
                  console.error('1. Is the storage bucket enabled in Firebase Console?');
                  console.error('2. Are storage rules properly configured?');
                  console.error('3. Is there a CORS configuration issue?');
                  console.error('4. Is the network connection stable?');
                }
                
                throw uploadError;
              }

              if (!uploadResult || !uploadResult.ref) {
                throw new Error('Storage upload failed - no reference returned');
              }

              console.log('📦 STORAGE: Upload completed successfully:', {
                path: uploadResult.ref.fullPath,
                contentType: uploadResult.metadata.contentType,
                size: uploadResult.metadata.size,
                timeCreated: uploadResult.metadata.timeCreated
              });

              // Get the download URL with error handling
              const downloadUrl = await getDownloadURL(imageRef).catch(error => {
                console.error('📦 STORAGE ERROR: Failed to get download URL:', {
                  code: error.code,
                  message: error.message,
                  storageRef: imageRef.fullPath
                });
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

              console.log('Dispatching new image item:', {
                id: Date.now(),
                storageRef: newItem.storageRef,
                hasUrl: !!newItem.imageUrl,
                urlLength: newItem.imageUrl?.length
              });

              // Dispatch event to add image to canvas
              const event = new CustomEvent('addImageItem', { detail: newItem });
              window.dispatchEvent(event);
            } catch (error) {
              console.error('📦 STORAGE ERROR: Failed to upload image:', {
                error: error.message,
                code: error.code,
                name: error.name,
                stack: error.stack,
                user: user.uid,
                fileSize: file.size,
                fileType: file.type
              });
              
              console.error('📦 STORAGE ERROR DETAILS:', {
                code: error.code,
                message: error.message,
                serverResponse: error.serverResponse
              });
              
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
              
              // Log additional debug information for unknown errors
              if (error.code === 'storage/unknown' || !error.code) {
                console.error('🔍 Unknown storage error - full error details:', {
                  error: error,
                  errorString: JSON.stringify(error, Object.getOwnPropertyNames(error)),
                  errorMessage: error.message,
                  errorName: error.name,
                  errorStack: error.stack,
                  storageBucket: storage?.app?.options?.storageBucket,
                  storageApp: storage?.app?.name,
                  userAuthenticated: !!user,
                  userUID: user?.uid,
                  userEmail: user?.email,
                  fileSize: file?.size,
                  fileType: file?.type,
                  fileName: file?.name
                });
              }
              
              alert(errorMessage);
              URL.revokeObjectURL(tempUrl);
            }
          };
          
          img.onerror = () => {
            console.error('Failed to load image for dimension calculation');
            alert('Failed to process image. Please try a different image file.');
            setIsUploading(false);
          };
          
          img.src = tempUrl;
        } catch (error) {
          console.error('Error preparing image:', error);
          alert('Failed to add image: ' + error.message);
        } finally {
          setIsUploading(false);
        }
      }
    };
    
    // Add error handler for file input
    input.onerror = (e) => {
      console.error('File input error:', e);
      setIsUploading(false);
      alert('Error opening file picker. Please try again.');
    };
    
    // Add cancel handler (when user closes file picker without selecting)
    input.oncancel = () => {
      console.log('File picker cancelled by user');
      setIsUploading(false);
    };
    
    console.log('Opening file picker...');
    input.click();
    console.log('File picker opened (user should see file selection dialog)');
    } catch (error) {
      console.error('Error setting up file input:', error);
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

const WhiteboardToolbar = ({ onOpenMindMapPanel, items, connections }) => {
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
    <div className="whiteboard-toolbar">
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
      />
      */}
    </div>
    
  );
};

export default WhiteboardToolbar; 