import React from 'react';

const Connector = ({ 
  startItem, 
  endItem, 
  isCreating, 
  mousePosition, 
  onDelete, 
  onSelect,
  connection,
  isSelected = false
}) => {
  // Get center points of each edge
  const getEdgePoints = (item) => {
    return {
      top: { 
        x: item.position.x + item.width / 2, 
        y: item.position.y 
      },
      right: { 
        x: item.position.x + item.width, 
        y: item.position.y + item.height / 2 
      },
      bottom: { 
        x: item.position.x + item.width / 2, 
        y: item.position.y + item.height 
      },
      left: { 
        x: item.position.x, 
        y: item.position.y + item.height / 2 
      }
    };
  };

  // Find the best connection points between two items
  const findBestConnectionPoints = () => {
    const startPoints = getEdgePoints(startItem);
    const endPoints = endItem ? getEdgePoints(endItem) : null;
    
    if (!endPoints) return { start: startPoints.right, end: startPoints.right };

    let shortestDistance = Infinity;
    let bestStart = null;
    let bestEnd = null;

    Object.values(startPoints).forEach(startPoint => {
      Object.values(endPoints).forEach(endPoint => {
        const distance = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
        if (distance < shortestDistance) {
          shortestDistance = distance;
          bestStart = startPoint;
          bestEnd = endPoint;
        }
      });
    });

    return { start: bestStart, end: bestEnd };
  };

  // Get connection properties with defaults (must be before early return)
  const strokeColor = connection?.color || '#2196F3';
  const strokeWidth = Number(connection?.strokeWidth) || 2;
  const lineType = connection?.lineType || 'straight';
  const lineDesign = connection?.lineDesign || 'curved';
  const arrowDirection = connection?.arrowDirection || '->';
  const arrowHeadStyle = connection?.arrowHeadStyle || 'medium';

  const points = findBestConnectionPoints();
  const { start, end } = points;

  if (!start || !end) return null;

  // Calculate the path and arrow
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  
  // Calculate path based on lineDesign
  let pathD;
  let endAngle;
  let startAngle;
  
  if (lineDesign === 'sharp') {
    // Straight line path
    endAngle = Math.atan2(dy, dx);
    startAngle = endAngle + Math.PI;
    pathD = `M ${start.x},${start.y} L ${end.x},${end.y}`;
  } else if (lineDesign === 'orthogonal') {
    // 90-degree cut path (L-shaped)
    const isHorizontal = Math.abs(dx) > Math.abs(dy);
    let midPoint;
    
    if (isHorizontal) {
      // Horizontal first, then vertical
      midPoint = { x: end.x, y: start.y };
    } else {
      // Vertical first, then horizontal
      midPoint = { x: start.x, y: end.y };
    }
    
    pathD = `M ${start.x},${start.y} L ${midPoint.x},${midPoint.y} L ${end.x},${end.y}`;
    
    // Calculate angles for arrows (tangent to the path segment at each end)
    if (isHorizontal) {
      endAngle = dy >= 0 ? Math.PI / 2 : -Math.PI / 2; // Vertical segment at end
      startAngle = dx >= 0 ? 0 : Math.PI; // Horizontal segment at start
    } else {
      endAngle = dx >= 0 ? 0 : Math.PI; // Horizontal segment at end
      startAngle = dy >= 0 ? Math.PI / 2 : -Math.PI / 2; // Vertical segment at start
    }
  } else {
    // Curved (default) - cubic Bezier
    const isHorizontal = Math.abs(dx) > Math.abs(dy);
    const controlPoint1 = {
      x: start.x + (isHorizontal ? dx * 0.4 : 0),
      y: start.y + (!isHorizontal ? dy * 0.4 : 0)
    };
    const controlPoint2 = {
      x: end.x - (isHorizontal ? dx * 0.4 : 0),
      y: end.y - (!isHorizontal ? dy * 0.4 : 0)
    };
    
    pathD = `
      M ${start.x},${start.y}
      C ${controlPoint1.x},${controlPoint1.y}
        ${controlPoint2.x},${controlPoint2.y}
        ${end.x},${end.y}
    `;
    
    // Calculate the angle for the arrow based on the curve's end tangent
    endAngle = Math.atan2(end.y - controlPoint2.y, end.x - controlPoint2.x);
    // Calculate the angle for the start arrow (direction from start toward controlPoint1, then reverse 180deg for arrow pointing outward)
    startAngle = Math.atan2(controlPoint1.y - start.y, controlPoint1.x - start.x) + Math.PI;
  }
  
  // Arrow properties based on style
  const getArrowProperties = (style) => {
    switch(style) {
      case 'spear':
        return { length: 12, width: Math.PI / 12 }; // 15 degrees - very pointy
      case 'small':
        return { length: 10, width: Math.PI / 6 }; // 30 degrees
      case 'medium':
        return { length: 15, width: Math.PI / 6 }; // 30 degrees
      case 'large':
        return { length: 20, width: Math.PI / 5 }; // 36 degrees - wider
      default:
        return { length: 15, width: Math.PI / 6 };
    }
  };
  
  const { length: arrowLength, width: arrowWidth } = getArrowProperties(arrowHeadStyle);
  
  // Calculate end arrow points
  const endArrowTip = end;
  const endArrowLeft = {
    x: end.x - arrowLength * Math.cos(endAngle - arrowWidth),
    y: end.y - arrowLength * Math.sin(endAngle - arrowWidth)
  };
  const endArrowRight = {
    x: end.x - arrowLength * Math.cos(endAngle + arrowWidth),
    y: end.y - arrowLength * Math.sin(endAngle + arrowWidth)
  };

  // Calculate start arrow points (reversed)
  const startArrowTip = start;
  const startArrowLeft = {
    x: start.x - arrowLength * Math.cos(startAngle - arrowWidth),
    y: start.y - arrowLength * Math.sin(startAngle - arrowWidth)
  };
  const startArrowRight = {
    x: start.x - arrowLength * Math.cos(startAngle + arrowWidth),
    y: start.y - arrowLength * Math.sin(startAngle + arrowWidth)
  };

  // Adjust path end points to not overlap with arrows (only if arrow is on that end)
  const pathEndOffset = (arrowDirection === '->' || arrowDirection === '<->') ? 2 : 0;
  const pathStartOffset = (arrowDirection === '<-' || arrowDirection === '<->') ? 2 : 0;
  const pathEndX = end.x - pathEndOffset * Math.cos(endAngle);
  const pathEndY = end.y - pathEndOffset * Math.sin(endAngle);
  const pathStartX = start.x - pathStartOffset * Math.cos(startAngle);
  const pathStartY = start.y - pathStartOffset * Math.sin(startAngle);
  
  // Adjust the path D string to use offset points if needed
  if (pathStartOffset > 0 || pathEndOffset > 0) {
    if (lineDesign === 'sharp') {
      pathD = `M ${pathStartX},${pathStartY} L ${pathEndX},${pathEndY}`;
    } else if (lineDesign === 'orthogonal') {
      const isHorizontal = Math.abs(dx) > Math.abs(dy);
      let midPoint;
      if (isHorizontal) {
        midPoint = { x: pathEndX, y: pathStartY };
      } else {
        midPoint = { x: pathStartX, y: pathEndY };
      }
      pathD = `M ${pathStartX},${pathStartY} L ${midPoint.x},${midPoint.y} L ${pathEndX},${pathEndY}`;
    } else {
      // Curved - recalculate with offsets
      const isHorizontal = Math.abs(dx) > Math.abs(dy);
      const controlPoint1 = {
        x: pathStartX + (isHorizontal ? (pathEndX - pathStartX) * 0.4 : 0),
        y: pathStartY + (!isHorizontal ? (pathEndY - pathStartY) * 0.4 : 0)
      };
      const controlPoint2 = {
        x: pathEndX - (isHorizontal ? (pathEndX - pathStartX) * 0.4 : 0),
        y: pathEndY - (!isHorizontal ? (pathEndY - pathStartY) * 0.4 : 0)
      };
      pathD = `
        M ${pathStartX},${pathStartY}
        C ${controlPoint1.x},${controlPoint1.y}
          ${controlPoint2.x},${controlPoint2.y}
          ${pathEndX},${pathEndY}
      `;
    }
  }

  return (
    <svg
      className={`connector ${isSelected ? 'selected' : ''}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'all',
        zIndex: 1
      }}
    >
      {/* Main connection line */}
      <path
        d={pathD}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={lineType === 'dashed' ? `${strokeWidth * 4} ${strokeWidth * 2}` : lineType === 'dotted' ? `${strokeWidth} ${strokeWidth}` : 'none'}
        fill="none"
        style={{
          cursor: 'pointer',
          pointerEvents: 'stroke',
          filter: isSelected ? 'drop-shadow(0 0 4px rgba(33, 150, 243, 0.6))' : 'none',
          // strokeWidth is set as an attribute, not in style (SVG attribute takes precedence)
        }}
        onClick={(e) => {
          if (!isCreating && onSelect) {
            e.stopPropagation();
            onSelect();
          }
        }}
        onDoubleClick={(e) => {
          if (!isCreating && onDelete) {
            e.stopPropagation();
            onDelete();
          }
        }}
      />
      
      {/* End arrow head (-> or <->) */}
      {!isCreating && (arrowDirection === '->' || arrowDirection === '<->') && (
        <path
          d={`M ${endArrowTip.x},${endArrowTip.y} L ${endArrowLeft.x},${endArrowLeft.y} L ${endArrowRight.x},${endArrowRight.y} Z`}
          fill={strokeColor}
          stroke={strokeColor}
          strokeWidth="1"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Start arrow head (<- or <->) */}
      {!isCreating && (arrowDirection === '<-' || arrowDirection === '<->') && (
        <path
          d={`M ${startArrowTip.x},${startArrowTip.y} L ${startArrowLeft.x},${startArrowLeft.y} L ${startArrowRight.x},${startArrowRight.y} Z`}
          fill={strokeColor}
          stroke={strokeColor}
          strokeWidth="1"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Start point circle (only show if no start arrow) */}
      {!isCreating && arrowDirection !== '<-' && arrowDirection !== '<->' && (
        <circle 
          cx={start.x} 
          cy={start.y} 
          r="3" 
          fill={strokeColor}
          style={{ pointerEvents: 'none' }}
        />
      )}
    </svg>
  );
};

export default Connector; 