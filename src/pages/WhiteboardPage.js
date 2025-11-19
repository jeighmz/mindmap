import React, { useState, useRef, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import html2canvas from 'html2canvas';
import { db } from '../firebase-config';
import { useAuth } from '../contexts/AuthContext';
import WhiteboardCanvas from '../components/whiteboard/WhiteboardCanvas';
import WhiteboardToolbar from '../components/whiteboard/WhiteboardToolbar';
import '../styles/Whiteboard.css';

const WhiteboardPage = () => {
  const [isMindMapPanelOpen, setIsMindMapPanelOpen] = useState(false);
  const canvasRef = useRef(null);
  const [items, setItems] = useState([]);
  const [connections, setConnections] = useState([]);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const navigate = useNavigate();
  const { boardId } = useParams();
  const { user } = useAuth();
  
  // Load board from URL if boardId is present (only once)
  const hasLoadedFromUrlRef = useRef(false);
  useEffect(() => {
    if (boardId && canvasRef.current && user && !hasLoadedFromUrlRef.current) {
      // Check if canvas has handleLoadWhiteboard method
      if (typeof canvasRef.current.handleLoadWhiteboard === 'function') {
        hasLoadedFromUrlRef.current = true;
        canvasRef.current.handleLoadWhiteboard(boardId).catch(error => {
          console.error('Error loading board from URL:', error);
          hasLoadedFromUrlRef.current = false;
        });
      }
    }
    // Reset when boardId changes
    if (!boardId) {
      hasLoadedFromUrlRef.current = false;
    }
  }, [boardId, user]);

  const handleOpenMindMapPanel = () => {
    // Toggle the mind map panel - let canvas handle the toggle
    if (canvasRef.current && typeof canvasRef.current.handleOpenMindMapPanel === 'function') {
      canvasRef.current.handleOpenMindMapPanel();
    }
  };

  const handleOpenSearchPanel = () => {
    if (canvasRef.current && typeof canvasRef.current.handleOpenSearchPanel === 'function') {
      canvasRef.current.handleOpenSearchPanel();
    }
  };

  const handleToggleHelp = () => {
    if (canvasRef.current && typeof canvasRef.current.handleToggleHelp === 'function') {
      canvasRef.current.handleToggleHelp();
    }
  };

  const handleCanvasUpdate = (newItems, newConnections) => {
    setItems(newItems);
    setConnections(newConnections);
  };

  const handlePublishToCommunity = async ({ title, description }) => {
    if (!user) {
      alert('Please sign in to publish to community');
      return;
    }

    try {
      // Capture the preview
      const boardElement = document.querySelector('.whiteboard-canvas');
      if (!boardElement) {
        console.error('Board element not found');
        return;
      }

      const canvas = await html2canvas(boardElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: true
      });
      const previewImage = canvas.toDataURL('image/png');

      // Upload preview to Firebase Storage
      const storage = getStorage();
      const previewRef = ref(storage, `previews/${boardId}_${Date.now()}.png`);
      await uploadString(previewRef, previewImage, 'data_url');
      const previewUrl = await getDownloadURL(previewRef);

      // Create community post
      const post = {
        userId: user.uid,
        boardId: boardId,
        title,
        description,
        createdAt: new Date().toISOString(),
        likes: 0,
        comments: [],
        previewUrl
      };

      await addDoc(collection(db, 'communityPosts'), post);
      
      // Show success message
      alert('Successfully published to community!');
      
      // Navigate to community page
      navigate('/community');
    } catch (err) {
      console.error('Error publishing to community:', err);
      alert('Failed to publish to community. Please try again.');
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="whiteboard">
        <WhiteboardToolbar 
          onOpenMindMapPanel={handleOpenMindMapPanel}
          onOpenSearchPanel={handleOpenSearchPanel}
          onPublishToCommunity={handlePublishToCommunity}
          items={items}
          connections={connections}
          isLibraryOpen={isLibraryOpen}
          onToggleHelp={handleToggleHelp}
        />
        <WhiteboardCanvas 
          ref={canvasRef}
          isMindMapPanelOpen={isMindMapPanelOpen}
          onMindMapPanelClose={() => setIsMindMapPanelOpen(false)}
          onMindMapPanelOpen={() => setIsMindMapPanelOpen(true)}
          onUpdate={handleCanvasUpdate}
          onLibraryStateChange={setIsLibraryOpen}
        />
      </div>
    </DndProvider>
  );
};

export default WhiteboardPage; 