import React, { useState } from 'react';
import { useDrag } from 'react-dnd';
import AgentChat from './agent/AgentChat';

const ToolbarItem = ({ type, icon, chartType }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'WHITEBOARD_ITEM',
    item: { type, chartType },
    collect: monitor => ({
      isDragging: monitor.isDragging()
    })
  }));

  const handleImageClick = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageUrl = e.target.result;
          // Create a new image element to get dimensions
          const img = new Image();
          img.onload = () => {
            const newItem = {
              type: 'image',
              imageUrl,
              width: Math.min(400, img.width), // Cap initial size
              height: Math.min(300, img.height * (Math.min(400, img.width) / img.width)),
              position: { x: 100, y: 100 }
            };
            // Dispatch a custom event to notify WhiteboardCanvas
            const event = new CustomEvent('addImageItem', { detail: newItem });
            window.dispatchEvent(event);
          };
          img.src = imageUrl;
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  return (
    <div
      ref={type === 'image' ? null : drag}
      className="toolbar-item"
      style={{ opacity: isDragging ? 0.5 : 1, cursor: type === 'image' ? 'pointer' : 'grab' }}
      onClick={type === 'image' ? handleImageClick : undefined}
    >
      {icon}
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