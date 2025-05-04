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

    console.log('Starting image addition process...');

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        console.log('File selected:', {
          name: file.name,
          type: file.type,
          size: file.size
        });

        try {
          setIsUploading(true);
          
          // Validate file type
          if (!file.type.startsWith('image/')) {
            throw new Error('Please select an image file');
          }

          console.log('Creating temporary URL for image...');
          const tempUrl = URL.createObjectURL(file);
          console.log('Temporary URL created:', tempUrl);

          // Create a new image element to get dimensions
          console.log('Loading image to get dimensions...');
          const img = new Image();
          img.onload = () => {
            console.log('Image loaded, dimensions:', {
              originalWidth: img.width,
              originalHeight: img.height
            });

            const newItem = {
              type: 'image',
              imageUrl: tempUrl,
              width: Math.min(400, img.width),
              height: Math.min(300, img.height * (Math.min(400, img.width) / img.width)),
              position: { x: 100, y: 100 },
              // Store the file for later upload
              pendingUpload: {
                file,
                fileName: `${Date.now()}_${file.name}`,
                contentType: file.type
              }
            };

            console.log('Created new image item:', {
              dimensions: {
                width: newItem.width,
                height: newItem.height
              },
              pendingUpload: {
                fileName: newItem.pendingUpload.fileName,
                contentType: newItem.pendingUpload.contentType,
                hasFile: !!newItem.pendingUpload.file
              }
            });

            // Dispatch a custom event to notify WhiteboardCanvas
            const event = new CustomEvent('addImageItem', { detail: newItem });
            window.dispatchEvent(event);
            console.log('Dispatched addImageItem event');
          };
          img.src = tempUrl;
        } catch (error) {
          console.error('Error creating image item:', {
            error,
            errorMessage: error.message,
            errorCode: error.code,
            fileName: file.name
          });
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