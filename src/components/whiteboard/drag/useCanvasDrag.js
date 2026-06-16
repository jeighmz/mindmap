import { useRef, useCallback } from 'react';

const GRID_SIZE = 10;

function resolvePosition(map, itemId) {
  return map[itemId] ?? map[String(itemId)] ?? map[Number(itemId)] ?? null;
}

export function useCanvasDrag({
  webglRef,
  domOverlayRef,
  itemsRef,
  connectionsRef,
  selectedConnectionRef,
  selectedItemsRef,
  scaleRef,
  constrainPositionToCanvas,
  setItems,
  saveStateRef,
}) {
  const sessionRef = useRef(null);
  const rafRef = useRef(null);
  const pendingPointerRef = useRef(null);
  const windowMoveRef = useRef(null);
  const windowUpRef = useRef(null);

  const detachWindowListeners = useCallback(() => {
    if (windowMoveRef.current) {
      window.removeEventListener('mousemove', windowMoveRef.current);
      windowMoveRef.current = null;
    }
    if (windowUpRef.current) {
      window.removeEventListener('mouseup', windowUpRef.current);
      windowUpRef.current = null;
    }
  }, []);

  const pushLivePositions = useCallback((positionsById) => {
    webglRef.current?.syncLivePositions(
      itemsRef.current,
      connectionsRef.current,
      selectedConnectionRef.current,
      positionsById
    );

    Object.entries(positionsById).forEach(([id, position]) => {
      domOverlayRef.current
        ?.querySelectorAll(`.whiteboard-dom-overlay-item[data-overlay-id="${CSS.escape(String(id))}"]`)
        .forEach((el) => {
          el.style.left = `${position.x}px`;
          el.style.top = `${position.y}px`;
        });
    });
  }, [webglRef, domOverlayRef, itemsRef, connectionsRef, selectedConnectionRef]);

  const computeLivePositions = useCallback((clientX, clientY) => {
    const session = sessionRef.current;
    if (!session) return null;

    const dx = (clientX - session.startX) / scaleRef.current;
    const dy = (clientY - session.startY) / scaleRef.current;
    const positions = {};

    session.ids.forEach((id) => {
      const start = resolvePosition(session.startPositions, id);
      const item = itemsRef.current.find((entry) => String(entry.id) === String(id));
      if (!start || !item) return;

      positions[id] = constrainPositionToCanvas(
        { x: start.x + dx, y: start.y + dy },
        item.width || 0,
        item.height || 0
      );
    });

    return positions;
  }, [scaleRef, constrainPositionToCanvas, itemsRef]);

  const flushDragFrame = useCallback(() => {
    rafRef.current = null;
    const pointer = pendingPointerRef.current;
    if (!pointer || !sessionRef.current) return;

    const positions = computeLivePositions(pointer.x, pointer.y);
    if (!positions) return;

    sessionRef.current.livePositions = positions;
    pushLivePositions(positions);
  }, [computeLivePositions, pushLivePositions]);

  const moveDrag = useCallback((clientX, clientY) => {
    if (!sessionRef.current) return;
    pendingPointerRef.current = { x: clientX, y: clientY };
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushDragFrame);
    }
  }, [flushDragFrame]);

  const endDrag = useCallback(() => {
    if (!sessionRef.current) return;

    detachWindowListeners();

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const session = sessionRef.current;
    pendingPointerRef.current = null;
    const live = session.livePositions || {};
    const snappedById = {};

    session.ids.forEach((id) => {
      const start = resolvePosition(session.startPositions, id);
      const current = resolvePosition(live, id) || start;
      if (!current) return;
      snappedById[id] = {
        x: Math.round(current.x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(current.y / GRID_SIZE) * GRID_SIZE,
      };
    });

    sessionRef.current = null;
    document.querySelector('.whiteboard-canvas')?.classList.remove('is-dragging-items');

    setItems((prev) => {
      const next = prev.map((item) => {
        const snapped = resolvePosition(snappedById, item.id);
        return snapped ? { ...item, position: snapped } : item;
      });
      itemsRef.current = next;
      webglRef.current?.syncLivePositions(
        next,
        connectionsRef.current,
        selectedConnectionRef.current,
        {}
      );
      return next;
    });

    saveStateRef.current?.();
  }, [
    detachWindowListeners,
    setItems,
    webglRef,
    itemsRef,
    connectionsRef,
    selectedConnectionRef,
    saveStateRef,
  ]);

  const startDrag = useCallback((primaryId, clientX, clientY) => {
    detachWindowListeners();

    const selected = selectedItemsRef.current;
    const dragGroup =
      selected.size > 1 &&
      [...selected].some((id) => String(id) === String(primaryId));

    const ids = dragGroup ? [...selected] : [primaryId];
    const startPositions = {};

    ids.forEach((id) => {
      const item = itemsRef.current.find((entry) => String(entry.id) === String(id));
      if (item?.position) {
        startPositions[id] = { ...item.position };
      }
    });

    sessionRef.current = {
      ids,
      startX: clientX,
      startY: clientY,
      startPositions,
      livePositions: null,
    };

    document.querySelector('.whiteboard-canvas')?.classList.add('is-dragging-items');

    windowMoveRef.current = (e) => moveDrag(e.clientX, e.clientY);
    windowUpRef.current = () => endDrag();
    window.addEventListener('mousemove', windowMoveRef.current);
    window.addEventListener('mouseup', windowUpRef.current);
  }, [selectedItemsRef, itemsRef, moveDrag, endDrag, detachWindowListeners]);

  const isDragging = useCallback(() => Boolean(sessionRef.current), []);

  return { startDrag, moveDrag, endDrag, isDragging };
}
