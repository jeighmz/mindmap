const DEFAULT_COLORS = {
  rectangle: { fill: '#ffffff', border: '#333333' },
  circle: { fill: '#ffffff', border: '#333333' },
  sticky: { fill: '#fff740', border: '#fff740' },
  text: { fill: 'transparent', border: 'transparent' },
};

const thumbnailCache = new Map();

function parseColor(value, fallback) {
  if (!value || value === 'transparent' || value === 'none') return fallback;
  if (typeof value === 'string' && value.startsWith('#')) return value;
  return fallback;
}

function getBoardItems(boardOrContent) {
  const content = boardOrContent?.content || boardOrContent || {};
  return (content.items || []).filter(
    (item) => item?.position && Number(item.width) > 0 && Number(item.height) > 0
  );
}

function getBoardConnections(boardOrContent) {
  const content = boardOrContent?.content || boardOrContent || {};
  return content.connections || [];
}

export function getThumbnailCacheKey(board) {
  if (!board?.id) return null;
  const items = getBoardItems(board);
  const edited =
    board.lastEditedAt?.getTime?.() ||
    board.lastEditedAt?.seconds ||
    board.savedAt?.getTime?.() ||
    board.savedAt?.seconds ||
    0;
  const signature = items
    .slice(0, 12)
    .map((item) => `${item.id}:${Math.round(item.position.x)}:${Math.round(item.position.y)}`)
    .join('|');
  return `${board.id}-${edited}-${items.length}-${signature}`;
}

function getItemsBounds(items) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  items.forEach((item) => {
    const x = item.position.x;
    const y = item.position.y;
    const w = item.width;
    const h = item.height;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });

  if (!Number.isFinite(minX)) return null;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

