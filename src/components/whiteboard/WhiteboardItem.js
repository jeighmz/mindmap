import React, { useState, useRef, useEffect, useCallback } from 'react';
import ChartConfigPanel from './ChartConfigPanel';

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

const formatAxisLabel = (value, mode) => {
  if (mode === 'date') {
    return formatDateLabel(value);
  } else if (mode === 'custom') {
    return value;
  } else {
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
  onOrganize
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [isChartEditing, setIsChartEditing] = useState(false);

  // Initialize chart config from saved item data or defaults
  const getInitialChartConfig = () => ({
    xAxisTitle: item.xAxisTitle || '',
    yAxisTitle: item.yAxisTitle || '',
    xAxisUnit: item.xAxisUnit || 1,
    yAxisUnit: item.yAxisUnit || 0.5,  // Changed to 0.5 for better Y-axis divisions
    xAxisStart: item.xAxisStart || 0,
    yAxisStart: item.chartType === 'sine' ? 0 : (item.yAxisStart || 0),  // Default to 0 for sine
    xAxisEnd: item.xAxisEnd || 10,
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
    modulationDepth: item.modulationDepth || 0.5
  });

  const [chartConfig, setChartConfig] = useState(getInitialChartConfig());

  // Update chart config when item changes
  useEffect(() => {
    setChartConfig(getInitialChartConfig());
  }, [item.id]); // Only update when item id changes to avoid unnecessary updates

  const updateChartConfig = useCallback((newConfig) => {
    setChartConfig(newConfig);
    // Update the item with new configuration
    const updatedItem = {
      ...item,
      xAxisTitle: newConfig.xAxisTitle,
      yAxisTitle: newConfig.yAxisTitle,
      xAxisUnit: newConfig.xAxisUnit,
      yAxisUnit: newConfig.yAxisUnit,
      xAxisStart: newConfig.xAxisStart,
      yAxisStart: newConfig.yAxisStart,
      xAxisEnd: newConfig.xAxisEnd,
      yAxisEnd: newConfig.yAxisEnd,
      xAxisMode: newConfig.xAxisMode,
      yAxisMode: newConfig.yAxisMode,
      xAxisStartDate: newConfig.xAxisStartDate,
      xAxisEndDate: newConfig.xAxisEndDate,
      yAxisStartDate: newConfig.yAxisStartDate,
      yAxisEndDate: newConfig.yAxisEndDate,
      xAxisCustomValues: newConfig.xAxisCustomValues,
      yAxisCustomValues: newConfig.yAxisCustomValues,
      showXAxisLabels: newConfig.showXAxisLabels,
      showYAxisLabels: newConfig.showYAxisLabels,
      periods: newConfig.periods,
      frequency: newConfig.frequency,
      amplitude: newConfig.amplitude,
      waveType: newConfig.waveType,
      phaseShift: newConfig.phaseShift,
      harmonics: newConfig.harmonics,
      enableModulation: newConfig.enableModulation,
      modulationDepth: newConfig.modulationDepth
    };
    // Call updateText with the entire updated item
    updateText(item.id, updatedItem.text || '', updatedItem);
  }, [item, updateText]);

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
      const basePadding = 50;
      const yAxisLabelPadding = 35;
      const padding = basePadding + yAxisLabelPadding;
      const tickLength = 5; // Length of tick marks
      
      const width = item.width;
      const height = item.height;
      const chartWidth = width - (padding * 2);
      const chartHeight = height - (padding * 2);

      const effectivePadding = padding;

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

      const xScaleCount = xScale.length;
      const yScaleCount = yScale.length;

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
                    // Default to π-based values for sine wave
                    const divisions = Math.floor((width - padding * 2) / 60);
                    xValues = Array.from({ length: divisions }, (_, i) => 
                      ((i * Math.PI / 2) / (divisions - 1) * 4).toFixed(1) + 'π'
                    );
                  }

                  const axisLength = width - padding * 2;
                  const stepSize = axisLength / (xValues.length - 1);

                  return xValues.map((value, i) => {
                    const x = padding + (i * stepSize);
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
                            {formatAxisLabel(value, chartConfig.xAxisMode)}
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
                
                {/* X-Axis Title for sine wave */}
                {chartConfig.xAxisTitle && chartConfig.showXAxisLabels === true && (
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

                {/* X-axis labels for sine wave */}
                {(() => {
                  const periods = chartConfig.periods || 1;
                  const labels = [];
                  const numLabels = Math.ceil(periods) * 4 + 1; // 4 labels per period (0, π/2, π, 3π/2) plus the end

                  for (let i = 0; i < numLabels; i++) {
                    const fraction = i / (numLabels - 1);
                    const x = padding + (chartWidth * fraction);
                    const angle = fraction * (2 * Math.PI * periods);
                    const label = `${(angle / Math.PI).toFixed(1)}π`;

                    labels.push(
                      <g key={i}>
                        {/* Tick mark */}
                        <line 
                          x1={x}
                          y1={height/2 - 5}
                          x2={x}
                          y2={height/2 + 5}
                          stroke="#2196F3"
                          strokeWidth="1"
                        />
                        {/* Label */}
                        {chartConfig.showXAxisLabels !== false && (
                          <text 
                            x={x}
                            y={height/2 + 25}
                            fontSize={Math.min(width, height) * 0.028}
                            fill="#404040"
                            textAnchor="middle"
                            fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                            style={{ userSelect: 'none' }}
                          >
                            {label}
                          </text>
                        )}
                      </g>
                    );
                  }

                  return labels;
                })()}
              </>
            )}
          </svg>
          {isChartEditing && (
            <ChartConfigPanel
              initialConfig={{
                ...chartConfig,
                chartType: item.chartType
              }}
              onConfigUpdate={updateChartConfig}
              onClose={() => setIsChartEditing(false)}
              position="right"
            />
          )}
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
          width="14" 
          height="14" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="white" 
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 17L17 7M17 7H7M17 7V17" />
        </svg>
      </div>
    );
  };

  const EditButton = ({ onStartEditing, scale }) => {
    const handleClick = (e) => {
      e.stopPropagation();
      if (item.type === 'chart') {
        setIsChartEditing(true);
      } else {
        setIsEditing(true);
      }
    };

    return (
      <div
        className="edit-control"
        onClick={handleClick}
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
          width="14" 
          height="14" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="white" 
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
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
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="white" 
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
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
        zIndex: item.type === 'chart' ? 1 : (isSelected ? 1000 : 100),
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
          {item.type !== 'chart' && (
            <>
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
            </>
          )}
        </>
      )}
    </div>
  );
};

export default WhiteboardItem; 