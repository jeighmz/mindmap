import React, { useState, useRef, useEffect, useCallback } from 'react';

const WhiteboardItem = ({ 
  item, 
  updatePosition, 
  updateSize, 
  updateText, 
  isSelected, 
  isConnecting,
  isValidTarget,
  isGroupSelectMode,
  isExpanding,
  onSelect,
  onConnectionStart,
  onDelete,
  scale,
  onContextMenu,
  onOrganize
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const itemRef = useRef(null);

  const handleClick = (e) => {
    e.stopPropagation();
    if (!isEditing && !isResizing) {
      onSelect(item.id, e);
    }
  };

  const handleResizeMove = useCallback((e) => {
    if (!isResizing) return;

    e.preventDefault();
    e.stopPropagation();

    const deltaX = (e.clientX - resizeStart.x) / scale;
    const deltaY = (e.clientY - resizeStart.y) / scale;
    
    let newWidth = resizeStart.width;
    let newHeight = resizeStart.height;
    let newX = item.position.x;
    let newY = item.position.y;

    switch (resizeStart.direction) {
      case 'e':
        newWidth = Math.max(50, resizeStart.width + deltaX);
        break;
      case 'w':
        newWidth = Math.max(50, resizeStart.width - deltaX);
        newX = item.position.x + (resizeStart.width - newWidth);
        break;
      case 's':
        newHeight = Math.max(50, resizeStart.height + deltaY);
        break;
      case 'n':
        newHeight = Math.max(50, resizeStart.height - deltaY);
        newY = item.position.y + (resizeStart.height - newHeight);
        break;
      case 'se':
        newWidth = Math.max(50, resizeStart.width + deltaX);
        newHeight = Math.max(50, resizeStart.height + deltaY);
        break;
      case 'sw':
        newWidth = Math.max(50, resizeStart.width - deltaX);
        newHeight = Math.max(50, resizeStart.height + deltaY);
        newX = item.position.x + (resizeStart.width - newWidth);
        break;
      case 'ne':
        newWidth = Math.max(50, resizeStart.width + deltaX);
        newHeight = Math.max(50, resizeStart.height - deltaY);
        newY = item.position.y + (resizeStart.height - newHeight);
        break;
      case 'nw':
        newWidth = Math.max(50, resizeStart.width - deltaX);
        newHeight = Math.max(50, resizeStart.height - deltaY);
        newX = item.position.x + (resizeStart.width - newWidth);
        newY = item.position.y + (resizeStart.height - newHeight);
        break;
      default:
        // Keep existing dimensions and position if direction is not recognized
        break;
    }

    // Snap to grid
    newX = Math.round(newX / 20) * 20;
    newY = Math.round(newY / 20) * 20;
    newWidth = Math.round(newWidth / 20) * 20;
    newHeight = Math.round(newHeight / 20) * 20;

    updatePosition(item.id, { x: newX, y: newY });
    updateSize(item.id, { width: newWidth, height: newHeight });
  }, [isResizing, resizeStart, scale, item.id, item.position.x, item.position.y, updatePosition, updateSize]);

  const handleResizeStart = useCallback((e, direction) => {
    e.stopPropagation();
    e.preventDefault();
    
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: item.width,
      height: item.height,
      direction
    });
  }, [item.width, item.height]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  const handleMouseDown = (e) => {
    // Allow moving without SHIFT when in group select mode
    if ((e.shiftKey || (isGroupSelectMode && isSelected)) && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        itemX: item.position.x,
        itemY: item.position.y
      });
      setIsDragging(true);
      if (itemRef.current) {
        itemRef.current.style.cursor = 'grabbing';
      }
    }
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isDragging && dragStart) {
        e.preventDefault();
        e.stopPropagation();
        
        const dx = (e.clientX - dragStart.x) / scale;
        const dy = (e.clientY - dragStart.y) / scale;
        
        const newX = Math.round((dragStart.itemX + dx) / 20) * 20;
        const newY = Math.round((dragStart.itemY + dy) / 20) * 20;
        
        // Update position for individual item movement
        updatePosition(item.id, { x: newX, y: newY });
        
        // If in group select mode, signal the parent component to move all selected items
        if (isGroupSelectMode && isSelected) {
          // Pass movement delta to parent component
          if (typeof window.moveSelectedItems === 'function') {
            window.moveSelectedItems(dx, dy);
          }
        }
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setDragStart(null);
        if (itemRef.current) {
          itemRef.current.style.cursor = 'default';
        }
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragStart, scale, item.id, updatePosition, isGroupSelectMode, isSelected]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if target is an input, textarea, or if the search panel is open
      const isEditingText = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
      const isInSearchPanel = document.querySelector('.search-panel') && 
                              document.querySelector('.search-panel').contains(e.target);
      
      // Only delete if not editing text and not in search panel
      if (isSelected && !isEditing && !isEditingText && !isInSearchPanel && 
          (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        onDelete(item.id);
      }
    };

    if (isSelected) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSelected, isEditing, item.id, onDelete]);

  const renderContent = () => {
    const stickyStyle = item.type === 'sticky' ? {
      backgroundColor: '#fff740',
      width: '100%',
      height: '100%',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      color: '#000',
      borderRadius: '2px'
    } : {
      width: '100%',
      height: '100%',
      padding: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    };

    if (isEditing) {
      return (
        <textarea
          value={item.text || ''}
          onChange={(e) => updateText(item.id, e.target.value)}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              setIsEditing(false);
            }
          }}
          style={{
            ...stickyStyle,
            resize: 'none',
            border: 'none',
            background: item.type === 'sticky' ? '#fff740' : 'transparent',
            outline: 'none',
            textAlign: 'left',
            lineHeight: '1.5'
          }}
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      );
    }

    return (
      <div 
        className={`${item.type}-shape`}
        style={stickyStyle}
        onDoubleClick={() => setIsEditing(true)}
      >
        {item.text || 'Double click to add text'}
      </div>
    );
  };

  const renderResizeHandles = () => {
    if (!isSelected) return null;

    const handles = [
      { position: 'nw', cursor: 'nw-resize' },
      { position: 'n', cursor: 'n-resize' },
      { position: 'ne', cursor: 'ne-resize' },
      { position: 'e', cursor: 'e-resize' },
      { position: 'se', cursor: 'se-resize' },
      { position: 's', cursor: 's-resize' },
      { position: 'sw', cursor: 'sw-resize' },
      { position: 'w', cursor: 'w-resize' }
    ];

    return handles.map(({ position, cursor }) => (
      <div
        key={position}
        className={`resize-handle ${position}`}
        style={{ 
          cursor,
          pointerEvents: 'all'
        }}
        onMouseDown={(e) => handleResizeStart(e, position)}
        onClick={(e) => e.stopPropagation()}
      />
    ));
  };

  const ConnectorButton = ({ onStartConnection, scale }) => {
    return (
      <div
        className="connector-control"
        onClick={(e) => {
          e.stopPropagation();
          onStartConnection(item.id);
        }}
        style={{
          position: 'absolute',
          top: '50%',
          right: '-28px',
          transform: `scale(${1/scale})`,
          width: '24px',
          height: '24px',
          background: '#4CAF50',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          zIndex: 1003
        }}
      >
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="white" 
          strokeWidth="2"
        >
          <path d="M7 17L17 7M17 7H7M17 7V17" />
        </svg>
      </div>
    );
  };

  const EditButton = ({ onStartEditing, scale }) => {
    return (
      <div
        className="edit-control"
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        style={{
          position: 'absolute',
          top: '50%',
          right: '-28px',
          transform: `scale(${1/scale})`,
          width: '24px',
          height: '24px',
          background: '#2196F3',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          zIndex: 1003,
          marginTop: '-30px'
        }}
      >
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="white" 
          strokeWidth="2"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </div>
    );
  };

  const ExpandButton = ({ onExpandConcept, scale, isExpanding }) => {
    return (
      <div
        className={`expand-control ${isExpanding ? 'expanding' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!isExpanding) {
            onExpandConcept();
          }
        }}
        style={{
          position: 'absolute',
          top: '50%',
          right: '-28px',
          transform: `scale(${1/scale})`,
          width: '24px',
          height: '24px',
          background: isExpanding ? '#7b1fa2' : '#9c27b0',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isExpanding ? 'wait' : 'pointer',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          zIndex: 1003,
          marginTop: '30px'
        }}
      >
        {isExpanding ? (
          <div className="spinner" style={{ width: '12px', height: '12px' }}></div>
        ) : (
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="white" 
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        )}
      </div>
    );
  };

  const OrganizeButton = ({ onOrganize, scale }) => {
    return (
      <div
        className="organize-control"
        onClick={(e) => {
          e.stopPropagation();
          onOrganize(item.id);
        }}
        style={{
          position: 'absolute',
          top: '50%',
          right: '-28px',
          transform: `scale(${1/scale})`,
          width: '24px',
          height: '24px',
          background: '#4CAF50',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          zIndex: 1003,
          marginTop: '60px'
        }}
      >
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="white" 
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3a9 9 0 0 1 0 18" />
          <path d="M12 3a9 9 0 0 0 0 18" />
        </svg>
      </div>
    );
  };

  return (
    <div
      ref={itemRef}
      data-id={item.id}
      className={`whiteboard-item ${isSelected ? 'selected' : ''} ${
        isResizing ? 'resizing' : ''
      } ${isDragging ? 'dragging' : ''} ${
        item.type === 'sticky' ? 'sticky-note' : ''
      } ${isConnecting ? 'connecting' : ''} ${
        isValidTarget ? 'valid-target' : ''
      } ${isGroupSelectMode && isSelected ? 'group-select-mode' : ''} ${
        isExpanding ? 'expanding' : ''
      }`}
      style={{
        position: 'absolute',
        left: item.position.x,
        top: item.position.y,
        width: item.width,
        height: item.height,
        cursor: isDragging ? 'grabbing' : (isConnecting ? 'not-allowed' : (isValidTarget ? 'pointer' : 'default')),
        transition: isDragging ? 'none' : 'all 0.15s ease',
        zIndex: isSelected ? 1000 : 100,
        userSelect: 'none',
        border: isValidTarget ? '2px dashed #4CAF50' : 'none',
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => onContextMenu && onContextMenu(e)}
    >
      {renderContent()}
      {renderResizeHandles()}
      {isSelected && !isEditing && (
        <>
          <EditButton 
            onStartEditing={() => setIsEditing(true)}
            scale={scale}
          />
          <ConnectorButton 
            onStartConnection={onConnectionStart}
            scale={scale}
          />
          <ExpandButton 
            onExpandConcept={() => {
              if (window.expandSelectedConcept && typeof window.expandSelectedConcept === 'function') {
                window.expandSelectedConcept(item.id, item.text);
              }
            }}
            scale={scale}
            isExpanding={isExpanding}
          />
          <OrganizeButton 
            onOrganize={onOrganize}
            scale={scale}
          />
        </>
      )}
    </div>
  );
};

export default WhiteboardItem; 