import React, { useState, useCallback } from 'react';
import { useDrop } from 'react-dnd';
import DraggableElement from './DraggableElement';

const Canvas = ({ elements, selectedElement, setSelectedElement, updateElementPosition }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [, drop] = useDrop(() => ({
    accept: 'SHAPE',
    drop: (item, monitor) => {
      if (!monitor.didDrop()) {
        const offset = monitor.getClientOffset();
        const canvasRect = document.querySelector('.whiteboard-canvas').getBoundingClientRect();
        const position = {
          x: Math.round(((offset.x - canvasRect.left) / scale - 25) / 20) * 20,
          y: Math.round(((offset.y - canvasRect.top) / scale - 25) / 20) * 20
        };
        updateElementPosition(item.id, position);
      }
      return { moved: true };
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [scale]);

  const handleWheel = useCallback((e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(s => Math.min(Math.max(0.1, s * delta), 4));
    }
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [position]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div 
      ref={drop} 
      className="whiteboard-canvas"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="zoom-controls">
        <button onClick={() => setScale(s => Math.min(s * 1.1, 4))}>+</button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => Math.max(s * 0.9, 0.1))}>-</button>
      </div>
      
      <div className="compass">
        <div className="compass-north">N</div>
        <div className="compass-east">E</div>
        <div className="compass-south">S</div>
        <div className="compass-west">W</div>
        <div className="compass-center">⌖</div>
      </div>

      <div 
        className="grid-background" 
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          backgroundSize: `${20 * scale}px ${20 * scale}px`
        }}
      />
      <div 
        className="canvas-content"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`
        }}
      >
        {elements.map((element) => (
          <DraggableElement
            key={element.id}
            element={element}
            isSelected={selectedElement === element.id}
            onClick={() => setSelectedElement(element.id)}
            updatePosition={updateElementPosition}
            scale={scale}
          />
        ))}
      </div>
    </div>
  );
};

export default Canvas; 