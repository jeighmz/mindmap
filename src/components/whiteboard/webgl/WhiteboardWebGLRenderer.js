import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
} from 'pixi.js';
import { CANVAS_SIZE, DEFAULT_ITEM_COLORS, GRID_SIZE } from './constants';
import {
  buildConnectionPath,
  drawConnectionGraphics,
  findBestConnectionPoints,
} from './connectorGeometry';
import { isItemInSelection } from '../selectionUtils';

function isTransparentColor(value) {
  return (
    value === 'transparent' ||
    value === 'none' ||
    value === 'rgba(0, 0, 0, 0)' ||
    value === 'rgba(0,0,0,0)'
  );
}

function parseColor(value, fallback) {
  if (typeof value !== 'string' || isTransparentColor(value)) return fallback;
  const hex = value.replace('#', '');
  if (hex.length !== 6) return fallback;
  return Number.parseInt(hex, 16);
}

function isValidItem(item) {
  return (
    item &&
    item.position &&
    typeof item.position.x === 'number' &&
    typeof item.position.y === 'number' &&
    item.width > 0 &&
    item.height > 0
  );
}

export class WhiteboardWebGLRenderer {
  constructor() {
    this.app = null;
    this.world = null;
    this.grid = null;
    this.connectionsLayer = null;
    this.itemsLayer = null;
    this.previewLayer = null;
    this.itemNodes = new Map();
    this.connectionNodes = new Map();
    this.textureCache = new Map();
    this.container = null;
    this.initialized = false;
    this.disposed = false;
    this.initPromise = null;
  }

