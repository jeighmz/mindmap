import React, { useState } from 'react';
import { useDrag } from 'react-dnd';

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
      style={{
        width: '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: '6px',
        cursor: isDragging ? 'grabbing' : 'grab',
        color: '#6b7280',
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: isDragging ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#f3f4f6';
        e.currentTarget.style.color = '#111827';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = '#6b7280';
      }}
      title={title}
    >
      {icon}
    </div>
  );
};

const ToolbarItem = ({ type, icon, chartType, isChartMenuOpen, onChartMenuToggle }) => {

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'WHITEBOARD_ITEM',
    item: { type, chartType },
    collect: monitor => ({
      isDragging: monitor.isDragging()
    })
  }), [type, chartType]);

  const handleImageClick = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true; // Support multiple file selection
      
      input.onchange = async (e) => {
        const files = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
        
        if (files.length === 0) {
          return;
        }

        // Get viewport center position
        const canvasEl = document.querySelector('.whiteboard-canvas');
        if (!canvasEl) {
          alert('Canvas not found');
          return;
        }

        const canvasRect = canvasEl.getBoundingClientRect();
        const viewportCenterX = canvasRect.left + canvasRect.width / 2;
        const viewportCenterY = canvasRect.top + canvasRect.height / 2;

        // Get current pan and scale from the canvas (we'll need to pass this or get it from event)
        // For now, we'll calculate a reasonable center position
        // The canvas will handle positioning based on its current pan/scale state
        
        files.forEach(async (file, index) => {
          // Convert file to data URL immediately for production compatibility
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target.result;
            const img = new Image();
            
            img.onload = () => {
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

              // Calculate center position - offset multiple images in a grid pattern
              const cols = Math.ceil(Math.sqrt(files.length));
              const row = Math.floor(index / cols);
              const col = index % cols;
              const offsetX = (col - (cols - 1) / 2) * (width + 20);
              const offsetY = (row - (Math.ceil(files.length / cols) - 1) / 2) * (height + 20);
              
              // Dispatch event with viewport center coordinates
              // The canvas will convert these to canvas coordinates
              const newItem = {
                type: 'image',
                imageUrl: dataUrl, // Use data URL instead of blob URL
                width,
                height,
                position: { 
                  viewportX: viewportCenterX + offsetX, 
                  viewportY: viewportCenterY + offsetY 
                }
              };

              // Use setTimeout to ensure each image gets processed with unique timing
              setTimeout(() => {
                const event = new CustomEvent('addImageItem', { detail: newItem });
                window.dispatchEvent(event);
              }, index * 10);
            };
            
            img.onerror = () => {
              alert(`Failed to load image "${file.name}"`);
            };
            
            img.src = dataUrl;
          };
          
          reader.onerror = () => {
            alert(`Failed to read image "${file.name}"`);
          };
          
          reader.readAsDataURL(file);
        });
      };
    
    // Add error handler for file input
    input.onerror = (e) => {
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
          <div style={{
            position: 'absolute',
            right: '-160px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            zIndex: 1001,
            padding: '6px',
            display: 'flex',
            gap: '4px',
            overflow: 'hidden'
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
      className="toolbar-item"
      style={{ opacity: isDragging ? 0.5 : 1, cursor: type === 'image' ? 'pointer' : (type === 'chart-menu' ? 'pointer' : 'grab') }}
      onClick={type === 'image' ? handleImageClick : undefined}
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
        className={`toolbar-item ai-button ${isSpacePressed ? 'panning-mode' : ''}`}
        onMouseDown={handleChatButtonMouseDown}
        onClick={handleChatButtonClick}
        onMouseUp={handleChatButtonMouseUp}
        onMouseLeave={handleChatButtonMouseUp}
        title="AI Analysis Chat"
        style={{
          cursor: isSpacePressed ? 'grab' : 'pointer',
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