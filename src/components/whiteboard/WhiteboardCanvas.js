import React, { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useDrop } from 'react-dnd';
import html2canvas from 'html2canvas';
import WhiteboardItem from './WhiteboardItem';
import Connector from './Connector';
import SavedWhiteboardsMenu from './SavedWhiteboardsMenu';
import SearchPanel from './SearchPanel';
import ChartConfigPanel from './ChartConfigPanel';
// import PublishModal from './PublishModal';  // Temporarily removed
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadString, getDownloadURL, getStorage, uploadBytes, getMetadata } from 'firebase/storage';
import { db, storage } from '../../firebase-config';
/* eslint-disable-next-line no-unused-vars */
import { useAuth } from '../../contexts/AuthContext';
import UserMenu from '../UserMenu';
import PricingTable from '../Pricing';
import { useNavigate } from 'react-router-dom';
import { useTierPermissions } from '../../hooks/useTierPermissions';
import { saveBoard } from '../../services/boardService';
import { getApiBaseUrl } from '../../utils/api';
import { createNotionPage, writeToNotionDatabase } from './agent/tools/notion';
import { ChromePicker } from 'react-color';

const WhiteboardCanvas = forwardRef((props, ref) => {
  const {
    isMindMapPanelOpen: externalIsMindMapPanelOpen,
    onMindMapPanelClose,
    onUpdate
  } = props;

  const [items, setItems] = useState([]);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1.0); // Changed from 0.4 to 1.0 for 100% default zoom
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [connections, setConnections] = useState([]);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [highlightedItems, setHighlightedItems] = useState([]);
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const [isMindMapPanelOpen, setIsMindMapPanelOpen] = useState(false);
  const [mindMapPrompt, setMindMapPrompt] = useState('');
  const [isGeneratingMindMap, setIsGeneratingMindMap] = useState(false);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0
  });
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [touchStartPoint, setTouchStartPoint] = useState(null);
  const [expandingItemId, setExpandingItemId] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [isExpandingConcept, setIsExpandingConcept] = useState(false);
  const [savedWhiteboards, setSavedWhiteboards] = useState([]);
  const [currentBoardId, setCurrentBoardId] = useState(null);
  const { user } = useAuth();
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [editingChartId, setEditingChartId] = useState(null);
  const [isSavedBoardsMenuOpen, setIsSavedBoardsMenuOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isInstructionsCollapsed, setIsInstructionsCollapsed] = useState(false);
  const navigate = useNavigate();
  const { userTier } = useAuth();
  const { canExport, getCurrentTier } = useTierPermissions();
  // Add clipboard state
  const [clipboardData, setClipboardData] = useState(null);
  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  // Add state for color picker
  const [colorPicker, setColorPicker] = useState({
    background: '#fff740',
    border: '#000',
  });
  // Add state for text styling
  const [textStyling, setTextStyling] = useState({
    fontSize: 14,
    textColor: '#000',
    fontFamily: 'Arial',
  });
  // Add state for color picker section
  const [activeColorSection, setActiveColorSection] = useState('background');

  // Sync with external state if provided
  useEffect(() => {
    if (externalIsMindMapPanelOpen !== undefined) {
      setIsMindMapPanelOpen(externalIsMindMapPanelOpen);
    }
  }, [externalIsMindMapPanelOpen]);

  // Expose methods to parent through ref
  useImperativeHandle(ref, () => ({
    handleCloseMindMapPanel: () => {
      setIsMindMapPanelOpen(false);
      if (onMindMapPanelClose) {
        onMindMapPanelClose();
      }
    }
  }));

  const handleMouseUp = useCallback((e) => {
    if (isPanning) {
      setIsPanning(false);
    }

    if (isSelecting && selectionBox) {
      const dpr = window.devicePixelRatio || 1;
      const selectedItems = items.filter(item => {
        const itemRight = item.position.x + item.width;
        const itemBottom = item.position.y + item.height;
        const boxRight = selectionBox.x + selectionBox.width;
        const boxBottom = selectionBox.y + selectionBox.height;

        return (
          item.position.x < boxRight &&
          itemRight > selectionBox.x &&
          item.position.y < boxBottom &&
          itemBottom > selectionBox.y
        );
      });

      if (selectedItems.length > 0) {
        setHighlightedItems(selectedItems);
        setSelectedItems(new Set(selectedItems.map(item => item.id)));
        setIsSearchPanelOpen(true);
      }

      setIsSelecting(false);
      setSelectionBox(null);
      setSelectionStart(null);
    }
  }, [isPanning, isSelecting, selectionBox, items]);

  const handleMouseMove = useCallback((e) => {
    if (isPanning) {
      const newPanOffset = {
        x: Math.min(0, e.clientX - panStart.x), // Limit to left (negative) direction
        y: Math.min(0, e.clientY - panStart.y)  // Limit to up (negative) direction
      };
      setPanOffset(newPanOffset);
    }
    
    const canvas = document.querySelector('.whiteboard-canvas');
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const x = (e.clientX - rect.left - panOffset.x) / (scale * dpr);
      const y = (e.clientY - rect.top - panOffset.y) / (scale * dpr);
      setMousePosition({ x, y });

      if (isSelecting && selectionStart) {
        const width = x - selectionStart.x;
        const height = y - selectionStart.y;
        
        setSelectionBox({
          x: width < 0 ? x : selectionStart.x,
          y: height < 0 ? y : selectionStart.y,
          width: Math.abs(width),
          height: Math.abs(height)
        });
      }
    }
  }, [isPanning, panStart, scale, panOffset, isSelecting, selectionStart]);

  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && isSpacePressed) || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y
      });
      e.preventDefault();
    } else if (e.button === 0 && !isSpacePressed && !e.altKey && !e.target.closest('.whiteboard-item')) {
      const canvas = document.querySelector('.whiteboard-canvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const x = (e.clientX - rect.left - panOffset.x) / (scale * dpr);
        const y = (e.clientY - rect.top - panOffset.y) / (scale * dpr);
        
        setIsSelecting(true);
        setSelectionStart({ x, y });
        setSelectionBox({ x, y, width: 0, height: 0 });
        setSelectedItems(new Set());
      }
    }
  }, [panOffset, isSpacePressed, scale]);

  const handleCloseSearchPanel = () => {
    setIsSearchPanelOpen(false);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isPanning) {
        const newPanOffset = {
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y
        };
        setPanOffset(newPanOffset);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isPanning) {
        setIsPanning(false);
      }
    };

    if (isPanning) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning, panStart]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat && 
          !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        setIsSpacePressed(true);
        e.preventDefault();
      } else if (e.code === 'AltLeft' || e.code === 'AltRight') {
        setIsAltPressed(true);
        e.preventDefault();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      } else if (e.code === 'AltLeft' || e.code === 'AltRight') {
        setIsAltPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const [, drop] = useDrop(() => ({
    accept: 'WHITEBOARD_ITEM',
    drop: (item, monitor) => {
      const offset = monitor.getClientOffset();
      const canvasRect = document.querySelector('.whiteboard-canvas').getBoundingClientRect();
      
      if (!item.id) {
        let width, height;

        // Set default sizes based on item type
        switch (item.type) {
          case 'chart':
            width = canvasRect.width * 0.2;  // Reduced from 0.3 to 0.2
            height = canvasRect.height * 0.3; // Reduced from 0.4 to 0.3
            break;
          case 'sticky':
            width = 150;  // Reduced from 200
            height = 150; // Reduced from 200
            break;
          default:
            width = 80;   // Reduced from 100
            height = 40;   // Reduced from 60
        }

        // Calculate the position accounting for scale, pan offset, and device pixel ratio
        const dpr = window.devicePixelRatio || 1;
        const position = {
          x: Math.round(((offset.x - canvasRect.left - panOffset.x) / (scale * dpr) - width/2) / 10) * 10,
          y: Math.round(((offset.y - canvasRect.top - panOffset.y) / (scale * dpr) - height/2) / 10) * 10
        };

        const newItem = {
          id: Date.now(),
          type: item.type,
          chartType: item.chartType,
          position,
          width,
          height,
          text: item.type === 'sticky' ? 'New note' : '',
          // Add default chart configuration for better initial appearance
          ...(item.type === 'chart' && {
            title: 'New Chart',
            xAxisTitle: 'X Axis',
            yAxisTitle: 'Y Axis',
            showXAxisLabels: true,
            showYAxisLabels: true,
            xAxisUnit: 1,
            yAxisUnit: 1,
            xAxisStart: 0,
            xAxisEnd: 10,
            yAxisStart: 0,
            yAxisEnd: 10,
            ...(item.chartType === 'sine' && {
              periods: 2,
              frequency: 1,
              amplitude: 1,
              waveType: 'sine',
              xAxisTitle: 'Angle (π)',
              yAxisTitle: 'Amplitude',
              yAxisStart: -3,
              yAxisEnd: 3
            })
          })
        };
        setItems(prevItems => [...prevItems, newItem]);
      }
      return undefined;
    }
  }), [scale, panOffset]);

  const handleWheel = useCallback((e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const dpr = window.devicePixelRatio || 1;
      setScale(s => {
        const newScale = Math.min(Math.max(0.1, s * delta), 2); // Changed max zoom from 4 to 2
        return newScale / dpr;
      });
    }
  }, []);

  const updateItemPosition = (id, position) => {
    setItems(items.map(item => 
      item.id === id 
        ? { ...item, position } 
        : item
    ));
  };

  const updateItemSize = (id, size) => {
    setItems(items.map(item =>
      item.id === id
        ? { ...item, ...size }
        : item
    ));
  };

  const updateItemText = (id, text, updatedItem) => {
    setItems(items.map(item =>
      item.id === id
        ? updatedItem || { ...item, text }  // Use updatedItem if provided, otherwise just update text
        : item
    ));
  };

  const handleConnectionStart = (itemId) => {
    setConnectingFrom(itemId);
    setSelectedItems(new Set([itemId]));
  };

  const handleItemClick = (itemId, e) => {
    if (connectingFrom) {
      if (connectingFrom !== itemId) {
        const newConnection = {
          id: `connection-${Date.now()}`,
          from: connectingFrom,
          to: itemId
        };
        setConnections(prev => [...prev, newConnection]);
        setConnectingFrom(null);
      }
    } else {
      setSelectedItems(new Set([itemId]));
    }
  };

  const handleDeleteItem = (itemId) => {
    setItems(prevItems => prevItems.filter(item => item.id !== itemId));
    setSelectedItems(new Set());
    setConnections(prevConnections => 
      prevConnections.filter(conn => 
        conn.from !== itemId && conn.to !== itemId
      )
    );
    // Close chart editing if the deleted item was being edited
    if (editingChartId === itemId) {
      setEditingChartId(null);
    }
  };

  const handleChartEdit = (chartId) => {
    setEditingChartId(chartId);
  };

  const handleChartEditClose = () => {
    setEditingChartId(null);
  };

  const handleResetBoard = () => {
    if (window.confirm('Are you sure you want to clear the entire whiteboard? This action cannot be undone.')) {
      setItems([]);
      setConnections([]);
      setSelectedItems(new Set());
      setConnectingFrom(null);
      setEditingChartId(null);
      setExpandingItemId(null);
      setContextMenu({ visible: false, x: 0, y: 0 });
      setPanOffset({ x: 0, y: 0 });
      setScale(1.0);
    }
  };

  const handleDeleteConnection = (connectionId) => {
    setConnections(connections.filter(conn => conn.id !== connectionId));
  };

  const organizeNodes = (parentId) => {
    // Find all direct child nodes connected to the parent
    const childConnections = connections.filter(conn => conn.from === parentId);
    const childNodes = childConnections.map(conn => items.find(item => item.id === conn.to)).filter(Boolean);
    
    if (childNodes.length === 0) return;

    // Calculate positions in a hierarchical layout
    const parentNode = items.find(item => item.id === parentId);
    const horizontalSpacing = 300; // Space between nodes horizontally
    const verticalSpacing = 60;   // Space between nodes vertically
    
    // Create new items array with updated positions
    const newItems = [...items];
    
    // Calculate total height needed for children
    const totalHeight = (childNodes.length - 1) * verticalSpacing;
    const startY = parentNode.position.y - totalHeight / 2;
    
    childNodes.forEach((child, index) => {
      // Position each child to the right of the parent with vertical distribution
      const childX = parentNode.position.x + horizontalSpacing;
      const childY = startY + (index * verticalSpacing);
      
      // Update child position
      const childIndex = newItems.findIndex(item => item.id === child.id);
      if (childIndex !== -1) {
        newItems[childIndex] = {
          ...newItems[childIndex],
          position: { x: childX, y: childY }
        };
        
        // Recursively organize child's children
        organizeNodes(child.id);
      }
    });
    
    setItems(newItems);
  };

  const renderConnections = () => {
    return connections.map(connection => {
      const startItem = items.find(item => item.id === connection.from);
      const endItem = items.find(item => item.id === connection.to);
      
      if (!startItem || !endItem) return null;

      return (
        <Connector
          key={connection.id}
          startItem={startItem}
          endItem={endItem}
          onDelete={() => handleDeleteConnection(connection.id)}
        />
      );
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem('savedWhiteboards');
    if (saved) {
      setSavedWhiteboards(JSON.parse(saved));
    }
  }, []);

  const handleSaveWhiteboard = async (name) => {
    try {
      if (!user) {
        throw new Error('Please sign in to save whiteboards');
      }

      console.log('🔄 Starting save process...');
      
      // First, verify storage is initialized
      const storage = getStorage();
      if (!storage) {
        throw new Error('Storage is not initialized');
      }

      // Process all items, with special handling for images
      console.log('📦 STORAGE: Processing items for save...');
      const processedItems = await Promise.all(items.map(async (item) => {
        const cleanedItem = { ...item };
        
        if (item.type === 'image') {
          // All images should already be uploaded and have a storageRef
          if (!item.storageRef) {
            console.error('📦 STORAGE ERROR: Image item missing storage reference:', item.id);
            throw new Error('Invalid image item state: missing storage reference');
          }
          
          // Verify the existing image is still accessible
          try {
            const storage = getStorage();
            const imageRef = storageRef(storage, item.storageRef);
            const downloadUrl = await getDownloadURL(imageRef);
            
            // Update the URL in case it has changed
            cleanedItem.imageUrl = downloadUrl;
            
            console.log('📦 STORAGE: Verified existing image:', {
              id: item.id,
              storageRef: item.storageRef
            });
          } catch (error) {
            console.error('📦 STORAGE ERROR: Failed to verify existing image:', {
              id: item.id,
              storageRef: item.storageRef,
              error: error.message
            });
            throw new Error(`Failed to verify existing image: ${error.message}`);
          }
        }
        return cleanedItem;
      }));

      // Verify all images were processed
      const invalidImages = processedItems.filter(
        item => item.type === 'image' && (!item.storageRef || !item.imageUrl)
      );

      if (invalidImages.length > 0) {
        console.error('📦 STORAGE ERROR: Some images are in invalid state:', invalidImages);
        throw new Error('Some images could not be processed');
      }

      // Prepare data for Firestore
      console.log('🔥 FIRESTORE: Preparing board data...');
      const boardData = {
        name,
        userId: user.uid,
        savedAt: serverTimestamp(),
        content: {
          items: processedItems,
          connections: connections.map(conn => ({
            id: String(conn.id || `connection-${Date.now()}`),
            from: String(conn.from),
            to: String(conn.to)
          })),
          scale: Number(scale || 1),
          panOffset: {
            x: Number(panOffset?.x || 0),
            y: Number(panOffset?.y || 0)
          }
        }
      };

      // Save to Firestore
      console.log('🔥 FIRESTORE: Saving board data...');
      const savedBoard = await saveBoard(boardData, user.uid);
      
      // Update state only after everything is saved
      setItems(processedItems);
      setCurrentBoardId(savedBoard.id);
      setShowSaveDialog(false);

      console.log('✅ Save process completed successfully:', {
        boardId: savedBoard.id,
        totalItems: processedItems.length,
        imageItems: processedItems.filter(item => item.type === 'image').length
      });
      
    } catch (error) {
      console.error('❌ Error during save process:', error);
      throw error; // Re-throw to be handled by the caller
    }
  };

  const handleLoadWhiteboard = async (boardId) => {
    try {
      if (!user) {
        throw new Error('Please sign in to load whiteboards');
      }

      console.log('🔄 Starting load process...', { boardId });

      const boardDoc = await getDoc(doc(db, 'boards', boardId));
      
      if (!boardDoc.exists()) {
        throw new Error('Board not found');
      }

      const boardData = boardDoc.data();

      if (!boardData.content) {
        throw new Error('Invalid board data: missing content');
      }

      // Process items to restore image URLs
      console.log('📦 STORAGE: Processing items for load...');
      const processedItems = await Promise.all(boardData.content.items.map(async (item) => {
        if (item.type === 'image') {
          if (!item.storageRef) {
            console.error('📦 STORAGE ERROR: Image missing storage reference:', item.id);
            return {
              ...item,
              loadError: 'Missing storage reference',
              imageUrl: '/placeholder-image-error.png', // Add a placeholder image
              errorOverlay: true
            };
          }

          const maxRetries = 3;
          let lastError = null;

          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              console.log(`📦 STORAGE: Loading image (attempt ${attempt}/${maxRetries}):`, {
                itemId: item.id,
                storageRef: item.storageRef
              });

              const storage = getStorage();
              const imageRef = storageRef(storage, item.storageRef);
              
              // Get the download URL
              const imageUrl = await getDownloadURL(imageRef);
              
              // Verify the image can be loaded
              await new Promise((resolve, reject) => {
                const img = new Image();
                const timeoutId = setTimeout(() => {
                  reject(new Error('Image load timed out'));
                }, 30000); // 30 second timeout

                img.onload = () => {
                  clearTimeout(timeoutId);
                  resolve();
                };

                img.onerror = () => {
                  clearTimeout(timeoutId);
                  reject(new Error('Failed to load image'));
                };

                img.src = imageUrl;
              });

              console.log('📦 STORAGE: Image loaded successfully:', {
                itemId: item.id,
                attempt,
                urlLength: imageUrl.length
              });

              return {
                ...item,
                imageUrl,
                loadError: null,
                errorOverlay: false
              };

            } catch (error) {
              lastError = error;
              console.error(`📦 STORAGE ERROR: Failed to load image (attempt ${attempt}/${maxRetries}):`, {
                itemId: item.id,
                storageRef: item.storageRef,
                error: error.message
              });

              // If this was the last attempt, mark the item as failed
              if (attempt === maxRetries) {
                return {
                  ...item,
                  loadError: `Failed to load after ${maxRetries} attempts: ${error.message}`,
                  imageUrl: '/placeholder-image-error.png', // Add a placeholder image
                  errorOverlay: true,
                  errorDetails: {
                    message: error.message,
                    storageRef: item.storageRef,
                    timestamp: new Date().toISOString()
                  }
                };
              }

              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
            }
          }
        }
        return item;
      }));

      // Check for any failed image loads
      const failedImages = processedItems.filter(item => 
        item.type === 'image' && item.loadError
      );
      
      if (failedImages.length > 0) {
        console.warn('📦 STORAGE WARNING: Some images failed to load:', failedImages);
      }

      // Update state with loaded data
      console.log('✅ Load process completed:', {
        totalItems: processedItems.length,
        imageItems: processedItems.filter(item => item.type === 'image').length,
        failedImages: failedImages.length
      });

      setItems(processedItems);
      setConnections(boardData.content.connections || []);
      setScale(boardData.content.scale || 1);
      setPanOffset(boardData.content.panOffset || { x: 0, y: 0 });
      setCurrentBoardId(boardId);

    } catch (error) {
      console.error('❌ Error during load process:', error);
      throw error; // Re-throw to be handled by the caller
    }
  };

  const handleDeleteSavedWhiteboard = (boardId) => {
    const updatedBoards = savedWhiteboards.filter(b => b.id !== boardId);
    setSavedWhiteboards(updatedBoards);
    localStorage.setItem('savedWhiteboards', JSON.stringify(updatedBoards));
    if (currentBoardId === boardId) {
      setCurrentBoardId(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && connectingFrom) {
        setConnectingFrom(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [connectingFrom]);

  // Add image item event listener
  useEffect(() => {
    const handleAddImageItem = (e) => {
      const newItem = {
        ...e.detail,
        id: Date.now()
      };
      setItems(prevItems => [...prevItems, newItem]);
      setSelectedItems(new Set([newItem.id]));
    };

    window.addEventListener('addImageItem', handleAddImageItem);
    return () => window.removeEventListener('addImageItem', handleAddImageItem);
  }, []);

  const handleCanvasClick = (e) => {
    if (e.target === e.currentTarget) {
      setSelectedItems(new Set());
      setConnectingFrom(null);
      setContextMenu({ visible: false, x: 0, y: 0 });
    }
  };

  const handleContextMenu = (e, itemId) => {
    if (selectedItems.size > 0) {
      e.preventDefault();
      if (!selectedItems.has(itemId)) {
        setSelectedItems(new Set([itemId]));
      }
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY
      });
    }
  };

  const handleContextMenuAction = (action) => {
    switch (action) {
      case 'delete':
        const updatedItems = items.filter(item => !selectedItems.has(item.id));
        setItems(updatedItems);
        
        const updatedConnections = connections.filter(conn => 
          !selectedItems.has(conn.from) && !selectedItems.has(conn.to)
        );
        setConnections(updatedConnections);
        setSelectedItems(new Set());
        break;
      case 'move':
        const selectedItemsArray = Array.from(selectedItems);
        if (selectedItemsArray.length > 0) {
          // Get all selected elements
          const elements = selectedItemsArray.map(id => 
            document.querySelector(`[data-id="${id}"]`)
          ).filter(el => el);
          
          // Add move-mode class for visual feedback
          elements.forEach(el => {
            el.classList.add('move-mode');
            // Show a tooltip to indicate items can be dragged
            const tooltip = document.createElement('div');
            tooltip.className = 'move-tooltip';
            tooltip.textContent = 'Click and drag to move items';
            document.body.appendChild(tooltip);
            
            // Position the tooltip above the first selected item
            if (elements[0] === el) {
              const rect = el.getBoundingClientRect();
              tooltip.style.position = 'absolute';
              tooltip.style.left = `${rect.left + rect.width/2 - tooltip.offsetWidth/2}px`;
              tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
            }
            
            // Remove tooltip and class after a delay
            setTimeout(() => {
              el.classList.remove('move-mode');
              if (document.body.contains(tooltip)) {
                document.body.removeChild(tooltip);
              }
            }, 3000);
          });
        }
        break;
      default:
        break;
    }
    setContextMenu({ visible: false, x: 0, y: 0 });
  };

  const updateMultipleItemPositions = useCallback((dx, dy) => {
    if (selectedItems.size <= 1) return;

    // Store current positions of all items to avoid interference
    const currentPositions = items.reduce((positions, item) => {
      if (selectedItems.has(item.id)) {
        positions[item.id] = { ...item.position };
      }
      return positions;
    }, {});

    // Calculate grid-aligned deltas
    const alignedDx = Math.round(dx / 20) * 20;
    const alignedDy = Math.round(dy / 20) * 20;
    
    // Only update if there's actual movement
    if (alignedDx === 0 && alignedDy === 0) return;

    requestAnimationFrame(() => {
      setItems(prevItems => 
        prevItems.map(item => {
          if (selectedItems.has(item.id) && currentPositions[item.id]) {
            const basePosition = currentPositions[item.id];
            return {
              ...item,
              position: {
                x: basePosition.x + alignedDx,
                y: basePosition.y + alignedDy
              }
            };
          }
          return item;
        })
      );
    });
  }, [selectedItems, items]);

  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (contextMenu.visible && 
          !e.target.closest('.context-menu') && 
          !e.target.closest('.whiteboard-item.selected')) {
        setContextMenu({ visible: false, x: 0, y: 0 });
      }
    };

    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleGlobalClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
    };
  }, [contextMenu.visible]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (contextMenu.visible) {
          setContextMenu({ visible: false, x: 0, y: 0 });
        }
        if (connectingFrom) {
          setConnectingFrom(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [connectingFrom, contextMenu.visible]);

  // Set up global function for moving selected items
  useEffect(() => {
    // Function to move all selected items
    window.moveSelectedItems = (dx, dy) => {
      updateMultipleItemPositions(dx, dy);
    };

    // Clean up the global function on unmount
    return () => {
      window.moveSelectedItems = undefined;
    };
  }, [updateMultipleItemPositions]);

  // Add expand functionality
  useEffect(() => {
    window.expandSelectedConcept = async (itemId, text) => {
      if (!text) return;
      
      setExpandingItemId(itemId);
      setIsExpandingConcept(true);

      try {
        // Get the item being expanded
        const sourceItem = items.find(item => item.id === itemId);
        if (!sourceItem) throw new Error('Source item not found');

        // Fetch the Groq API key from Firebase
        if (!user?.uid) {
          throw new Error('Please sign in to expand concepts');
        }

        const settingsRef = doc(db, 'userSettings', user.uid);
        const settingsSnap = await getDoc(settingsRef);
        
        if (!settingsSnap.exists() || !settingsSnap.data().groqApiKey) {
          throw new Error('Please set your Groq API key in Settings first');
        }

        // Get and decrypt the API key
        const encryptedApiKey = settingsSnap.data().groqApiKey;
        let groqApiKey;

        try {
          groqApiKey = atob(encryptedApiKey);
        } catch (e) {
          const decryptResponse = await fetch(`${getApiBaseUrl()}/decryptApiKey`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.uid,
              encryptedData: encryptedApiKey
            })
          });

          if (!decryptResponse.ok) {
            throw new Error('Failed to decrypt API key');
          }

          const { decrypted } = await decryptResponse.json();
          groqApiKey = decrypted;
        }

        if (!groqApiKey?.trim() || !groqApiKey.startsWith('gsk_')) {
          throw new Error('Invalid API key format');
        }

        // Call Groq API to generate related concepts
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqApiKey}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content: `You are an expert at identifying key related concepts. When given a concept, generate exactly 5 closely related ideas or aspects that help expand understanding of the original concept.

Guidelines:
- Generate exactly 5 related concepts, no more and no less
- Each concept should be 2-4 words long
- Make each concept clear and specific
- Ensure direct relevance to the original topic
- Use professional, field-appropriate terminology
- Avoid generic or redundant information

Format:
- Return only the 5 concepts, one per line
- No prefixes, numbers, or bullet points
- Just plain text, each on its own line

Example for "Machine Learning":
Neural Network Architecture
Training Data Preparation
Model Optimization Techniques
Hyperparameter Tuning
Performance Metrics Analysis`
              },
              {
                role: 'user',
                content: `Generate 5 key related concepts for: ${text}`
              }
            ],
            temperature: 0.7,
            max_tokens: 500
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Failed to generate concepts');
        }

        const data = await response.json();
        const concepts = data.choices[0].message.content
          .split('\n')
          .filter(line => line.trim())
          .slice(0, 5); // Ensure we only take 5 concepts

        // Calculate positions for new items in a circular layout
        const radius = 200; // Distance from center item
        const angleStep = (2 * Math.PI) / concepts.length;
        
        // Create new items and connections
        const newItems = [];
        const newConnections = [];

        concepts.forEach((concept, i) => {
          const angle = i * angleStep;
          const dimensions = calculateTextDimensions(concept, 'rectangle');
          const newItem = {
            id: Date.now() + i,
            type: 'rectangle',
            text: concept,
            position: {
              x: sourceItem.position.x + radius * Math.cos(angle),
              y: sourceItem.position.y + radius * Math.sin(angle)
            },
            width: dimensions.width,
            height: dimensions.height
          };

          newItems.push(newItem);
          newConnections.push({
            id: `connection-${Date.now()}-${i}`,
            from: itemId,
            to: newItem.id
          });
        });

        // Update state with new items and connections
        setItems(prevItems => [...prevItems, ...newItems]);
        setConnections(prevConnections => [...prevConnections, ...newConnections]);

      } catch (error) {
        console.error('Error expanding concept:', error);
        alert(error.message || 'Failed to expand concept. Please try again.');
      } finally {
        setExpandingItemId(null);
        setIsExpandingConcept(false);
      }
    };

    return () => {
      window.expandSelectedConcept = undefined;
    };
  }, [items, user, getApiBaseUrl]);

  const handleCloseMindMapPanel = () => {
    setIsMindMapPanelOpen(false);
    setMindMapPrompt(''); // Reset the prompt when closing
    if (onMindMapPanelClose) {
      onMindMapPanelClose();
    }
  };

  // Calculate bounds of all items on the canvas
  const calculateContentBounds = useCallback(() => {
    const padding = 50;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    if (items.length === 0) {
      // Return default bounds if no items exist
      return { x: 0, y: 0, width: 500, height: 300 };
    }
    
    items.forEach(item => {
      minX = Math.min(minX, item.position.x);
      minY = Math.min(minY, item.position.y);
      maxX = Math.max(maxX, item.position.x + item.width);
      maxY = Math.max(maxY, item.position.y + item.height);
    });
    
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + (padding * 2),
      height: maxY - minY + (padding * 2)
    };
  }, [items]); // Depends only on items

  // --- Export Functions --- 

  const exportToPNG = useCallback(() => {
    const contentElement = document.querySelector('.canvas-content');
    if (!contentElement) return;

    // Calculate bounds including padding
    const bounds = calculateContentBounds();
    const exportPadding = 20;

    html2canvas(contentElement, {
      backgroundColor: '#f5f5f5',
      x: bounds.x - exportPadding,
      y: bounds.y - exportPadding,
      width: bounds.width + exportPadding * 2,
      height: bounds.height + exportPadding * 2,
      scale: 2,
      useCORS: true,
      logging: true,
      onclone: (clonedDoc) => {
        const clonedContent = clonedDoc.querySelector('.canvas-content');
        if (clonedContent) {
          clonedContent.style.transform = 'none';
          const grid = clonedContent.querySelector('.grid-background');
          if (grid) grid.style.display = 'none';
        }
      }
    }).then(canvas => {
      // Create a new canvas with the logo
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = canvas.width;
      finalCanvas.height = canvas.height;
      const ctx = finalCanvas.getContext('2d');

      // Draw the original canvas
      ctx.drawImage(canvas, 0, 0);

      // Load and draw the logo
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      logo.src = '/logo_and_name.png';
      
      logo.onload = () => {
        // Calculate logo dimensions (40px height, maintain aspect ratio)
        const logoHeight = 40 * 2; // Multiply by 2 because of canvas scale
        const logoWidth = (logo.width * logoHeight) / logo.height;
        
        // Draw logo with semi-transparency
        ctx.globalAlpha = 0.8;
        ctx.drawImage(
          logo,
          finalCanvas.width - logoWidth - 40, // 40px padding from right
          finalCanvas.height - logoHeight - 40, // 40px padding from bottom
          logoWidth,
          logoHeight
        );
        ctx.globalAlpha = 1.0;

        // Download the final image
        const link = document.createElement('a');
        link.download = 'mindmap.png';
        link.href = finalCanvas.toDataURL('image/png', 1.0);
        link.click();
      };

      logo.onerror = () => {
        // If logo fails to load, just download the original canvas
        const link = document.createElement('a');
        link.download = 'mindmap.png';
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
      };
    }).catch(err => {
      console.error("Error exporting to PNG:", err);
      alert("Could not export to PNG. See console for details.");
    });
  }, [calculateContentBounds]);

  const exportToJSON = useCallback(() => {
    const data = {
      items,
      connections,
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0'
      }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mindmap.json';
    link.click();
    URL.revokeObjectURL(url);
  }, [items, connections]);

  const exportToMarkdown = useCallback(() => {
    let markdown = '# Mind Map\n\n';
    
    // Helper function to get item by id
    const getItem = (id) => items.find(item => item.id === id);
    
    // Create a map of parent-child relationships
    const relationshipMap = new Map();
    connections.forEach(conn => {
      if (!relationshipMap.has(conn.from)) {
        relationshipMap.set(conn.from, []);
      }
      relationshipMap.get(conn.from).push(conn.to);
    });
    
    // Helper function to build markdown tree
    const buildTree = (itemId, level = 0) => {
      const item = getItem(itemId);
      if (!item) return '';
      
      let result = `${'  '.repeat(level)}- ${item.text}\n`;
      const children = relationshipMap.get(itemId) || [];
      children.forEach(childId => {
        result += buildTree(childId, level + 1);
      });
      return result;
    };
    
    // Find root nodes (nodes with no incoming connections)
    const allTargets = new Set(connections.map(conn => conn.to));
    const rootNodes = items.filter(item => !allTargets.has(item.id));
    
    // Build markdown from root nodes
    rootNodes.forEach(root => {
      markdown += buildTree(root.id);
    });
    
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mindmap.md';
    link.click();
    URL.revokeObjectURL(url);
  }, [items, connections]);

  // Function to toggle Saved Boards menu (closes others)
  const toggleSavedBoardsMenu = useCallback(() => {
    setIsSavedBoardsMenuOpen(prev => !prev);
    setIsExportMenuOpen(false); 
    // Close UserMenu if its state was lifted up
  }, []);

  // Function to toggle Export menu (closes others)
  const toggleExportMenu = useCallback(() => {
    setIsExportMenuOpen(prev => !prev);
    setIsSavedBoardsMenuOpen(false);
    // Close UserMenu if its state was lifted up
  }, []);

  // Function to capture canvas as base64 image
  const captureCanvasAsBase64 = useCallback(async () => {
    const contentElement = document.querySelector('.canvas-content');
    if (!contentElement) return null;

    // Calculate bounds including padding
    const bounds = calculateContentBounds();
    const exportPadding = 20;

    try {
      const canvas = await html2canvas(contentElement, {
        backgroundColor: '#f5f5f5',
        x: bounds.x - exportPadding,
        y: bounds.y - exportPadding,
        width: bounds.width + exportPadding * 2,
        height: bounds.height + exportPadding * 2,
        scale: scale,
        useCORS: true,
        onclone: (clonedDoc) => {
          const clonedContent = clonedDoc.querySelector('.canvas-content');
          if (clonedContent) {
            clonedContent.style.transform = 'none';
            const grid = clonedContent.querySelector('.grid-background');
            if (grid) grid.style.display = 'none';
          }
        }
      });

      return canvas.toDataURL('image/png');
    } catch (err) {
      console.error("Error capturing canvas:", err);
      return null;
    }
  }, [calculateContentBounds, scale]);

  const exportToNotion = useCallback(async () => {
    if (!canExport('notion')) {
      setIsPricingOpen(true);
      return;
    }

    try {
      // Get Notion API key from environment or user settings
      const notionApiKey = process.env.REACT_APP_NOTION_API_KEY;
      if (!notionApiKey) {
        alert('Notion API key not configured. Please add it to your settings.');
        return;
      }

      // Create a new page in Notion
      const pageTitle = 'Mind Map Export';
      const pageContent = [];

      // Helper function to get item by id
      const getItem = (id) => items.find(item => item.id === id);

      // Create a map of parent-child relationships
      const relationshipMap = new Map();
      connections.forEach(conn => {
        if (!relationshipMap.has(conn.from)) {
          relationshipMap.set(conn.from, []);
        }
        relationshipMap.get(conn.from).push(conn.to);
      });

      // Find root nodes (nodes with no incoming connections)
      const allTargets = new Set(connections.map(conn => conn.to));
      const rootNodes = items.filter(item => !allTargets.has(item.id));

      // Helper function to build Notion blocks for a node and its children
      const buildNodeBlocks = (itemId, level = 0) => {
        const item = getItem(itemId);
        if (!item) return [];

        const blocks = [];

        // Add the node as a heading
        blocks.push({
          object: 'block',
          type: level === 0 ? 'heading_1' : 'heading_2',
          heading_1: level === 0 ? {
            rich_text: [{
              type: 'text',
              text: { content: item.text }
            }]
          } : undefined,
          heading_2: level > 0 ? {
            rich_text: [{
              type: 'text',
              text: { content: item.text }
            }]
          } : undefined
        });

        // Add item description if exists
        if (item.description) {
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{
                type: 'text',
                text: { content: item.description }
              }]
            }
          });
        }

        // Add children
        const children = relationshipMap.get(itemId) || [];
        children.forEach(childId => {
          blocks.push(...buildNodeBlocks(childId, level + 1));
        });

        return blocks;
      };

      // Build blocks for each root node
      rootNodes.forEach(root => {
        pageContent.push(...buildNodeBlocks(root.id));
      });

      // Create the page
      const response = await createNotionPage(
        notionApiKey,
        null, // No database ID for direct page creation
        pageTitle,
        {
          title: {
            title: [{ text: { content: pageTitle } }]
          }
        },
        (message) => console.log(message)
      );

      if (response) {
        // Add the blocks to the page
        const blocksResponse = await fetch(`${getApiBaseUrl()}/blocks/${response.id}/children`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${notionApiKey}`
          },
          body: JSON.stringify({
            children: pageContent
          })
        });

        if (blocksResponse.ok) {
          alert('Successfully exported mind map to Notion!');
        } else {
          throw new Error('Failed to add blocks to Notion page');
        }
      }
    } catch (err) {
      console.error("Error exporting to Notion:", err);
      alert("Could not export to Notion. See console for details.");
    }
  }, [items, connections, canExport, getApiBaseUrl]);

  const renderExportMenu = () => {
    const currentTier = getCurrentTier();
    
    return (
      <div className="export-menu" style={{
        padding: '8px 0',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        minWidth: '220px'
      }}>
        <button 
          onClick={() => { exportToPNG(); toggleExportMenu(); }}
          className={`export-menu-item ${canExport('png') ? '' : 'disabled'}`}
          disabled={!canExport('png')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '14px',
            color: canExport('png') ? '#333' : '#999',
            ':hover': {
              backgroundColor: canExport('png') ? '#f5f5f5' : 'transparent'
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span style={{ flex: 1 }}>Export as PNG</span>
          {!canExport('png') && <span className="upgrade-note" style={{ fontSize: '12px', color: '#666' }}>Free tier</span>}
        </button>

        <button 
          onClick={() => { exportToPDF(); toggleExportMenu(); }}
          className={`export-menu-item ${canExport('pdf') ? '' : 'disabled'}`}
          disabled={!canExport('pdf')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '14px',
            color: canExport('pdf') ? '#333' : '#999',
            ':hover': {
              backgroundColor: canExport('pdf') ? '#f5f5f5' : 'transparent'
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <span style={{ flex: 1 }}>Export as PDF</span>
          {!canExport('pdf') && <span className="upgrade-note" style={{ fontSize: '12px', color: '#666' }}>Starter tier</span>}
        </button>

        <button 
          onClick={() => { exportToMarkdown(); toggleExportMenu(); }}
          className={`export-menu-item ${canExport('markdown') ? '' : 'disabled'}`}
          disabled={!canExport('markdown')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '14px',
            color: canExport('markdown') ? '#333' : '#999',
            ':hover': {
              backgroundColor: canExport('markdown') ? '#f5f5f5' : 'transparent'
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            <path d="M7 8h10M7 12h4"/>
          </svg>
          <span style={{ flex: 1 }}>Export as Markdown</span>
          {!canExport('markdown') && <span className="upgrade-note" style={{ fontSize: '12px', color: '#666' }}>Starter tier</span>}
        </button>

        <button 
          onClick={() => { exportToJSON(); toggleExportMenu(); }}
          className={`export-menu-item ${canExport('json') ? '' : 'disabled'}`}
          disabled={!canExport('json')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '14px',
            color: canExport('json') ? '#333' : '#999',
            ':hover': {
              backgroundColor: canExport('json') ? '#f5f5f5' : 'transparent'
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <path d="M10 12a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2"/>
            <path d="M14 16a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2"/>
          </svg>
          <span style={{ flex: 1 }}>Export as JSON</span>
          {!canExport('json') && <span className="upgrade-note" style={{ fontSize: '12px', color: '#666' }}>Pro tier</span>}
        </button>

        <button 
          onClick={() => { exportToMM(); toggleExportMenu(); }}
          className={`export-menu-item ${canExport('mm') ? '' : 'disabled'}`}
          disabled={!canExport('mm')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '14px',
            color: canExport('mm') ? '#333' : '#999',
            ':hover': {
              backgroundColor: canExport('mm') ? '#f5f5f5' : 'transparent'
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16 C14.2091 16 16 14.2091 16 12 C16 9.79086 14.2091 8 12 8"/>
            <path d="M12 8 C9.79086 8 8 9.79086 8 12 C8 14.2091 9.79086 16 12 16"/>
          </svg>
          <span style={{ flex: 1 }}>Export as Mind Map (.mm)</span>
          {!canExport('mm') && <span className="upgrade-note" style={{ fontSize: '12px', color: '#666' }}>Pro tier</span>}
        </button>

        <button 
          onClick={() => { exportToFigma(); toggleExportMenu(); }}
          className={`export-menu-item ${canExport('fig') ? '' : 'disabled'}`}
          disabled={!canExport('fig')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '14px',
            color: canExport('fig') ? '#333' : '#999',
            ':hover': {
              backgroundColor: canExport('fig') ? '#f5f5f5' : 'transparent'
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>
            <path d="M12 8h4v4h-4z"/>
            <path d="M8 12h4v4H8z"/>
            <path d="M16 12h4v4h-4z"/>
          </svg>
          <span style={{ flex: 1 }}>Export as Figma (.fig)</span>
          {!canExport('fig') && <span className="upgrade-note" style={{ fontSize: '12px', color: '#666' }}>Pro tier</span>}
        </button>

        <button 
          onClick={() => { exportToNotion(); toggleExportMenu(); }}
          className={`export-menu-item ${canExport('notion') ? '' : 'disabled'}`}
          disabled={!canExport('notion')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '14px',
            color: canExport('notion') ? '#333' : '#999',
            ':hover': {
              backgroundColor: canExport('notion') ? '#f5f5f5' : 'transparent'
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <span style={{ flex: 1 }}>Export to Notion</span>
          {!canExport('notion') && <span className="upgrade-note" style={{ fontSize: '12px', color: '#666' }}>Pro tier</span>}
        </button>
      </div>
    );
  };

  // Add new export functions
  const exportToPDF = useCallback(async () => {
    if (!canExport('pdf')) {
      setIsPricingOpen(true);
      return;
    }

    try {
      const base64Image = await captureCanvasAsBase64();
      if (!base64Image) {
        throw new Error('Failed to capture canvas');
      }

      // Create PDF using jsPDF (you'll need to install this package)
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px'
      });

      // Calculate dimensions
      const imgData = base64Image;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgData;
      });

      // Calculate PDF dimensions while maintaining aspect ratio
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgAspectRatio = img.width / img.height;
      const pdfAspectRatio = pdfWidth / pdfHeight;

      let renderWidth = pdfWidth;
      let renderHeight = pdfWidth / imgAspectRatio;

      if (renderHeight > pdfHeight) {
        renderHeight = pdfHeight;
        renderWidth = pdfHeight * imgAspectRatio;
      }

      // Add the image to PDF
      pdf.addImage(
        imgData,
        'PNG',
        (pdfWidth - renderWidth) / 2, // Center horizontally
        (pdfHeight - renderHeight) / 2, // Center vertically
        renderWidth,
        renderHeight
      );

      // Save the PDF
      pdf.save('mindmap.pdf');
    } catch (err) {
      console.error("Error exporting to PDF:", err);
      alert("Could not export to PDF. See console for details.");
    }
  }, [canExport, captureCanvasAsBase64]);

  const exportToMM = useCallback(() => {
    if (!canExport('mm')) {
      setIsPricingOpen(true);
      return;
    }

    // Create FreeMind-compatible .mm format
    const createMMXML = () => {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<map version="1.0.1">\n';

      // Helper function to escape XML special characters
      const escapeXML = (str) => {
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      };

      // Find root nodes (nodes with no incoming connections)
      const allTargets = new Set(connections.map(conn => conn.to));
      const rootNodes = items.filter(item => !allTargets.has(item.id));

      // Create a map of parent-child relationships
      const relationshipMap = new Map();
      connections.forEach(conn => {
        if (!relationshipMap.has(conn.from)) {
          relationshipMap.set(conn.from, []);
        }
        relationshipMap.get(conn.from).push(conn.to);
      });

      // Recursive function to build XML tree
      const buildNodeXML = (itemId, level = 1) => {
        const item = items.find(i => i.id === itemId);
        if (!item) return '';

        const indent = '  '.repeat(level);
        let nodeXML = `${indent}<node ID="${itemId}" TEXT="${escapeXML(item.text)}">\n`;
        
        // Add children
        const children = relationshipMap.get(itemId) || [];
        children.forEach(childId => {
          nodeXML += buildNodeXML(childId, level + 1);
        });

        nodeXML += `${indent}</node>\n`;
        return nodeXML;
      };

      // Build XML for each root node
      rootNodes.forEach(root => {
        xml += buildNodeXML(root.id);
      });

      xml += '</map>';
      return xml;
    };

    // Generate and download the .mm file
    const mmContent = createMMXML();
    const blob = new Blob([mmContent], { type: 'application/x-freemind' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mindmap.mm';
    link.click();
    URL.revokeObjectURL(url);
  }, [items, connections, canExport]);

  const exportToFigma = useCallback(async () => {
    if (!canExport('fig')) {
      setIsPricingOpen(true);
      return;
    }

    try {
      // Create a Figma-compatible JSON structure
      const figmaData = {
        name: "Mind Map",
        lastModified: new Date().toISOString(),
        schemaVersion: 0,
        documentType: "DESIGN",
        root: {
          id: "0:0",
          name: "Document",
          type: "DOCUMENT",
          children: []
        }
      };

      // Convert mind map items to Figma nodes
      const convertToFigmaNode = (item) => {
        const node = {
          id: item.id,
          name: item.text,
          type: "FRAME",
          children: [],
          absoluteBoundingBox: {
            x: item.position.x,
            y: item.position.y,
            width: item.size.width,
            height: item.size.height
          },
          fills: [{
            type: "SOLID",
            color: {
              r: item.color ? parseInt(item.color.slice(1, 3), 16) / 255 : 1,
              g: item.color ? parseInt(item.color.slice(3, 5), 16) / 255 : 1,
              b: item.color ? parseInt(item.color.slice(5, 7), 16) / 255 : 1,
              a: 1
            }
          }],
          strokes: [{
            type: "SOLID",
            color: { r: 0, g: 0, b: 0, a: 1 }
          }],
          strokeWeight: 1,
          cornerRadius: 4
        };

        // Add text layer
        node.children.push({
          id: `${item.id}_text`,
          name: "Text",
          type: "TEXT",
          characters: item.text,
          style: {
            fontFamily: "Inter",
            fontSize: 16,
            fontWeight: 400,
            lineHeightPx: 24,
            textAlignHorizontal: "CENTER",
            textAlignVertical: "CENTER"
          },
          absoluteBoundingBox: {
            x: item.position.x,
            y: item.position.y,
            width: item.size.width,
            height: item.size.height
          }
        });

        return node;
      };

      // Add all items to the Figma document
      items.forEach(item => {
        figmaData.root.children.push(convertToFigmaNode(item));
      });

      // Convert connections to Figma vector paths
      connections.forEach(connection => {
        const startItem = items.find(item => item.id === connection.start);
        const endItem = items.find(item => item.id === connection.end);
        
        if (startItem && endItem) {
          const startX = startItem.position.x + startItem.size.width / 2;
          const startY = startItem.position.y + startItem.size.height / 2;
          const endX = endItem.position.x + endItem.size.width / 2;
          const endY = endItem.position.y + endItem.size.height / 2;

          figmaData.root.children.push({
            id: connection.id,
            name: "Connection",
            type: "VECTOR",
            vectorPaths: [{
              windingRule: "NONE",
              data: `M ${startX} ${startY} L ${endX} ${endY}`
            }],
            strokes: [{
              type: "SOLID",
              color: { r: 0, g: 0, b: 0, a: 1 }
            }],
            strokeWeight: 1
          });
        }
      });

      // Convert to .fig format (binary)
      const jsonString = JSON.stringify(figmaData);
      const blob = new Blob([jsonString], { type: 'application/figma' });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mindmap.fig';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("Error exporting to Figma:", err);
      alert("Could not export to Figma. See console for details.");
    }
  }, [canExport, items, connections]);

  // Add copy/paste handlers
  const handleCopy = useCallback((e) => {
    // Only handle if there are selected items and we're not in a text input
    if (selectedItems.size > 0 && 
        !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      e.preventDefault();
      
      // Get all selected items
      const itemsToCopy = items
        .filter(item => selectedItems.has(item.id))
        .map(item => ({
          ...item,
          id: undefined, // Remove ID so new ones will be generated on paste
          position: {
            x: item.position.x,
            y: item.position.y
          }
        }));

      // Get connections between selected items
      const connectionsToCopy = connections.filter(conn => 
        selectedItems.has(conn.from) && selectedItems.has(conn.to)
      ).map(conn => ({
        ...conn,
        id: undefined // Remove ID so new ones will be generated on paste
      }));

      // Store in clipboard state
      setClipboardData({
        items: itemsToCopy,
        connections: connectionsToCopy,
        originalPositions: itemsToCopy.map(item => ({ ...item.position }))
      });
    }
  }, [selectedItems, items, connections]);

  const handlePaste = useCallback((e) => {
    // Only handle if we have clipboard data and we're not in a text input
    if (clipboardData && 
        !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      e.preventDefault();

      // Calculate offset from original positions
      const PASTE_OFFSET = 20; // Pixels to offset each paste
      
      // Create new items with offset positions
      const newItems = clipboardData.items.map((item, index) => {
        const newId = Date.now() + index;
        return {
          ...item,
          id: newId,
          position: {
            x: item.position.x + PASTE_OFFSET,
            y: item.position.y + PASTE_OFFSET
          }
        };
      });

      // Create new connections with updated IDs
      const newConnections = clipboardData.connections.map(conn => {
        const fromIndex = clipboardData.items.findIndex(item => item.id === conn.from);
        const toIndex = clipboardData.items.findIndex(item => item.id === conn.to);
        
        return {
          ...conn,
          id: `connection-${Date.now()}-${fromIndex}-${toIndex}`,
          from: newItems[fromIndex].id,
          to: newItems[toIndex].id
        };
      });

      // Update clipboard data with new offset for next paste
      setClipboardData(prev => ({
        ...prev,
        items: prev.items.map(item => ({
          ...item,
          position: {
            x: item.position.x + PASTE_OFFSET,
            y: item.position.y + PASTE_OFFSET
          }
        }))
      }));

      // Add new items and connections to the canvas
      setItems(prevItems => [...prevItems, ...newItems]);
      setConnections(prevConnections => [...prevConnections, ...newConnections]);
      
      // Select newly pasted items
      setSelectedItems(new Set(newItems.map(item => item.id)));
    }
  }, [clipboardData]);

  // Add keyboard shortcut listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if we're in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Copy: Cmd+C (Mac) or Ctrl+C (Windows)
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        handleCopy(e);
      }
      // Paste: Cmd+V (Mac) or Ctrl+V (Windows)
      else if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        handlePaste(e);
      }
      // Space for panning
      else if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
        e.preventDefault();
      }
      // Alt for alternative actions
      else if (e.code === 'AltLeft' || e.code === 'AltRight') {
        setIsAltPressed(true);
        e.preventDefault();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      } else if (e.code === 'AltLeft' || e.code === 'AltRight') {
        setIsAltPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleCopy, handlePaste]);

  const handleGenerateMindMap = async () => {
    setIsGeneratingMindMap(true);
    try {
      // Fetch the Groq API key from Firebase
      if (!user?.uid) {
        throw new Error('Please sign in to generate mind maps');
      }

      const settingsRef = doc(db, 'userSettings', user.uid);
      const settingsSnap = await getDoc(settingsRef);
      
      console.log('Settings document exists:', settingsSnap.exists());
      
      if (!settingsSnap.exists() || !settingsSnap.data().groqApiKey) {
        throw new Error('Please set your Groq API key in Settings first');
      }

      // Get the API key and decrypt it
      const encryptedApiKey = settingsSnap.data().groqApiKey;
      console.log('Retrieved encrypted key type:', typeof encryptedApiKey);
      console.log('Retrieved encrypted key length:', encryptedApiKey.length);
      console.log('Retrieved encrypted key starts with:', encryptedApiKey.substring(0, 10));
      
      let groqApiKey;

      try {
        // Try to decode base64 first (for development environment)
        console.log('Attempting base64 decode...');
        groqApiKey = atob(encryptedApiKey);
        console.log('Successfully decoded base64 API key');
        console.log('Decoded key length:', groqApiKey.length);
        console.log('Decoded key starts with:', groqApiKey.substring(0, 4));
      } catch (e) {
        console.log('Base64 decode failed:', e.message);
        console.log('Attempting to decrypt using Netlify function...');
        // If base64 decode fails, try the decryption endpoint
        const decryptResponse = await fetch(`${getApiBaseUrl()}/decryptApiKey`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            encryptedData: encryptedApiKey
          })
        });

        if (!decryptResponse.ok) {
          console.error('Decryption failed with status:', decryptResponse.status);
          const errorText = await decryptResponse.text();
          console.error('Decryption error:', errorText);
          throw new Error('Failed to decrypt API key');
        }

        const { decrypted } = await decryptResponse.json();
        groqApiKey = decrypted;
        console.log('Successfully decrypted API key');
        console.log('Decrypted key length:', groqApiKey.length);
        console.log('Decrypted key starts with:', groqApiKey.substring(0, 4));
      }

      if (!groqApiKey?.trim()) {
        console.error('API key is empty or only whitespace after decryption');
        throw new Error('Invalid API key format');
      }

      if (!groqApiKey.startsWith('gsk_')) {
        console.error('API key does not start with gsk_');
        throw new Error('Invalid API key format. API key should start with "gsk_"');
      }

      // Create a central node as a circle
      const centralNode = {
        id: Date.now(),
        type: 'circle',
        text: mindMapPrompt,
        position: { 
          x: windowDimensions.width/2 - 75, 
          y: windowDimensions.height/2 - 75 
        },
        width: 150,
        height: 150
      };
      
      // Add the central node
      setItems(prevItems => [...prevItems, centralNode]);
      
      // Model configuration
      const MODEL_ID = 'llama-3.3-70b-versatile';
      console.log('Using Groq model:', MODEL_ID);
      console.log('Model capabilities:', {
        contextWindow: '128K tokens',
        maxCompletionTokens: '32,768 tokens',
        type: 'Production model'
      });
      
      console.log('Making API request with key starting with:', groqApiKey.substring(0, 4));
      console.log('API key length for request:', groqApiKey.length);
      
      // Call Groq API to generate branches
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
          model: MODEL_ID,
          messages: [
            {
              role: 'system',
              content: `You are a mind map generator specializing in creating hierarchical knowledge structures. Follow these guidelines:

1. Central Node (Level 0):
   - This is the main topic provided by the user
   - Treat this as the core concept to expand upon

2. Main Branches (Level 1):
   - Generate 4-6 fundamental aspects or key categories of the central topic
   - These should be broad enough to warrant further exploration
   - Each should represent a distinct facet of the main topic
   - Format: MAIN: [concise label, max 4 words]

3. Sub-Branches (Level 2):
   - For each main branch, generate 2-4 specific sub-topics
   - These should directly elaborate on their parent branch
   - Must be more specific and detailed than the parent
   - Should show clear relationship to both central topic and parent branch
   - Format: SUB: [specific detail, max 6 words]

Format your response as:
MAIN: [Main Branch 1]
SUB: [Sub Branch 1.1 - specific detail]
SUB: [Sub Branch 1.2 - specific detail]

MAIN: [Main Branch 2]
SUB: [Sub Branch 2.1 - specific detail]
SUB: [Sub Branch 2.2 - specific detail]

And so on. Each line must start with either MAIN: or SUB: to indicate the branch type.`
            },
            {
              role: 'user',
              content: `Generate a hierarchical mind map about: ${mindMapPrompt}`
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error Response:', errorData);
        console.error('API Error Status:', response.status);
        console.error('API Error Status Text:', response.statusText);
        throw new Error(errorData.error?.message || 'Failed to generate mind map branches');
      }

      const data = await response.json();
      console.log('Successfully received API response');
      console.log('Model used in response:', data.model);
      console.log('Usage statistics:', data.usage);
      
      const branches = data.choices[0].message.content
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [type, text] = line.split(': ');
          return { type, text: text.trim() };
        });

      console.log('Generated branches count:', branches.length);

      // Calculate positions for branches in a circular layout
      const mainBranches = branches.filter(b => b.type === 'MAIN');
      const radius = Math.min(windowDimensions.width, windowDimensions.height) * 0.2; // 20% of the smaller dimension
      const angleStep = (2 * Math.PI) / mainBranches.length;

      // Add branches and connections
      const newItems = [];
      const newConnections = [];

      mainBranches.forEach((branch, index) => {
        const angle = index * angleStep;
        const dimensions = calculateTextDimensions(branch.text, 'rectangle');
        const mainBranchNode = {
          id: Date.now() + index,
          type: 'rectangle',
          text: branch.text,
          position: {
            x: centralNode.position.x + radius * Math.cos(angle),
            y: centralNode.position.y + radius * Math.sin(angle)
          },
          width: dimensions.width,
          height: dimensions.height
        };

        newItems.push(mainBranchNode);
        newConnections.push({
          id: `connection-${Date.now()}-${index}`,
          from: centralNode.id,
          to: mainBranchNode.id
        });

        // Add sub-branches for this main branch
        const subBranches = branches
          .filter(b => b.type === 'SUB')
          .slice(index * 2, index * 2 + 2); // Get 2 sub-branches for each main branch

        subBranches.forEach((subBranch, subIndex) => {
          const subAngle = angle - 0.3 + (subIndex * 0.6); // Spread sub-branches around main branch
          const subRadius = radius * 0.7; // Place sub-branches closer to main branch
          const subBranchNode = {
            id: Date.now() + index + 1 + (subIndex + 1) * 1000,
            type: 'rectangle',
            text: subBranch.text,
            position: {
              x: mainBranchNode.position.x + subRadius * Math.cos(subAngle),
              y: mainBranchNode.position.y + subRadius * Math.sin(subAngle)
            },
            width: 100,
            height: 60
          };

          newItems.push(subBranchNode);
          newConnections.push({
            id: `connection-${Date.now()}-${index}-${subIndex}`,
            from: mainBranchNode.id,
            to: subBranchNode.id
          });
        });
      });

      setItems(prevItems => [...prevItems, ...newItems]);
      setConnections(prevConnections => [...prevConnections, ...newConnections]);
      
      setIsMindMapPanelOpen(false);
    } catch (error) {
      console.error('Error generating mind map:', error);
      alert(error.message || 'Failed to generate mind map. Please try again.');
    } finally {
      setIsGeneratingMindMap(false);
      setMindMapPrompt('');
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate dimensions based on text content and node type
  const calculateTextDimensions = (text, nodeType = 'rectangle') => {
    // Create a temporary span to measure text
    const span = document.createElement('span');
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'pre-wrap'; // Allow text wrapping
    span.style.maxWidth = '250px'; // Reduced from 300px
    span.style.font = '12px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'; // Reduced from 14px
    span.style.padding = '8px'; // Reduced from 10px
    span.textContent = text;
    document.body.appendChild(span);

    // Get dimensions
    const width = span.offsetWidth;
    const height = span.offsetHeight;

    // Clean up
    document.body.removeChild(span);

    // Different minimum dimensions based on node type
    if (nodeType === 'circle') {
      const size = Math.max(width, height, 120); // Reduced from 150
      return {
        width: size,
        height: size
      };
    }

    // For rectangles and other shapes
    return {
      width: Math.max(width + 30, 100), // Reduced from width + 40, 120
      height: Math.max(height + 16, 32)  // Reduced from height + 20, 40
    };
  };

  useEffect(() => {
    console.log('Canvas dimensions:', {
      width: window.innerWidth,
      height: window.innerHeight,
      scale,
      dpr: window.devicePixelRatio
    });
  }, [scale]);

  const handleResetView = useCallback(() => {
    setScale(1.0);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const handleZoomToFullWidth = useCallback(() => {
    const canvas = document.querySelector('.whiteboard-canvas');
    if (canvas) {
      const { width } = canvas.getBoundingClientRect();
      const newScale = width / 4000; // 4000 is the fixed canvas width
      setScale(newScale);
      setPanOffset({ x: 0, y: panOffset.y }); // Keep the same vertical position
    }
  }, [panOffset.y]);

  const calculateViewportBounds = useCallback(() => {
    const padding = 50;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    if (items.length === 0) {
      // Return default bounds if no items exist
      return { x: 0, y: 0, width: 500, height: 300 };
    }
    
    items.forEach(item => {
      minX = Math.min(minX, item.position.x);
      minY = Math.min(minY, item.position.y);
      maxX = Math.max(maxX, item.position.x + item.width);
      maxY = Math.max(maxY, item.position.y + item.height);
    });
    
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + (padding * 2),
      height: maxY - minY + (padding * 2)
    };
  }, [items]);

  // Find the single selected item
  const selectedItem = items.find(item => selectedItems.size === 1 && selectedItems.has(item.id));

  // Sync colorPicker state to selected item's colors
  useEffect(() => {
    if (selectedItem && selectedItem.type !== 'chart') {
      setColorPicker({
        background: selectedItem.backgroundColor || '#fff740',
        border: selectedItem.borderColor || '#000',
      });
      setTextStyling({
        fontSize: selectedItem.fontSize || 14,
        textColor: selectedItem.textColor || '#000',
        fontFamily: selectedItem.fontFamily || 'Arial',
      });
    }
  }, [selectedItem]);

  // Handler for color change
  const handleColorChange = (color) => {
    if (!selectedItem || selectedItem.type === 'chart') return;
    // Update the selected item's backgroundColor live
    setItems(prevItems => prevItems.map(item =>
      item.id === selectedItem.id
        ? { ...item, backgroundColor: color.hex }
        : item
    ));
    setColorPicker(prev => ({ ...prev, background: color.hex }));
  };

  const handleBorderColorChange = (color) => {
    if (!selectedItem || selectedItem.type === 'chart') return;
    setItems(prevItems => prevItems.map(item =>
      item.id === selectedItem.id
        ? { ...item, borderColor: color.hex }
        : item
    ));
    setColorPicker(prev => ({ ...prev, border: color.hex }));
  };

  // Preselect primary colors
  const preselectColors = [
    '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#000000', '#FFFFFF', 'transparent'
  ];
  const handleSwatchClick = (color) => {
    if (!selectedItem || selectedItem.type === 'chart') return;
    setItems(prevItems => prevItems.map(item =>
      item.id === selectedItem.id
        ? { ...item, backgroundColor: color }
        : item
    ));
    setColorPicker(prev => ({ ...prev, background: color }));
  };

  // Handler for text color change
  const handleTextColorChange = (color) => {
    if (!selectedItem || selectedItem.type === 'chart') return;
    setItems(prevItems => prevItems.map(item =>
      item.id === selectedItem.id
        ? { ...item, textColor: color.hex }
        : item
    ));
    setTextStyling(prev => ({ ...prev, textColor: color.hex }));
  };

  // Handler for font size change
  const handleFontSizeChange = (size) => {
    if (!selectedItem || selectedItem.type === 'chart') return;
    setItems(prevItems => prevItems.map(item =>
      item.id === selectedItem.id
        ? { ...item, fontSize: parseInt(size) }
        : item
    ));
    setTextStyling(prev => ({ ...prev, fontSize: parseInt(size) }));
  };

  // Handler for font family change
  const handleFontFamilyChange = (fontFamily) => {
    if (!selectedItem || selectedItem.type === 'chart') return;
    setItems(prevItems => prevItems.map(item =>
      item.id === selectedItem.id
        ? { ...item, fontFamily: fontFamily }
        : item
    ));
    setTextStyling(prev => ({ ...prev, fontFamily: fontFamily }));
  };

  return (
    <div className={`whiteboard-container ${isSearchPanelOpen ? 'panel-open' : ''}`} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Color Wheel at top right */}
      {selectedItem && selectedItem.type !== 'chart' && (
        <div style={{
          position: 'fixed',
          top: 70,
          right: 20,
          zIndex: 2000,
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          padding: '10px',
          minWidth: 220,
        }}>
          {/* Section Dropdown */}
          <div style={{ marginBottom: '10px' }}>
            <select
              value={activeColorSection}
              onChange={(e) => setActiveColorSection(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '12px',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              <option value="background">Background Color</option>
              <option value="border">Border Color</option>
              <option value="text">Text Styling</option>
            </select>
          </div>

          {/* Background Color Section */}
          {activeColorSection === 'background' && (
            <>
              <div style={{ fontSize: 13, marginBottom: 6 }}>Background Color</div>
              <div style={{
                display: 'flex',
                gap: '4px',
                marginBottom: '10px',
                flexWrap: 'nowrap',
                width: '100%',
                justifyContent: 'center',
                overflowX: 'hidden',
                alignItems: 'center',
                marginLeft: 'auto',
                marginRight: 'auto',
                height: '30px',
                padding: '2px',
                paddingRight: '2px',
              }}>
                {preselectColors.map(color => (
                  <div
                    key={color}
                    onClick={() => handleSwatchClick(color)}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: color === 'transparent'
                        ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 8px 8px'
                        : color,
                      border: '2px solid #eee',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                      outline: colorPicker.background === color ? '2px solid #2196F3' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      flex: '0 0 auto',
                    }}
                  >
                    {color === 'transparent' && (
                      <span style={{
                        color: '#888',
                        fontSize: 10,
                        fontWeight: 700,
                        pointerEvents: 'none',
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>⨉</span>
                    )}
                  </div>
                ))}
              </div>
              <ChromePicker
                color={selectedItem.backgroundColor || colorPicker.background}
                onChange={handleColorChange}
                disableAlpha
              />
            </>
          )}

          {/* Border Color Section */}
          {activeColorSection === 'border' && (
            <>
              <div style={{ fontSize: 13, marginBottom: 6 }}>Border Color</div>
              <div style={{
                display: 'flex',
                gap: '4px',
                marginBottom: '10px',
                flexWrap: 'nowrap',
                width: '100%',
                justifyContent: 'center',
                overflowX: 'hidden',
                alignItems: 'center',
                marginLeft: 'auto',
                marginRight: 'auto',
                height: '30px',
                padding: '2px',
                paddingRight: '2px',
              }}>
                {preselectColors.map(color => (
                  <div
                    key={color + '-border'}
                    onClick={() => {
                      if (!selectedItem) return;
                      setItems(prevItems => prevItems.map(item =>
                        item.id === selectedItem.id
                          ? { ...item, borderColor: color }
                          : item
                      ));
                      setColorPicker(prev => ({ ...prev, border: color }));
                    }}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: color === 'transparent'
                        ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 8px 8px'
                        : color,
                      border: '2px solid #eee',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                      outline: colorPicker.border === color ? '2px solid #2196F3' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      flex: '0 0 auto',
                    }}
                  >
                    {color === 'transparent' && (
                      <span style={{
                        color: '#888',
                        fontSize: 10,
                        fontWeight: 700,
                        pointerEvents: 'none',
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>⨉</span>
                    )}
                  </div>
                ))}
              </div>
              <ChromePicker
                color={selectedItem.borderColor || colorPicker.border}
                onChange={handleBorderColorChange}
                disableAlpha
              />
            </>
          )}

          {/* Text Styling Section */}
          {activeColorSection === 'text' && (
            <>
              <div style={{ fontSize: 13, marginBottom: 6 }}>Text Styling</div>
              
              {/* Font Family Control */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: 11, marginBottom: 4 }}>Font Family</div>
                <select
                  value={textStyling.fontFamily}
                  onChange={(e) => handleFontFamilyChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    fontSize: '12px',
                    background: 'white',
                    cursor: 'pointer',
                  }}
                >
                  <option value="Arial" style={{ fontFamily: 'Arial' }}>Arial</option>
                  <option value="Helvetica" style={{ fontFamily: 'Helvetica' }}>Helvetica</option>
                  <option value="Times New Roman" style={{ fontFamily: 'Times New Roman' }}>Times New Roman</option>
                  <option value="Georgia" style={{ fontFamily: 'Georgia' }}>Georgia</option>
                  <option value="Verdana" style={{ fontFamily: 'Verdana' }}>Verdana</option>
                  <option value="Courier New" style={{ fontFamily: 'Courier New' }}>Courier New</option>
                  <option value="Impact" style={{ fontFamily: 'Impact' }}>Impact</option>
                  <option value="Comic Sans MS" style={{ fontFamily: 'Comic Sans MS' }}>Comic Sans MS</option>
                  <option value="Trebuchet MS" style={{ fontFamily: 'Trebuchet MS' }}>Trebuchet MS</option>
                  <option value="Lucida Console" style={{ fontFamily: 'Lucida Console' }}>Lucida Console</option>
                </select>
              </div>
              
              {/* Font Size Control */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: 11, marginBottom: 4 }}>Font Size: {textStyling.fontSize}px</div>
                <input
                  type="range"
                  min="8"
                  max="48"
                  value={textStyling.fontSize}
                  onChange={(e) => handleFontSizeChange(e.target.value)}
                  style={{
                    width: '100%',
                    height: '4px',
                    borderRadius: '2px',
                    background: '#ddd',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                />
              </div>
              
              {/* Text Color Swatches */}
              <div style={{ fontSize: 11, marginBottom: 4 }}>Text Color</div>
              <div style={{
                display: 'flex',
                gap: '4px',
                marginBottom: '10px',
                flexWrap: 'nowrap',
                width: '100%',
                justifyContent: 'center',
                overflowX: 'hidden',
                alignItems: 'center',
                marginLeft: 'auto',
                marginRight: 'auto',
                height: '30px',
                padding: '2px',
                paddingRight: '2px',
              }}>
                {preselectColors.map(color => (
                  <div
                    key={color + '-text'}
                    onClick={() => {
                      if (!selectedItem || selectedItem.type === 'chart') return;
                      setItems(prevItems => prevItems.map(item =>
                        item.id === selectedItem.id
                          ? { ...item, textColor: color }
                          : item
                      ));
                      setTextStyling(prev => ({ ...prev, textColor: color }));
                    }}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: color === 'transparent'
                        ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 8px 8px'
                        : color,
                      border: '2px solid #eee',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                      outline: textStyling.textColor === color ? '2px solid #2196F3' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      flex: '0 0 auto',
                    }}
                  >
                    {color === 'transparent' && (
                      <span style={{
                        color: '#888',
                        fontSize: 10,
                        fontWeight: 700,
                        pointerEvents: 'none',
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>⨉</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <div className="whiteboard-header">
        <div className="header-left-controls">
          <img 
            src="/logo_and_name.png" 
            alt="MindMap Logo" 
            style={{
              height: '32px',
              marginRight: '16px',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/')}
          />
          <SavedWhiteboardsMenu
            isOpen={isSavedBoardsMenuOpen}
            onToggle={toggleSavedBoardsMenu}
            savedWhiteboards={savedWhiteboards}
            onSave={handleSaveWhiteboard}
            onLoad={handleLoadWhiteboard}
            onDelete={handleDeleteSavedWhiteboard}
            currentWhiteboard={{
              items,
              connections,
              scale,
              panOffset
            }}
          />
          <div className="export-controls">
            <button 
              className="export-button header-button" 
              onClick={toggleExportMenu}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export
            </button>
            {isExportMenuOpen && renderExportMenu()}
          </div>
          <button 
            className="header-button"
            onClick={handleResetBoard}
            title="Clear whiteboard"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
            Reset
          </button>
          <button 
            className="header-button"
            onClick={() => setIsPricingOpen(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Pricing
          </button>
          {/* Temporarily removed community and publish buttons
          <button 
            className="header-button"
            onClick={() => navigate('/community')}
          >
            👥 Community
          </button>
          <button 
            className="header-button"
            onClick={handlePublishClick}
            disabled={isPublishing}
          >
            {isPublishing ? '📤 Publishing...' : '📤 Publish'}
          </button>
          */}
        </div>
        <UserMenu />
      </div>

      <div
        ref={drop}
        className={`whiteboard-canvas ${isPanning ? 'panning' : ''}`}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleCanvasClick}
        style={{
          cursor: isPanning ? 'grabbing' : (isSpacePressed || isAltPressed ? 'grab' : 'default'),
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          height: '100%'
        }}
      >
        <div className="whiteboard-zoom-overlay">
          <div className="zoom-controls">
            <button onClick={() => setScale(s => Math.min(s * 1.1, 4))}>+</button>
            <span>{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.max(s * 0.9, 0.1))}>-</button>
            <button 
              className="home-button" 
              onClick={handleResetView}
              title="Reset view"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </button>
            <button 
              className="full-width-button" 
              onClick={handleZoomToFullWidth}
              title="Zoom to full width"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <div 
              className="viewport-indicator" 
              onClick={(e) => {
                const viewport = e.currentTarget;
                const rect = viewport.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;
                const y = (e.clientY - rect.top) / rect.height;
                
                const canvas = document.querySelector('.whiteboard-canvas');
                if (canvas) {
                  const { width, height } = canvas.getBoundingClientRect();
                  const newPanOffset = {
                    x: -(x * 4000 - width),
                    y: -(y * 4000 - height)
                  };
                  setPanOffset(newPanOffset);
                }
              }}
            >
              <div className="viewport-content" />
              {(() => {
                const canvas = document.querySelector('.whiteboard-canvas');
                if (!canvas) return null;
                
                const { width: canvasWidth, height: canvasHeight } = canvas.getBoundingClientRect();
                const viewportWidth = canvasWidth / scale;
                const viewportHeight = canvasHeight / scale;
                
                // Calculate the viewport position relative to the fixed canvas size
                const viewportX = (-panOffset.x / scale) / 4000;
                const viewportY = (-panOffset.y / scale) / 4000;
                const viewportScaleX = viewportWidth / 4000;
                const viewportScaleY = viewportHeight / 4000;
                
                return (
                  <div 
                    className="viewport-frame"
                    style={{
                      width: `${viewportScaleX * 100}%`,
                      height: `${viewportScaleY * 100}%`,
                      left: `${viewportX * 100}%`,
                      top: `${viewportY * 100}%`
                    }}
                  />
                );
              })()}
            </div>
          </div>
        </div>

        <div className={`whiteboard-controls-overlay ${isInstructionsCollapsed ? 'collapsed' : ''}`}>
          <div className="controls-help">
            <div className="control-tip-container">
              <div className="control-tip">
                <span className="control-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </span>
                Edit - Click the blue pencil button
              </div>
              <div className="control-tip">
                <span className="control-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M7 17L17 7M17 7H7M17 7V17" />
                  </svg>
                </span>
                Connect - Click the green arrow button
              </div>
              <div className="control-tip">
                <span className="control-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </span>
                Expand - Click the purple plus button
              </div>
            </div>
            <div className="control-tip-container">
            <div className="control-tip">
              <span className="keyboard-key">Alt</span> + <span className="mouse-action">Drag</span> or 
              <span className="keyboard-key">Space</span> + <span className="mouse-action">Drag</span> to pan
              <span className="touch-tip">• Use two fingers to pan on touch devices</span>
            </div>
            <div className="control-tip">
              <span className="keyboard-key">SHIFT</span> + <span className="mouse-action">Drag</span> an object to move it
            </div>
            <div className="control-tip">
              Group highlight for AI insights
            </div>
            </div>
          </div>
        </div>

        <div 
          className="canvas-content"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale * (window.devicePixelRatio || 1)})`,
            transformOrigin: '0 0',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '4000px',  // Fixed width instead of percentage
            height: '4000px', // Fixed height instead of percentage
            margin: 0
          }}
        >
          <div className="grid-background" />
          {renderConnections()}
          {connectingFrom && (
            <Connector
              startItem={items.find(item => item.id === connectingFrom)}
              endItem={null}
              isCreating={true}
              mousePosition={mousePosition}
            />
          )}
          {/* Render chart items first (in the back) */}
          {items
            .filter(item => item.type === 'chart')
            .map(item => (
              <WhiteboardItem
                key={item.id}
                item={item}
                updatePosition={updateItemPosition}
                updateSize={updateItemSize}
                updateText={updateItemText}
                isSelected={selectedItems.has(item.id)}
                isConnecting={connectingFrom === item.id}
                isValidTarget={connectingFrom && connectingFrom !== item.id}
                isGroupSelectMode={selectedItems.size > 1}
                isExpanding={expandingItemId === item.id}
                onSelect={(itemId, e) => handleItemClick(itemId, e)}
                onConnectionStart={(itemId) => handleConnectionStart(itemId)}
                onDelete={handleDeleteItem}
                scale={scale}
                onContextMenu={(e) => handleContextMenu(e, item.id)}
                onOrganize={organizeNodes}
                onChartEdit={handleChartEdit}
                isChartEditing={editingChartId === item.id}
              />
            ))}
          {/* Render non-chart items after (in front) */}
          {items
            .filter(item => item.type !== 'chart')
            .map(item => (
              <WhiteboardItem
                key={item.id}
                item={item}
                updatePosition={updateItemPosition}
                updateSize={updateItemSize}
                updateText={updateItemText}
                isSelected={selectedItems.has(item.id)}
                isConnecting={connectingFrom === item.id}
                isValidTarget={connectingFrom && connectingFrom !== item.id}
                isGroupSelectMode={selectedItems.size > 1}
                isExpanding={expandingItemId === item.id}
                onSelect={(itemId, e) => handleItemClick(itemId, e)}
                onConnectionStart={(itemId) => handleConnectionStart(itemId)}
                onDelete={handleDeleteItem}
                scale={scale}
                onContextMenu={(e) => handleContextMenu(e, item.id)}
                onOrganize={organizeNodes}
              />
            ))}
        </div>

        {selectionBox && (
          <div
            className="selection-box"
            style={{
              position: 'absolute',
              left: selectionBox.x * scale * (window.devicePixelRatio || 1) + panOffset.x,
              top: selectionBox.y * scale * (window.devicePixelRatio || 1) + panOffset.y,
              width: selectionBox.width * scale * (window.devicePixelRatio || 1),
              height: selectionBox.height * scale * (window.devicePixelRatio || 1),
              border: '2px solid #007bff',
              backgroundColor: 'rgba(0, 123, 255, 0.1)',
              pointerEvents: 'none',
              zIndex: 1000
            }}
          />
        )}
      </div>

      {/* Right-click notification */}
      {selectedItems.size > 1 && !contextMenu.visible && (
        <div className="right-click-hint">
          ✨ Right-click for options or click and drag to move selected items
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div 
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 2000
          }}
        >
          <div className="context-menu-option" onClick={() => handleContextMenuAction('delete')}>
            🗑️ Delete Selected ({selectedItems.size})
          </div>
          <div className="context-menu-option" onClick={() => handleContextMenuAction('move')}>
            🔄 Move Selected ({selectedItems.size})
          </div>
        </div>
      )}

      {isSearchPanelOpen && (
        <SearchPanel
          highlightedItems={highlightedItems}
          onClose={handleCloseSearchPanel}
        />
      )}

      {/* Chart Config Panel */}
      {editingChartId && (() => {
        const editingChart = items.find(item => item.id === editingChartId);
        if (!editingChart || editingChart.type !== 'chart') return null;
        
        return (
          <ChartConfigPanel
            initialConfig={{
              title: editingChart.title || '',
              xAxisTitle: editingChart.xAxisTitle || '',
              yAxisTitle: editingChart.yAxisTitle || '',
              xAxisUnit: editingChart.xAxisUnit || 1,
              yAxisUnit: editingChart.yAxisUnit || 1,
              xAxisStart: editingChart.xAxisStart || 0,
              yAxisStart: editingChart.yAxisStart || 0,
              xAxisEnd: editingChart.xAxisEnd || 10,
              yAxisEnd: editingChart.yAxisEnd || 10,
              xAxisMode: editingChart.xAxisMode || 'number',
              yAxisMode: editingChart.yAxisMode || 'number',
              xAxisStartDate: editingChart.xAxisStartDate || new Date().toISOString().split('T')[0],
              xAxisEndDate: editingChart.xAxisEndDate || new Date().toISOString().split('T')[0],
              yAxisStartDate: editingChart.yAxisStartDate || new Date().toISOString().split('T')[0],
              yAxisEndDate: editingChart.yAxisEndDate || new Date().toISOString().split('T')[0],
              xAxisCustomValues: editingChart.xAxisCustomValues || [],
              yAxisCustomValues: editingChart.yAxisCustomValues || [],
              showXAxisLabels: editingChart.showXAxisLabels !== false,
              showYAxisLabels: editingChart.showYAxisLabels !== false,
              frequency: editingChart.frequency || 1,
              amplitude: editingChart.amplitude || 1,
              periods: editingChart.periods || 1,
              waveType: editingChart.waveType || 'sine',
              phaseShift: editingChart.phaseShift || 0,
              harmonics: editingChart.harmonics || 1,
              enableModulation: editingChart.enableModulation || false,
              modulationDepth: editingChart.modulationDepth || 0.5,
              chartType: editingChart.chartType
            }}
            onConfigUpdate={(newConfig) => {
              const updatedItem = {
                ...editingChart,
                ...newConfig
              };
              updateItemText(editingChartId, editingChart.text || '', updatedItem);
            }}
            onClose={handleChartEditClose}
            position="right"
          />
        );
      })()}

      {isMindMapPanelOpen && (
        <div className="mind-map-modal-overlay" onClick={handleCloseMindMapPanel}>
          <div className="mind-map-modal" onClick={e => e.stopPropagation()}>
            <div className="mind-map-modal-header">
              <h3>Generate Mind Map</h3>
              <button className="close-button" onClick={handleCloseMindMapPanel}>×</button>
            </div>
            <div className="mind-map-modal-content">
              <div className="mind-map-input-container">
                <label htmlFor="mind-map-prompt">Enter a topic or prompt:</label>
                <textarea
                  id="mind-map-prompt"
                  value={mindMapPrompt}
                  onChange={(e) => setMindMapPrompt(e.target.value)}
                  placeholder="e.g., Artificial Intelligence, Project Planning, etc."
                  rows={4}
                />
              </div>
              <button 
                className="generate-mind-map-button"
                onClick={handleGenerateMindMap}
                disabled={isGeneratingMindMap || !mindMapPrompt.trim()}
              >
                {isGeneratingMindMap ? (
                  <>
                    <span>Generating...</span>
                    <span className="loading-spinner"></span>
                  </>
                ) : (
                  'Generate Mind Map'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <PricingTable 
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
      />

      {/* Temporarily removed publish modal
      <PublishModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        onPublish={handlePublish}
        isPublishing={isPublishing}
      />
      */}

      {/* Add the help toggle button */}
      <button 
        className="help-toggle-button"
        onClick={() => setIsInstructionsCollapsed(!isInstructionsCollapsed)}
        title={isInstructionsCollapsed ? "Show Instructions" : "Hide Instructions"}
      >
        ?
      </button>
    </div>
  );
});

export default WhiteboardCanvas; 