  async init(container) {
    if (this.initialized || this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._init(container);
    return this.initPromise;
  }

  async _init(container) {
    if (this.disposed) return;

    this.container = container;
    this.app = new Application();

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    await this.app.init({
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      width,
      height,
      powerPreference: 'high-performance',
    });

    if (this.disposed) {
      this._destroyApp();
      return;
    }

    container.appendChild(this.app.canvas);
    this.app.canvas.style.position = 'absolute';
    this.app.canvas.style.inset = '0';
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = '100%';
    this.app.canvas.style.pointerEvents = 'none';

    this.world = new Container();
    this.grid = new Graphics();
    this.connectionsLayer = new Container();
    this.itemsLayer = new Container();
    this.itemsLayer.sortableChildren = true;
    this.previewLayer = new Graphics();

    this.drawGrid();
    this.world.addChild(this.grid);
    this.world.addChild(this.connectionsLayer);
    this.world.addChild(this.itemsLayer);
    this.world.addChild(this.previewLayer);
    this.app.stage.addChild(this.world);

    this.initialized = true;
    this.resize();
  }

  _destroyApp() {
    if (!this.app) return;

    try {
      if (this.app.canvas?.parentNode) {
        this.app.canvas.parentNode.removeChild(this.app.canvas);
      }
    } catch (error) {
      // Ignore DOM removal errors during teardown
    }

    if (this.initialized) {
      try {
        this.app.destroy(true, { children: true, texture: true });
      } catch (error) {
        // Pixi destroy can fail if init did not fully complete
      }
    }

    this.app = null;
  }

  drawGrid() {
    this.grid.clear();
    this.grid.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    this.grid.fill({ color: 0xffffff });

    this.grid.setStrokeStyle({ width: 1, color: 0x000000, alpha: 0.05 });
    for (let x = 0; x <= CANVAS_SIZE; x += GRID_SIZE) {
      this.grid.moveTo(x, 0);
      this.grid.lineTo(x, CANVAS_SIZE);
    }
    for (let y = 0; y <= CANVAS_SIZE; y += GRID_SIZE) {
      this.grid.moveTo(0, y);
      this.grid.lineTo(CANVAS_SIZE, y);
    }
    this.grid.stroke();
  }

  setViewport(pan, scale) {
    if (!this.world) return;
    this.world.position.set(pan.x, pan.y);
    this.world.scale.set(scale);
  }

  resolveItemNode(itemId) {
    const key = String(itemId);
    for (const [id, node] of this.itemNodes.entries()) {
      if (String(id) === key) {
        return node;
      }
    }
    return null;
  }

  getPositionOverride(positionOverrides, itemId) {
    if (!positionOverrides) return null;
    return (
      positionOverrides[itemId]
      ?? positionOverrides[String(itemId)]
      ?? positionOverrides[Number(itemId)]
      ?? null
    );
  }

  resize() {
    if (!this.app || !this.container) return;
    const { clientWidth, clientHeight } = this.container;
    if (clientWidth > 0 && clientHeight > 0) {
      this.app.renderer.resize(clientWidth, clientHeight);
    }
  }

  async syncScene({
    items = [],
    connections = [],
    selectedItemIds = new Set(),
    selectedConnectionId = null,
    connectingFromId = null,
    connectingMousePosition = null,
    skipTypes = ['chart'],
  }) {
    if (!this.initialized) return;

    await this.syncItems(items, selectedItemIds, skipTypes);
    this.syncConnections(items, connections, selectedConnectionId);
    this.syncConnectingPreview(items, connectingFromId, connectingMousePosition);
  }

  async syncItems(items, selectedItemIds, skipTypes) {
    const visibleItems = items.filter(
      (item) =>
        isValidItem(item) &&
        !skipTypes.includes(item.type) &&
        !isItemInSelection(selectedItemIds, item.id)
    );

    for (const [id, node] of this.itemNodes.entries()) {
      if (!visibleItems.some((item) => String(item.id) === String(id))) {
        this.itemsLayer.removeChild(node.container);
        node.container.destroy({ children: true });
        this.itemNodes.delete(id);
      }
    }

    for (const item of visibleItems) {
      let node = this.resolveItemNode(item.id);
      if (!node) {
        node = this.createItemNode(item);
        this.itemNodes.set(item.id, node);
        this.itemsLayer.addChild(node.container);
      }

      node.meta = {
        width: item.width,
        height: item.height,
        rotation: item.rotation || 0,
      };
      this.setItemPosition(item.id, item.position.x, item.position.y, node.meta);

      node.container.zIndex = item.order !== undefined ? item.order : 0;

      const isSelected = isItemInSelection(selectedItemIds, item.id);

      if (item.type === 'image') {
        await this.updateImageNode(node, item);
      } else {
        this.updateShapeNode(node, item, isSelected);
      }
    }

    this.itemsLayer.sortChildren();
  }

  setItemPosition(itemId, x, y, meta = null) {
    const node = this.resolveItemNode(itemId);
    if (!node?.container) return;

    const itemMeta = meta || node.meta;
    if (!itemMeta) {
      node.container.position.set(x, y);
      return;
    }

    if (itemMeta.rotation) {
      node.container.pivot.set(itemMeta.width / 2, itemMeta.height / 2);
      node.container.position.set(x + itemMeta.width / 2, y + itemMeta.height / 2);
    } else {
      node.container.pivot.set(0, 0);
      node.container.rotation = 0;
      node.container.position.set(x, y);
    }
  }

  syncLivePositions(positionOverrides, items, connections, selectedConnectionId) {
    if (!this.initialized) return;

    if (positionOverrides && Object.keys(positionOverrides).length > 0) {
      Object.entries(positionOverrides).forEach(([id, position]) => {
        this.setItemPosition(id, position.x, position.y);
      });
    } else {
      const visibleItems = items.filter(
        (item) => isValidItem(item) && item.type !== 'chart'
      );
      visibleItems.forEach((item) => {
        const node = this.resolveItemNode(item.id);
        if (!node) return;
        node.meta = {
          width: item.width,
          height: item.height,
          rotation: item.rotation || 0,
        };
        this.setItemPosition(item.id, item.position.x, item.position.y, node.meta);
      });
    }

    const liveItems = items.map((item) => {
      const override = this.getPositionOverride(positionOverrides, item.id);
      return override ? { ...item, position: override } : item;
    });

    this.syncConnections(liveItems, connections, selectedConnectionId);
  }

  createItemNode(item) {
    const container = new Container();
    container.eventMode = 'none';
    const shape = new Graphics();
    const label = new Text({
      text: '',
      style: {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
        fontSize: 14,
        fill: 0x111111,
        wordWrap: true,
        align: 'center',
      },
    });
    label.anchor.set(0.5);
    const sprite = new Sprite();
    sprite.visible = false;

    container.addChild(shape);
    container.addChild(sprite);
    container.addChild(label);

    return { container, shape, label, sprite, itemType: item.type };
  }

  updateShapeNode(node, item, isSelected) {
    const { shape, label, sprite } = node;
    sprite.visible = false;
    label.visible = item.type !== 'image';

    const defaults = DEFAULT_ITEM_COLORS[item.type] || DEFAULT_ITEM_COLORS.rectangle;
    const hasTransparentFill = isTransparentColor(item.backgroundColor);
    const hasTransparentBorder = isTransparentColor(item.borderColor);
    const isTextItem = item.type === 'text';
    const fill = hasTransparentFill
      ? null
      : parseColor(item.backgroundColor, defaults.fill);
    const border = hasTransparentBorder
      ? null
      : parseColor(item.borderColor, defaults.border);
    const radius = item.cornerRadius || 0;
    const textValue = item.text || '';

    shape.clear();

    if (isTextItem) {
      if (!textValue) {
        shape.roundRect(0, 0, item.width, item.height, 4);
        shape.stroke({
          width: 1,
          color: isSelected ? 0x2196f3 : 0xcccccc,
          alpha: isSelected ? 0.8 : 0.45,
        });
      } else if (isSelected) {
        shape.roundRect(0, 0, item.width, item.height, 4);
        shape.stroke({ width: 2, color: 0x2196f3, alpha: 0.35 });
      }
    } else if (item.type === 'circle') {
      if (isSelected) {
        shape.setStrokeStyle({ width: 3, color: 0x2196f3, alpha: 1 });
      } else if (border !== null) {
        shape.setStrokeStyle({ width: 2, color: border, alpha: 1 });
      }

      shape.circle(item.width / 2, item.height / 2, Math.min(item.width, item.height) / 2);

      if (fill !== null) {
        shape.fill({ color: fill, alpha: 0.98 });
      }
      if (border !== null || isSelected) {
        shape.stroke();
      }
    } else {
      if (isSelected) {
        shape.setStrokeStyle({ width: 3, color: 0x2196f3, alpha: 1 });
      } else if (border !== null) {
        shape.setStrokeStyle({ width: 2, color: border, alpha: 1 });
      }

      shape.roundRect(0, 0, item.width, item.height, Math.min(radius, 50));

      if (fill !== null) {
        shape.fill({ color: fill, alpha: item.type === 'sticky' ? 1 : 0.98 });
      }
      if (border !== null || isSelected) {
        shape.stroke();
      }
    }

    if (item.rotation) {
      node.container.pivot.set(item.width / 2, item.height / 2);
      node.container.position.set(item.position.x + item.width / 2, item.position.y + item.height / 2);
      node.container.rotation = (item.rotation * Math.PI) / 180;
    } else {
      node.container.pivot.set(0, 0);
      node.container.rotation = 0;
    }

    label.text = textValue;
    label.style.fontSize = item.fontSize || 14;
    label.style.fill = parseColor(item.textColor, 0x111111);
    label.style.fontWeight = item.fontWeight === 'bold' ? 'bold' : 'normal';
    label.style.fontStyle = item.fontStyle === 'italic' ? 'italic' : 'normal';
    label.style.wordWrapWidth = Math.max(item.width - 24, 40);
    label.style.align = item.textAlign || 'center';
    label.position.set(item.width / 2, item.height / 2);
    label.visible = Boolean(textValue) && item.type !== 'image';
  }

  async updateImageNode(node, item) {
    const { shape, label, sprite } = node;
    label.visible = false;
    shape.clear();

    const src = item.src || item.imageUrl || item.url;
    if (!src) {
      shape.roundRect(0, 0, item.width, item.height, 8);
      shape.fill({ color: 0xf3f4f6 });
      shape.stroke({ color: 0xd1d5db, width: 1 });
      return;
    }

    try {
      const cacheKey = `${item.id}:${src}`;
      let texture = this.textureCache.get(cacheKey);
      if (!texture) {
        texture = await Assets.load({ src, alias: cacheKey });
        this.textureCache.set(cacheKey, texture);
      }

      sprite.texture = texture;
      sprite.width = item.width;
      sprite.height = item.height;
      sprite.visible = true;
    } catch (error) {
      shape.roundRect(0, 0, item.width, item.height, 8);
      shape.fill({ color: 0xfee2e2 });
      shape.stroke({ color: 0xf87171, width: 1 });
    }
  }

  syncConnections(items, connections, selectedConnectionId) {
    const itemMap = new Map(items.map((item) => [String(item.id), item]));
    const nextIds = new Set();

    connections.forEach((connection) => {
      nextIds.add(String(connection.id));
      const startItem = itemMap.get(String(connection.from));
      const endItem = itemMap.get(String(connection.to));
      if (!startItem || !endItem) return;

      let node = this.connectionNodes.get(connection.id);
      if (!node) {
        node = new Graphics();
        this.connectionNodes.set(connection.id, node);
        this.connectionsLayer.addChild(node);
      }

      const { start, end } = findBestConnectionPoints(startItem, endItem);
      const lineDesign = connection.lineDesign || 'curved';
      const points = buildConnectionPath(start, end, lineDesign);
      drawConnectionGraphics(
        node,
        points,
        lineDesign,
        connection,
        selectedConnectionId === connection.id
      );
    });

    for (const [id, node] of this.connectionNodes.entries()) {
      if (!nextIds.has(String(id))) {
        this.connectionsLayer.removeChild(node);
        node.destroy();
        this.connectionNodes.delete(id);
      }
    }
  }

  syncConnectingPreview(items, connectingFromId, mousePosition) {
    if (!this.initialized || !this.previewLayer) return;

    this.previewLayer.clear();
    if (!connectingFromId || !mousePosition) return;

    const startItem = items.find((item) => item.id === connectingFromId);
    if (!startItem) return;

    const fakeEnd = {
      position: { x: mousePosition.x - 1, y: mousePosition.y - 1 },
      width: 2,
      height: 2,
    };
    const { start, end } = findBestConnectionPoints(startItem, fakeEnd);
    end.x = mousePosition.x;
    end.y = mousePosition.y;
    const points = buildConnectionPath(start, end, 'curved');
    drawConnectionGraphics(
      this.previewLayer,
      points,
      'curved',
      { color: '#2196F3', strokeWidth: 2, arrowDirection: '->', arrowHeadStyle: 'medium' },
      false
    );
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;

    this.textureCache.clear();
    this.itemNodes.clear();
    this.connectionNodes.clear();

    this._destroyApp();

    this.world = null;
    this.grid = null;
    this.connectionsLayer = null;
    this.itemsLayer = null;
    this.previewLayer = null;
    this.initialized = false;
    this.container = null;
    this.initPromise = null;
  }
}
