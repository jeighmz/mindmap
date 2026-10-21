import React, { useState } from 'react';
import { useDrag } from 'react-dnd';
import { useAuth } from '../../contexts/AuthContext';
import {
  uploadBoardImage,
  getImageNaturalSize,
  fitImageDimensions,
} from '../../services/imageUploadService';

import AgentChat from './agent/AgentChat';

const ChartMenuItem = ({ chartType, icon, title, onChartMenuToggle }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'WHITEBOARD_ITEM',
    item: { type: 'chart', chartType },
    collect: monitor => ({
      isDragging: monitor.isDragging()
    })
  }), [chartType]);

  return (
    <div
      ref={drag}
      onClick={(e) => {
        e.stopPropagation();
        onChartMenuToggle?.();
      }}
      className="chart-menu-item"
      style={{
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.6 : 1,
      }}
      title={title}
    >
      {icon}
    </div>
  );
};

const ToolbarItem = ({ type, icon, chartType, isChartMenuOpen, onChartMenuToggle }) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'WHITEBOARD_ITEM',
    item: { type, chartType },
    collect: monitor => ({
      isDragging: monitor.isDragging()
    })
  }), [type, chartType]);

  const handleImageClick = async () => {
    if (!user?.uid) {
      alert('Please sign in to upload images');
      return;
    }

    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      
      input.onchange = async (e) => {
        const files = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
        
        if (files.length === 0) {
          return;
        }

        const canvasEl = document.querySelector('.whiteboard-canvas');
        if (!canvasEl) {
          alert('Canvas not found');
          return;
        }

        const canvasRect = canvasEl.getBoundingClientRect();
        const viewportCenterX = canvasRect.left + canvasRect.width / 2;
        const viewportCenterY = canvasRect.top + canvasRect.height / 2;

        setIsUploading(true);
        try {
          for (let index = 0; index < files.length; index++) {
            const file = files[index];
            try {
              const natural = await getImageNaturalSize(file);
              const { width, height } = fitImageDimensions(natural.width, natural.height);
              const uploaded = await uploadBoardImage({
                file,
                userId: user.uid,
                originalName: file.name,
              });

              const cols = Math.ceil(Math.sqrt(files.length));
              const row = Math.floor(index / cols);
              const col = index % cols;
              const offsetX = (col - (cols - 1) / 2) * (width + 20);
              const offsetY = (row - (Math.ceil(files.length / cols) - 1) / 2) * (height + 20);

              const newItem = {
                type: 'image',
                imageUrl: uploaded.imageUrl,
                storageRef: uploaded.storageRef,
                width,
                height,
                position: {
                  viewportX: viewportCenterX + offsetX,
                  viewportY: viewportCenterY + offsetY,
                },
              };

              window.dispatchEvent(new CustomEvent('addImageItem', { detail: newItem }));
            } catch (error) {
              console.error('Failed to upload image:', error);
              alert(`Failed to upload image "${file.name}": ${error.message}`);
            }
          }
        } finally {
          setIsUploading(false);
        }
      };
    
      input.onerror = () => {
        alert('Error opening file picker. Please try again.');
      };
    
      input.click();
    } catch (error) {
      alert('Failed to open file picker: ' + error.message);
    }
  };

  if (type === 'chart-menu') {
    return (
      <div style={{ position: 'relative' }}>
        <div
          className="toolbar-item"
          style={{ cursor: 'pointer', position: 'relative' }}
          onClick={onChartMenuToggle}
          title="Select Chart Type"
        >
          {icon}
        </div>
        {isChartMenuOpen && (
          <div className="chart-menu-popup" style={{
            position: 'absolute',
            right: '-160px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1001,
          }}>
            <ChartMenuItem
              chartType="xy"
              title="XY Chart"
              onChartMenuToggle={onChartMenuToggle}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="20" x2="20" y2="20" />
                  <line x1="4" y1="20" x2="4" y2="4" />
                  <path d="M7 14l3-3 4 4 4-8" />
                </svg>
              }
            />
            <ChartMenuItem
              chartType="sine"
              title="Sine Wave"
              onChartMenuToggle={onChartMenuToggle}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 12c2-2.67 4-4 6-4s4 1.33 6 4c2 2.67 4 4 6 4s4-1.33 6-4" />
                </svg>
              }
            />
            <ChartMenuItem
              chartType="sankey"
              title="Sankey"
              onChartMenuToggle={onChartMenuToggle}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="2" y="5" width="3.5" height="14" rx="0.5" fill="currentColor" opacity="0.85" />
                  <rect x="18.5" y="4" width="3.5" height="5.5" rx="0.5" fill="currentColor" opacity="0.85" />
                  <rect x="18.5" y="10.5" width="3.5" height="4" rx="0.5" fill="currentColor" opacity="0.85" />
                  <rect x="18.5" y="15.5" width="3.5" height="4.5" rx="0.5" fill="currentColor" opacity="0.85" />
                  <path d="M5.5 6.5 Q9 6 12.5 5.5 Q16 5 18.5 5.5 L18.5 9.5 Q16 9 12.5 8.5 Q9 8 5.5 8.5 Z" fill="currentColor" opacity="0.6" />
                  <path d="M5.5 11 Q9 10.5 12.5 10 Q16 9.5 18.5 10 L18.5 13.5 Q16 13 12.5 12.5 Q9 12 5.5 12.5 Z" fill="currentColor" opacity="0.6" />
                  <path d="M5.5 15.5 Q9 15 12.5 14.5 Q16 14 18.5 14.5 L18.5 19 Q16 18.5 12.5 18 Q9 17.5 5.5 18 Z" fill="currentColor" opacity="0.6" />
                </svg>
              }
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={type === 'image' || type === 'chart-menu' ? null : drag}
      className={`toolbar-item${isUploading ? ' uploading' : ''}`}
      style={{
        opacity: isDragging || isUploading ? 0.5 : 1,
        cursor: type === 'image' ? (isUploading ? 'wait' : 'pointer') : (type === 'chart-menu' ? 'pointer' : 'grab'),
        pointerEvents: isUploading ? 'none' : undefined,
      }}
      onClick={type === 'image' ? handleImageClick : undefined}
      title={type === 'image' && isUploading ? 'Uploading image…' : undefined}
    >
      {icon}
    </div>
  );
};

