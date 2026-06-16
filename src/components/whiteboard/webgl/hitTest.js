function pointInRotatedRect(px, py, item) {
  const cx = item.position.x + item.width / 2;
  const cy = item.position.y + item.height / 2;
  const rotation = ((item.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const dx = px - cx;
  const dy = py - cy;
  const localX = dx * cos - dy * sin + item.width / 2;
  const localY = dx * sin + dy * cos + item.height / 2;
  return localX >= 0 && localX <= item.width && localY >= 0 && localY <= item.height;
}

function pointInItem(px, py, item) {
  if (item.type === 'circle') {
    const cx = item.position.x + item.width / 2;
    const cy = item.position.y + item.height / 2;
    const radius = Math.min(item.width, item.height) / 2;
    return Math.hypot(px - cx, py - cy) <= radius;
  }

  return pointInRotatedRect(px, py, item);
}

export function hitTestItem(worldX, worldY, items, { skipTypes = [] } = {}) {
  const sorted = [...items].sort((a, b) => {
    const orderA = a.order !== undefined ? a.order : 0;
    const orderB = b.order !== undefined ? b.order : 0;
    return orderB - orderA;
  });

  for (const item of sorted) {
    if (!item?.position || skipTypes.includes(item.type)) continue;
    if (!item.width || !item.height) continue;
    if (pointInItem(worldX, worldY, item)) {
      return item;
    }
  }

  return null;
}
