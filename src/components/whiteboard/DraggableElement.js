import React from 'react';
import { useDrag } from 'react-dnd';

const DraggableElement = ({ element, isSelected, onClick, updatePosition, scale }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'SHAPE',
    item: { 
      id: element.id, 
      type: element.type,
      position: element.position 
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    }),
    end: (item, monitor) => {
      const dropResult = monitor.getDropResult();
      if (dropResult) {
        const offset = monitor.getDifferenceFromInitialOffset();
        const newPosition = {
          x: Math.round((element.position.x + offset.x / scale) / 10) * 10,
          y: Math.round((element.position.y + offset.y / scale) / 10) * 10
        };
        updatePosition(element.id, newPosition);
      }
    }
  }), [element.position, scale]);

  const renderShape = () => {
    switch (element.type) {
      case 'circle':
        return <div className="shape circle" />;
      case 'rectangle':
        return <div className="shape rectangle" />;
      case 'diamond':
        return <div className="shape diamond" />;
      case 'text':
        return <div className="shape text">{element.text}</div>;
      default:
        return null;
    }
  };

  return (
    <div
      ref={drag}
      className={`draggable-element ${isSelected ? 'selected' : ''}`}
      style={{
        left: element.position.x,
        top: element.position.y,
        opacity: isDragging ? 0.5 : 1,
        transform: `scale(${1 / (scale * (window.devicePixelRatio || 1))})`,
        transition: isDragging ? 'none' : 'all 0.1s ease'
      }}
      onClick={onClick}
    >
      {renderShape()}
    </div>
  );
};

export default DraggableElement; 