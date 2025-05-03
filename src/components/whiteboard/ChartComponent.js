import React from 'react';

const ChartComponent = ({ config, width, height }) => {
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

  const formatAxisLabel = (value, mode) => {
    if (mode === 'date') {
      return new Date(value).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } else if (mode === 'custom') {
      return value.toString();
    } else {
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
                fill="#404040"
                textAnchor="middle"
                fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                style={{ userSelect: 'none' }}
                transform={config.xAxisMode === 'date' || config.xAxisMode === 'custom' 
                  ? `rotate(-45, ${x}, ${height - effectivePadding + (tickLength * 3)})` 
                  : undefined}
              >
                {formatAxisLabel(value, config.xAxisMode)}
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
                fill="#404040"
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
            fill="#1a1a1a"
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
            fill="#1a1a1a"
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