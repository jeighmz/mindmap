import React, { useState } from 'react';
import { useDrag } from 'react-dnd';
import AgentChat from './agent/AgentChat';


const ToolbarItem = ({ type, icon }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'WHITEBOARD_ITEM',
    item: { type },
    collect: monitor => ({
      isDragging: monitor.isDragging()
    })
  }));

  return (
    <div
      ref={drag}
      className="toolbar-item"
      style={{ opacity: isDragging ? 0.5 : 1 }}
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
  ];

  const [isAgentChatOpen, setIsAgentChatOpen] = useState(false);

  return (
    <div className="whiteboard-toolbar">
      {tools.map(tool => (
        <ToolbarItem
          key={tool.type}
          type={tool.type}
          icon={tool.icon}
        />
      ))}
      <div className="toolbar-item separator"></div>
      <button 
        className="toolbar-item"
        onClick={onOpenMindMapPanel}
      >
        🧠
      </button>
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
    </div>
    
  );
};

export default WhiteboardToolbar; 