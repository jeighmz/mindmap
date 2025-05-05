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
    { type: 'sticky', icon: '📝' },
    { type: 'rectangle', icon: '⬜' },
    { type: 'circle', icon: '⭕' },
    { type: 'chart', icon: '📊', chartType: 'xy' },
    { type: 'chart', icon: '〰️', chartType: 'sine' },
    { type: 'image', icon: '🖼️' },
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
        🧠
      </button>
      {/* Agent chat button temporarily disabled
      <button 
        className="toolbar-item"
        onClick={() => setIsAgentChatOpen(true)}
        title="Open AI Agent Chat"
      >
        🤖
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