function drawThumbnailBackground(ctx, width, height) {
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#d1d5db';
  const step = 14;
  for (let x = step / 2; x < width; x += step) {
    for (let y = step / 2; y < height; y += step) {
      ctx.beginPath();
      ctx.arc(x, y, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawRoundedRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawItemText(ctx, item, x, y, w, h, scale) {
  const text = (item.text || '').trim();
  if (!text) return;

  const fontSize = Math.max(8, Math.min(14, (item.fontSize || 14)));
  ctx.fillStyle = parseColor(item.textColor, '#111827');
  ctx.font = `${item.fontWeight === 'bold' ? 'bold ' : ''}${fontSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const maxChars = Math.floor(w / (fontSize * 0.55));
  const display = text.length > maxChars ? `${text.slice(0, Math.max(maxChars - 1, 1))}…` : text;
  ctx.fillText(display, x + w / 2, y + h / 2, w - 8 / scale);
}

function drawChartPlaceholder(ctx, x, y, w, h) {
  drawRoundedRect(ctx, x, y, w, h, 6);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const pad = Math.min(w, h) * 0.18;
  const chartX = x + pad;
  const chartY = y + pad;
  const chartW = w - pad * 2;
  const chartH = h - pad * 2;

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(chartX, chartY + chartH);
  ctx.lineTo(chartX + chartW, chartY + chartH);
  ctx.moveTo(chartX, chartY);
  ctx.lineTo(chartX, chartY + chartH);
  ctx.stroke();

  ctx.strokeStyle = '#4285f4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(chartX, chartY + chartH * 0.7);
  ctx.lineTo(chartX + chartW * 0.35, chartY + chartH * 0.45);
  ctx.lineTo(chartX + chartW * 0.65, chartY + chartH * 0.55);
  ctx.lineTo(chartX + chartW, chartY + chartH * 0.25);
  ctx.stroke();
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => resolve(null), 2500);

    img.onload = () => {
      clearTimeout(timeout);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };
    img.src = src;
  });
}

async function preloadImages(items) {
  const imageItems = items.filter((item) => item.type === 'image' && (item.imageUrl || item.src || item.url));
  const entries = await Promise.all(
    imageItems.map(async (item) => {
      const src = item.imageUrl || item.src || item.url;
      const img = await loadImage(src);
      return [String(item.id), img];
    })
  );
  return new Map(entries.filter(([, img]) => img));
}

function drawShapeItem(ctx, item, imageMap, scale) {
  const x = item.position.x;
  const y = item.position.y;
  const w = item.width;
  const h = item.height;
  const defaults = DEFAULT_COLORS[item.type] || DEFAULT_COLORS.rectangle;
  const fill = parseColor(item.backgroundColor, defaults.fill);
  const border = parseColor(item.borderColor, defaults.border);

  if (item.type === 'image') {
    const img = imageMap.get(String(item.id));
    drawRoundedRect(ctx, x, y, w, h, 4);
    if (img) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(img, x, y, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = '#f3f4f6';
      ctx.fill();
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1.5 / scale;
      ctx.stroke();
    }
    return;
  }

  if (item.type === 'chart') {
    drawChartPlaceholder(ctx, x, y, w, h);
    return;
  }

  if (item.type === 'circle') {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    if (fill !== 'transparent') {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (border !== 'transparent') {
      ctx.strokeStyle = border;
      ctx.lineWidth = 2 / scale;
      ctx.stroke();
    }
    drawItemText(ctx, item, x, y, w, h, scale);
    return;
  }

  const radius = item.type === 'sticky' ? 4 : item.cornerRadius || 4;
  drawRoundedRect(ctx, x, y, w, h, radius);
  if (fill !== 'transparent') {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (border !== 'transparent' && item.type !== 'text') {
    ctx.strokeStyle = border;
    ctx.lineWidth = 2 / scale;
    ctx.stroke();
  }

  if (item.type === 'text' && !item.text?.trim()) {
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1 / scale;
    ctx.setLineDash([4 / scale, 4 / scale]);
    drawRoundedRect(ctx, x, y, w, h, 4);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawItemText(ctx, item, x, y, w, h, scale);
}

function drawConnections(ctx, items, connections, scale) {
  const itemMap = new Map(items.map((item) => [String(item.id), item]));

  connections.forEach((connection) => {
    const from = itemMap.get(String(connection.from));
    const to = itemMap.get(String(connection.to));
    if (!from || !to) return;

    const fromX = from.position.x + from.width / 2;
    const fromY = from.position.y + from.height / 2;
    const toX = to.position.x + to.width / 2;
    const toY = to.position.y + to.height / 2;

    ctx.strokeStyle = parseColor(connection.color, '#2196f3');
    ctx.lineWidth = 2 / scale;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
  });
}

export async function generateBoardThumbnail(boardOrContent, options = {}) {
  const width = options.width || 400;
  const height = options.height || 225;
  const padding = options.padding ?? 20;
  const cacheKey = options.cacheKey;

  if (cacheKey && thumbnailCache.has(cacheKey)) {
    return thumbnailCache.get(cacheKey);
  }

  const items = getBoardItems(boardOrContent);
  const connections = getBoardConnections(boardOrContent);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  drawThumbnailBackground(ctx, width, height);

  if (items.length === 0) {
    const url = canvas.toDataURL('image/jpeg', 0.82);
    if (cacheKey) thumbnailCache.set(cacheKey, url);
    return url;
  }

  const bounds = getItemsBounds(items);
  const scale = Math.min(
    (width - padding * 2) / bounds.width,
    (height - padding * 2) / bounds.height
  );

  const offsetX = (width - bounds.width * scale) / 2 - bounds.minX * scale;
  const offsetY = (height - bounds.height * scale) / 2 - bounds.minY * scale;

  const imageMap = await preloadImages(items);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  drawConnections(ctx, items, connections, scale);

  const sortedItems = [...items].sort((a, b) => {
    const orderA = a.order !== undefined ? a.order : 0;
    const orderB = b.order !== undefined ? b.order : 0;
    return orderA - orderB;
  });

  sortedItems.forEach((item) => {
    drawShapeItem(ctx, item, imageMap, scale);
  });

  ctx.restore();

  const url = canvas.toDataURL('image/jpeg', 0.82);
  if (cacheKey) thumbnailCache.set(cacheKey, url);
  return url;
}

export function clearBoardThumbnailCache(boardId) {
  if (!boardId) return;
  [...thumbnailCache.keys()].forEach((key) => {
    if (key.startsWith(`${boardId}-`)) {
      thumbnailCache.delete(key);
    }
  });
}