const WhiteboardToolbar = ({ onOpenMindMapPanel, onOpenSearchPanel, items, connections, highlightedItems = [], isLibraryOpen = false, onToggleHelp }) => {
  const [buttonMouseDown, setButtonMouseDown] = useState(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isChartMenuOpen, setIsChartMenuOpen] = useState(false);

  // Track space key state
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleChatButtonMouseDown = (e) => {
    // Don't track if space or alt is pressed (panning mode)
    if (isSpacePressed || e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setButtonMouseDown({ x: e.clientX, y: e.clientY });
  };

  const handleChatButtonClick = (e) => {
    // Don't trigger if space key is pressed (panning mode) or alt key
    if (isSpacePressed || e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      setButtonMouseDown(null);
      return;
    }

    // Only trigger if mouse hasn't moved significantly (indicating a click, not a drag/pan)
    if (buttonMouseDown) {
      const deltaX = Math.abs(e.clientX - buttonMouseDown.x);
      const deltaY = Math.abs(e.clientY - buttonMouseDown.y);
      const moveThreshold = 5; // pixels
      
      if (deltaX > moveThreshold || deltaY > moveThreshold) {
        // Mouse moved too much, this was a drag/pan, not a click
        e.preventDefault();
        e.stopPropagation();
        setButtonMouseDown(null);
        return;
      }
    }
    
    setButtonMouseDown(null);
    onOpenSearchPanel();
  };

  const handleChatButtonMouseUp = () => {
    setButtonMouseDown(null);
  };

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
      type: 'text', 
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20h16" />
          <path d="M6 16l6-12 6 12" />
          <path d="M8 12h8" />
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
      type: 'chart-menu',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="20" x2="20" y2="20" />
          <line x1="4" y1="20" x2="4" y2="4" />
          <path d="M7 14l3-3 4 4 4-8" />
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
          isChartMenuOpen={isChartMenuOpen}
          onChartMenuToggle={() => setIsChartMenuOpen(!isChartMenuOpen)}
        />
      ))}
      <div className="toolbar-item separator"></div>
      <button 
        className="toolbar-item mind-map-button"
        onClick={onOpenMindMapPanel}
        title="Generate Mind Map"
        style={{
          cursor: 'pointer',
          transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
      <button 
        className="toolbar-item ai-button"
        onMouseDown={handleChatButtonMouseDown}
        onClick={handleChatButtonClick}
        onMouseUp={handleChatButtonMouseUp}
        onMouseLeave={handleChatButtonMouseUp}
        title="AI Analysis Chat"
        style={{
          cursor: 'pointer',
          transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M8 10h.01" />
          <path d="M12 10h.01" />
          <path d="M16 10h.01" />
        </svg>
      </button>
      {onToggleHelp && (
        <button 
          className="toolbar-item help-toggle-button"
          onClick={onToggleHelp}
          title="Show/Hide Instructions"
          style={{
            cursor: 'pointer',
            transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
        </button>
      )}
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
        highlightedItems={highlightedItems}
      />
      */}
    </div>
    
  );
};

export default WhiteboardToolbar; 