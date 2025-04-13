import React, { useState, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import WhiteboardCanvas from '../components/whiteboard/WhiteboardCanvas';
import WhiteboardToolbar from '../components/whiteboard/WhiteboardToolbar';
import '../styles/Whiteboard.css';

const WhiteboardPage = () => {
  const [isMindMapPanelOpen, setIsMindMapPanelOpen] = useState(false);
  const canvasRef = useRef(null);
  const [items, setItems] = useState([]);
  const [connections, setConnections] = useState([]);

  const handleOpenMindMapPanel = () => {
    setIsMindMapPanelOpen(true);
    // If the canvas has a method to open the mind map panel, call it
    if (canvasRef.current && typeof canvasRef.current.handleOpenMindMapPanel === 'function') {
      canvasRef.current.handleOpenMindMapPanel();
    }
  };

  // Function to update items and connections from the canvas
  const handleCanvasUpdate = (newItems, newConnections) => {
    setItems(newItems);
    setConnections(newConnections);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="whiteboard">
        <WhiteboardToolbar 
          onOpenMindMapPanel={handleOpenMindMapPanel} 
          items={items}
          connections={connections}
        />
        <WhiteboardCanvas 
          ref={canvasRef}
          isMindMapPanelOpen={isMindMapPanelOpen}
          onMindMapPanelClose={() => setIsMindMapPanelOpen(false)}
          onUpdate={handleCanvasUpdate}
        />
      </div>
    </DndProvider>
  );
};

export default WhiteboardPage; 