import React from 'react';

const Connector = ({ startItem, endItem, isCreating, mousePosition, onDelete }) => {
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

  const points = findBestConnectionPoints();
  const { start, end } = points;

  if (!start || !end) return null;

  // Calculate the path and arrow
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  
  // Calculate control points for the curve based on direction
  const isHorizontal = Math.abs(dx) > Math.abs(dy);
  const controlPoint1 = {
    x: start.x + (isHorizontal ? dx * 0.4 : 0),
    y: start.y + (!isHorizontal ? dy * 0.4 : 0)
  };
  const controlPoint2 = {
    x: end.x - (isHorizontal ? dx * 0.4 : 0),
    y: end.y - (!isHorizontal ? dy * 0.4 : 0)
  };

  // Calculate the angle for the arrow based on the curve's end tangent
  const angle = Math.atan2(end.y - controlPoint2.y, end.x - controlPoint2.x);
  
  // Arrow properties
  const arrowLength = 15;
  const arrowWidth = Math.PI/6; // 30 degrees
  
  // Calculate arrow points with adjusted angle based on direction
  const arrowTip = end;
  const arrowLeft = {
    x: end.x - arrowLength * Math.cos(angle - arrowWidth),
    y: end.y - arrowLength * Math.sin(angle - arrowWidth)
  };
  const arrowRight = {
    x: end.x - arrowLength * Math.cos(angle + arrowWidth),
    y: end.y - arrowLength * Math.sin(angle + arrowWidth)
  };

  // Adjust path end point to not overlap with arrow
  const pathEndOffset = 2; // Small gap between line and arrow
  const pathEndX = end.x - pathEndOffset * Math.cos(angle);
  const pathEndY = end.y - pathEndOffset * Math.sin(angle);

  // Path for the curved line
  const pathD = `
    M ${start.x},${start.y}
    C ${controlPoint1.x},${controlPoint1.y}
      ${controlPoint2.x},${controlPoint2.y}
      ${pathEndX},${pathEndY}
  `;

  return (
    <svg
      className="connector"
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
        stroke="#2196F3"
        strokeWidth="2"
        fill="none"
        style={{
          cursor: 'pointer',
          pointerEvents: 'stroke'
        }}
        onDoubleClick={(e) => {
          if (!isCreating && onDelete) {
            e.stopPropagation();
            onDelete();
          }
        }}
      />
      
      {/* Arrow head */}
      {!isCreating && (
        <path
          d={`M ${arrowTip.x},${arrowTip.y} L ${arrowLeft.x},${arrowLeft.y} L ${arrowRight.x},${arrowRight.y} Z`}
          fill="#2196F3"
          stroke="#2196F3"
          strokeWidth="1"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Start point */}
      <circle 
        cx={start.x} 
        cy={start.y} 
        r="3" 
        fill="#2196F3"
        style={{ pointerEvents: 'none' }}
      />
    </svg>
  );
};

export default Connector; 