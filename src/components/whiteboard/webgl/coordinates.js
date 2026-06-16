export function screenToWorld(screenX, screenY, pan, scale) {
  return {
    x: (screenX - pan.x) / scale,
    y: (screenY - pan.y) / scale,
  };
}

export function worldToScreen(worldX, worldY, pan, scale) {
  return {
    x: worldX * scale + pan.x,
    y: worldY * scale + pan.y,
  };
}
