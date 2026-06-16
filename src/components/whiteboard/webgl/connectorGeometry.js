const getEdgePoints = (item) => ({
  top: { x: item.position.x + item.width / 2, y: item.position.y },
  right: { x: item.position.x + item.width, y: item.position.y + item.height / 2 },
  bottom: { x: item.position.x + item.width / 2, y: item.position.y + item.height },
  left: { x: item.position.x, y: item.position.y + item.height / 2 },
});

export function findBestConnectionPoints(startItem, endItem) {
  const startPoints = getEdgePoints(startItem);
  if (!endItem) {
    return { start: startPoints.right, end: startPoints.right };
  }

  const endPoints = getEdgePoints(endItem);
  let shortestDistance = Infinity;
  let bestStart = startPoints.right;
  let bestEnd = endPoints.left;

  Object.values(startPoints).forEach((startPoint) => {
    Object.values(endPoints).forEach((endPoint) => {
      const distance = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
      if (distance < shortestDistance) {
        shortestDistance = distance;
        bestStart = startPoint;
        bestEnd = endPoint;
      }
    });
  });

  return { start: bestStart, end: bestEnd };
}

export function buildConnectionPath(start, end, lineDesign = 'curved') {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (lineDesign === 'sharp') {
    return [{ x: start.x, y: start.y }, { x: end.x, y: end.y }];
  }

  if (lineDesign === 'orthogonal') {
    const isHorizontal = Math.abs(dx) > Math.abs(dy);
    const midPoint = isHorizontal
      ? { x: end.x, y: start.y }
      : { x: start.x, y: end.y };
    return [{ x: start.x, y: start.y }, midPoint, { x: end.x, y: end.y }];
  }

  const isHorizontal = Math.abs(dx) > Math.abs(dy);
  const controlPoint1 = {
    x: start.x + (isHorizontal ? dx * 0.4 : 0),
    y: start.y + (!isHorizontal ? dy * 0.4 : 0),
  };
  const controlPoint2 = {
    x: end.x - (isHorizontal ? dx * 0.4 : 0),
    y: end.y - (!isHorizontal ? dy * 0.4 : 0),
  };

  return [
    { x: start.x, y: start.y },
    controlPoint1,
    controlPoint2,
    { x: end.x, y: end.y },
  ];
}

export function drawConnectionGraphics(graphics, points, lineDesign, color, strokeWidth, isSelected) {
  graphics.clear();

  if (!points || points.length < 2) return;

  const stroke = parseColor(color, 0x2196f3);
  graphics.setStrokeStyle({
    width: isSelected ? strokeWidth + 1 : strokeWidth,
    color: isSelected ? 0x007bff : stroke,
    alpha: 1,
    cap: 'round',
    join: 'round',
  });

  graphics.moveTo(points[0].x, points[0].y);

  if (lineDesign === 'curved' && points.length === 4) {
    graphics.bezierCurveTo(points[1].x, points[1].y, points[2].x, points[2].y, points[3].x, points[3].y);
  } else {
    for (let i = 1; i < points.length; i += 1) {
      graphics.lineTo(points[i].x, points[i].y);
    }
  }

  graphics.stroke();
}

function parseColor(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const hex = value.replace('#', '');
  if (hex.length !== 6) return fallback;
  return Number.parseInt(hex, 16);
}
