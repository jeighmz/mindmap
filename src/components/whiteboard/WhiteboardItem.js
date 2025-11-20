import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { TIER_FEATURES, USER_TIERS } from '../../config/userTiers';


const formatDateLabel = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
};

const calculateDateScale = (start, end, count) => {
  const timeRange = end - start;
  const step = timeRange / (count - 1);
  return Array.from({ length: count }, (_, i) => start + (step * i));
};

const calculateScale = (start, end, unit, mode, customValues) => {
  if (mode === 'custom' && Array.isArray(customValues) && customValues.length > 0) {
    return customValues;
  } else if (mode === 'date') {
    // For dates, we want about 5-7 points on the axis
    const count = 6;
    return calculateDateScale(start, end, count);
  } else {
    // For numbers, use the unit-based calculation
    const range = end - start;
    const count = Math.ceil(range / unit) + 1;
    return Array.from({ length: count }, (_, i) => start + (i * unit));
  }
};

const formatAxisLabel = (value, mode, xAxisTitle = '') => {
  if (mode === 'date') {
    return formatDateLabel(value);
  } else if (mode === 'custom') {
    return value;
  } else {
    // Check if x-axis title contains pi symbol
    const isPiMode = xAxisTitle && (xAxisTitle.includes('π') || xAxisTitle.toLowerCase().includes('pi'));
    
    if (isPiMode && typeof value === 'number') {
      // Format as multiples of pi
      const piMultiple = value / Math.PI;
      
      // Handle common fractions
      if (Math.abs(piMultiple - 0) < 0.001) return '0';
      if (Math.abs(piMultiple - 0.5) < 0.001) return 'π/2';
      if (Math.abs(piMultiple - 1) < 0.001) return 'π';
      if (Math.abs(piMultiple - 1.5) < 0.001) return '3π/2';
      if (Math.abs(piMultiple - 2) < 0.001) return '2π';
      if (Math.abs(piMultiple - -0.5) < 0.001) return '-π/2';
      if (Math.abs(piMultiple - -1) < 0.001) return '-π';
      if (Math.abs(piMultiple - -1.5) < 0.001) return '-3π/2';
      if (Math.abs(piMultiple - -2) < 0.001) return '-2π';
      
      // Check for other simple fractions
      const absMultiple = Math.abs(piMultiple);
      const numerator = Math.round(absMultiple * 2);
      if (numerator % 2 === 0 && Math.abs(absMultiple - numerator / 2) < 0.001) {
        const coeff = numerator / 2;
        if (coeff === 1) {
          return piMultiple < 0 ? '-π' : 'π';
        } else {
          return piMultiple < 0 ? `-${coeff}π` : `${coeff}π`;
        }
      }
      
      // For other values, show as decimal multiple of pi
      if (Math.abs(piMultiple) < 0.001) return '0';
      const rounded = Math.round(piMultiple * 100) / 100;
      if (rounded === 1) return 'π';
      if (rounded === -1) return '-π';
      if (rounded % 1 === 0) {
        return rounded < 0 ? `${rounded}π` : `${rounded}π`;
      }
      return `${rounded.toFixed(2)}π`;
    }
    
    return typeof value === 'number' ? value.toFixed(1) : value;
  }
};

