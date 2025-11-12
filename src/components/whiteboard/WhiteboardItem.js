import React, { useState, useRef, useEffect, useCallback } from 'react';


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
  const [isEditing, setIsEditing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);

  // Initialize chart config from saved item data or defaults
  const getInitialChartConfig = () => ({
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
    dataColor: item.dataColor || '#FF5722'
  });

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
    item.dataColor
  ]);

  const itemRef = useRef(null);

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



  const renderContent = () => {
    const stickyStyle = item.type === 'sticky' ? {
      backgroundColor: item.backgroundColor || '#fff740',
      width: '100%',
      height: '100%',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      fontFamily: item.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: `${item.fontSize || 14}px`,
      color: item.textColor || '#000',
      borderRadius: '2px'
    } : {
      backgroundColor: item.backgroundColor,
      width: '100%',
      height: '100%',
      padding: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      fontFamily: item.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: `${item.fontSize || 14}px`,
      color: item.textColor || '#000',
      border: item.borderColor ? `2px solid ${item.borderColor}` : '1px solid #ccc'
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
      const padding = basePadding + yAxisLabelPadding;
      const tickLength = 5; // Length of tick marks
      
      const width = item.width;
      const height = item.height;
      const chartWidth = width - (padding * 2);
      const chartHeight = height - (padding * 2);

      const effectivePadding = padding;

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
        if (chartConfig.dataMode === 'none' || item.chartType !== 'xy') return [];
        
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
                fill="#1a1a1a"
                textAnchor="middle"
                fontWeight="600"
                letterSpacing="0.5px"
                fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                style={{ userSelect: 'none' }}
              >
                {item.title}
              </text>
            )}
            {item.chartType === 'xy' && (
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
                          fill="#404040"
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
                          fill="#404040"
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
                      fill="#1a1a1a"
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
                      fill="#1a1a1a"
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

                {/* Data Plotting */}
                {dataPoints.length > 0 && (() => {
                  // Convert data points to chart coordinates
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
                      {chartConfig.showDataPoints && chartPoints.map((point, i) => (
                        <circle
                          key={`data-point-${i}`}
                          cx={point.x}
                          cy={point.y}
                          r={Math.min(width, height) * 0.008}
                          fill={chartConfig.dataColor || '#FF5722'}
                          stroke="white"
                          strokeWidth={Math.min(width, height) * 0.002}
                        />
                      ))}
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
                            fill="#404040"
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
                            fill="#404040"
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
                            fill="#404040"
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
                      fill="#1a1a1a"
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
                      fill="#1a1a1a"
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
            // Don't override border or backgroundColor - stickyStyle already has them set correctly
            outline: 'none',
            textAlign: 'left',
            lineHeight: '1.5',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
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
        style={stickyStyle}
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
          right: '-19px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '14px',
          height: '14px',
          background: '#2196F3',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: '1.5px solid white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          zIndex: 1003,
          padding: '2px',
          pointerEvents: 'auto'
        }}
      >
        <svg 
          width="8" 
          height="8" 
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
          right: '-19px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '14px',
          height: '14px',
          background: '#4CAF50',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: '1.5px solid white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          zIndex: 1003,
          marginTop: '22px',
          padding: '2px',
          pointerEvents: 'auto'
        }}
      >
        <svg 
          width="8" 
          height="8" 
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
          right: '-19px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '14px',
          height: '14px',
          background: isExpanding ? '#7b1fa2' : '#9c27b0',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isExpanding ? 'wait' : 'pointer',
          border: '1.5px solid white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          zIndex: 1003,
          marginTop: '-22px',
          padding: '2px',
          pointerEvents: 'auto'
        }}
      >
        {isExpanding ? (
          <div className="spinner" style={{ pointerEvents: 'none' }}></div>
        ) : (
          <svg 
            width="8" 
            height="8" 
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
        zIndex: item.type === 'chart' ? 1 : (isSelected ? 1000 : (item.order !== undefined ? 100 + item.order : 100)),
        pointerEvents: 'auto',
        userSelect: 'none',
        border: isValidTarget ? '2px dashed #4CAF50' : 'none',
        ...(item.type === 'sticky' ? { backgroundColor: item.backgroundColor || '#fff740' } : {}),
      }}
      onClick={handleClick}
      onDoubleClick={(e) => {
        // Enable double-click to edit for circle, rectangle, and sticky note types
        if (item.type === 'circle' || item.type === 'rectangle' || item.type === 'sticky') {
          if (!isEditing && !isResizing && !isDragging) {
            e.stopPropagation();
            setIsEditing(true);
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
              <ExpandButton 
                onExpandConcept={() => {
                  if (window.expandSelectedConcept && typeof window.expandSelectedConcept === 'function') {
                    window.expandSelectedConcept(item.id, item.text);
                  }
                }}
                scale={scale}
                isExpanding={isExpanding}
              />
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
    </div>
  );
};

export default WhiteboardItem; 