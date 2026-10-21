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
    syncLivePositions(items, connections, selectedConnectionId, positionOverrides) {
      rendererRef.current?.syncLivePositions(
        positionOverrides,
        items,
        connections,
        selectedConnectionId
      );
    },
    syncScene(scene) {
      latestSceneRef.current = scene;
      rendererRef.current?.syncScene(scene);
    },
    syncConnectingPreview(items, connectingFromId, connectingMousePosition) {
      rendererRef.current?.syncConnectingPreview(
        items,
        connectingFromId,
        connectingMousePosition
      );
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

    renderer.init(mount).then(async () => {
      if (disposed) {
        renderer.destroy();
        return;
      }

      const { panOffset: pan, scale: currentScale } = latestViewportRef.current;
      renderer.setViewport(pan, currentScale);
      await renderer.syncScene(latestSceneRef.current);
      const scene = latestSceneRef.current;
      renderer.syncConnectingPreview(
        scene.items || [],
        scene.connectingFromId ?? null,
        scene.connectingMousePosition ?? null
      );
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
      // Images stay on the DOM overlay. Firebase download URLs display in <img>
      // but fail WebGL texture upload (no bucket CORS), which drew a pink error box.
      skipTypes: ['chart', 'image'],
    };
    latestSceneRef.current = scene;
    
    const updateScene = async () => {
      await rendererRef.current?.syncScene(scene);
    };
    updateScene();
  }, [
    items,
    connections,
    selectedItemIds,
    selectedConnectionId,
    connectingFromId,
  ]);

  useEffect(() => {
    rendererRef.current?.syncConnectingPreview(
      items,
      connectingFromId,
      connectingMousePosition
    );
  }, [items, connectingFromId, connectingMousePosition]);

  return (
    <div
      ref={mountRef}
      className="whiteboard-webgl-viewport"
      aria-hidden="true"
    />
  );
});

export default WhiteboardWebGLView;