const WhiteboardItem = ({ 
  item, 
  updatePosition, 
  updateSize,
  updateRotation,
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
  onOrganize,
  onChartEdit,
  isChartEditing,
  panOffset = { x: 0, y: 0 },
  onDragEnd,
  onResizeEnd,
  onShowColorMenu
}) => {
  const { isDarkMode } = useApp();
  const { userTier } = useAuth();
  
  // Check if expand tool is available for this tier
  const tierFeatures = TIER_FEATURES[userTier] || TIER_FEATURES[USER_TIERS.FREE];
  const canUseExpandTool = tierFeatures.dailyExpandTool !== 0;
  
  // Text colors for charts based on dark mode
  const chartTextColor = isDarkMode ? '#e5e5e5' : '#404040';
  const chartTitleColor = isDarkMode ? '#ffffff' : '#1a1a1a';
  
  // Validate item early - but don't return yet (hooks must run unconditionally)
  const isValidItem = item && 
    item.position && 
    typeof item.position.x === 'number' && 
    typeof item.position.y === 'number' &&
    item.width && 
    item.height && 
    item.width > 0 && 
    item.height > 0;

  const [isEditing, setIsEditing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0 });
  const [isRotating, setIsRotating] = useState(false);
  const [rotateStart, setRotateStart] = useState({ x: 0, y: 0, angle: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [hoverTooltip, setHoverTooltip] = useState(null); // { x, y, content }
  const textareaRef = useRef(null);

  // Initialize chart config from saved item data or defaults
  const getInitialChartConfig = () => {
    if (!item) return {};
    return {
      title: item.title || '',
    xAxisTitle: item.xAxisTitle || '',
    yAxisTitle: item.yAxisTitle || '',
    xAxisUnit: item.xAxisUnit || (item.chartType === 'sine' ? Math.PI / 2 : 1),
    yAxisUnit: item.yAxisUnit || 0.5,  // Changed to 0.5 for better Y-axis divisions
    xAxisStart: item.xAxisStart !== undefined ? item.xAxisStart : (item.chartType === 'sine' ? 0 : 0),
    yAxisStart: item.chartType === 'sine' ? 0 : (item.yAxisStart || 0),  // Default to 0 for sine
    xAxisEnd: item.chartType === 'sine' ? (2 * Math.PI * (item.periods || 1)) : (item.xAxisEnd !== undefined ? item.xAxisEnd : 10),
    yAxisEnd: item.chartType === 'sine' ? 3 : (item.yAxisEnd || 10),  // Default to 3 for sine
    xAxisMode: item.xAxisMode || 'number',
    yAxisMode: item.yAxisMode || 'number',
    xAxisStartDate: item.xAxisStartDate || new Date().toISOString().split('T')[0],
    xAxisEndDate: item.xAxisEndDate || new Date().toISOString().split('T')[0],
    yAxisStartDate: item.yAxisStartDate || new Date().toISOString().split('T')[0],
    yAxisEndDate: item.yAxisEndDate || new Date().toISOString().split('T')[0],
    xAxisCustomValues: item.xAxisCustomValues || [],
    yAxisCustomValues: item.yAxisCustomValues || [],
    showXAxisLabels: item.showXAxisLabels !== false,
    showYAxisLabels: item.showYAxisLabels !== false,
    frequency: item.frequency || 1,
    amplitude: item.amplitude || 1,
    periods: item.periods || 1,
    waveType: item.waveType || 'sine',
    phaseShift: item.phaseShift || 0,
    harmonics: item.harmonics || 1,
    enableModulation: item.enableModulation || false,
    modulationDepth: item.modulationDepth || 0.5,
    // Data plotting settings (for XY charts)
    dataMode: item.dataMode || 'none',
    dataPoints: item.dataPoints || '',
    dataEquation: item.dataEquation || '',
    dataPointCount: item.dataPointCount || 100,
    showDataLine: item.showDataLine !== false,
    showDataPoints: item.showDataPoints !== false,
    dataColor: item.dataColor || '#FF5722',
    xyChartDisplayType: item.xyChartDisplayType || 'line', // 'line', 'bar', 'scatter'
    // Sankey chart settings
    sankeyData: item.sankeyData || '' // "source1,target1,value1; source2,target2,value2; ..."
    };
  };

  const [chartConfig, setChartConfig] = useState(getInitialChartConfig());

  // Update chart config when item changes
  useEffect(() => {
    setChartConfig(getInitialChartConfig());
  }, [
    item.id,
    item.title,
    item.xAxisTitle,
    item.yAxisTitle,
    item.xAxisUnit,
    item.yAxisUnit,
    item.xAxisStart,
    item.yAxisStart,
    item.xAxisEnd,
    item.yAxisEnd,
    item.xAxisMode,
    item.yAxisMode,
    item.xAxisStartDate,
    item.xAxisEndDate,
    item.yAxisStartDate,
    item.yAxisEndDate,
    item.xAxisCustomValues,
    item.yAxisCustomValues,
    item.showXAxisLabels,
    item.showYAxisLabels,
    item.frequency,
    item.amplitude,
    item.periods,
    item.waveType,
    item.phaseShift,
    item.harmonics,
    item.enableModulation,
    item.modulationDepth,
    item.chartType,
    item.dataMode,
    item.dataPoints,
    item.dataEquation,
    item.dataPointCount,
    item.showDataLine,
    item.showDataPoints,
    item.dataColor,
    item.xyChartDisplayType,
    item.sankeyData,
    item.chartType
  ]);

  const itemRef = useRef(null);

  // Check if chart is empty (no data configured)
  const isChartEmpty = () => {
    if (item.type !== 'chart') return false;
    
    if (item.chartType === 'sankey') {
      return !item.sankeyData || item.sankeyData.trim() === '';
    } else if (item.chartType === 'xy') {
      return (!item.dataMode || item.dataMode === 'none') || 
             (item.dataMode === 'points' && (!item.dataPoints || item.dataPoints.trim() === '')) ||
             (item.dataMode === 'equation' && (!item.dataEquation || item.dataEquation.trim() === ''));
    } else if (item.chartType === 'sine') {
      // Sine charts always have data, so they're never "empty"
      return false;
    }
    
    return false;
  };

  const handleClick = (e) => {
    // Don't trigger selection if clicking on control buttons
    if (e.target.closest('.edit-control, .connector-control, .expand-control')) {
      return;
    }
    
    // Stop propagation to prevent multiple items from being selected
    e.stopPropagation();
    e.preventDefault();
    
    // Also stop immediate propagation to prevent event bubbling
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }
    
    if (!isEditing && !isResizing) {
      onSelect(item.id, e);
    }
  };

  const handleResizeMove = useCallback((e) => {
    if (!isResizing) return;

    e.preventDefault();
    e.stopPropagation();

    // Calculate the raw delta in screen coordinates
    const dx = e.clientX - resizeStart.x;
    const dy = e.clientY - resizeStart.y;
    
    // Convert screen delta to canvas coordinates considering scale and device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    const deltaX = dx / (scale * dpr);
    const deltaY = dy / (scale * dpr);
    
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
    newX = Math.round(newX / 10) * 10;
    newY = Math.round(newY / 10) * 10;
    newWidth = Math.round(newWidth / 10) * 10;
    newHeight = Math.round(newHeight / 10) * 10;

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
    if (onResizeEnd) {
      onResizeEnd();
    }
  }, [onResizeEnd]);

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

  const handleRotateMove = useCallback((e) => {
    if (!isRotating || !updateRotation) return;

    e.preventDefault();
    e.stopPropagation();

    // Get item center in screen coordinates
    const itemRect = itemRef.current?.getBoundingClientRect();
    if (!itemRect) return;

    const centerX = itemRect.left + itemRect.width / 2;
    const centerY = itemRect.top + itemRect.height / 2;

    // Calculate angle from center to mouse position
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Calculate the rotation relative to the start angle
    const rotationDelta = angle - rotateStart.angle;
    let newRotation = rotateStart.rotation + rotationDelta;

    // Normalize to 0-360 range
    newRotation = ((newRotation % 360) + 360) % 360;

    // Snap to 15-degree increments if shift is held
    if (e.shiftKey) {
      newRotation = Math.round(newRotation / 15) * 15;
    }

    updateRotation(item.id, newRotation);
  }, [isRotating, rotateStart, scale, item.id, updateRotation]);

  const handleRotateStart = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!updateRotation) return;

    setIsRotating(true);
    
    // Get item center in screen coordinates
    const itemRect = itemRef.current?.getBoundingClientRect();
    if (!itemRect) return;

    const centerX = itemRect.left + itemRect.width / 2;
    const centerY = itemRect.top + itemRect.height / 2;

    // Calculate initial angle from center to mouse position
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const initialAngle = Math.atan2(dy, dx) * (180 / Math.PI);

    setRotateStart({
      x: e.clientX,
      y: e.clientY,
      angle: initialAngle,
      rotation: item.rotation || 0
    });
  }, [item.rotation, updateRotation]);

  const handleRotateEnd = useCallback(() => {
    setIsRotating(false);
    if (onResizeEnd) {
      onResizeEnd();
    }
  }, [onResizeEnd]);

  useEffect(() => {
    if (isRotating) {
      window.addEventListener('mousemove', handleRotateMove);
      window.addEventListener('mouseup', handleRotateEnd);
      return () => {
        window.removeEventListener('mousemove', handleRotateMove);
        window.removeEventListener('mouseup', handleRotateEnd);
      };
    }
  }, [isRotating, handleRotateMove, handleRotateEnd]);

  const handleMouseDown = (e) => {
    // Don't start drag if clicking on control buttons or resize handles
    if (e.target.closest('.edit-control, .connector-control, .expand-control, .resize-handle')) {
      return;
    }
    
    // Don't start drag if space is pressed (let canvas handle selection box)
    if (window.isSpacePressed) {
      return;
    }
    
    // Regular drag to move items (no shift required)
    if (e.button === 0) {
      // In group select mode, only allow one item to be the primary dragger
      // If another item is already dragging, don't start a new drag
      if (isGroupSelectMode && isSelected) {
        if (typeof window.startGroupDrag === 'function') {
          // Try to register as primary dragger - if another item is already primary, this will fail
          const wasPrimary = window.startGroupDrag(item.id);
          if (wasPrimary === false) {
            // Another item is already the primary dragger, don't start dragging
            return;
          }
        }
      }
      
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
        
        // Calculate the raw delta in screen coordinates
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        
        // Convert screen delta to canvas coordinates considering scale and device pixel ratio
        const dpr = window.devicePixelRatio || 1;
        const canvasDx = dx / (scale * dpr);
        const canvasDy = dy / (scale * dpr);
        
        // If in group select mode, only move items through the group drag function
        // This prevents multiple items from updating positions simultaneously
        if (isGroupSelectMode && isSelected) {
          if (typeof window.moveSelectedItems === 'function') {
            // Only the primary dragger should call this, and it moves all items
            window.moveSelectedItems(canvasDx, canvasDy, item.id);
          }
        } else {
          // Single item movement - update position directly
          const newX = Math.round((dragStart.itemX + canvasDx) / 10) * 10;
          const newY = Math.round((dragStart.itemY + canvasDy) / 10) * 10;
          updatePosition(item.id, { x: newX, y: newY });
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
        
        // Clear the primary dragger if this was a group drag
        if (isGroupSelectMode && isSelected && typeof window.endGroupDrag === 'function') {
          window.endGroupDrag();
        }
        
        if (onDragEnd) {
          onDragEnd();
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

  // Auto-enable editing for newly created text items (only once)
  const hasAutoEnabledRef = useRef(false);
  useEffect(() => {
    if (item.type === 'text' && item.isNewText && !isEditing && !hasAutoEnabledRef.current) {
      setIsEditing(true);
      hasAutoEnabledRef.current = true;
    }
  }, [item.type, item.isNewText, isEditing]);

  // Function to close editing and blur the textarea
  const closeEditing = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.blur();
    }
    setIsEditing(false);
  }, []);

  // Handle clicks outside the textarea to close editing
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e) => {
      if (textareaRef.current && !textareaRef.current.contains(e.target)) {
        closeEditing();
      }
    };

    // Use a small timeout to avoid closing immediately when opening
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, closeEditing]);

  const renderContent = () => {
    // Determine alignment based on textAlign property
    const textAlign = item.textAlign || 'center';
    const getAlignment = (align) => {
      switch(align) {
        case 'left':
          return { alignItems: 'center', justifyContent: 'flex-start' };
        case 'right':
          return { alignItems: 'center', justifyContent: 'flex-end' };
        case 'center':
        default:
          return { alignItems: 'center', justifyContent: 'center' };
      }
    };
    const alignment = getAlignment(textAlign);

    const stickyStyle = item.type === 'sticky' ? {
      backgroundColor: item.backgroundColor || '#fff740',
      width: '100%',
      height: '100%',
      padding: '16px',
      display: 'flex',
      ...alignment,
      overflow: 'hidden',
      fontFamily: item.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: `${item.fontSize || 14}px`,
      color: item.textColor || '#000',
      fontWeight: item.fontWeight || 'normal',
      fontStyle: item.fontStyle || 'normal',
      textDecoration: item.textDecoration || 'none',
      textAlign: textAlign,
      borderRadius: '2px'
    } : {
      backgroundColor: item.backgroundColor,
      width: '100%',
      height: '100%',
      padding: '8px',
      display: 'flex',
      ...alignment,
      overflow: 'hidden',
      fontFamily: item.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: `${item.fontSize || 14}px`,
      color: item.textColor || '#000',
      fontWeight: item.fontWeight || 'normal',
      fontStyle: item.fontStyle || 'normal',
      textDecoration: item.textDecoration || 'none',
      textAlign: textAlign,
      border: item.borderColor ? `2px solid ${item.borderColor}` : '1px solid #ccc',
      borderRadius: item.type === 'rectangle' && item.cornerRadius !== undefined ? `${item.cornerRadius}px` : undefined
    };

    if (item.type === 'image') {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          backgroundColor: item.errorOverlay ? '#ffebee' : 'transparent',
          borderRadius: '4px',
          boxShadow: isSelected ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
          position: 'relative'
        }}>
          <img
            src={item.imageUrl}
            alt={item.loadError ? 'Failed to load image' : 'Whiteboard item'}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              userSelect: 'none',
              pointerEvents: 'none',
              opacity: item.errorOverlay ? 0.5 : 1
            }}
            draggable={false}
            onError={(e) => {
              console.error('Image failed to load in WhiteboardItem:', {
                itemId: item.id,
                imageUrl: item.imageUrl?.substring(0, 50) + '...',
                error: e
              });
            }}
          />
          {item.errorOverlay && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              padding: '12px',
              borderRadius: '4px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              maxWidth: '90%',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
              <div style={{ 
                color: '#d32f2f',
                fontWeight: 'bold',
                marginBottom: '4px'
              }}>
                Image Load Error
              </div>
              <div style={{ 
                fontSize: '12px',
                color: '#666',
                wordBreak: 'break-word'
              }}>
                {item.loadError}
              </div>
              {item.errorDetails && (
                <div style={{
                  fontSize: '10px',
                  color: '#999',
                  marginTop: '8px',
                  wordBreak: 'break-word'
                }}>
                  Storage path: {item.errorDetails.storageRef}
                  <br />
                  Time: {new Date(item.errorDetails.timestamp).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (item.type === 'chart') {
      const basePadding = 30;
      const yAxisLabelPadding = 20;
      const basePaddingValue = basePadding + yAxisLabelPadding;
      const tickLength = 5; // Length of tick marks
      
      const width = item.width;
      const height = item.height;
      
      // Calculate dynamic padding based on axis titles
      // Title font size scales with chart size
      const titleFontSize = Math.min(width, height) * 0.045;
      const axisLabelFontSize = Math.min(width, height) * 0.028;
      
      // Calculate extra padding needed for axis titles
      const xAxisTitlePadding = (chartConfig.xAxisTitle && chartConfig.showXAxisLabels !== false) 
        ? titleFontSize + 10  // Space for title + margin
        : 0;
      
      const yAxisTitlePadding = (chartConfig.yAxisTitle && chartConfig.showYAxisLabels !== false)
        ? titleFontSize + 10  // Space for rotated title + margin
        : 0;
      
      // Calculate padding for axis labels (they can be rotated, so need extra space)
      const xAxisLabelPadding = (chartConfig.showXAxisLabels && (chartConfig.xAxisMode === 'date' || chartConfig.xAxisMode === 'custom'))
        ? axisLabelFontSize * 1.5  // Extra space for rotated labels
        : axisLabelFontSize + 5;  // Space for normal labels
      
      const yAxisLabelPaddingValue = axisLabelFontSize + 5;
      
      // Calculate effective padding
      const leftPadding = basePaddingValue + Math.max(yAxisTitlePadding, yAxisLabelPaddingValue);
      const rightPadding = basePaddingValue;
      const topPadding = basePaddingValue;
      const bottomPadding = basePaddingValue + Math.max(xAxisTitlePadding, xAxisLabelPadding);
      
      const padding = basePaddingValue; // Keep for backward compatibility
      const effectivePadding = padding;
      
      const chartWidth = width - leftPadding - rightPadding;
      const chartHeight = height - topPadding - bottomPadding;

      // Parse and generate data points for XY charts
      const parseDataPoints = (dataPointsString) => {
        if (!dataPointsString || dataPointsString.trim() === '') return [];
        try {
          return dataPointsString.split(';')
            .map(pair => {
              const trimmed = pair.trim();
              if (!trimmed) return null;
              const [x, y] = trimmed.split(',').map(v => parseFloat(v.trim()));
              if (isNaN(x) || isNaN(y)) return null;
              return { x, y };
            })
            .filter(point => point !== null);
        } catch (error) {
          console.error('Error parsing data points:', error);
          return [];
        }
      };

      // Evaluate equation/formula
      const evaluateEquation = (equation, x) => {
        if (!equation || equation.trim() === '') return null;
        try {
          // Replace ^ with ** for exponentiation
          let expr = equation.replace(/\^/g, '**');
          // Replace 'x' with the actual x value
          expr = expr.replace(/\bx\b/g, `(${x})`);
          // Replace common math functions
          expr = expr.replace(/\bsin\b/g, 'Math.sin');
          expr = expr.replace(/\bcos\b/g, 'Math.cos');
          expr = expr.replace(/\btan\b/g, 'Math.tan');
          expr = expr.replace(/\blog\b/g, 'Math.log');
          expr = expr.replace(/\bexp\b/g, 'Math.exp');
          expr = expr.replace(/\bsqrt\b/g, 'Math.sqrt');
          expr = expr.replace(/\babs\b/g, 'Math.abs');
          // Replace PI and E
          expr = expr.replace(/\bPI\b/g, 'Math.PI');
          expr = expr.replace(/\bE\b/g, 'Math.E');
          
          // Use Function constructor for safe evaluation
          const func = new Function('Math', 'return ' + expr);
          return func(Math);
        } catch (error) {
          console.error('Error evaluating equation:', error);
          return null;
        }
      };

      // Generate data points based on mode
      const getDataPoints = () => {
        // For xy charts (with any display type), bar, and scatter charts, use data plotting
        const isDataChart = item.chartType === 'xy' || item.chartType === 'bar' || item.chartType === 'scatter';
        if (chartConfig.dataMode === 'none' || !isDataChart) return [];
        
        if (chartConfig.dataMode === 'points') {
          return parseDataPoints(chartConfig.dataPoints);
        } else if (chartConfig.dataMode === 'equation') {
          const points = [];
          const xStart = chartConfig.xAxisStart;
          const xEnd = chartConfig.xAxisEnd;
          const pointCount = chartConfig.dataPointCount || 100;
          
          for (let i = 0; i < pointCount; i++) {
            const x = xStart + (xEnd - xStart) * (i / (pointCount - 1));
            const y = evaluateEquation(chartConfig.dataEquation, x);
            if (y !== null && !isNaN(y) && isFinite(y)) {
              points.push({ x, y });
            }
          }
          return points;
        }
        return [];
      };

      const dataPoints = getDataPoints();

      // Calculate scale values based on configuration and mode
      const xScale = calculateScale(
        chartConfig.xAxisStart,
        chartConfig.xAxisEnd,
        chartConfig.xAxisUnit,
        chartConfig.xAxisMode,
        chartConfig.xAxisCustomValues
      );

      const yScale = calculateScale(
        chartConfig.yAxisStart,
        chartConfig.yAxisEnd,
        chartConfig.yAxisUnit,
        chartConfig.yAxisMode,
        chartConfig.yAxisCustomValues
      );



      return (
        <div style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}>
          <svg 
            width="100%" 
            height="100%" 
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Chart Title */}
            {item.type === 'chart' && item.title && (
              <text
                x={width / 2}
                y={effectivePadding - 10}
                fontSize={Math.min(width, height) * 0.05}
                fill={chartTitleColor}
                textAnchor="middle"
                fontWeight="600"
                letterSpacing="0.5px"
                fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                style={{ userSelect: 'none' }}
              >
                {item.title}
              </text>
            )}
            {item.chartType === 'xy' && (() => {
              const displayType = chartConfig.xyChartDisplayType || 'line';
              
              return (
                <>
                  {/* Background grid */}
                  {xScale.map((value, i) => {
                    const x = leftPadding + (i * (chartWidth / (xScale.length - 1)));
                    return (
                      <g key={`x-${i}`}>
                        <line 
                          x1={x}
                          y1={topPadding}
                          x2={x}
                          y2={height - bottomPadding}
                          stroke="#666" 
                          strokeDasharray="4,4"
                          opacity="0.1"
                        />
                        {chartConfig.showXAxisLabels && (
                          <text 
                            x={x}
                            y={height - bottomPadding + axisLabelFontSize + 5}
                            fontSize={axisLabelFontSize}
                            fill={chartTextColor}
                            textAnchor="middle"
                            fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                            style={{ userSelect: 'none' }}
                            transform={chartConfig.xAxisMode === 'date' || chartConfig.xAxisMode === 'custom' 
                              ? `rotate(-45, ${x}, ${height - bottomPadding + axisLabelFontSize + 5})` 
                              : undefined}
                          >
                            {formatAxisLabel(value, chartConfig.xAxisMode)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                  {yScale.map((value, i) => {
                    const y = height - bottomPadding - (i * (chartHeight / (yScale.length - 1)));
                    return (
                      <g key={`y-${i}`}>
                        <line 
                          x1={leftPadding}
                          y1={y}
                          x2={width - rightPadding}
                          y2={y}
                          stroke="#666" 
                          strokeDasharray="4,4"
                          opacity="0.1"
                        />
                        {chartConfig.showYAxisLabels && (
                          <text 
                            x={leftPadding - 10}
                            y={y}
                            fontSize={axisLabelFontSize}
                            fill={chartTextColor}
                            textAnchor="end"
                            dominantBaseline="middle"
                            fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                            style={{ userSelect: 'none' }}
                          >
                            {formatAxisLabel(value, chartConfig.yAxisMode)}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Axes */}
                  <line 
                    x1={leftPadding} 
                    y1={height - bottomPadding} 
                    x2={width - rightPadding} 
                    y2={height - bottomPadding} 
                    stroke="#2196F3" 
                    strokeWidth={Math.min(width, height) * 0.005}
                  />
                  <line 
                    x1={leftPadding} 
                    y1={topPadding} 
                    x2={leftPadding} 
                    y2={height - bottomPadding} 
                    stroke="#2196F3" 
                    strokeWidth={Math.min(width, height) * 0.005}
                  />

                  {/* X-Axis Title */}
                  {chartConfig.xAxisTitle && chartConfig.showXAxisLabels !== false && (
                    <g>
                      <text
                        x={leftPadding + (chartWidth / 2)}
                        y={height - bottomPadding + titleFontSize + 5}
                        fontSize={titleFontSize}
                        fill={chartTitleColor}
                        textAnchor="middle"
                        fontWeight="600"
                        letterSpacing="0.5px"
                        fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                        style={{ userSelect: 'none' }}
                        dominantBaseline="hanging"
                      >
                        {chartConfig.xAxisTitle}
                      </text>
                    </g>
                  )}

                  {/* Y-Axis Title */}
                  {chartConfig.yAxisTitle && chartConfig.showYAxisLabels !== false && (
                    <g>
                      <text
                        x={leftPadding / 3}
                        y={height - bottomPadding - (chartHeight / 2)}
                        fontSize={titleFontSize}
                        fill={chartTitleColor}
                        textAnchor="middle"
                        fontWeight="600"
                        letterSpacing="0.5px"
                        fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                        style={{ userSelect: 'none' }}
                        transform={`rotate(-90, ${leftPadding / 3}, ${height - bottomPadding - (chartHeight / 2)})`}
                      >
                        {chartConfig.yAxisTitle}
                      </text>
                    </g>
                  )}

                  {/* Arrows */}
                  <polygon 
                    points={`${width - rightPadding + 5},${height - bottomPadding} ${width - rightPadding - 5},${height - bottomPadding - 5} ${width - rightPadding - 5},${height - bottomPadding + 5}`} 
                    fill="#2196F3"
                  />
                  <polygon 
                    points={`${leftPadding},${topPadding - 5} ${leftPadding - 5},${topPadding + 5} ${leftPadding + 5},${topPadding + 5}`} 
                    fill="#2196F3"
                  />

                  {/* Data Plotting - based on display type */}
                  {dataPoints.length > 0 && (() => {
                    const xRange = chartConfig.xAxisEnd - chartConfig.xAxisStart;
                    const yRange = chartConfig.yAxisEnd - chartConfig.yAxisStart;
                    
                    if (xRange === 0 || yRange === 0) return null;
                    
                    if (displayType === 'bar') {
                      // Bar chart rendering
                      const barWidth = chartWidth / (dataPoints.length * 1.5);
                      const maxBarHeight = chartHeight;
                      
                      return (
                        <g key="bar-chart">
                          {dataPoints.map((point, i) => {
                            const normalizedX = (point.x - chartConfig.xAxisStart) / xRange;
                            const normalizedY = (point.y - chartConfig.yAxisStart) / yRange;
                            const barX = leftPadding + (normalizedX * chartWidth) - (barWidth / 2);
                            const barHeight = Math.max(0, normalizedY * maxBarHeight);
                            const barY = height - bottomPadding - barHeight;
                            
                            if (barX < leftPadding || barX + barWidth > width - rightPadding) return null;
                            if (barY < topPadding || barY + barHeight > height - bottomPadding) return null;
                            
                            return (
                              <rect
                                key={`bar-${i}`}
                                x={barX}
                                y={barY}
                                width={barWidth}
                                height={barHeight}
                                fill={chartConfig.dataColor || '#FF5722'}
                                stroke="white"
                                strokeWidth={Math.min(width, height) * 0.002}
                                opacity="0.8"
                              />
                            );
                          })}
                        </g>
                      );
                    } else if (displayType === 'scatter') {
                      // Scatter plot rendering
                      const chartPoints = dataPoints.map(point => {
                        const normalizedX = (point.x - chartConfig.xAxisStart) / xRange;
                        const normalizedY = (point.y - chartConfig.yAxisStart) / yRange;
                        const chartX = leftPadding + (normalizedX * chartWidth);
                        const chartY = height - bottomPadding - (normalizedY * chartHeight);
                        return { x: chartX, y: chartY, dataX: point.x, dataY: point.y };
                      }).filter(p => 
                        p.x >= leftPadding && p.x <= width - rightPadding &&
                        p.y >= topPadding && p.y <= height - bottomPadding
                      );

                      if (chartPoints.length === 0) return null;

                      return (
                        <g key="scatter-plot">
                          {chartPoints.map((point, i) => (
                            <circle
                              key={`scatter-point-${i}`}
                              cx={point.x}
                              cy={point.y}
                              r={Math.min(width, height) * 0.012}
                              fill={chartConfig.dataColor || '#FF5722'}
                              stroke="white"
                              strokeWidth={Math.min(width, height) * 0.003}
                              opacity="0.8"
                            />
                          ))}
                        </g>
                      );
                    } else {
                      // Line chart rendering (default)
                      const chartPoints = dataPoints.map(point => {
                        const normalizedX = (point.x - chartConfig.xAxisStart) / xRange;
                        const normalizedY = (point.y - chartConfig.yAxisStart) / yRange;
                        const chartX = leftPadding + (normalizedX * chartWidth);
                        const chartY = height - bottomPadding - (normalizedY * chartHeight);
                        return { x: chartX, y: chartY, dataX: point.x, dataY: point.y };
                      }).filter(p => 
                        p.x >= leftPadding && p.x <= width - rightPadding &&
                        p.y >= topPadding && p.y <= height - bottomPadding
                      );

                      if (chartPoints.length === 0) return null;

                      return (
                        <g key="data-plot">
                          {/* Data line */}
                          {chartConfig.showDataLine && chartPoints.length > 1 && (
                            <polyline
                              points={chartPoints.map(p => `${p.x},${p.y}`).join(' ')}
                              fill="none"
                              stroke={chartConfig.dataColor || '#FF5722'}
                              strokeWidth={Math.min(width, height) * 0.004}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}
                          
                          {/* Data points */}
                          {chartConfig.showDataPoints && chartPoints.map((point, i) => {
                            const maxY = Math.max(...dataPoints.map(p => p.y));
                            const percentage = maxY > 0 ? (point.dataY / maxY * 100) : 0;
                            return (
                              <circle
                                key={`data-point-${i}`}
                                cx={point.x}
                                cy={point.y}
                                r={Math.min(width, height) * 0.008}
                                fill={chartConfig.dataColor || '#FF5722'}
                                stroke="white"
                                strokeWidth={Math.min(width, height) * 0.002}
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={() => {
                                  setHoverTooltip({
                                    x: point.x,
                                    y: point.y,
                                    content: (
                                      <div>
                                        <div><strong>X: {point.dataX.toFixed(2)}</strong></div>
                                        <div><strong>Y: {point.dataY.toFixed(2)}</strong></div>
                                        <div>{percentage.toFixed(1)}% of max</div>
                                      </div>
                                    )
                                  });
                                }}
                                onMouseLeave={() => setHoverTooltip(null)}
                              />
                            );
                          })}
                        </g>
                      );
                    }
                  })()}
                </>
              );
            })()}
            {item.chartType === 'bar' && (
              <>
                {/* Background grid */}
                {xScale.map((value, i) => {
                  const x = effectivePadding + (i * (chartWidth / (xScale.length - 1)));
                  return (
                    <g key={`x-${i}`}>
                      <line 
                        x1={x}
                        y1={effectivePadding}
                        x2={x}
                        y2={height - effectivePadding}
                        stroke="#666" 
                        strokeDasharray="4,4"
                        opacity="0.1"
                      />
                      {chartConfig.showXAxisLabels && (
                        <text 
                          x={x}
                          y={height - padding + 20}
                          fontSize={Math.min(width, height) * 0.028}
                          fill={chartTextColor}
                          textAnchor="middle"
                          fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                          style={{ userSelect: 'none' }}
                          transform={chartConfig.xAxisMode === 'date' || chartConfig.xAxisMode === 'custom' 
                            ? `rotate(-45, ${x}, ${height - padding + 20})` 
                            : undefined}
                        >
                          {formatAxisLabel(value, chartConfig.xAxisMode)}
                        </text>
                      )}
                    </g>
                  );
                })}
                {yScale.map((value, i) => {
                  const y = height - effectivePadding - (i * (chartHeight / (yScale.length - 1)));
                  return (
                    <g key={`y-${i}`}>
                      <line 
                        x1={effectivePadding}
                        y1={y}
                        x2={width - effectivePadding}
                        y2={y}
                        stroke="#666" 
                        strokeDasharray="4,4"
                        opacity="0.1"
                      />
                      {chartConfig.showYAxisLabels && (
                        <text 
                          x={padding - 15}
                          y={y}
                          fontSize={Math.min(width, height) * 0.028}
                          fill={chartTextColor}
                          textAnchor="end"
                          dominantBaseline="middle"
                          fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                          style={{ userSelect: 'none' }}
                        >
                          {formatAxisLabel(value, chartConfig.yAxisMode)}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Axes */}
                <line 
                  x1={effectivePadding} 
                  y1={height - effectivePadding} 
                  x2={width - padding} 
                  y2={height - effectivePadding} 
                  stroke="#2196F3" 
                  strokeWidth={Math.min(width, height) * 0.005}
                />
                <line 
                  x1={effectivePadding} 
                  y1={padding} 
                  x2={effectivePadding} 
                  y2={height - effectivePadding} 
                  stroke="#2196F3" 
                  strokeWidth={Math.min(width, height) * 0.005}
                />

                {/* X-Axis Title */}
                {chartConfig.xAxisTitle && (
                  <g>
                    <text
                      x={effectivePadding + (chartWidth / 2)}
                      y={height - padding / 2}
                      fontSize={Math.min(width, height) * 0.045}
                      fill={chartTitleColor}
                      textAnchor="middle"
                      fontWeight="600"
                      letterSpacing="0.5px"
                      fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                      style={{ userSelect: 'none' }}
                      dominantBaseline="hanging"
                    >
                      {chartConfig.xAxisTitle}
                    </text>
                  </g>
                )}

                {/* Y-Axis Title */}
                {chartConfig.yAxisTitle && (
                  <g>
                    <text
                      x={padding / 2}
                      y={height - effectivePadding - (chartHeight / 2)}
                      fontSize={Math.min(width, height) * 0.045}
                      fill={chartTitleColor}
                      textAnchor="middle"
                      fontWeight="600"
                      letterSpacing="0.5px"
                      fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                      style={{ userSelect: 'none' }}
                      transform={`rotate(-90, ${padding / 3}, ${height - effectivePadding - (chartHeight / 2)})`}
                    >
                      {chartConfig.yAxisTitle}
                    </text>
                  </g>
                )}

                {/* Arrows */}
                <polygon 
                  points={`${width - padding + 5},${height - effectivePadding} ${width - padding - 5},${height - effectivePadding - 5} ${width - padding - 5},${height - effectivePadding + 5}`} 
                  fill="#2196F3"
                />
                <polygon 
                  points={`${effectivePadding},${padding - 5} ${effectivePadding - 5},${padding + 5} ${effectivePadding + 5},${padding + 5}`} 
                  fill="#2196F3"
                />

                {/* Bar Chart Data */}
                {dataPoints.length > 0 && (() => {
                  const xRange = chartConfig.xAxisEnd - chartConfig.xAxisStart;
                  const yRange = chartConfig.yAxisEnd - chartConfig.yAxisStart;
                  
                  if (xRange === 0 || yRange === 0) return null;
                  
                  const barWidth = chartWidth / (dataPoints.length * 1.5); // Space between bars
                  const maxBarHeight = chartHeight;
                  
                  return (
                    <g key="bar-chart">
                      {dataPoints.map((point, i) => {
                        const normalizedX = (point.x - chartConfig.xAxisStart) / xRange;
                        const normalizedY = (point.y - chartConfig.yAxisStart) / yRange;
                        const barX = effectivePadding + (normalizedX * chartWidth) - (barWidth / 2);
                        const barHeight = Math.max(0, normalizedY * maxBarHeight);
                        const barY = height - effectivePadding - barHeight;
                        
                        // Only render if within bounds
                        if (barX < effectivePadding || barX + barWidth > width - effectivePadding) return null;
                        if (barY < effectivePadding || barY + barHeight > height - effectivePadding) return null;
                        
                        return (
                          <rect
                            key={`bar-${i}`}
                            x={barX}
                            y={barY}
                            width={barWidth}
                            height={barHeight}
                            fill={chartConfig.dataColor || '#FF5722'}
                            stroke="white"
                            strokeWidth={Math.min(width, height) * 0.002}
                            opacity="0.8"
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={(e) => {
                              const maxY = Math.max(...dataPoints.map(p => p.y));
                              const percentage = maxY > 0 ? (point.y / maxY * 100) : 0;
                              setHoverTooltip({
                                x: barX + barWidth / 2,
                                y: barY,
                                content: (
                                  <div>
                                    <div><strong>X: {point.x.toFixed(2)}</strong></div>
                                    <div><strong>Y: {point.y.toFixed(2)}</strong></div>
                                    <div>{percentage.toFixed(1)}% of max</div>
                                  </div>
                                )
                              });
                            }}
                            onMouseLeave={() => setHoverTooltip(null)}
                          />
                        );
                      })}
                    </g>
                  );
                })()}
              </>
            )}
            {item.chartType === 'scatter' && (
              <>
                {/* Background grid */}
                {xScale.map((value, i) => {
                  const x = effectivePadding + (i * (chartWidth / (xScale.length - 1)));
                  return (
                    <g key={`x-${i}`}>
                      <line 
                        x1={x}
                        y1={effectivePadding}
                        x2={x}
                        y2={height - effectivePadding}
                        stroke="#666" 
                        strokeDasharray="4,4"
                        opacity="0.1"
                      />
                      {chartConfig.showXAxisLabels && (
                        <text 
                          x={x}
                          y={height - padding + 20}
                          fontSize={Math.min(width, height) * 0.028}
                          fill={chartTextColor}
                          textAnchor="middle"
                          fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                          style={{ userSelect: 'none' }}
                          transform={chartConfig.xAxisMode === 'date' || chartConfig.xAxisMode === 'custom' 
                            ? `rotate(-45, ${x}, ${height - padding + 20})` 
                            : undefined}
                        >
                          {formatAxisLabel(value, chartConfig.xAxisMode)}
                        </text>
                      )}
                    </g>
                  );
                })}
                {yScale.map((value, i) => {
                  const y = height - effectivePadding - (i * (chartHeight / (yScale.length - 1)));
                  return (
                    <g key={`y-${i}`}>
                      <line 
                        x1={effectivePadding}
                        y1={y}
                        x2={width - effectivePadding}
                        y2={y}
                        stroke="#666" 
                        strokeDasharray="4,4"
                        opacity="0.1"
                      />
                      {chartConfig.showYAxisLabels && (
                        <text 
                          x={padding - 15}
                          y={y}
                          fontSize={Math.min(width, height) * 0.028}
                          fill={chartTextColor}
                          textAnchor="end"
                          dominantBaseline="middle"
                          fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                          style={{ userSelect: 'none' }}
                        >
                          {formatAxisLabel(value, chartConfig.yAxisMode)}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Axes */}
                <line 
                  x1={effectivePadding} 
                  y1={height - effectivePadding} 
                  x2={width - padding} 
                  y2={height - effectivePadding} 
                  stroke="#2196F3" 
                  strokeWidth={Math.min(width, height) * 0.005}
                />
                <line 
                  x1={effectivePadding} 
                  y1={padding} 
                  x2={effectivePadding} 
                  y2={height - effectivePadding} 
                  stroke="#2196F3" 
                  strokeWidth={Math.min(width, height) * 0.005}
                />

                {/* X-Axis Title */}
                {chartConfig.xAxisTitle && (
                  <g>
                    <text
                      x={effectivePadding + (chartWidth / 2)}
                      y={height - padding / 2}
                      fontSize={Math.min(width, height) * 0.045}
                      fill={chartTitleColor}
                      textAnchor="middle"
                      fontWeight="600"
                      letterSpacing="0.5px"
                      fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                      style={{ userSelect: 'none' }}
                      dominantBaseline="hanging"
                    >
                      {chartConfig.xAxisTitle}
                    </text>
                  </g>
                )}

                {/* Y-Axis Title */}
                {chartConfig.yAxisTitle && (
                  <g>
                    <text
                      x={padding / 2}
                      y={height - effectivePadding - (chartHeight / 2)}
                      fontSize={Math.min(width, height) * 0.045}
                      fill={chartTitleColor}
                      textAnchor="middle"
                      fontWeight="600"
                      letterSpacing="0.5px"
                      fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                      style={{ userSelect: 'none' }}
                      transform={`rotate(-90, ${padding / 3}, ${height - effectivePadding - (chartHeight / 2)})`}
                    >
                      {chartConfig.yAxisTitle}
                    </text>
                  </g>
                )}

                {/* Arrows */}
                <polygon 
                  points={`${width - padding + 5},${height - effectivePadding} ${width - padding - 5},${height - effectivePadding - 5} ${width - padding - 5},${height - effectivePadding + 5}`} 
                  fill="#2196F3"
                />
                <polygon 
                  points={`${effectivePadding},${padding - 5} ${effectivePadding - 5},${padding + 5} ${effectivePadding + 5},${padding + 5}`} 
                  fill="#2196F3"
                />

                {/* Scatter Plot Data - Only points, no line */}
                {dataPoints.length > 0 && (() => {
                  const xRange = chartConfig.xAxisEnd - chartConfig.xAxisStart;
                  const yRange = chartConfig.yAxisEnd - chartConfig.yAxisStart;
                  
                  if (xRange === 0 || yRange === 0) return null;
                  
                  const chartPoints = dataPoints.map(point => {
                    const normalizedX = (point.x - chartConfig.xAxisStart) / xRange;
                    const normalizedY = (point.y - chartConfig.yAxisStart) / yRange;
                    const chartX = effectivePadding + (normalizedX * chartWidth);
                    const chartY = height - effectivePadding - (normalizedY * chartHeight);
                    return { x: chartX, y: chartY, dataX: point.x, dataY: point.y };
                  }).filter(p => 
                    p.x >= effectivePadding && p.x <= width - effectivePadding &&
                    p.y >= effectivePadding && p.y <= height - effectivePadding
                  );

                  if (chartPoints.length === 0) return null;

                  return (
                    <g key="scatter-plot">
                      {/* Scatter points only - no line */}
                      {chartPoints.map((point, i) => {
                        const maxY = Math.max(...dataPoints.map(p => p.y));
                        const percentage = maxY > 0 ? (point.dataY / maxY * 100) : 0;
                        return (
                          <circle
                            key={`scatter-point-${i}`}
                            cx={point.x}
                            cy={point.y}
                            r={Math.min(width, height) * 0.012}
                            fill={chartConfig.dataColor || '#FF5722'}
                            stroke="white"
                            strokeWidth={Math.min(width, height) * 0.003}
                            opacity="0.8"
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={() => {
                              setHoverTooltip({
                                x: point.x,
                                y: point.y,
                                content: (
                                  <div>
                                    <div><strong>X: {point.dataX.toFixed(2)}</strong></div>
                                    <div><strong>Y: {point.dataY.toFixed(2)}</strong></div>
                                    <div>{percentage.toFixed(1)}% of max</div>
                                  </div>
                                )
                              });
                            }}
                            onMouseLeave={() => setHoverTooltip(null)}
                          />
                        );
                      })}
                    </g>
                  );
                })()}
              </>
            )}
            {item.chartType === 'sankey' && (
              <>
                {/* Sankey Chart - Complete Rewrite */}
                {(() => {
                  // Parse Sankey data
                  const parseSankeyData = (dataString) => {
                    if (!dataString || dataString.trim() === '') return { nodes: [], links: [], maxTier: 0 };
                    
                    try {
                      const rawLinks = dataString.split(';')
                        .map(link => {
                          const trimmed = link.trim();
                          if (!trimmed) return null;
                          const parts = trimmed.split(',').map(v => v.trim());
                          if (parts.length < 3) return null;
                          const [source, target, value] = parts;
                          const numValue = parseFloat(value);
                          if (!source || !target || isNaN(numValue) || numValue <= 0) return null;
                          return { source, target, value: numValue };
                        })
                        .filter(link => link !== null);
                      
                      if (rawLinks.length === 0) return { nodes: [], links: [], maxTier: 0 };
                      
                      // Get all unique node names
                      const allNodeNames = new Set();
                      rawLinks.forEach(link => {
                        allNodeNames.add(link.source);
                        allNodeNames.add(link.target);
                      });
                      
                      // Build graph structure
                      const outgoing = new Map();
                      const incoming = new Map();
                      rawLinks.forEach(link => {
                        if (!outgoing.has(link.source)) outgoing.set(link.source, []);
                        if (!incoming.has(link.target)) incoming.set(link.target, []);
                        outgoing.get(link.source).push(link.target);
                        incoming.get(link.target).push(link.source);
                      });
                      
                      // Calculate tiers using longest path algorithm
                      // This creates as many tiers as needed based on the data structure
                      const nodeTiers = new Map();
                      
                      // Initialize all nodes with tier -1 (unassigned)
                      Array.from(allNodeNames).forEach(name => {
                        nodeTiers.set(name, -1);
                      });
                      
                      // Find all source nodes (no incoming edges) and set to tier 0
                      const sources = Array.from(allNodeNames).filter(name => 
                        !incoming.has(name) || incoming.get(name).length === 0
                      );
                      
                      if (sources.length > 0) {
                        sources.forEach(name => {
                          nodeTiers.set(name, 0);
                        });
                      } else {
                        // If no sources (fully connected graph), find nodes with minimal incoming edges
                        const incomingCounts = new Map();
                        Array.from(allNodeNames).forEach(name => {
                          const count = incoming.has(name) ? incoming.get(name).length : 0;
                          incomingCounts.set(name, count);
                        });
                        const minIncoming = Math.min(...Array.from(incomingCounts.values()));
                        
                        // Also check for nodes that appear as sources in the raw links but have incoming connections
                        // This handles cases where the graph has cycles but we still want to start from somewhere
                        const linkSources = new Set(rawLinks.map(link => link.source));
                        const pseudoSources = Array.from(allNodeNames).filter(name => {
                          const incomingCount = incomingCounts.get(name);
                          // Prefer nodes that are sources in links and have minimal incoming
                          if (linkSources.has(name) && incomingCount === minIncoming) {
                            return true;
                          }
                          // Fallback: any node with minimal incoming
                          return incomingCount === minIncoming;
                        });
                        
                        // If we found pseudo-sources, assign them to tier 0
                        if (pseudoSources.length > 0) {
                          pseudoSources.forEach(name => {
                            nodeTiers.set(name, 0);
                          });
                        } else {
                          // Last resort: assign first node alphabetically to tier 0
                          const sortedNames = Array.from(allNodeNames).sort();
                          if (sortedNames.length > 0) {
                            nodeTiers.set(sortedNames[0], 0);
                          }
                        }
                      }
                      
                      // Calculate tiers using iterative longest path algorithm
                      // Keep iterating until all nodes are assigned and tiers stabilize
                      let changed = true;
                      let iterations = 0;
                      const maxIterations = allNodeNames.size * 3; // Allow more iterations for complex graphs
                      
                      while (changed && iterations < maxIterations) {
                        changed = false;
                        iterations++;
                        
                        // Process nodes in a specific order: process tier 0 first, then tier 1, etc.
                        // This ensures proper propagation for linear chains
                        const nodesByCurrentTier = new Map();
                        Array.from(allNodeNames).forEach(name => {
                          const tier = nodeTiers.get(name);
                          if (!nodesByCurrentTier.has(tier)) {
                            nodesByCurrentTier.set(tier, []);
                          }
                          nodesByCurrentTier.get(tier).push(name);
                        });
                        
                        // Process nodes starting from tier 0, then -1 (unassigned), then higher tiers
                        const sortedTiers = Array.from(nodesByCurrentTier.keys()).sort((a, b) => {
                          if (a === 0) return -1;
                          if (b === 0) return 1;
                          if (a < 0) return -1;
                          if (b < 0) return 1;
                          return a - b;
                        });
                        
                        sortedTiers.forEach(tier => {
                          nodesByCurrentTier.get(tier).forEach(name => {
                            const currentTier = nodeTiers.get(name);
                            
                            // Skip if already a source node at tier 0
                            if (currentTier === 0 && (!incoming.has(name) || incoming.get(name).length === 0)) {
                              return;
                            }
                            
                            // Find maximum tier of all incoming source nodes
                            let maxSourceTier = -1;
                            let hasAssignedSources = false;
                            
                            if (incoming.has(name) && incoming.get(name).length > 0) {
                              incoming.get(name).forEach(sourceName => {
                                const sourceTier = nodeTiers.get(sourceName);
                                if (sourceTier >= 0) {
                                  maxSourceTier = Math.max(maxSourceTier, sourceTier);
                                  hasAssignedSources = true;
                                }
                              });
                            }
                            
                            // Calculate new tier
                            if (hasAssignedSources && maxSourceTier >= 0) {
                              const newTier = maxSourceTier + 1;
                              if (currentTier < 0 || newTier > currentTier) {
                                nodeTiers.set(name, newTier);
                                changed = true;
                              }
                            }
                          });
                        });
                      }
                      
                      // Handle any remaining unassigned nodes (isolated or in cycles)
                      // Instead of assigning all to tier 0, try to distribute them based on their connections
                      Array.from(allNodeNames).forEach(name => {
                        if (nodeTiers.get(name) < 0) {
                          // Try to find any assigned neighbors to determine tier
                          let maxNeighborTier = -1;
                          
                          // Check outgoing connections
                          if (outgoing.has(name)) {
                            outgoing.get(name).forEach(target => {
                              const targetTier = nodeTiers.get(target);
                              if (targetTier >= 0) {
                                maxNeighborTier = Math.max(maxNeighborTier, targetTier - 1);
                              }
                            });
                          }
                          
                          // Check incoming connections
                          if (incoming.has(name)) {
                            incoming.get(name).forEach(source => {
                              const sourceTier = nodeTiers.get(source);
                              if (sourceTier >= 0) {
                                maxNeighborTier = Math.max(maxNeighborTier, sourceTier);
                              }
                            });
                          }
                          
                          if (maxNeighborTier >= 0) {
                            nodeTiers.set(name, maxNeighborTier + 1);
                          } else {
                            // Last resort: assign to tier 0
                            nodeTiers.set(name, 0);
                          }
                        }
                      });
                      
                      // Post-process: If all nodes are in tier 0, try to redistribute based on flow direction
                      const tier0Nodes = Array.from(allNodeNames).filter(name => nodeTiers.get(name) === 0);
                      if (tier0Nodes.length === allNodeNames.size && tier0Nodes.length > 1) {
                        // All nodes in tier 0 - redistribute based on flow relationships
                        // Use a topological sort approach to assign tiers based on longest path from sources
                        const sourceNodes = Array.from(allNodeNames).filter(name => {
                          const hasOutgoing = outgoing.has(name) && outgoing.get(name).length > 0;
                          const hasIncoming = incoming.has(name) && incoming.get(name).length > 0;
                          return hasOutgoing && !hasIncoming;
                        });
                        
                        // If no clear sources, find nodes with minimal incoming edges
                        const actualSources = sourceNodes.length > 0 ? sourceNodes : Array.from(allNodeNames).filter(name => {
                          const incomingCount = incoming.has(name) ? incoming.get(name).length : 0;
                          return incomingCount === 0 || (incomingCount > 0 && !outgoing.has(name));
                        });
                        
                        // Reset all tiers and start fresh with topological sort
                        Array.from(allNodeNames).forEach(name => {
                          if (actualSources.includes(name)) {
                            nodeTiers.set(name, 0);
                          } else {
                            nodeTiers.set(name, -1);
                          }
                        });
                        
                        // Use BFS/DFS to assign tiers based on longest path from sources
                        const visited = new Set();
                        const queue = [...actualSources];
                        actualSources.forEach(name => visited.add(name));
                        
                        while (queue.length > 0) {
                          const current = queue.shift();
                          const currentTier = nodeTiers.get(current);
                          
                          // Process all outgoing connections
                          if (outgoing.has(current)) {
                            outgoing.get(current).forEach(target => {
                              const targetTier = nodeTiers.get(target);
                              const newTier = currentTier + 1;
                              
                              // Assign target to a tier that's at least one more than current
                              if (targetTier < 0 || newTier > targetTier) {
                                nodeTiers.set(target, newTier);
                                if (!visited.has(target)) {
                                  visited.add(target);
                                  queue.push(target);
                                }
                              }
                            });
                          }
                        }
                        
                        // Handle any remaining unvisited nodes (cycles or isolated)
                        Array.from(allNodeNames).forEach(name => {
                          if (nodeTiers.get(name) < 0) {
                            // Find max tier of any connected node and assign one tier higher
                            let maxConnectedTier = -1;
                            if (incoming.has(name)) {
                              incoming.get(name).forEach(source => {
                                const sourceTier = nodeTiers.get(source);
                                if (sourceTier >= 0) {
                                  maxConnectedTier = Math.max(maxConnectedTier, sourceTier);
                                }
                              });
                            }
                            if (outgoing.has(name)) {
                              outgoing.get(name).forEach(target => {
                                const targetTier = nodeTiers.get(target);
                                if (targetTier >= 0) {
                                  maxConnectedTier = Math.max(maxConnectedTier, targetTier - 1);
                                }
                              });
                            }
                            
                            nodeTiers.set(name, maxConnectedTier >= 0 ? maxConnectedTier + 1 : 0);
                          }
                        });
                      }
                      
                      const maxTier = Math.max(...Array.from(nodeTiers.values()), 0);
                      
                      // Create node objects with indices and group by tier
                      let nodeIndex = 0;
                      const allNodes = [];
                      const nodeMap = new Map();
                      const nodesByTier = new Map();
                      
                      for (let tier = 0; tier <= maxTier; tier++) {
                        const tierNodeNames = Array.from(allNodeNames).filter(name => nodeTiers.get(name) === tier);
                        if (tierNodeNames.length > 0) {
                          const tierNodes = [];
                          tierNodeNames.forEach(name => {
                            const node = {
                              id: name,
                              name: name,
                              index: nodeIndex,
                              tier: tier
                            };
                            allNodes.push(node);
                            tierNodes.push(node);
                            nodeMap.set(name, nodeIndex);
                            nodeIndex++;
                          });
                          nodesByTier.set(tier, tierNodes);
                        }
                      }
                      
                      // Map links to node indices
                      const mappedLinks = rawLinks.map(link => ({
                        source: nodeMap.get(link.source),
                        target: nodeMap.get(link.target),
                        value: link.value
                      })).filter(link => link.source !== undefined && link.target !== undefined);
                      
                      return { nodes: allNodes, links: mappedLinks, maxTier, nodesByTier };
                    } catch (error) {
                      console.error('Error parsing Sankey data:', error);
                      return { nodes: [], links: [], maxTier: 0, nodesByTier: new Map() };
                    }
                  };
                  
                  const dataString = chartConfig.sankeyData || item.sankeyData || '';
                  const sankeyData = parseSankeyData(dataString);
                  
                  if (!sankeyData || !sankeyData.nodes || !sankeyData.links || !sankeyData.nodesByTier || 
                      sankeyData.nodes.length === 0 || sankeyData.links.length === 0) {
                    return (
                      <text
                        x={width / 2}
                        y={height / 2}
                        fontSize={Math.min(width, height) * 0.04}
                        fill="#999"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                      >
                        {dataString ? 'Invalid Sankey data format' : 'Add Sankey data in chart settings'}
                      </text>
                    );
                  }
                  
                  // Calculate node values (sum of all flows in/out)
                  const nodeValues = new Map();
                  const nodeOutgoing = new Map(); // Sum of outgoing flows per node
                  const nodeIncoming = new Map(); // Sum of incoming flows per node
                  
                  sankeyData.links.forEach(link => {
                    const sourceVal = nodeValues.get(link.source) || 0;
                    const targetVal = nodeValues.get(link.target) || 0;
                    nodeValues.set(link.source, sourceVal + link.value);
                    nodeValues.set(link.target, targetVal + link.value);
                    
                    // Track outgoing/incoming separately
                    const outgoingVal = nodeOutgoing.get(link.source) || 0;
                    const incomingVal = nodeIncoming.get(link.target) || 0;
                    nodeOutgoing.set(link.source, outgoingVal + link.value);
                    nodeIncoming.set(link.target, incomingVal + link.value);
                  });
                  
                  // Ensure all nodes have a value
                  sankeyData.nodes.forEach(node => {
                    if (!nodeValues.has(node.index)) {
                      nodeValues.set(node.index, 0);
                    }
                    if (!nodeOutgoing.has(node.index)) {
                      nodeOutgoing.set(node.index, 0);
                    }
                    if (!nodeIncoming.has(node.index)) {
                      nodeIncoming.set(node.index, 0);
                    }
                  });
                  
                  // Calculate total flow for percentage calculations
                  const totalFlow = sankeyData.links.reduce((sum, link) => sum + link.value, 0);
                  
                  const maxValue = Math.max(...Array.from(nodeValues.values()), 1);
                  const minNodeHeight = 25; // Increased minimum height
                  const maxNodeHeight = 150; // Increased maximum height
                  
                  // Calculate node heights proportional to flow
                  const nodeHeights = new Map();
                  sankeyData.nodes.forEach(node => {
                    const value = nodeValues.get(node.index) || 0;
                    const height = value > 0 
                      ? Math.max(minNodeHeight, Math.min(maxNodeHeight, (value / maxValue) * maxNodeHeight))
                      : minNodeHeight;
                    nodeHeights.set(node.index, height);
                  });
                  
                  // Layout constants - optimized for better horizontal distribution
                  const nodeWidth = 12;
                  const chartPadding = 20; // Left/right padding
                  const chartMargin = 60; // Space for node labels on left
                  const rightMargin = 60; // Space for node labels on right
                  const availableHeight = height - (chartPadding * 2);
                  const availableWidth = width - chartPadding - chartMargin - rightMargin; // Better distribution
                  const numTiers = sankeyData.maxTier + 1;
                  
                  // Calculate tier spacing - ensure minimum spacing even if only one tier
                  let tierSpacing = 0;
                  if (numTiers > 1) {
                    tierSpacing = availableWidth / (numTiers - 1);
                  } else {
                    // If all nodes are in one tier, still spread them out horizontally
                    // This handles cases where tier calculation failed or graph is fully connected
                    tierSpacing = 0; // Will be handled differently below
                  }
                  
                  // Calculate X positions for each tier - ensure proper horizontal spacing
                  const tierXPositions = new Map();
                  
                  // Force horizontal distribution if all nodes are in one tier
                  // This handles cases where tier assignment failed or data doesn't have clear flow direction
                  if (numTiers === 1 && sankeyData.nodesByTier.has(0)) {
                    const singleTierNodes = sankeyData.nodesByTier.get(0);
                    if (singleTierNodes.length > 1) {
                      // First try to find flow-based tier redistribution
                      const nodeOrder = new Map();
                      const visited = new Set();
                      
                      // Find starting nodes (nodes that appear as sources in links)
                      const linkSources = new Set(sankeyData.links.map(link => {
                        const sourceNode = sankeyData.nodes.find(n => n.index === link.source);
                        return sourceNode?.name;
                      }).filter(Boolean));
                      
                      const startingNodes = singleTierNodes.filter(node => linkSources.has(node.name));
                      
                      // If we have starting nodes, use them; otherwise distribute evenly across tiers
                      let nodesToProcess = startingNodes;
                      let shouldRedistribute = true;
                      
                      if (startingNodes.length === 0) {
                        // No clear starting nodes - distribute nodes evenly across multiple tiers
                        // This ensures horizontal spread even without clear flow direction
                        shouldRedistribute = true;
                        
                        // Divide nodes into tiers based on their position in the list
                        // For n nodes, create roughly sqrt(n) tiers to make a more square-ish layout
                        const numNewTiers = Math.max(2, Math.ceil(Math.sqrt(singleTierNodes.length)));
                        const nodesPerTier = Math.ceil(singleTierNodes.length / numNewTiers);
                        
                        sankeyData.nodesByTier.clear();
                        singleTierNodes.forEach((node, index) => {
                          const newTier = Math.min(Math.floor(index / nodesPerTier), numNewTiers - 1);
                          node.tier = newTier;
                          
                          if (!sankeyData.nodesByTier.has(newTier)) {
                            sankeyData.nodesByTier.set(newTier, []);
                          }
                          sankeyData.nodesByTier.get(newTier).push(node);
                          nodeOrder.set(node.name, newTier);
                        });
                        
                        sankeyData.maxTier = numNewTiers - 1;
                      } else {
                        // We have starting nodes, use flow-based distribution
                        nodesToProcess = startingNodes;
                        
                        // Use BFS to assign sequential tiers
                        let currentTier = 0;
                        const queue = [...nodesToProcess];
                        nodesToProcess.forEach(node => {
                          nodeOrder.set(node.name, currentTier);
                          visited.add(node.name);
                        });
                        
                        while (queue.length > 0) {
                          const current = queue.shift();
                          const currentTierForNode = nodeOrder.get(current.name);
                          
                          // Find outgoing connections
                          sankeyData.links.forEach(link => {
                            const sourceNode = sankeyData.nodes.find(n => n.index === link.source);
                            const targetNode = sankeyData.nodes.find(n => n.index === link.target);
                            
                            if (sourceNode?.name === current.name && targetNode && !visited.has(targetNode.name)) {
                              const newTier = currentTierForNode + 1;
                              nodeOrder.set(targetNode.name, newTier);
                              visited.add(targetNode.name);
                              queue.push(targetNode);
                              // Update maxTier
                              if (newTier > sankeyData.maxTier) {
                                sankeyData.maxTier = newTier;
                              }
                            }
                          });
                        }
                        
                        // Reassign tiers based on node order
                        // First, clear and rebuild nodesByTier
                        sankeyData.nodesByTier.clear();
                        
                        singleTierNodes.forEach(node => {
                          const newTier = nodeOrder.get(node.name) ?? 0;
                          node.tier = newTier;
                          
                          // Add node to appropriate tier
                          if (!sankeyData.nodesByTier.has(newTier)) {
                            sankeyData.nodesByTier.set(newTier, []);
                          }
                          sankeyData.nodesByTier.get(newTier).push(node);
                        });
                        
                        // Update maxTier
                        const newMaxTier = Math.max(...Array.from(nodeOrder.values()), 0);
                        sankeyData.maxTier = newMaxTier;
                      }
                    }
                  }
                  
                  // Calculate X positions for each tier - ensure good horizontal distribution
                  const finalNumTiers = sankeyData.maxTier + 1;
                  let finalTierSpacing = 0;
                  
                  for (let tier = 0; tier <= sankeyData.maxTier; tier++) {
                    let x;
                    if (finalNumTiers === 1) {
                      // Single tier: spread nodes across more space by distributing horizontally
                      // Use full available width for horizontal node placement
                      x = chartMargin + (availableWidth / 2);
                    } else {
                      // Multi-tier: distribute tiers evenly across available space
                      finalTierSpacing = availableWidth / (finalNumTiers - 1);
                      x = chartMargin + (tier * finalTierSpacing);
                    }
                    tierXPositions.set(tier, x);
                  }
                  
                  // Proper Sankey layout: align nodes based on flow relationships
                  // This positions nodes to minimize flow crossing and align flows
                  const calculateSankeyLayout = () => {
                    const tierPositions = new Map();
                    const minSpacing = 15; // Minimum spacing between nodes
                    
                    // Step 1: Calculate initial positions for each tier based on flow alignment
                    for (let tier = 0; tier <= sankeyData.maxTier; tier++) {
                      if (!sankeyData.nodesByTier.has(tier)) continue;
                      
                      const tierNodes = sankeyData.nodesByTier.get(tier);
                      const positions = new Map();
                      
                      if (tier === 0) {
                        // First tier: position based on total flow (largest first)
                        const sortedNodes = [...tierNodes].sort((a, b) => {
                          const valA = nodeValues.get(a.index) || 0;
                          const valB = nodeValues.get(b.index) || 0;
                          return valB - valA;
                        });
                        
                        let currentY = chartPadding;
                        sortedNodes.forEach((node) => {
                          const nodeHeight = nodeHeights.get(node.index);
                          positions.set(node.index, {
                            y: currentY,
                            height: nodeHeight
                          });
                          currentY += nodeHeight + minSpacing;
                        });
                      } else {
                        // Subsequent tiers: position based on incoming flows from previous tier
                        const prevTierPos = tierPositions.get(tier - 1);
                        if (!prevTierPos) {
                          // Fallback: stack them with spacing
                          let currentY = chartPadding;
                          tierNodes.forEach((node) => {
                            const nodeHeight = nodeHeights.get(node.index);
                            positions.set(node.index, {
                              y: currentY,
                              height: nodeHeight
                            });
                            currentY += nodeHeight + minSpacing;
                          });
                        } else {
                          // Position nodes based on where their incoming flows come from
                          const nodeYPositions = new Map();
                          
                          // For each node in this tier, find its incoming flows
                          tierNodes.forEach(node => {
                            const incomingLinks = sankeyData.links.filter(l => l.target === node.index);
                            
                            if (incomingLinks.length === 0) {
                              // No incoming flows, position at top
                              nodeYPositions.set(node.index, chartPadding);
                            } else {
                              // Calculate weighted average position based on flow values
                              let totalValue = 0;
                              let weightedY = 0;
                              
                              incomingLinks.forEach(link => {
                                const sourceNode = sankeyData.nodes.find(n => n.index === link.source);
                                if (sourceNode && sourceNode.tier === tier - 1) {
                                  const sourcePos = prevTierPos.get(link.source);
                                  if (sourcePos) {
                                    // Get the flow position on the source node
                                    const sourceFlows = nodeFlowPositions.get(link.source)?.outgoing || [];
                                    const sourceFlow = sourceFlows.find(f => f.link === link);
                                    const sourceFlowY = sourceFlow ? sourceFlow.y : sourcePos.y + (sourcePos.height / 2);
                                    
                                    weightedY += sourceFlowY * link.value;
                                    totalValue += link.value;
                                  }
                                }
                              });
                              
                              if (totalValue > 0) {
                                nodeYPositions.set(node.index, weightedY / totalValue);
                              } else {
                                nodeYPositions.set(node.index, chartPadding);
                              }
                            }
                          });
                          
                          // Sort nodes by their calculated Y positions
                          const sortedNodes = [...tierNodes].sort((a, b) => {
                            const yA = nodeYPositions.get(a.index) || 0;
                            const yB = nodeYPositions.get(b.index) || 0;
                            return yA - yB;
                          });
                          
                          // Position nodes, ensuring they don't overlap with proper spacing
                          let currentY = chartPadding;
                          sortedNodes.forEach((node) => {
                            const nodeHeight = nodeHeights.get(node.index);
                            const desiredY = nodeYPositions.get(node.index) || currentY;
                            
                            // Use desired position but ensure no overlap with minimum spacing
                            const finalY = Math.max(currentY, desiredY);
                            
                            positions.set(node.index, {
                              y: finalY,
                              height: nodeHeight
                            });
                            currentY = finalY + nodeHeight + minSpacing;
                          });
                        }
                      }
                      
                      tierPositions.set(tier, positions);
                    }
                    
                    // Step 2: Scale all tiers to fit available height, but preserve relative spacing
                    // Find the maximum total height needed across all tiers
                    let maxTotalHeight = 0;
                    tierPositions.forEach((positions) => {
                      let tierHeight = 0;
                      positions.forEach((pos) => {
                        tierHeight = Math.max(tierHeight, pos.y + pos.height);
                      });
                      maxTotalHeight = Math.max(maxTotalHeight, tierHeight);
                    });
                    
                    // Only scale if we significantly exceed available height
                    // Use 85% of available height to leave good margins
                    const targetHeight = availableHeight * 0.85;
                    const scale = maxTotalHeight > targetHeight ? targetHeight / maxTotalHeight : 1;
                    
                    // Apply scale to all positions and center vertically
                    const scaledPositions = new Map();
                    let scaledMaxHeight = 0;
                    const tempScaled = new Map();
                    
                    tierPositions.forEach((positions, tier) => {
                      const scaled = new Map();
                      positions.forEach((pos, nodeIndex) => {
                        const scaledPos = {
                          y: (pos.y - chartPadding) * scale + chartPadding,
                          height: pos.height * scale
                        };
                        scaled.set(nodeIndex, scaledPos);
                        scaledMaxHeight = Math.max(scaledMaxHeight, scaledPos.y + scaledPos.height);
                      });
                      tempScaled.set(tier, scaled);
                    });
                    
                    // Center the chart vertically in available space
                    const verticalOffset = (availableHeight - (scaledMaxHeight - chartPadding)) / 2;
                    
                    tempScaled.forEach((positions, tier) => {
                      const centered = new Map();
                      positions.forEach((pos, nodeIndex) => {
                        centered.set(nodeIndex, {
                          y: pos.y + verticalOffset,
                          height: pos.height
                        });
                      });
                      scaledPositions.set(tier, centered);
                    });
                    
                    return scaledPositions;
                  };
                  
                  // Calculate flow positions first (needed for layout calculation)
                  // Flows must be properly stacked within each node's height
                  const calculatePreliminaryFlowPositions = (tierPositions) => {
                    const flowPositions = new Map();
                    
                    sankeyData.nodes.forEach(node => {
                      const tierPos = tierPositions.get(node.tier);
                      if (!tierPos) return;
                      
                      const nodePos = tierPos.get(node.index);
                      if (!nodePos) return;
                      
                      const nodeHeight = nodePos.height;
                      const nodeTop = nodePos.y;
                      const nodeBottom = nodeTop + nodeHeight;
                      
                      // Calculate total flow value for this node to determine how to distribute flows
                      const outgoingLinks = sankeyData.links.filter(l => l.source === node.index);
                      const incomingLinks = sankeyData.links.filter(l => l.target === node.index);
                      
                      const totalOutgoing = outgoingLinks.reduce((sum, l) => sum + l.value, 0);
                      const totalIncoming = incomingLinks.reduce((sum, l) => sum + l.value, 0);
                      const nodeValue = nodeValues.get(node.index) || 0;
                      
                      // Outgoing flows - stack from top to bottom, proportional to actual node value
                      const sortedOutgoing = [...outgoingLinks].sort((a, b) => b.value - a.value);
                      let currentY = nodeTop;
                      const outgoing = [];
                      
                      if (totalOutgoing > 0 && nodeValue > 0) {
                        sortedOutgoing.forEach(link => {
                          // Flow width proportional to node value, not scaled to fill 100%
                          const flowHeight = (link.value / nodeValue) * nodeHeight;
                          const flowY = currentY + flowHeight / 2;
                          
                          outgoing.push({
                            link,
                            y: flowY,
                            width: flowHeight,
                            top: currentY,
                            bottom: currentY + flowHeight
                          });
                          currentY += flowHeight;
                        });
                      }
                      
                      // Incoming flows - stack from top to bottom, always fill 100% of node height
                      const sortedIncoming = [...incomingLinks].sort((a, b) => b.value - a.value);
                      currentY = nodeTop;
                      const incoming = [];
                      
                      if (totalIncoming > 0) {
                        sortedIncoming.forEach(link => {
                          // Flow width proportional to total incoming, always fills 100% of node height
                          const flowHeight = (link.value / totalIncoming) * nodeHeight;
                          const flowY = currentY + flowHeight / 2;
                          
                          incoming.push({
                            link,
                            y: flowY,
                            width: flowHeight,
                            top: currentY,
                            bottom: currentY + flowHeight
                          });
                          currentY += flowHeight;
                        });
                      }
                      
                      flowPositions.set(node.index, { outgoing, incoming });
                    });
                    
                    return flowPositions;
                  };
                  
                  // Initialize nodeFlowPositions map
                  const nodeFlowPositions = new Map();
                  
                  // Initial tier positions (simple stacking for first pass with better spacing)
                  const initialTierPositions = new Map();
                  const initialSpacing = 20; // More spacing for initial layout
                  for (let tier = 0; tier <= sankeyData.maxTier; tier++) {
                    if (!sankeyData.nodesByTier.has(tier)) continue;
                    const tierNodes = sankeyData.nodesByTier.get(tier);
                    const positions = new Map();
                    let currentY = chartPadding;
                    tierNodes.forEach((node) => {
                      const nodeHeight = nodeHeights.get(node.index);
                      positions.set(node.index, {
                        y: currentY,
                        height: nodeHeight
                      });
                      currentY += nodeHeight + initialSpacing;
                    });
                    initialTierPositions.set(tier, positions);
                  }
                  
                  // Calculate preliminary flow positions
                  const preliminaryFlowPositions = calculatePreliminaryFlowPositions(initialTierPositions);
                  preliminaryFlowPositions.forEach((flows, nodeIndex) => {
                    nodeFlowPositions.set(nodeIndex, flows);
                  });
                  
                  // Now calculate proper Sankey layout (this uses nodeFlowPositions)
                  const tierPositions = calculateSankeyLayout();
                  
                  // Recalculate flow positions with final tier positions
                  const finalFlowPositions = calculatePreliminaryFlowPositions(tierPositions);
                  nodeFlowPositions.clear();
                  finalFlowPositions.forEach((flows, nodeIndex) => {
                    nodeFlowPositions.set(nodeIndex, flows);
                  });
                  
                  // Create flow path - flows connect to node edges and fill node height proportionally
                  const createFlowPath = (link) => {
                    const sourceNode = sankeyData.nodes.find(n => n.index === link.source);
                    const targetNode = sankeyData.nodes.find(n => n.index === link.target);
                    
                    if (!sourceNode || !targetNode) return null;
                    
                    const sourceTier = sourceNode.tier;
                    const targetTier = targetNode.tier;
                    const sourceX = tierXPositions.get(sourceTier);
                    const targetX = tierXPositions.get(targetTier);
                    
                    if (sourceX === undefined || targetX === undefined) return null;
                    
                    const sourceTierPos = tierPositions.get(sourceTier);
                    const targetTierPos = tierPositions.get(targetTier);
                    if (!sourceTierPos || !targetTierPos) return null;
                    
                    const sourcePos = sourceTierPos.get(link.source);
                    const targetPos = targetTierPos.get(link.target);
                    if (!sourcePos || !targetPos) return null;
                    
                    // Get flow positions - these contain the actual connection points
                    const sourceFlows = nodeFlowPositions.get(link.source)?.outgoing || [];
                    const sourceFlow = sourceFlows.find(f => f.link === link);
                    
                    const targetFlows = nodeFlowPositions.get(link.target)?.incoming || [];
                    const targetFlow = targetFlows.find(f => f.link === link);
                    
                    // Use flow positions if available, otherwise center of node
                    const sourceFlowTop = sourceFlow ? sourceFlow.top : sourcePos.y;
                    const sourceFlowBottom = sourceFlow ? sourceFlow.bottom : sourcePos.y + sourcePos.height;
                    const sourceFlowY = sourceFlow ? sourceFlow.y : sourcePos.y + (sourcePos.height / 2);
                    const sourceFlowHeight = sourceFlow ? sourceFlow.width : sourcePos.height;
                    
                    const targetFlowTop = targetFlow ? targetFlow.top : targetPos.y;
                    const targetFlowBottom = targetFlow ? targetFlow.bottom : targetPos.y + targetPos.height;
                    const targetFlowY = targetFlow ? targetFlow.y : targetPos.y + (targetPos.height / 2);
                    const targetFlowHeight = targetFlow ? targetFlow.width : targetPos.height;
                    
                    // Connection points at node edges
                    const sourceX1 = sourceX + nodeWidth; // Right edge of source node
                    const targetX0 = targetX; // Left edge of target node
                    const dx = targetX0 - sourceX1;
                    const curvature = 0.4;
                    
                    // Smooth S-curve connecting the flow segments
                    const cp1x = sourceX1 + dx * curvature;
                    const cp2x = targetX0 - dx * curvature;
                    
                    // Create path that connects source flow segment to target flow segment
                    const path = `M ${sourceX1} ${sourceFlowTop}
                                 C ${cp1x} ${sourceFlowTop}, ${cp2x} ${targetFlowTop}, ${targetX0} ${targetFlowTop}
                                 L ${targetX0} ${targetFlowBottom}
                                 C ${cp2x} ${targetFlowBottom}, ${cp1x} ${sourceFlowBottom}, ${sourceX1} ${sourceFlowBottom}
                                 Z`;
                    
                    return path;
                  };
                  
                  // Sort links for rendering
                  const sortedLinks = [...sankeyData.links].sort((a, b) => {
                    const sourceNodeA = sankeyData.nodes.find(n => n.index === a.source);
                    const sourceNodeB = sankeyData.nodes.find(n => n.index === b.source);
                    const tierA = sourceNodeA?.tier || 0;
                    const tierB = sourceNodeB?.tier || 0;
                    const posA = tierPositions.get(tierA)?.get(a.source)?.y || 0;
                    const posB = tierPositions.get(tierB)?.get(b.source)?.y || 0;
                    return posA - posB;
                  });
                  
                  return (
                    <g key="sankey-chart">
                      <defs>
                        <linearGradient id={`sankeyGradient-${item.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor={chartConfig.dataColor || '#4CAF50'} stopOpacity="0.75" />
                          <stop offset="100%" stopColor={chartConfig.dataColor || '#4CAF50'} stopOpacity="0.4" />
                        </linearGradient>
                      </defs>
                      
                      {/* Render flows first (behind nodes) */}
                      {sortedLinks.map((link, i) => {
                        const path = createFlowPath(link);
                        if (!path) return null;
                        
                        const sourceNode = sankeyData.nodes.find(n => n.index === link.source);
                        const sourceTotalValue = nodeValues.get(link.source) || 0;
                        const flowPercentage = sourceTotalValue > 0 ? (link.value / sourceTotalValue * 100) : 0;
                        
                        // Calculate midpoint of path for tooltip positioning
                        const sourceTierX = tierXPositions.get(sourceNode?.tier || 0) || 0;
                        const targetNode = sankeyData.nodes.find(n => n.index === link.target);
                        const targetTierX = tierXPositions.get(targetNode?.tier || 0) || 0;
                        const midX = (sourceTierX + targetTierX) / 2;
                        const midY = height / 2;
                        
                        return (
                          <path
                            key={`link-${i}`}
                            d={path}
                            fill={`url(#sankeyGradient-${item.id})`}
                            opacity="0.65"
                            stroke="none"
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const itemRect = itemRef.current?.getBoundingClientRect();
                              if (itemRect) {
                                setHoverTooltip({
                                  x: midX,
                                  y: midY,
                                  content: (
                                    <div>
                                      <div><strong>{sourceNode?.name || 'Source'} → {targetNode?.name || 'Target'}</strong></div>
                                      <div>Value: {link.value.toFixed(1)}</div>
                                      <div>{flowPercentage.toFixed(1)}% of {sourceNode?.name || 'source'}</div>
                                    </div>
                                  )
                                });
                              }
                            }}
                            onMouseLeave={() => setHoverTooltip(null)}
                          />
                        );
                      })}
                      
                      {/* Render nodes by tier */}
                      {sankeyData.nodesByTier && Array.from(sankeyData.nodesByTier.entries()).map(([tier, tierNodes]) => {
                        const tierX = tierXPositions.get(tier);
                        const tierPos = tierPositions.get(tier);
                        if (tierX === undefined || !tierPos) return null;
                        
                        return tierNodes.map((node) => {
                          const pos = tierPos.get(node.index);
                          if (!pos) {
                            if (process.env.NODE_ENV === 'development') {
                              console.warn(`No position found for node ${node.index} (${node.name}) in tier ${tier}`);
                            }
                            return null;
                          }
                          
                          const nodeHeight = pos.height;
                          const value = nodeValues.get(node.index) || 0;
                          const outgoing = nodeOutgoing.get(node.index) || 0;
                          const incoming = nodeIncoming.get(node.index) || 0;
                          const isFirstTier = tier === 0;
                          const isLastTier = tier === sankeyData.maxTier;
                          
                          return (
                            <g key={`node-${node.index}`}>
                              <rect
                                x={tierX}
                                y={pos.y}
                                width={nodeWidth}
                                height={nodeHeight}
                                fill={chartConfig.dataColor || '#2196F3'}
                                stroke="#fff"
                                strokeWidth={1.5}
                                rx={2}
                                style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))', cursor: 'pointer' }}
                                onMouseEnter={(e) => {
                                  setHoverTooltip({
                                    x: tierX + nodeWidth / 2,
                                    y: pos.y + nodeHeight / 2,
                                    content: (
                                      <div>
                                        <div><strong>{node.name}</strong></div>
                                        <div>Total: {value.toFixed(1)}</div>
                                        {outgoing > 0 && <div>Outgoing: {outgoing.toFixed(1)}</div>}
                                        {incoming > 0 && <div>Incoming: {incoming.toFixed(1)}</div>}
                                      </div>
                                    )
                                  });
                                }}
                                onMouseLeave={() => setHoverTooltip(null)}
                              />
                              <text
                                x={isFirstTier ? tierX - 6 : (isLastTier ? tierX + nodeWidth + 6 : tierX + nodeWidth / 2)}
                                y={pos.y + nodeHeight / 2}
                                fontSize={Math.min(width, height) * 0.022}
                                fill={chartTitleColor}
                                textAnchor={isFirstTier ? 'end' : (isLastTier ? 'start' : 'middle')}
                                dominantBaseline="middle"
                                fontWeight="500"
                                fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                                style={{ userSelect: 'none' }}
                              >
                                {node.name}
                              </text>
                              {(isFirstTier || isLastTier) && value > 0 && (
                                <text
                                  x={isFirstTier ? tierX - 6 : tierX + nodeWidth + 6}
                                  y={pos.y + nodeHeight / 2 + 14}
                                  fontSize={Math.min(width, height) * 0.018}
                                  fill="#666"
                                  textAnchor={isFirstTier ? 'end' : 'start'}
                                  dominantBaseline="middle"
                                  fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                                  style={{ userSelect: 'none' }}
                                >
                                  {value.toFixed(0)}
                                </text>
                              )}
                            </g>
                          );
                        });
                      })}
                    </g>
                  );
                })()}
              </>
            )}
            {item.chartType === 'sine' && (
              <>
                {/* Background grid with scale */}
                {(() => {
                  // Calculate Y-axis values based on configuration
                  const yValues = (() => {
                    if (chartConfig.yAxisMode === 'custom' && Array.isArray(chartConfig.yAxisCustomValues) && chartConfig.yAxisCustomValues.length > 0) {
                      return chartConfig.yAxisCustomValues;
                    } else {
                      // Default to 7 points from 3 to -3 if no custom values
                      const start = chartConfig.yAxisStart || -3;
                      const end = chartConfig.yAxisEnd || 3;
                      const step = chartConfig.yAxisUnit || 1;
                      const count = Math.ceil((end - start) / step) + 1;
                      return Array.from({ length: count }, (_, i) => end - (i * step));
                    }
                  })();

                  const axisLength = height - padding * 2;  // Available length for the y-axis
                  
                  return yValues.map((value, i) => {
                    // Calculate position relative to the axis
                    const normalizedPosition = i / (yValues.length - 1);
                    const y = padding + (normalizedPosition * axisLength);

                    return (
                      <g key={`y-${i}`}>
                        {/* Y-axis tick mark */}
                        <line 
                          x1={padding - 5}
                          y1={y}
                          x2={padding + 5}
                          y2={y}
                          stroke="#2196F3"
                          strokeWidth="1"
                        />
                        {/* Grid line */}
                        <line 
                          x1={padding} 
                          y1={y}
                          x2={width - padding} 
                          y2={y}
                          stroke="#666" 
                          strokeDasharray="4,4"
                          opacity="0.1"
                        />
                        {/* Label */}
                        {chartConfig.showYAxisLabels !== false && (
                          <text 
                            x={padding - (padding * 0.2)} // Position relative to axis
                            y={y}
                            fontSize={Math.min(width, height) * 0.028}
                            fill={chartTextColor}
                            textAnchor="end"
                            dominantBaseline="middle"
                            fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                            style={{ userSelect: 'none' }}
                          >
                            {formatAxisLabel(value, chartConfig.yAxisMode)}
                          </text>
                        )}
                      </g>
                    );
                  });
                })()}
                
                {/* X-axis scale */}
                {(() => {
                  let xValues;
                  if (chartConfig.xAxisMode === 'custom' && Array.isArray(chartConfig.xAxisCustomValues) && chartConfig.xAxisCustomValues.length > 0) {
                    xValues = chartConfig.xAxisCustomValues;
                  } else if (chartConfig.xAxisMode === 'date') {
                    const start = new Date(chartConfig.xAxisStartDate || new Date());
                    const end = new Date(chartConfig.xAxisEndDate || new Date(start.getTime() + 86400000)); // Default to 1 day range
                    const count = 6; // Default to 6 points
                    const timeRange = end.getTime() - start.getTime();
                    const step = timeRange / (count - 1);
                    xValues = Array.from({ length: count }, (_, i) => new Date(start.getTime() + (step * i)));
                  } else {
                    // For sine charts, ensure x-axis aligns with wave periods
                    if (item.chartType === 'sine') {
                      const periods = chartConfig.periods || 1;
                      const maxAngle = 2 * Math.PI * periods;
                      const start = chartConfig.xAxisStart || 0;
                      // Always use calculated end based on periods for sine charts
                      const end = 2 * Math.PI * periods;
                      const unit = chartConfig.xAxisUnit || (Math.PI / 2);
                      
                      // Generate values from start to end with unit step
                      const numSteps = Math.ceil((end - start) / unit) + 1;
                      xValues = Array.from({ length: numSteps }, (_, i) => {
                        const value = start + (i * unit);
                        return value > end ? end : value;
                      });
                    } else {
                      // Use calculateScale for non-sine charts
                      xValues = calculateScale(
                        chartConfig.xAxisStart,
                        chartConfig.xAxisEnd,
                        chartConfig.xAxisUnit,
                        chartConfig.xAxisMode,
                        chartConfig.xAxisCustomValues
                      );
                    }
                  }

                  const axisLength = width - padding * 2;

                  return xValues.map((value, i) => {
                    let x;
                    if (item.chartType === 'sine') {
                      // Map angle values to chart positions
                      // The wave spans from xAxisStart to 2π * periods
                      const start = chartConfig.xAxisStart || 0;
                      const periods = chartConfig.periods || 1;
                      const end = 2 * Math.PI * periods;
                      const range = end - start;
                      const normalizedPosition = range > 0 ? (value - start) / range : 0;
                      x = padding + (normalizedPosition * axisLength);
                    } else {
                      const stepSize = axisLength / (xValues.length - 1);
                      x = padding + (i * stepSize);
                    }
                    return (
                      <g key={`x-${i}`}>
                        {/* Vertical grid line */}
                        <line 
                          x1={x}
                          y1={effectivePadding}
                          x2={x}
                          y2={height - effectivePadding}
                          stroke="#666" 
                          strokeDasharray="4,4"
                          opacity="0.1"
                        />
                        {/* Only render X-axis labels if showXAxisLabels is true */}
                        {chartConfig.showXAxisLabels === true && (
                          <text 
                            x={x}
                            y={height - effectivePadding + (tickLength * 3)}
                            fontSize={Math.min(width, height) * 0.028}
                            fill={chartTextColor}
                            textAnchor="middle"
                            fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                            style={{ userSelect: 'none' }}
                            transform={chartConfig.xAxisMode === 'date' || chartConfig.xAxisMode === 'custom' 
                              ? `rotate(-45, ${x}, ${height - effectivePadding + (tickLength * 3)})` 
                              : undefined}
                          >
                            {formatAxisLabel(value, chartConfig.xAxisMode, chartConfig.xAxisTitle)}
                          </text>
                        )}
                      </g>
                    );
                  });
                })()}
                
                {/* Y-axis scale */}
                {(() => {
                  // Calculate Y-axis values
                  const yValues = (() => {
                    if (chartConfig.yAxisMode === 'custom' && Array.isArray(chartConfig.yAxisCustomValues) && chartConfig.yAxisCustomValues.length > 0) {
                      return chartConfig.yAxisCustomValues;
                    } else {
                      const start = chartConfig.yAxisStart || -3;
                      const end = chartConfig.yAxisEnd || 3;
                      const step = chartConfig.yAxisUnit || 1;
                      const count = Math.ceil((end - start) / step) + 1;
                      return Array.from({ length: count }, (_, i) => end - (i * step));
                    }
                  })();

                  const axisLength = height - padding * 2;
                  const stepSize = axisLength / (yValues.length - 1);

                  return yValues.map((value, i) => {
                    const y = padding + (i * stepSize);
                    return (
                      <g key={`y-${i}`}>
                        {/* Horizontal grid line */}
                        <line 
                          x1={padding}
                          y1={y}
                          x2={width - padding}
                          y2={y}
                          stroke="#666" 
                          strokeDasharray="4,4"
                          opacity="0.1"
                        />
                        {/* Only render Y-axis labels if showYAxisLabels is true */}
                        {chartConfig.showYAxisLabels === true && (
                          <text 
                            x={padding - (padding * 0.2)}
                            y={y}
                            fontSize={Math.min(width, height) * 0.028}
                            fill={chartTextColor}
                            textAnchor="end"
                            dominantBaseline="middle"
                            fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                            style={{ userSelect: 'none' }}
                          >
                            {formatAxisLabel(value, chartConfig.yAxisMode)}
                          </text>
                        )}
                      </g>
                    );
                  });
                })()}
                

                {/* Y-Axis Title for sine wave */}
                {chartConfig.yAxisTitle && chartConfig.showYAxisLabels === true && (
                  <g>
                    <text
                      x={padding / 2}
                      y={height - effectivePadding - (chartHeight / 2)}
                      fontSize={Math.min(width, height) * 0.045}
                      fill={chartTitleColor}
                      textAnchor="middle"
                      fontWeight="600"
                      letterSpacing="0.5px"
                      fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                      style={{ userSelect: 'none' }}
                      transform={`rotate(-90, ${padding / 4}, ${height - effectivePadding - (chartHeight / 2)})`}
                    >
                      {chartConfig.yAxisTitle}
                    </text>
                  </g>
                )}
                
                {/* Sine wave with gradient */}
                <defs>
                  <linearGradient id="sineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{ stopColor: '#2196F3', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#03A9F4', stopOpacity: 0.7 }} />
                  </linearGradient>
                </defs>
                
                {/* Main sine wave */}
                <path
                  d={`M ${padding} ${height/2} ${Array.from({ length: chartWidth }, (_, i) => {
                    const x = i + padding;
                    const normalizedX = (i / chartWidth) * (2 * Math.PI * chartConfig.periods);
                    const amplitude = (height - padding * 2) / 6 * (chartConfig.amplitude || 1);
                    
                    // Calculate phase shift
                    const phaseShift = chartConfig.phaseShift || 0;
                    
                    // Calculate harmonics
                    const harmonics = chartConfig.harmonics || 1;
                    
                    // Calculate modulation if enabled
                    let modulationFactor = 1;
                    if (chartConfig.enableModulation) {
                      const modulationDepth = chartConfig.modulationDepth || 0.5;
                      modulationFactor = 1 + modulationDepth * Math.sin(normalizedX * 0.5); // Slower modulation frequency
                    }
                    
                    // Calculate base wave value based on type
                    let waveValue;
                    const angle = (normalizedX * (chartConfig.frequency || 1) * harmonics + phaseShift) * modulationFactor;
                    
                    switch (chartConfig.waveType || 'sine') {
                      case 'cosine':
                        waveValue = Math.cos(angle);
                        break;
                      case 'tangent':
                        waveValue = Math.tan(angle);
                        // Clamp tangent values to avoid extreme values
                        waveValue = Math.max(Math.min(waveValue, 3), -3);
                        break;
                      default: // sine
                        waveValue = Math.sin(angle);
                        break;
                    }
                    
                    const y = height - (padding + ((chartConfig.yAxisEnd - chartConfig.yAxisStart) / 2 + waveValue * (chartConfig.amplitude || 1)) * ((height - padding * 2) / (chartConfig.yAxisEnd - chartConfig.yAxisStart)));
                    return `L ${x} ${y}`;
                  }).join(' ')}`}
                  stroke="url(#sineGradient)"
                  strokeWidth={Math.min(width, height) * 0.005}
                  fill="none"
                  strokeLinecap="round"
                />
                
                {/* Key points on wave */}
                {(() => {
                  const keyPoints = [];
                  const periods = chartConfig.periods || 1;
                  const frequency = chartConfig.frequency || 1;
                  
                  // Add points at key angles for each period
                  for (let p = 0; p <= periods; p++) {
                    const baseAngle = p * (2 * Math.PI);
                    const angles = (chartConfig.waveType || 'sine') === 'tangent' 
                      ? [0, Math.PI/4, Math.PI/2 * 0.9] // Avoid exact π/2 for tangent
                      : [0, Math.PI/2, Math.PI];
                    
                    angles.forEach(angle => {
                      const totalAngle = baseAngle + angle;
                      const normalizedX = totalAngle / (2 * Math.PI * periods);
                      if (normalizedX <= 1) { // Only add points within the visible range
                        const x = padding + (normalizedX * chartWidth);
                        
                        // Calculate y based on wave type
                        let waveValue;
                        switch (chartConfig.waveType || 'sine') {
                          case 'cosine':
                            waveValue = Math.cos(totalAngle * frequency);
                            break;
                          case 'tangent':
                            waveValue = Math.tan(totalAngle * frequency);
                            waveValue = Math.max(Math.min(waveValue, 3), -3);
                            break;
                          default: // sine
                            waveValue = Math.sin(totalAngle * frequency);
                            break;
                        }
                        
                        const y = height - (padding + ((chartConfig.yAxisEnd - chartConfig.yAxisStart) / 2 + waveValue * (chartConfig.amplitude || 1)) * ((height - padding * 2) / (chartConfig.yAxisEnd - chartConfig.yAxisStart)));
                        keyPoints.push({ x, y });
                      }
                    });
                  }

                  return keyPoints.map((point, i) => (
                    <circle 
                      key={i} 
                      cx={point.x} 
                      cy={point.y} 
                      r={Math.min(width, height) * 0.01}
                      fill="#2196F3"
                      stroke="#fff"
                      strokeWidth="1"
                    />
                  ));
                })()}

                {/* X-Axis Title for sine wave */}
                {chartConfig.xAxisTitle && chartConfig.showXAxisLabels !== false && (
                  <g>
                    <text
                      x={effectivePadding + (chartWidth / 2)}
                      y={height - (padding / 2)}
                      fontSize={Math.min(width, height) * 0.045}
                      fill={chartTitleColor}
                      textAnchor="middle"
                      fontWeight="600"
                      letterSpacing="0.5px"
                      fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                      style={{ userSelect: 'none' }}
                      dominantBaseline="hanging"
                    >
                      {chartConfig.xAxisTitle}
                    </text>
                  </g>
                )}

              </>
            )}
          </svg>
        </div>
      );
    }

    if (isEditing) {
      return (
        <textarea
          ref={textareaRef}
          value={item.text || ''}
          onChange={(e) => updateText(item.id, e.target.value)}
          onBlur={closeEditing}
          onKeyDown={(e) => {
            // For text items, Enter always closes editing
            // For other items (sticky notes), Enter closes unless Shift is held
            if (e.key === 'Enter') {
              if (item.type === 'text' || !e.shiftKey) {
                e.preventDefault();
                closeEditing();
              }
            }
          }}
          style={{
            ...stickyStyle,
            resize: 'none',
            // Don't override border or backgroundColor - stickyStyle already has them set correctly
            outline: 'none',
            textAlign: item.textAlign || 'center',
            lineHeight: '1.5',
            display: 'flex',
            ...(item.textAlign === 'left' ? { alignItems: 'flex-start', justifyContent: 'flex-start' } :
                item.textAlign === 'right' ? { alignItems: 'flex-start', justifyContent: 'flex-end' } :
                { alignItems: 'center', justifyContent: 'center' }),
            paddingTop: '8px'
          }}
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      );
    }

    return (
      <div 
        className={`${item.type}-shape`}
        style={{
          ...stickyStyle,
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
        }}
        onDoubleClick={() => setIsEditing(true)}
      >
        {item.text}
      </div>
    );
  };

  const renderResizeHandles = () => {
    if (!isSelected) return null;

    // Only show corner handles, exclude center handles (n, s, e, w)
    const handles = [
      { position: 'nw', cursor: 'nw-resize' },
      { position: 'ne', cursor: 'ne-resize' },
      { position: 'se', cursor: 'se-resize' },
      { position: 'sw', cursor: 'sw-resize' }
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

  const EditButton = ({ onStartEditing, scale }) => {
    const handleMouseDown = (e) => {
      // Stop all propagation immediately
      e.stopPropagation();
      e.preventDefault();
      if (e.nativeEvent) {
        e.nativeEvent.stopImmediatePropagation();
      }
      // Trigger action directly on mousedown for better reliability
      onStartEditing();
    };

    const scaledSize = Math.max(18, 18 * Math.min(scale, 2));
    const scaledPadding = 3 * Math.min(scale, 2);
    
    return (
      <div
        className="edit-control"
        onMouseDown={handleMouseDown}
        onMouseDownCapture={handleMouseDown}
        onClick={(e) => {
          // Also handle click as fallback
          e.stopPropagation();
          e.preventDefault();
          onStartEditing();
        }}
        style={{
          position: 'absolute',
          right: `-${scaledSize / 2 + 15}px`,
          top: '50%',
          transform: 'translateY(-50%)',
          width: `${scaledSize}px`,
          height: `${scaledSize}px`,
          background: '#2196F3',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: '1.5px solid white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          zIndex: 1003,
          padding: `${scaledPadding}px`,
          pointerEvents: 'auto'
        }}
      >
        <svg 
          width={scaledSize * 0.6} 
          height={scaledSize * 0.6} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="white" 
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: 'none' }}
        >
          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      </div>
    );
  };

  const ConnectorButton = ({ onStartConnection, scale }) => {
    const handleMouseDown = (e) => {
      // Stop all propagation immediately
      e.stopPropagation();
      e.preventDefault();
      if (e.nativeEvent) {
        e.nativeEvent.stopImmediatePropagation();
      }
      // Trigger action directly on mousedown for better reliability
      onStartConnection(item.id);
    };

    const scaledSize = Math.max(18, 18 * Math.min(scale, 2));
    const scaledPadding = 3 * Math.min(scale, 2);

    return (
      <div
        className="connector-control"
        onMouseDown={handleMouseDown}
        onMouseDownCapture={handleMouseDown}
        onClick={(e) => {
          // Also handle click as fallback
          e.stopPropagation();
          e.preventDefault();
          onStartConnection(item.id);
        }}
        style={{
          position: 'absolute',
          right: `-${scaledSize / 2 + 15}px`,
          top: '50%',
          transform: 'translateY(-50%)',
          width: `${scaledSize}px`,
          height: `${scaledSize}px`,
          background: '#4CAF50',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: '1.5px solid white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          zIndex: 1003,
          marginTop: `${scaledSize * 1.2}px`,
          padding: `${scaledPadding}px`,
          pointerEvents: 'auto'
        }}
      >
        <svg 
          width={scaledSize * 0.6} 
          height={scaledSize * 0.6} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="white" 
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: 'none' }}
        >
          <path d="M7 17L17 7M17 7H7M17 7V17" />
        </svg>
      </div>
    );
  };

  const ExpandButton = ({ onExpandConcept, scale, isExpanding }) => {
    const handleMouseDown = (e) => {
      // Stop all propagation immediately
      e.stopPropagation();
      e.preventDefault();
      if (e.nativeEvent) {
        e.nativeEvent.stopImmediatePropagation();
      }
      // Trigger action directly on mousedown for better reliability
      if (!isExpanding) {
        onExpandConcept();
      }
    };

    const scaledSize = Math.max(18, 18 * Math.min(scale, 2));
    const scaledPadding = 3 * Math.min(scale, 2);

    return (
      <div
        className={`expand-control ${isExpanding ? 'expanding' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseDownCapture={handleMouseDown}
        onClick={(e) => {
          // Also handle click as fallback
          e.stopPropagation();
          e.preventDefault();
          if (!isExpanding) {
            onExpandConcept();
          }
        }}
        style={{
          position: 'absolute',
          right: `-${scaledSize / 2 + 15}px`,
          top: '50%',
          transform: 'translateY(-50%)',
          width: `${scaledSize}px`,
          height: `${scaledSize}px`,
          background: isExpanding ? '#7b1fa2' : '#9c27b0',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isExpanding ? 'wait' : 'pointer',
          border: '1.5px solid white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          zIndex: 1003,
          marginTop: `-${scaledSize * 1.2}px`,
          padding: `${scaledPadding}px`,
          pointerEvents: 'auto'
        }}
      >
        {isExpanding ? (
          <div className="spinner" style={{ pointerEvents: 'none' }}></div>
        ) : (
          <svg 
            width={scaledSize * 0.6} 
            height={scaledSize * 0.6} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="white" 
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: 'none', display: 'block' }}
          >
            <path d="M12 2v20M2 12h20" />
          </svg>
        )}
      </div>
    );
  };

  // Return null if item is invalid (after all hooks have been called)
  if (!isValidItem) {
    console.warn('WhiteboardItem: Invalid item or missing required properties', item);
    return null;
  }

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
        transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
        transformOrigin: 'center center',
        cursor: isDragging ? 'grabbing' : (isConnecting ? 'not-allowed' : (isValidTarget ? 'pointer' : 'default')),
        transition: isDragging || isRotating ? 'none' : 'all 0.15s ease',
        zIndex: item.type === 'chart' ? 1 : (isSelected ? 1000 : (item.order !== undefined ? 100 + item.order : 100)),
        pointerEvents: 'auto',
        userSelect: 'none',
        border: isValidTarget ? '2px dashed #4CAF50' : 'none',
        ...(item.type === 'sticky' ? { backgroundColor: item.backgroundColor || '#fff740' } : {}),
      }}
      onClick={handleClick}
      onDoubleClick={(e) => {
        // Enable double-click to edit for circle, rectangle, text, and sticky note types
        if (item.type === 'circle' || item.type === 'rectangle' || item.type === 'text' || item.type === 'sticky') {
          if (!isEditing && !isResizing && !isDragging) {
            e.stopPropagation();
            setIsEditing(true);
          }
        }
        // Enable double-click to open edit menu for all charts
        else if (item.type === 'chart') {
          if (!isEditing && !isResizing && !isDragging && onChartEdit) {
            e.stopPropagation();
            onChartEdit(item.id);
          }
        }
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => onContextMenu && onContextMenu(e)}
    >
      {renderContent()}
      {renderResizeHandles()}
      {localStorage.getItem('showCoordinates') !== 'false' && (
        <div
          style={{
            position: 'absolute',
            bottom: '-20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 1001
          }}
        >
          ({item.position.x}, {item.position.y})
        </div>
      )}
      {isSelected && !isEditing && !isChartEditing && (
        <>
          {/* Show connect button for all items except charts */}
          {item.type !== 'chart' && (
            <ConnectorButton 
              onStartConnection={onConnectionStart}
              scale={scale}
            />
          )}
          
          {/* Show edit and expand buttons only for non-image, non-chart items */}
          {item.type !== 'chart' && item.type !== 'image' && (
            <>
              <EditButton 
                onStartEditing={() => {
                  // Show color menu instead of editing for non-image, non-chart items
                  if (onShowColorMenu) {
                    onShowColorMenu();
                  }
                }}
                scale={scale}
              />
              {canUseExpandTool && (
                <ExpandButton 
                  onExpandConcept={() => {
                    if (window.expandSelectedConcept && typeof window.expandSelectedConcept === 'function') {
                      window.expandSelectedConcept(item.id, item.text);
                    }
                  }}
                  scale={scale}
                  isExpanding={isExpanding}
                />
              )}
            </>
          )}

          {/* Show edit button for charts */}
          {item.type === 'chart' && (
            <EditButton 
              onStartEditing={() => {
                onChartEdit && onChartEdit(item.id);
              }}
              scale={scale}
            />
          )}
        </>
      )}
      
      {/* Hover Tooltip */}
      {hoverTooltip && (
        <div
          style={{
            position: 'absolute',
            left: hoverTooltip.x,
            top: hoverTooltip.y,
            transform: 'translate(-50%, -100%)',
            marginBottom: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            pointerEvents: 'none',
            zIndex: 10000,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            lineHeight: '1.5'
          }}
        >
          {hoverTooltip.content}
        </div>
      )}
    </div>
  );
};

export default WhiteboardItem; 