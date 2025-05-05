import React, { useState } from 'react';
import { useDrag } from 'react-dnd';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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

    console.log('Starting image addition process...', { userId: user.uid });

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          setIsUploading(true);
          console.log('File selected:', {
            name: file.name,
            type: file.type,
            size: file.size
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
              
              // Upload the file immediately
              const storage = getStorage();
              const imageRef = ref(storage, storagePath);
              
              console.log('📦 STORAGE: Starting immediate image upload:', {
                path: storagePath,
                contentType: file.type,
                fileSize: file.size
              });

              // Upload with metadata
              const uploadResult = await uploadBytes(imageRef, file, {
                contentType: file.type,
                customMetadata: {
                  uploadedBy: user.uid,
                  uploadedAt: new Date().toISOString(),
                  originalName: fileName
                }
              });

              if (!uploadResult || !uploadResult.ref) {
                throw new Error('Storage upload failed - no reference returned');
              }

              // Get the download URL
              const downloadUrl = await getDownloadURL(imageRef);

              console.log('📦 STORAGE: Upload completed successfully:', {
                path: uploadResult.ref.fullPath,
                contentType: uploadResult.metadata.contentType,
                size: uploadResult.metadata.size
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
                hasUrl: !!newItem.imageUrl
              });

              // Dispatch event to add image to canvas
              const event = new CustomEvent('addImageItem', { detail: newItem });
              window.dispatchEvent(event);
            } catch (error) {
              console.error('📦 STORAGE ERROR: Failed to upload image:', error);
              alert('Failed to upload image: ' + error.message);
              URL.revokeObjectURL(tempUrl);
            }
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
    input.click();
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