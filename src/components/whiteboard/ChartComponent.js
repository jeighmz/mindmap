import React from 'react';
import { useApp } from '../../contexts/AppContext';

const ChartComponent = ({ config, width, height }) => {
  const { isDarkMode } = useApp();
  
  // Text colors for charts based on dark mode
  const chartTextColor = isDarkMode ? '#e5e5e5' : '#404040';
  const chartTitleColor = isDarkMode ? '#ffffff' : '#1a1a1a';
  const basePadding = 50;
  const yAxisLabelPadding = 35;
  const padding = basePadding + yAxisLabelPadding;
  const effectivePadding = padding;
  const tickLength = 5; // Length of tick marks

  const chartWidth = width - (padding * 2);
  const chartHeight = height - (padding * 2);

  const getAxisValues = (mode, start, end, unit, customValues) => {
    if (mode === 'custom' && Array.isArray(customValues) && customValues.length > 0) {
      return customValues;
    } else if (mode === 'date') {
      // For dates, ensure we're working with timestamps
      const startTime = typeof start === 'number' ? start : new Date(start).getTime();
      const endTime = typeof end === 'number' ? end : new Date(end).getTime();
      const count = 6; // Maintain about 6 points for dates
      const timeRange = endTime - startTime;
      const step = timeRange / (count - 1);
      return Array.from({ length: count }, (_, i) => startTime + (step * i));
    } else {
      // For numbers, use the unit-based calculation
      const range = end - start;
      const count = Math.ceil(range / unit) + 1;
      return Array.from({ length: count }, (_, i) => start + (i * unit));
    }
  };

  const formatAxisLabel = (value, mode, xAxisTitle = '') => {
    if (mode === 'date') {
      return new Date(value).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } else if (mode === 'custom') {
      return value.toString();
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

  const getAxisPosition = (value, mode, start, end, size, customValues) => {
    if (mode === 'custom' && Array.isArray(customValues) && customValues.length > 0) {
      const index = customValues.indexOf(value.toString());
      return index >= 0 ? effectivePadding + (index * (size / (customValues.length - 1))) : effectivePadding;
    } else if (mode === 'date') {
      const startTime = typeof start === 'number' ? start : new Date(start).getTime();
      const endTime = typeof end === 'number' ? end : new Date(end).getTime();
      const valueTime = typeof value === 'number' ? value : new Date(value).getTime();
      const range = endTime - startTime;
      return effectivePadding + ((valueTime - startTime) / range * size);
    } else {
      const range = end - start;
      return effectivePadding + ((value - start) / range * size);
    }
  };

  // Get axis values based on mode
  const xValues = getAxisValues(
    config.xAxisMode,
    config.xAxisMode === 'date' ? config.xAxisStartDate : config.xAxisStart,
    config.xAxisMode === 'date' ? config.xAxisEndDate : config.xAxisEnd,
    config.xAxisUnit,
    config.xAxisCustomValues
  );

  const yValues = getAxisValues(
    config.yAxisMode,
    config.yAxisMode === 'date' ? config.yAxisStartDate : config.yAxisStart,
    config.yAxisMode === 'date' ? config.yAxisEndDate : config.yAxisEnd,
    config.yAxisUnit,
    config.yAxisCustomValues
  );

  // Calculate font sizes relative to axis lengths
  const xAxisFontSize = Math.min(chartWidth * 0.03, chartHeight * 0.03);
  const yAxisFontSize = Math.min(chartWidth * 0.03, chartHeight * 0.03);
  const titleFontSize = Math.min(chartWidth * 0.045, chartHeight * 0.045);

  return (
    <svg 
      width="100%" 
      height="100%" 
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Background grid with tick marks */}
      {xValues.map((value, i) => {
        const x = getAxisPosition(
          value,
          config.xAxisMode,
          config.xAxisMode === 'date' ? config.xAxisStartDate : config.xAxisStart,
          config.xAxisMode === 'date' ? config.xAxisEndDate : config.xAxisEnd,
          chartWidth,
          config.xAxisCustomValues
        );

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
            {/* X-axis tick mark */}
            <line 
              x1={x}
              y1={height - effectivePadding - tickLength}
              x2={x}
              y2={height - effectivePadding + tickLength}
              stroke="#2196F3"
              strokeWidth="1"
            />
            {/* X-axis label */}
            {config.showXAxisLabels !== false && (
              <text 
                x={x}
                y={height - effectivePadding + (tickLength * 3)}
                fontSize={xAxisFontSize}
                fill={chartTextColor}
                textAnchor="middle"
                fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                style={{ userSelect: 'none' }}
                transform={config.xAxisMode === 'date' || config.xAxisMode === 'custom' 
                  ? `rotate(-45, ${x}, ${height - effectivePadding + (tickLength * 3)})` 
                  : undefined}
              >
                {formatAxisLabel(value, config.xAxisMode, config.xAxisTitle)}
              </text>
            )}
          </g>
        );
      })}

      {yValues.map((value, i) => {
        const y = height - getAxisPosition(
          value,
          config.yAxisMode,
          config.yAxisMode === 'date' ? config.yAxisStartDate : config.yAxisStart,
          config.yAxisMode === 'date' ? config.yAxisEndDate : config.yAxisEnd,
          chartHeight,
          config.yAxisCustomValues
        );

        return (
          <g key={`y-${i}`}>
            {/* Horizontal grid line */}
            <line 
              x1={effectivePadding}
              y1={y}
              x2={width - effectivePadding}
              y2={y}
              stroke="#666" 
              strokeDasharray="4,4"
              opacity="0.1"
            />
            {/* Y-axis tick mark */}
            <line 
              x1={effectivePadding - tickLength}
              y1={y}
              x2={effectivePadding + tickLength}
              y2={y}
              stroke="#2196F3"
              strokeWidth="1"
            />
            {/* Y-axis label */}
            {config.showYAxisLabels !== false && (
              <text 
                x={effectivePadding - (tickLength * 3)}
                y={y}
                fontSize={yAxisFontSize}
                fill={chartTextColor}
                textAnchor="end"
                dominantBaseline="middle"
                fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                style={{ userSelect: 'none' }}
              >
                {formatAxisLabel(value, config.yAxisMode)}
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
        strokeWidth={Math.min(chartWidth, chartHeight) * 0.005}
      />
      <line 
        x1={effectivePadding} 
        y1={padding} 
        x2={effectivePadding} 
        y2={height - effectivePadding} 
        stroke="#2196F3" 
        strokeWidth={Math.min(chartWidth, chartHeight) * 0.005}
      />

      {/* X-Axis Title */}
      {config.xAxisTitle && config.showXAxisLabels !== false && (
        <g>
          <text
            x={effectivePadding + (chartWidth / 2)}
            y={height - (padding / 4)}
            fontSize={titleFontSize}
            fill={chartTitleColor}
            textAnchor="middle"
            fontWeight="600"
            letterSpacing="0.5px"
            fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            style={{ userSelect: 'none' }}
            dominantBaseline="hanging"
          >
            {config.xAxisTitle}
          </text>
        </g>
      )}

      {/* Y-Axis Title */}
      {config.yAxisTitle && config.showYAxisLabels !== false && (
        <g>
          <text
            x={padding / 4}
            y={height - effectivePadding - (chartHeight / 2)}
            fontSize={titleFontSize}
            fill={chartTitleColor}
            textAnchor="middle"
            fontWeight="600"
            letterSpacing="0.5px"
            fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            style={{ userSelect: 'none' }}
            transform={`rotate(-90, ${padding / 4}, ${height - effectivePadding - (chartHeight / 2)})`}
          >
            {config.yAxisTitle}
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
    </svg>
  );
};

export default ChartComponent; 