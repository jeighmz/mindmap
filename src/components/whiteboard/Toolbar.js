import React from 'react';
import { useDrag } from 'react-dnd';

const ToolbarItem = ({ type, icon, label }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'SHAPE',
    item: { type },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  }));

  return (
    <div
      ref={drag}
      className={`whiteboard-toolbar-item ${isDragging ? 'dragging' : ''}`}
    >
      <div className="toolbar-item-content">
        <span className="toolbar-item-icon">{icon}</span>
        <span className="toolbar-item-label">{label}</span>
      </div>
    </div>
  );
};

const Toolbar = ({ onAddElement }) => {
  const tools = [
    { type: 'circle', icon: '⭕', label: 'Circle' },
    { type: 'rectangle', icon: '⬜', label: 'Rectangle' },
    { type: 'diamond', icon: '◆', label: 'Diamond' },
    { type: 'text', icon: 'T', label: 'Text' },
    { type: 'connector', icon: '↔', label: 'Connector' }
  ];

  return (
    <div className="whiteboard-toolbar">
      <h3 className="toolbar-title">Shapes</h3>
      <div className="toolbar-items">
        {tools.map((tool) => (
          <ToolbarItem
            key={tool.type}
            {...tool}
            onClick={() => onAddElement(tool.type)}
          />
        ))}
      </div>
    </div>
  );
};

export default Toolbar; 