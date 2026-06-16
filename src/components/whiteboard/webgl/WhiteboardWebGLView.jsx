import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { WhiteboardWebGLRenderer } from './WhiteboardWebGLRenderer';

const WhiteboardWebGLView = forwardRef(function WhiteboardWebGLView(
  {
    items,
    connections,
    panOffset,
    scale,
    selectedItemIds,
    selectedConnectionId,
    connectingFromId,
    connectingMousePosition,
  },
  ref
) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const latestSceneRef = useRef({});
  const latestViewportRef = useRef({ panOffset, scale });

  useImperativeHandle(ref, () => ({
    setViewport(pan, nextScale) {
      rendererRef.current?.setViewport(pan, nextScale);
    },
    resize() {
      rendererRef.current?.resize();
    },
    syncScene(scene) {
      latestSceneRef.current = scene;
      rendererRef.current?.syncScene(scene);
    },
  }));

  useEffect(() => {
    latestViewportRef.current = { panOffset, scale };
  }, [panOffset, scale]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    const renderer = new WhiteboardWebGLRenderer();
    rendererRef.current = renderer;

    renderer.init(mount).then(() => {
      if (disposed) {
        renderer.destroy();
        return;
      }

      const { panOffset: pan, scale: currentScale } = latestViewportRef.current;
      renderer.setViewport(pan, currentScale);
      renderer.syncScene(latestSceneRef.current);
    });

    const handleResize = () => renderer.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      renderer.destroy();
      if (rendererRef.current === renderer) {
        rendererRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setViewport(panOffset, scale);
  }, [panOffset, scale]);

  useEffect(() => {
    const scene = {
      items,
      connections,
      selectedItemIds,
      selectedConnectionId,
      connectingFromId,
      connectingMousePosition,
      skipTypes: ['chart'],
    };
    latestSceneRef.current = scene;
    rendererRef.current?.syncScene(scene);
  }, [
    items,
    connections,
    selectedItemIds,
    selectedConnectionId,
    connectingFromId,
    connectingMousePosition,
  ]);

  return (
    <div
      ref={mountRef}
      className="whiteboard-webgl-viewport"
      aria-hidden="true"
    />
  );
});

export default WhiteboardWebGLView;
