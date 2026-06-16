function getEdgePoints(item) {
  if (item.type === 'circle') {
    const cx = item.position.x + item.width / 2;
    const cy = item.position.y + item.height / 2;
    const radius = Math.min(item.width, item.height) / 2;
    return {
      top: { x: cx, y: cy - radius },
      right: { x: cx + radius, y: cy },
      bottom: { x: cx, y: cy + radius },
      left: { x: cx - radius, y: cy },
    };
  }

  return {
    top: { x: item.position.x + item.width / 2, y: item.position.y },
    right: { x: item.position.x + item.width, y: item.position.y + item.height / 2 },
    bottom: { x: item.position.x + item.width / 2, y: item.position.y + item.height },
    left: { x: item.position.x, y: item.position.y + item.height / 2 },
  };
}

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
      const dx = endPoint.x - startPoint.x;
      const dy = endPoint.y - startPoint.y;
      const distance = Math.hypot(dx, dy);
      if (distance < shortestDistance) {
        shortestDistance = distance;
        bestStart = startPoint;
        bestEnd = endPoint;
      }
    });
  });

  return { start: bestStart, end: bestEnd };
}

export function normalizeLineDesign(lineDesign = 'curved') {
  if (lineDesign === 'straight' || lineDesign === 'sharp') return 'sharp';
  if (lineDesign === 'orthogonal') return 'orthogonal';
  return 'curved';
}

export function buildConnectionPath(start, end, lineDesign = 'curved') {
  const design = normalizeLineDesign(lineDesign);
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (design === 'sharp') {
    return [{ x: start.x, y: start.y }, { x: end.x, y: end.y }];
  }

  if (design === 'orthogonal') {
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

function getArrowProperties(style) {
  switch (style) {
    case 'spear':
      return { length: 12, width: Math.PI / 12 };
    case 'small':
      return { length: 10, width: Math.PI / 6 };
    case 'large':
      return { length: 20, width: Math.PI / 5 };
    case 'medium':
    default:
      return { length: 15, width: Math.PI / 6 };
  }
}

function getPathAngles(start, end, points, lineDesign) {
  const design = normalizeLineDesign(lineDesign);
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (design === 'sharp') {
    const angle = Math.atan2(dy, dx);
    return { endAngle: angle, startAngle: angle + Math.PI };
  }

  if (design === 'orthogonal') {
    const isHorizontal = Math.abs(dx) > Math.abs(dy);
    if (isHorizontal) {
      return {
        endAngle: dy >= 0 ? Math.PI / 2 : -Math.PI / 2,
        startAngle: dx >= 0 ? 0 : Math.PI,
      };
    }
    return {
      endAngle: dx >= 0 ? 0 : Math.PI,
      startAngle: dy >= 0 ? Math.PI / 2 : -Math.PI / 2,
    };
  }

  const controlPoint2 = points[2];
  const controlPoint1 = points[1];
  return {
    endAngle: Math.atan2(end.y - controlPoint2.y, end.x - controlPoint2.x),
    startAngle: Math.atan2(controlPoint1.y - start.y, controlPoint1.x - start.x) + Math.PI,
  };
}

function drawArrowHead(graphics, tip, angle, length, width, color) {
  const left = {
    x: tip.x - length * Math.cos(angle - width),
    y: tip.y - length * Math.sin(angle - width),
  };
  const right = {
    x: tip.x - length * Math.cos(angle + width),
    y: tip.y - length * Math.sin(angle + width),
  };

  graphics.moveTo(tip.x, tip.y);
  graphics.lineTo(left.x, left.y);
  graphics.lineTo(right.x, right.y);
  graphics.closePath();
  graphics.fill({ color });
}

export function drawConnectionGraphics(
  graphics,
  points,
  lineDesign,
  connection,
  isSelected
) {
  graphics.clear();

  if (!points || points.length < 2) return;

  const start = points[0];
  const end = points[points.length - 1];
  const design = normalizeLineDesign(lineDesign);
  const strokeWidth = Number(connection?.strokeWidth) || 2;
  const stroke = parseColor(connection?.color, 0x2196f3);
  const arrowDirection = connection?.arrowDirection || '->';
  const arrowHeadStyle = connection?.arrowHeadStyle || 'medium';
  const { length: arrowLength, width: arrowWidth } = getArrowProperties(arrowHeadStyle);
  const { endAngle, startAngle } = getPathAngles(start, end, points, design);

  graphics.setStrokeStyle({
    width: isSelected ? strokeWidth + 1 : strokeWidth,
    color: isSelected ? 0x007bff : stroke,
    alpha: 1,
    cap: 'round',
    join: 'round',
  });

  graphics.moveTo(start.x, start.y);

  if (design === 'curved' && points.length === 4) {
    graphics.bezierCurveTo(points[1].x, points[1].y, points[2].x, points[2].y, end.x, end.y);
  } else {
    for (let i = 1; i < points.length; i += 1) {
      graphics.lineTo(points[i].x, points[i].y);
    }
  }

  graphics.stroke();

  if (arrowDirection === '->' || arrowDirection === '<->') {
    drawArrowHead(graphics, end, endAngle, arrowLength, arrowWidth, stroke);
  }
  if (arrowDirection === '<-' || arrowDirection === '<->') {
    drawArrowHead(graphics, start, startAngle, arrowLength, arrowWidth, stroke);
  }
}

function parseColor(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const hex = value.replace('#', '');
  if (hex.length !== 6) return fallback;
  return Number.parseInt(hex, 16);
}
