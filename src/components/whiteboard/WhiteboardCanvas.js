import React, { useState, useCallback, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
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
import { useNavigate } from 'react-router-dom';
import { useTierPermissions } from '../../hooks/useTierPermissions';
import { saveBoard, getDemoBoards } from '../../services/boardService';
import { getApiBaseUrl } from '../../utils/api';
import { createNotionPage, writeToNotionDatabase } from './agent/tools/notion';
import { ChromePicker } from 'react-color';

const WhiteboardCanvas = forwardRef((props, ref) => {
  const {
    isMindMapPanelOpen: externalIsMindMapPanelOpen,
    onMindMapPanelClose,
    onMindMapPanelOpen,
    onUpdate,
    onLibraryStateChange
  } = props;

  const [items, setItems] = useState([]);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1.0); // Changed from 0.4 to 1.0 for 100% default zoom
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [connections, setConnections] = useState([]);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const connectionSettingsMenuRef = useRef(null);
  const primaryDraggingItemIdRef = useRef(null);
  const groupDragStartPositionsRef = useRef(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [highlightedItems, setHighlightedItems] = useState([]);
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const [isSearchPanelFullscreen, setIsSearchPanelFullscreen] = useState(false);
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
  const [currentBoardName, setCurrentBoardName] = useState(null);
  const { user } = useAuth();
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [editingChartId, setEditingChartId] = useState(null);
  const [isSavedBoardsMenuOpen, setIsSavedBoardsMenuOpen] = useState(false);
  const [isInstructionsCollapsed, setIsInstructionsCollapsed] = useState(true);
  const navigate = useNavigate();
  const { userTier } = useAuth();
  const { canExport, getCurrentTier } = useTierPermissions();
  // Add clipboard state
  const [clipboardData, setClipboardData] = useState(null);
  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  const [canvasViewSize, setCanvasViewSize] = useState({ width: 0, height: 0 });
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const autoSaveTimeoutRef = useRef(null);
  const isInitialLoadRef = useRef(true);
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
  
  // Add state for footer visibility
  const [showFooter, setShowFooter] = useState(() => {
    const stored = localStorage.getItem('showFooter');
    return stored === null ? true : stored === 'true';
  });
  
  // Add state for zoom overlay visibility (fade-out effect)
  const [zoomOverlayVisible, setZoomOverlayVisible] = useState(true);
  const zoomOverlayTimeoutRef = useRef(null);
  
  // Add undo functionality
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  
  // Add scalar slider for mind map branch distance
  const [branchDistance, setBranchDistance] = useState(0.8); // Default multiplier - more compact

  // Listen for showFooter changes from localStorage
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'showFooter') {
        setShowFooter(e.newValue === 'true');
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events (for same-tab updates)
    const handleShowFooterChange = () => {
      const stored = localStorage.getItem('showFooter');
      setShowFooter(stored === null ? true : stored === 'true');
    };
    
    window.addEventListener('showFooterChanged', handleShowFooterChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('showFooterChanged', handleShowFooterChange);
    };
  }, []);
  
  // Helper function to show zoom overlay and set fade-out timeout
  const showZoomOverlay = useCallback(() => {
    setZoomOverlayVisible(true);
    
    // Clear existing timeout
    if (zoomOverlayTimeoutRef.current) {
      clearTimeout(zoomOverlayTimeoutRef.current);
    }
    
    // Set new timeout to fade out after 2 seconds of inactivity
    zoomOverlayTimeoutRef.current = setTimeout(() => {
      setZoomOverlayVisible(false);
    }, 2000);
  }, []);

  // Initial timeout to fade out overlay after 2 seconds
  useEffect(() => {
    zoomOverlayTimeoutRef.current = setTimeout(() => {
      setZoomOverlayVisible(false);
    }, 2000);
    
    return () => {
      if (zoomOverlayTimeoutRef.current) {
        clearTimeout(zoomOverlayTimeoutRef.current);
      }
    };
  }, []);
  
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
    },
    handleOpenMindMapPanel: () => {
      // Toggle the mind map panel
      // Use external state if provided, otherwise use internal state
      const currentState = externalIsMindMapPanelOpen !== undefined ? externalIsMindMapPanelOpen : isMindMapPanelOpen;
      if (currentState) {
        setIsMindMapPanelOpen(false);
        if (onMindMapPanelClose) {
          onMindMapPanelClose();
        }
      } else {
        setIsMindMapPanelOpen(true);
        if (onMindMapPanelOpen) {
          onMindMapPanelOpen();
        }
      }
    },
    handleOpenSearchPanel: () => {
      // Toggle the search panel
      if (isSearchPanelOpen) {
        setIsSearchPanelOpen(false);
      } else {
        // Only use highlighted items if there are currently selected items
        // Otherwise, clear highlighted items to start fresh
        if (selectedItems.size === 0) {
          setHighlightedItems([]);
        } else {
          // Convert selectedItems Set to array of item objects
          const selectedItemsArray = items.filter(item => selectedItems.has(item.id));
          setHighlightedItems(selectedItemsArray);
        }
        setIsSearchPanelOpen(true);
      }
    },
    handleCloseSearchPanel: () => {
      setIsSearchPanelOpen(false);
      setIsSearchPanelFullscreen(false);
    }
  }), [selectedItems, items, isSearchPanelOpen, isMindMapPanelOpen, externalIsMindMapPanelOpen, onMindMapPanelClose, onMindMapPanelOpen]);

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
    // Don't interfere with control buttons
    if (e.target.closest('.edit-control, .connector-control, .expand-control')) {
      return;
    }
    
    if (e.button === 1 || (e.button === 0 && isSpacePressed) || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y
      });
      e.preventDefault();
    } else if (e.button === 0 && !isSpacePressed && !e.altKey && !e.target.closest('.whiteboard-item') && !e.target.closest('.zoom-controls')) {
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

  // Undo functionality
  const saveState = useCallback(() => {
    const currentState = {
      items: [...items],
      connections: [...connections],
      scale: scale,
      panOffset: { ...panOffset },
      timestamp: Date.now()
    };
    setUndoStack(prev => [...prev, currentState].slice(-20)); // Keep last 20 states
    setRedoStack([]); // Clear redo stack when new action is performed
  }, [items, connections, scale, panOffset]);

  const handleUndo = useCallback(() => {
    if (undoStack.length > 0) {
      const currentState = {
        items: [...items],
        connections: [...connections],
        scale: scale,
        panOffset: { ...panOffset },
        timestamp: Date.now()
      };
      const previousState = undoStack[undoStack.length - 1];
      
      setRedoStack(prev => [...prev, currentState]);
      setUndoStack(prev => prev.slice(0, -1));
      setItems(previousState.items);
      setConnections(previousState.connections);
      setScale(previousState.scale || 1.0);
      setPanOffset(previousState.panOffset || { x: 0, y: 0 });
    }
  }, [undoStack, items, connections, scale, panOffset]);

  const handleRedo = useCallback(() => {
    if (redoStack.length > 0) {
      const currentState = {
        items: [...items],
        connections: [...connections],
        scale: scale,
        panOffset: { ...panOffset },
        timestamp: Date.now()
      };
      const nextState = redoStack[redoStack.length - 1];
      
      setUndoStack(prev => [...prev, currentState]);
      setRedoStack(prev => prev.slice(0, -1));
      setItems(nextState.items);
      setConnections(nextState.connections);
      setScale(nextState.scale || 1.0);
      setPanOffset(nextState.panOffset || { x: 0, y: 0 });
    }
  }, [redoStack, items, connections, scale, panOffset]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat && 
          !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        setIsSpacePressed(true);
        e.preventDefault();
      } else if (e.code === 'AltLeft' || e.code === 'AltRight') {
        setIsAltPressed(true);
        e.preventDefault();
      } else if (e.ctrlKey && e.key === 'z' && !e.shiftKey && 
          !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        e.preventDefault();
        handleUndo();
      } else if (e.ctrlKey && e.key === 'y' && 
          !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        e.preventDefault();
        handleRedo();
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
  }, [handleUndo, handleRedo]);

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

        const maxOrder = items.length > 0 ? Math.max(...items.map((i, idx) => i.order !== undefined ? i.order : idx)) : -1;
        const newItem = {
          id: Date.now(),
          type: item.type,
          chartType: item.chartType,
          position,
          width,
          height,
          text: item.type === 'sticky' ? 'New note' : '',
          order: maxOrder + 1,
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
        saveState();
        setItems(prevItems => [...prevItems, newItem]);
      }
      return undefined;
    }
  }), [scale, panOffset]);

  const handleWheel = useCallback((e) => {
    // Enable scroll zoom without requiring Ctrl key
    e.preventDefault();
    showZoomOverlay(); // Show zoom overlay when zooming
    const delta = e.deltaY > 0 ? 0.9 : 1.1; // Scroll down = zoom out (0.9), scroll up = zoom in (1.1)
    setScale(s => {
      const newScale = Math.min(Math.max(0.1, s * delta), 4); // Restored max zoom to 4 for better zoom range
      return newScale;
    });
  }, [showZoomOverlay]);

  const updateItemPosition = useCallback((id, position) => {
    setItems(items.map(item => 
      item.id === id 
        ? { ...item, position } 
        : item
    ));
  }, [items]);

  const updateItemSize = useCallback((id, size) => {
    setItems(items.map(item =>
      item.id === id
        ? { ...item, ...size }
        : item
    ));
  }, [items]);

  const updateItemText = useCallback((id, text, updatedItem) => {
    saveState(); // Save state before text change
    setItems(items.map(item =>
      item.id === id
        ? updatedItem || { ...item, text }  // Use updatedItem if provided, otherwise just update text
        : item
    ));
  }, [items, saveState]);

  const handleConnectionStart = (itemId) => {
    setConnectingFrom(itemId);
    setSelectedItems(new Set([itemId]));
  };

  const handleItemClick = (itemId, e) => {
    // Close connection settings menu when clicking on an item
    if (selectedConnection) {
      // Don't close if clicking inside the menu or on color picker
      if (connectionSettingsMenuRef.current && 
          !connectionSettingsMenuRef.current.contains(e.target)) {
        const chromePickerElement = document.querySelector('.chrome-picker');
        if (!chromePickerElement || !chromePickerElement.contains(e.target)) {
          setSelectedConnection(null);
        }
      }
    }
    
    if (connectingFrom) {
      if (connectingFrom !== itemId) {
        saveState(); // Save state before creating connection
        const defaults = getDefaultConnectionSettings();
        const newConnection = {
          id: `connection-${Date.now()}`,
          from: connectingFrom,
          to: itemId,
          color: defaults.color,
          strokeWidth: defaults.strokeWidth,
          lineType: defaults.lineType,
          lineDesign: defaults.lineDesign || 'curved',
          arrowDirection: defaults.arrowDirection,
          arrowHeadStyle: defaults.arrowHeadStyle
        };
        setConnections(prev => [...prev, newConnection]);
        setConnectingFrom(null);
      }
    } else {
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
        } else {
          if (!e?.shiftKey) {
            newSet.clear();
          }
          newSet.add(itemId);
        }
        return newSet;
      });
      setSelectedConnection(null); // Deselect connection when selecting item
    }
  };

  const handleDeleteItem = (itemId) => {
    saveState();
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
      saveState(); // Save state before reset
      setItems([]);
      setConnections([]);
      setSelectedItems(new Set());
      setConnectingFrom(null);
      setEditingChartId(null);
      setExpandingItemId(null);
      setContextMenu({ visible: false, x: 0, y: 0 });
      setPanOffset({ x: 0, y: 0 });
      setScale(1.0);
      setCurrentBoardName(null);
    }
  };

  const handleNewCanvas = () => {
    // Clear everything and reset to a fresh canvas
      setItems([]);
      setConnections([]);
      setSelectedItems(new Set());
      setConnectingFrom(null);
      setEditingChartId(null);
      setExpandingItemId(null);
      setContextMenu({ visible: false, x: 0, y: 0 });
      setPanOffset({ x: 0, y: 0 });
      setScale(1.0);
      setCurrentBoardId(null);
      setCurrentBoardName(null);
      setIsAutoSaving(false);
      setLastSaveTime(null);
      isInitialLoadRef.current = true;
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      // Clear undo/redo stacks
      setUndoStack([]);
      setRedoStack([]);
      // Navigate to a fresh whiteboard URL (without boardId)
      navigate('/whiteboard');
  };

  const handleDeleteConnection = useCallback((connectionId) => {
    saveState(); // Save state before deletion
    setConnections(prev => prev.filter(conn => conn.id !== connectionId));
  }, [saveState]);

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
    
    saveState(); // Save state before organizing
    setItems(newItems);
  };

  // Get default connection settings from localStorage
  const getDefaultConnectionSettings = useCallback(() => {
    try {
      const saved = localStorage.getItem('defaultConnectionSettings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      // Ignore parsing errors, use defaults
    }
    // Return defaults if nothing saved
    return {
      color: '#2196F3',
      strokeWidth: 2,
      lineType: 'straight',
      lineDesign: 'curved',
      arrowDirection: '->',
      arrowHeadStyle: 'medium'
    };
  }, []);

  // Save default connection settings to localStorage
  const saveDefaultConnectionSettings = useCallback((settings) => {
    try {
      localStorage.setItem('defaultConnectionSettings', JSON.stringify(settings));
    } catch (e) {
      // Ignore saving errors
    }
  }, []);

  const handleConnectionClick = useCallback((connectionId, e) => {
    e?.stopPropagation();
    setSelectedConnection(connectionId);
    setSelectedItems(new Set()); // Deselect items when selecting connection
  }, []);

  const handleUpdateConnection = useCallback((connectionId, updates) => {
    // Check if this is the first update for this connection in the current operation
    const connection = connections.find(c => c.id === connectionId);
    if (!connection) return;
    
    // Save state only if this is a significant change (not just color/stroke changes that might be rapid)
    // For now, save state on all updates - we can optimize later if needed
    saveState();
    
    setConnections(prev => {
      const updated = prev.map(conn => {
        if (conn.id === connectionId) {
          const newConn = { ...conn };
          // Apply updates
          if (updates.strokeWidth !== undefined) {
            newConn.strokeWidth = Number(updates.strokeWidth);
          }
          if (updates.color !== undefined) {
            newConn.color = updates.color;
          }
          if (updates.lineType !== undefined) {
            newConn.lineType = updates.lineType;
          }
          if (updates.lineDesign !== undefined) {
            newConn.lineDesign = updates.lineDesign;
          }
          if (updates.arrowDirection !== undefined) {
            newConn.arrowDirection = updates.arrowDirection;
          }
          if (updates.arrowHeadStyle !== undefined) {
            newConn.arrowHeadStyle = updates.arrowHeadStyle;
          }
          return newConn;
        }
        return conn;
      });
      return updated;
    });
  }, [connections, saveState]);

  const renderConnections = useCallback(() => {
    return connections.map(connection => {
      // Use loose comparison to handle string/number ID mismatches
      const startItem = items.find(item => String(item.id) === String(connection.from));
      const endItem = items.find(item => String(item.id) === String(connection.to));
      
      if (!startItem || !endItem) {
        return null;
      }

      // Create a fresh connection object to ensure React detects changes
      const connectionProps = {
        ...connection,
        strokeWidth: Number(connection.strokeWidth) || 2,
        color: connection.color || '#2196F3',
        lineType: connection.lineType || 'straight',
        lineDesign: connection.lineDesign || 'curved',
        arrowDirection: connection.arrowDirection || '->',
        arrowHeadStyle: connection.arrowHeadStyle || 'medium'
      };
      
      // Use connection properties in key to force re-render when they change
      return (
        <Connector
          key={`conn-${connection.id}-${connectionProps.strokeWidth}-${connectionProps.color}-${connectionProps.lineType}-${connectionProps.lineDesign}-${connectionProps.arrowDirection}-${connectionProps.arrowHeadStyle}`}
          startItem={startItem}
          endItem={endItem}
          connection={connectionProps}
          isSelected={selectedConnection === connection.id}
          onSelect={(e) => handleConnectionClick(connection.id, e)}
          onDelete={() => handleDeleteConnection(connection.id)}
        />
      );
    });
  }, [connections, items, selectedConnection]);

  useEffect(() => {
    // Load demo boards from Firebase
    const loadDemoBoards = async () => {
      try {
        const boards = await getDemoBoards();
        setSavedWhiteboards(boards);
      } catch (error) {
        console.error('Error loading demo boards:', error);
        // Fallback to localStorage if Firebase fails
        const saved = localStorage.getItem('savedWhiteboards');
        if (saved) {
          try {
            setSavedWhiteboards(JSON.parse(saved));
          } catch (e) {
            console.error('Error parsing localStorage boards:', e);
          }
        }
      }
    };
    
    loadDemoBoards();
  }, []);

  // Sync Library state with parent
  useEffect(() => {
    if (onLibraryStateChange) {
      onLibraryStateChange(isSavedBoardsMenuOpen);
    }
  }, [isSavedBoardsMenuOpen, onLibraryStateChange]);

  // Close connection settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectedConnection && connectionSettingsMenuRef.current) {
        // Check if click is inside the menu
        if (connectionSettingsMenuRef.current.contains(event.target)) {
          return; // Don't close if clicking inside menu
        }
        
        // Check if clicking on ChromePicker (react-color creates a portal outside the menu)
        const chromePickerElement = document.querySelector('.chrome-picker');
        if (chromePickerElement && chromePickerElement.contains(event.target)) {
          return; // Don't close if clicking on color picker
        }
        
        // Check if clicking on the connection line itself (should not close)
        const clickedElement = event.target;
        if (clickedElement.closest('.connector') || 
            clickedElement.closest('path') || 
            clickedElement.tagName === 'svg' ||
            clickedElement.closest('svg')) {
          return; // Don't close if clicking on connection
        }
        
        // Close for all other clicks (canvas, items, etc.)
        setSelectedConnection(null);
      }
    };

    if (selectedConnection) {
      // Use both mousedown and click events to catch all interactions
      // Use a slight delay to avoid immediate closing when opening the menu
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside, true);
        document.addEventListener('click', handleClickOutside, true);
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside, true);
        document.removeEventListener('click', handleClickOutside, true);
      };
    }
  }, [selectedConnection]);

  const handleSaveWhiteboard = async (name) => {
    try {
      if (!user) {
        throw new Error('Please sign in to save whiteboards');
      }
      
      // Helper function to remove undefined values from objects
      const removeUndefinedFromObject = (obj) => {
        if (obj === null || obj === undefined) return null;
        if (Array.isArray(obj)) {
          return obj.map(removeUndefinedFromObject);
        }
        if (typeof obj === 'object') {
          const cleaned = {};
          for (const key in obj) {
            if (obj[key] !== undefined) {
              cleaned[key] = removeUndefinedFromObject(obj[key]);
            }
          }
          return cleaned;
        }
        return obj;
      };

      // Process all items, with special handling for images
      let processedItems = [];
      if (items.length > 0) {
        // Only verify storage if there are items
        const storage = getStorage();
        if (!storage) {
          throw new Error('Storage is not initialized');
        }

        processedItems = await Promise.all(items.map(async (item) => {
          let cleanedItem = { ...item };
          
          if (item.type === 'image') {
            // All images should already be uploaded and have a storageRef
            if (!item.storageRef) {
              // If image URL exists but no storageRef, keep the imageUrl
              if (!item.imageUrl) {
                throw new Error('Invalid image item: missing both storage reference and image URL');
              }
              // Continue with just the imageUrl if available
            } else {
              // Verify the existing image is still accessible
              try {
                const storage = getStorage();
                const imageRef = storageRef(storage, item.storageRef);
                const downloadUrl = await getDownloadURL(imageRef);
                
                // Update the URL in case it has changed
                cleanedItem.imageUrl = downloadUrl;
              } catch (error) {
                // If imageUrl exists, use it as fallback
                if (item.imageUrl) {
                  cleanedItem.imageUrl = item.imageUrl;
                } else {
                  throw new Error(`Failed to verify existing image: ${error.message}`);
                }
              }
            }
          }
          
          // Remove undefined values from the item
          cleanedItem = removeUndefinedFromObject(cleanedItem);
          return cleanedItem;
        }));
      }

      // Prepare data for Firestore
      // Clean connections and preserve customization properties
      const cleanedConnections = (connections || []).map(conn => {
        const cleaned = {
          id: String(conn.id || `connection-${Date.now()}`),
          from: String(conn.from),
          to: String(conn.to),
          // Always save customization properties (use defaults if not set)
          color: String(conn.color || '#2196F3'),
          strokeWidth: Number(conn.strokeWidth || 2),
          lineType: String(conn.lineType || 'straight'),
          lineDesign: String(conn.lineDesign || 'curved'),
          arrowDirection: String(conn.arrowDirection || '->'),
          arrowHeadStyle: String(conn.arrowHeadStyle || 'medium')
        };
        return cleaned;
      });

      const boardData = {
        name: name || currentBoardName || 'Untitled Board',
        userId: user.uid,
        savedAt: serverTimestamp(),
        content: {
          items: processedItems,
          connections: cleanedConnections,
          scale: Number(scale || 1),
          panOffset: {
            x: Number(panOffset?.x || 0),
            y: Number(panOffset?.y || 0)
          }
        }
      };

      // Include board ID if updating existing board
      if (currentBoardId) {
        boardData.id = currentBoardId;
      }

      // Save to Firestore
      const savedBoard = await saveBoard(boardData, user.uid);
      
      // Update state only after everything is saved
      setItems(processedItems);
      setCurrentBoardId(savedBoard.id);
      setCurrentBoardName(savedBoard.name);
      setShowSaveDialog(false);
      
      return savedBoard;
    } catch (error) {
      throw error; // Re-throw to be handled by the caller
    }
  };

  const handleLoadWhiteboard = async (boardId) => {
    try {
      const boardDoc = await getDoc(doc(db, 'boards', boardId));
      
      if (!boardDoc.exists()) {
        throw new Error('Board not found');
      }

      const boardData = boardDoc.data();
      
      // Check if this is a demo board (userId is null)
      const isDemoBoard = boardData.userId === null;
      
      // For non-demo boards, require authentication
      if (!isDemoBoard && !user) {
        throw new Error('Please sign in to load your boards');
      }

      if (!boardData.content) {
        throw new Error('Invalid board data: missing content');
      }

      // Process items to restore image URLs
      const processedItems = await Promise.all(boardData.content.items.map(async (item) => {
        if (item.type === 'image') {
          if (!item.storageRef) {
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

              return {
                ...item,
                imageUrl,
                loadError: null,
                errorOverlay: false
              };

            } catch (error) {
              lastError = error;

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

      // Update state with loaded data
      setItems(processedItems);
      
      // Load connections with all properties properly converted
      // Note: Item IDs might be numbers or strings, so we need to match them properly
      const loadedConnections = (boardData.content.connections || []).map(conn => {
        // Convert from/to to match item ID type (items might have number or string IDs)
        const fromId = conn.from;
        const toId = conn.to;
        
        // Find the actual item IDs to match against
        const fromItem = processedItems.find(item => String(item.id) === String(fromId));
        const toItem = processedItems.find(item => String(item.id) === String(toId));
        
        // Use the actual item ID (preserving type) if item exists, otherwise use the connection value
        const cleaned = {
          id: String(conn.id || `connection-${Date.now()}`),
          from: fromItem ? fromItem.id : (typeof fromId === 'number' ? fromId : Number(fromId) || fromId),
          to: toItem ? toItem.id : (typeof toId === 'number' ? toId : Number(toId) || toId),
          color: String(conn.color || '#2196F3'),
          strokeWidth: Number(conn.strokeWidth || 2),
          lineType: String(conn.lineType || 'straight'),
          lineDesign: String(conn.lineDesign || 'curved'),
          arrowDirection: String(conn.arrowDirection || '->'),
          arrowHeadStyle: String(conn.arrowHeadStyle || 'medium')
        };
        return cleaned;
      });
      setConnections(loadedConnections);
      setScale(boardData.content.scale || 1);
      setPanOffset(boardData.content.panOffset || { x: 0, y: 0 });
      
      // If it's a demo board, clear currentBoardId so saving creates a new board
      // isDemoBoard was already determined above
      if (isDemoBoard) {
        setCurrentBoardId(null);
        // Set a name that indicates it's a copy of a demo board
        setCurrentBoardName(boardData.name ? `${boardData.name} (Copy)` : 'Demo Board (Copy)');
      } else {
        setCurrentBoardId(boardId);
        setCurrentBoardName(boardData.name || null);
      }
      
      // Mark that we just loaded, so we don't auto-save immediately
      isInitialLoadRef.current = true;
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 2000); // Wait 2 seconds after load before allowing auto-save

    } catch (error) {
      throw error; // Re-throw to be handled by the caller
    }
  };

  // Auto-save function for existing boards
  const autoSave = useCallback(async () => {
    if (!user || !currentBoardId || !currentBoardName || isInitialLoadRef.current) {
      return;
    }

    try {
      setIsAutoSaving(true);
      
      // Helper function to remove undefined values from objects
      const removeUndefinedFromObject = (obj) => {
        if (obj === null || obj === undefined) return null;
        if (Array.isArray(obj)) {
          return obj.map(removeUndefinedFromObject);
        }
        if (typeof obj === 'object') {
          const cleaned = {};
          for (const key in obj) {
            if (obj[key] !== undefined) {
              cleaned[key] = removeUndefinedFromObject(obj[key]);
            }
          }
          return cleaned;
        }
        return obj;
      };

      // Process all items, with special handling for images
      let processedItems = [];
      if (items.length > 0) {
        const storage = getStorage();
        if (!storage) {
          return;
        }

        processedItems = await Promise.all(items.map(async (item) => {
          let cleanedItem = { ...item };
          
          if (item.type === 'image') {
            if (!item.storageRef) {
              if (!item.imageUrl) {
                return cleanedItem; // Skip invalid images during auto-save
              }
            } else {
              try {
                const storage = getStorage();
                const imageRef = storageRef(storage, item.storageRef);
                const downloadUrl = await getDownloadURL(imageRef);
                cleanedItem.imageUrl = downloadUrl;
              } catch (error) {
                if (item.imageUrl) {
                  cleanedItem.imageUrl = item.imageUrl;
                }
              }
            }
          }
          
          cleanedItem = removeUndefinedFromObject(cleanedItem);
          return cleanedItem;
        }));
      }

      // Clean connections
      const cleanedConnections = (connections || []).map(conn => {
        return {
          id: String(conn.id || `connection-${Date.now()}`),
          from: String(conn.from),
          to: String(conn.to),
          color: String(conn.color || '#2196F3'),
          strokeWidth: Number(conn.strokeWidth || 2),
          lineType: String(conn.lineType || 'straight'),
          lineDesign: String(conn.lineDesign || 'curved'),
          arrowDirection: String(conn.arrowDirection || '->'),
          arrowHeadStyle: String(conn.arrowHeadStyle || 'medium')
        };
      });

      // Don't save viewport (scale, panOffset) in auto-save to avoid saving on every view change
      const boardData = {
        id: currentBoardId,
        name: currentBoardName,
        userId: user.uid,
        savedAt: serverTimestamp(),
        content: {
          items: processedItems,
          connections: cleanedConnections,
          // Viewport changes are not auto-saved - they're only saved on manual save
        }
      };

      await saveBoard(boardData, user.uid);
      setLastSaveTime(new Date());
    } catch (error) {
      // Silently fail for auto-save - don't interrupt user workflow
    } finally {
      setIsAutoSaving(false);
    }
  }, [user, currentBoardId, currentBoardName, items, connections]);

  // Auto-save effect - debounced (only for items and connections, not viewport changes)
  useEffect(() => {
    if (!currentBoardId || isInitialLoadRef.current) {
      return;
    }

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save (2 seconds after last change)
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 2000);

    // Cleanup
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [items, connections, currentBoardId, autoSave]);

  const handleDeleteSavedWhiteboard = (boardId) => {
    const updatedBoards = savedWhiteboards.filter(b => b.id !== boardId);
    setSavedWhiteboards(updatedBoards);
    localStorage.setItem('savedWhiteboards', JSON.stringify(updatedBoards));
    if (currentBoardId === boardId) {
      setCurrentBoardId(null);
      setCurrentBoardName(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cancel connection on Escape
      if (e.key === 'Escape' && connectingFrom) {
        e.preventDefault();
        e.stopPropagation();
        setConnectingFrom(null);
        setSelectedItems(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [connectingFrom]);

  // Add image item event listener
  useEffect(() => {
    const handleAddImageItem = (e) => {
      const newItemId = Date.now();
      setItems(prevItems => {
        const newItem = {
          ...e.detail,
          id: newItemId,
          order: prevItems.length > 0 ? Math.max(...prevItems.map((i, idx) => i.order !== undefined ? i.order : idx)) + 1 : 0
        };
        return [...prevItems, newItem];
      });
      setSelectedItems(new Set([newItemId]));
    };

    window.addEventListener('addImageItem', handleAddImageItem);
    return () => window.removeEventListener('addImageItem', handleAddImageItem);
  }, []);

  const handleCanvasClick = (e) => {
    // Close connection settings menu if clicking on canvas (but not on menu or color picker)
    if (selectedConnection && connectionSettingsMenuRef.current) {
      if (!connectionSettingsMenuRef.current.contains(e.target)) {
        const chromePickerElement = document.querySelector('.chrome-picker');
        if (!chromePickerElement || !chromePickerElement.contains(e.target)) {
          setSelectedConnection(null);
        }
      }
    }
    
    // Don't clear connection if clicking on control buttons or connector paths
    if (e.target.closest('.edit-control, .connector-control, .expand-control, .resize-handle')) {
      return;
    }
    // Don't clear if clicking on a connector path
    if (e.target.tagName === 'path' && e.target.closest('.connector')) {
      return;
    }
    if (e.target === e.currentTarget && !e.target.closest('.zoom-controls')) {
      setSelectedItems(new Set());
      setSelectedConnection(null);
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
      case 'bringForward':
      case 'pushBackward':
      case 'bringToFront':
      case 'pushToBack':
        if (selectedItems.size === 1) {
          const itemId = Array.from(selectedItems)[0];
          const currentItem = items.find(item => item.id === itemId);
          if (!currentItem) break;
          
          // Initialize order if not present (use index as fallback)
          const itemsWithOrder = items.map((item, index) => ({
            ...item,
            order: item.order !== undefined ? item.order : index
          }));
          
          // Sort items by order to determine layering
          const sortedItems = [...itemsWithOrder].sort((a, b) => a.order - b.order);
          const currentIndex = sortedItems.findIndex(item => item.id === itemId);
          
          if (currentIndex === -1) break;
          
          let newOrder;
          switch (action) {
            case 'bringForward':
              // Swap with the item directly in front (if exists)
              if (currentIndex < sortedItems.length - 1) {
                const nextItem = sortedItems[currentIndex + 1];
                newOrder = nextItem.order;
                // Swap orders: move next item back
                setItems(itemsWithOrder.map(item => 
                  item.id === nextItem.id ? { ...item, order: sortedItems[currentIndex].order } :
                  item.id === itemId ? { ...item, order: newOrder } : item
                ));
              }
              break;
            case 'pushBackward':
              // Swap with the item directly behind (if exists)
              if (currentIndex > 0) {
                const prevItem = sortedItems[currentIndex - 1];
                newOrder = prevItem.order;
                // Swap orders: move prev item forward
                setItems(itemsWithOrder.map(item => 
                  item.id === prevItem.id ? { ...item, order: sortedItems[currentIndex].order } :
                  item.id === itemId ? { ...item, order: newOrder } : item
                ));
              }
              break;
            case 'bringToFront':
              // Move to the highest order
              const maxOrder = Math.max(...itemsWithOrder.map(item => item.order));
              newOrder = maxOrder + 1;
              setItems(itemsWithOrder.map(item => 
                item.id === itemId ? { ...item, order: newOrder } : item
              ));
              break;
            case 'pushToBack':
              // Move to the lowest order
              const minOrder = Math.min(...itemsWithOrder.map(item => item.order));
              newOrder = minOrder - 1;
              setItems(itemsWithOrder.map(item => 
                item.id === itemId ? { ...item, order: newOrder } : item
              ));
              break;
            default:
              break;
          }
        }
        break;
      default:
        break;
    }
    setContextMenu({ visible: false, x: 0, y: 0 });
  };

  const updateMultipleItemPositions = useCallback((dx, dy) => {
    if (selectedItems.size <= 1) return;

    // Use stored original positions if available (from when drag started), otherwise use current
    const basePositions = groupDragStartPositionsRef.current || items.reduce((positions, item) => {
      if (selectedItems.has(item.id)) {
        positions[item.id] = { ...item.position };
      }
      return positions;
    }, {});

    // Calculate grid-aligned deltas
    const alignedDx = Math.round(dx / 10) * 10;
    const alignedDy = Math.round(dy / 10) * 10;
    
    // Only update if there's actual movement
    if (alignedDx === 0 && alignedDy === 0) return;

    requestAnimationFrame(() => {
      setItems(prevItems => 
        prevItems.map(item => {
          if (selectedItems.has(item.id) && basePositions[item.id]) {
            const basePosition = basePositions[item.id];
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
          e.preventDefault();
          e.stopPropagation();
          setConnectingFrom(null);
          setSelectedItems(new Set());
        }
      }
      
      // Handle Delete/Backspace for group selection
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItems.size > 0) {
        // Check if target is an input, textarea, or if the search panel is open
        const isEditingText = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
        const isInSearchPanel = document.querySelector('.search-panel') && 
                                document.querySelector('.search-panel').contains(e.target);
        const isInAgentChat = document.querySelector('.agent-chat') && 
                              document.querySelector('.agent-chat').contains(e.target);
        
        // Only delete if not editing text and not in search panel or agent chat
        if (!isEditingText && !isInSearchPanel && !isInAgentChat) {
          e.preventDefault();
          e.stopPropagation();
          
          // Delete all selected items
          saveState();
          const updatedItems = items.filter(item => !selectedItems.has(item.id));
          setItems(updatedItems);
          
          // Also delete connections involving selected items
          const updatedConnections = connections.filter(conn => 
            !selectedItems.has(conn.from) && !selectedItems.has(conn.to)
          );
          setConnections(updatedConnections);
          
          // Close chart editing if a deleted item was being edited
          if (editingChartId && selectedItems.has(editingChartId)) {
            setEditingChartId(null);
          }
          
          // Clear selection
          setSelectedItems(new Set());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase for priority
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [connectingFrom, contextMenu.visible, selectedItems, items, connections, saveState, editingChartId]);

  // Set up global function for moving selected items
  useEffect(() => {
    // Function to move all selected items
    window.moveSelectedItems = (dx, dy, itemId) => {
      // Only allow the primary dragger to move items
      if (primaryDraggingItemIdRef.current === null || primaryDraggingItemIdRef.current === itemId) {
        updateMultipleItemPositions(dx, dy);
      }
    };

    // Function to register the primary dragger and store original positions
    window.startGroupDrag = (itemId) => {
      // If another item is already the primary dragger, don't allow this one
      if (primaryDraggingItemIdRef.current !== null && primaryDraggingItemIdRef.current !== itemId) {
        return false;
      }
      primaryDraggingItemIdRef.current = itemId;
      // Store original positions of all selected items
      groupDragStartPositionsRef.current = items.reduce((positions, item) => {
        if (selectedItems.has(item.id)) {
          positions[item.id] = { ...item.position };
        }
        return positions;
      }, {});
      return true;
    };

    // Function to clear the primary dragger
    window.endGroupDrag = () => {
      primaryDraggingItemIdRef.current = null;
      groupDragStartPositionsRef.current = null;
    };

    // Clean up the global functions on unmount
    return () => {
      window.moveSelectedItems = undefined;
      window.startGroupDrag = undefined;
      window.endGroupDrag = undefined;
    };
  }, [updateMultipleItemPositions, selectedItems, items]);

  // Function to find the path from a node back to the central node
  const findPathToCentralNode = useCallback((startItemId) => {
    const path = [];
    const visited = new Set();
    const itemMap = new Map(items.map(item => [item.id, item]));
    
    // Helper function to find parent connections (nodes that connect TO this node)
    // Also check bidirectional connections (where this node is the 'from')
    const findParentConnections = (itemId) => {
      const parents = [];
      connections.forEach(conn => {
        // If this node is the target, the other node is the parent
        if (conn.to === itemId) {
          parents.push(conn.from);
        }
        // Also check if there's a reverse connection (bidirectional)
        // We'll prefer the 'to' connection as it's more likely hierarchical
      });
      return parents;
    };
    
    // Traverse backwards from the starting node
    let currentItemId = startItemId;
    
    while (currentItemId && !visited.has(currentItemId)) {
      visited.add(currentItemId);
      const currentItem = itemMap.get(currentItemId);
      
      if (currentItem) {
        path.unshift(currentItem); // Add to beginning of path
        
        // Check if this is the central node (type 'circle')
        if (currentItem.type === 'circle') {
          // This is the central node
          break;
        }
        
        // Find parent connections
        const parentIds = findParentConnections(currentItemId);
        if (parentIds.length === 0) {
          // No parent found, stop here (might be disconnected or already at root)
          break;
        }
        
        // Move to the first parent
        currentItemId = parentIds[0];
      } else {
        break;
      }
    }
    
    return path;
  }, [items, connections]);

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
        
        // Find the path from this item back to the central node
        const pathToCentral = findPathToCentralNode(itemId);
        
        // Build context string from the path
        let contextString = '';
        if (pathToCentral.length > 1) {
          // If we have a path, build context from central node to current item
          const pathTexts = pathToCentral.map(item => item.text || '');
          contextString = `This concept is part of the following hierarchy:\n${pathTexts.join(' → ')}\n\n`;
        } else if (pathToCentral.length === 1) {
          // Only the current item, no path found
          contextString = `Expanding the concept: ${text}\n\n`;
        }

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
                content: `You are an expert at identifying key related concepts. When given a concept within a hierarchical context, generate exactly 5 closely related ideas or aspects that help expand understanding of the original concept.

Guidelines:
- Generate exactly 5 related concepts, no more and no less
- Each concept should be 2-4 words long
- Make each concept clear and specific
- Ensure direct relevance to the original topic within its hierarchical context
- Use professional, field-appropriate terminology
- Avoid generic or redundant information
- Consider the full context path from central node to this concept when generating related ideas
- The expanded concepts should fit naturally within the existing hierarchy

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
                content: `${contextString}Generate 5 key related concepts for: ${text}`
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

        const baseOrder = items.length > 0 ? Math.max(...items.map((i, idx) => i.order !== undefined ? i.order : idx)) : -1;
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
            height: dimensions.height,
            order: baseOrder + 1 + i
          };

          newItems.push(newItem);
          const defaults = getDefaultConnectionSettings();
          newConnections.push({
            id: `connection-${Date.now()}-${i}`,
            from: itemId,
            to: newItem.id,
            color: defaults.color,
            strokeWidth: defaults.strokeWidth,
            lineType: defaults.lineType,
            lineDesign: defaults.lineDesign || 'curved',
            arrowDirection: defaults.arrowDirection,
            arrowHeadStyle: defaults.arrowHeadStyle
          });
        });

        // Update state with new items and connections
        setItems(prevItems => [...prevItems, ...newItems]);
        setConnections(prevConnections => [...prevConnections, ...newConnections]);

      } catch (error) {
        alert(error.message || 'Failed to expand concept. Please try again.');
      } finally {
        setExpandingItemId(null);
        setIsExpandingConcept(false);
      }
    };

    return () => {
      window.expandSelectedConcept = undefined;
    };
  }, [items, user, getApiBaseUrl, findPathToCentralNode]);

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
      alert("Could not export to PNG.");
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
    setIsSavedBoardsMenuOpen(prev => {
      const newState = !prev;
      if (onLibraryStateChange) {
        onLibraryStateChange(newState);
      }
      return newState;
    });
    setIsExportMenuOpen(false); 
    // Close UserMenu if its state was lifted up
  }, [onLibraryStateChange]);

  // Function to toggle Export menu (closes others)
  const toggleExportMenu = useCallback(() => {
    setIsExportMenuOpen(prev => !prev);
    setIsSavedBoardsMenuOpen(false);
    if (onLibraryStateChange) {
      onLibraryStateChange(false);
    }
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
      return null;
    }
  }, [calculateContentBounds, scale]);

  const exportToNotion = useCallback(async () => {
    if (!canExport('notion')) {
      navigate('/pricing');
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
          }
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
      alert("Could not export to Notion.");
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
      navigate('/pricing');
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
      alert("Could not export to PDF.");
    }
  }, [canExport, captureCanvasAsBase64]);

  const exportToMM = useCallback(() => {
    if (!canExport('mm')) {
      navigate('/pricing');
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
      navigate('/pricing');
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
      alert("Could not export to Figma.");
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

  // Enhanced collision detection function with better overlap verification
  const checkCollision = (pos1, dim1, item2, margin = 10) => {
    const pos2 = item2.position;
    const dim2 = { width: item2.width, height: item2.height };
    
    // Calculate bounding boxes with margins
    const box1 = {
      left: pos1.x - margin,
      right: pos1.x + dim1.width + margin,
      top: pos1.y - margin,
      bottom: pos1.y + dim1.height + margin
    };
    
    const box2 = {
      left: pos2.x,
      right: pos2.x + dim2.width,
      top: pos2.y,
      bottom: pos2.y + dim2.height
    };
    
    // Check for overlap with more precise calculation
    const horizontalOverlap = !(box1.right < box2.left || box1.left > box2.right);
    const verticalOverlap = !(box1.bottom < box2.top || box1.top > box2.bottom);
    
    return horizontalOverlap && verticalOverlap;
  };

  // Function to regenerate mind map with new branch distance
  const regenerateMindMapWithNewDistance = (centralNode, mindMapItems, newDistance) => {
    // Find all items connected to the central node (main branches)
    const mainBranches = items.filter(item => 
      item.id !== centralNode.id && 
      connections.some(conn => 
        (conn.from === centralNode.id && conn.to === item.id) ||
        (conn.to === centralNode.id && conn.from === item.id)
      )
    );
    
    if (mainBranches.length === 0) {
      return;
    }
    
    // Find all sub-branches (items connected to main branches)
    const subBranches = items.filter(item => 
      item.id !== centralNode.id && 
      !mainBranches.some(main => main.id === item.id) &&
      connections.some(conn => 
        mainBranches.some(main => 
          (conn.from === main.id && conn.to === item.id) ||
          (conn.to === main.id && conn.from === item.id)
        )
      )
    );
    
    // Remove all connected items and their connections
    const allConnectedItems = [...mainBranches, ...subBranches];
    const connectedItemIds = allConnectedItems.map(item => item.id);
    
    setItems(prevItems => prevItems.filter(item => !connectedItemIds.includes(item.id)));
    setConnections(prevConnections => 
      prevConnections.filter(conn => 
        !connectedItemIds.includes(conn.from) && !connectedItemIds.includes(conn.to)
      )
    );
    
    // Regenerate with new distance
    setTimeout(() => {
      // Calculate new positions with updated distance (using viewport-relative sizing)
      const canvasEl2 = document.querySelector('.whiteboard-canvas');
      const canvasBounds2 = canvasEl2.getBoundingClientRect();
      const viewportWidth = canvasBounds2.width;
      const viewportHeight = canvasBounds2.height;
      
      const baseRadius = Math.min(viewportWidth, viewportHeight) * 0.12; // 12% of viewport for better user experience
      const radius = Math.max(baseRadius, 200) * newDistance; // Reduced minimum for better viewport fit
      const angleStep = (2 * Math.PI) / mainBranches.length;
      
      const newItems = [];
      const newConnections = [];
      
      // Reposition main branches
      mainBranches.forEach((branch, index) => {
        const angle = index * angleStep;
        const dimensions = calculateTextDimensions(branch.text, 'rectangle');
        
        let currentRadius = radius;
        let position = {
          x: centralNode.position.x + currentRadius * Math.cos(angle) - dimensions.width / 2,
          y: centralNode.position.y + currentRadius * Math.sin(angle) - dimensions.height / 2
        };
        
        // Enhanced collision detection with better spacing and symmetry
        const minSpacing = 50;
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
          let hasCollision = false;
          
          for (const existingItem of newItems) {
            if (checkCollision(position, dimensions, existingItem, minSpacing)) {
              hasCollision = true;
              break;
            }
          }
          
          if (!hasCollision) break;
          
          const radiusIncrement = 40 + (attempts * 15);
          currentRadius += radiusIncrement;
          position = {
            x: centralNode.position.x + currentRadius * Math.cos(angle) - dimensions.width / 2,
            y: centralNode.position.y + currentRadius * Math.sin(angle) - dimensions.height / 2
          };
          attempts++;
        }
        
        const mainBranchNode = {
          ...branch,
          position,
          width: dimensions.width,
          height: dimensions.height
        };
        
        newItems.push(mainBranchNode);
        const defaults = getDefaultConnectionSettings();
        newConnections.push({
          from: centralNode.id,
          to: mainBranchNode.id,
          id: `connection-${centralNode.id}-${mainBranchNode.id}`,
          color: defaults.color,
          strokeWidth: defaults.strokeWidth,
          lineType: defaults.lineType,
          lineDesign: defaults.lineDesign || 'curved',
          arrowDirection: defaults.arrowDirection,
          arrowHeadStyle: defaults.arrowHeadStyle
        });
        
        // Now reposition sub-branches for this main branch
        const subBranchesForThisMain = subBranches.filter(subBranch => 
          connections.some(conn => 
            (conn.from === branch.id && conn.to === subBranch.id) ||
            (conn.to === branch.id && conn.from === subBranch.id)
          )
        );
        
        if (subBranchesForThisMain.length > 0) {
          const subRadius = radius * 0.6; // Sub-branches are closer to main branches
          const subAngleOffset = 0.3; // Angle offset for sub-branches
          const subAngleStep = (2 * Math.PI) / subBranchesForThisMain.length;
          
          subBranchesForThisMain.forEach((subBranch, subIndex) => {
            const subAngle = angle + (subIndex * subAngleStep - Math.PI / 2) * subAngleOffset;
            const subDimensions = calculateTextDimensions(subBranch.text, 'rectangle');
            
            let subCurrentRadius = subRadius;
            let subPosition = {
              x: mainBranchNode.position.x + subCurrentRadius * Math.cos(subAngle) - subDimensions.width / 2,
              y: mainBranchNode.position.y + subCurrentRadius * Math.sin(subAngle) - subDimensions.height / 2
            };
            
            // Enhanced collision detection for sub-branches
            const subMinSpacing = 35;
            let subAttempts = 0;
            const subMaxAttempts = 8;
            
            while (subAttempts < subMaxAttempts) {
              let hasCollision = false;
              
              for (const existingItem of newItems) {
                if (checkCollision(subPosition, subDimensions, existingItem, subMinSpacing)) {
                  hasCollision = true;
                  break;
                }
              }
              
              if (!hasCollision) break;
              
              const subRadiusIncrement = 25 + (subAttempts * 8);
              subCurrentRadius += subRadiusIncrement;
              subPosition = {
                x: mainBranchNode.position.x + subCurrentRadius * Math.cos(subAngle) - subDimensions.width / 2,
                y: mainBranchNode.position.y + subCurrentRadius * Math.sin(subAngle) - subDimensions.height / 2
              };
              subAttempts++;
            }
            
            const subBranchNode = {
              ...subBranch,
              position: subPosition,
              width: subDimensions.width,
              height: subDimensions.height
            };
            
            newItems.push(subBranchNode);
            const subDefaults = getDefaultConnectionSettings();
            newConnections.push({
              from: mainBranchNode.id,
              to: subBranchNode.id,
              id: `connection-${mainBranchNode.id}-${subBranchNode.id}`,
              color: subDefaults.color,
              strokeWidth: subDefaults.strokeWidth,
              lineType: subDefaults.lineType,
              lineDesign: subDefaults.lineDesign || 'curved',
              arrowDirection: subDefaults.arrowDirection,
              arrowHeadStyle: subDefaults.arrowHeadStyle
            });
          });
        }
      });
      
      
      // Add new items and connections
      setItems(prevItems => [...prevItems, ...newItems]);
      setConnections(prevConnections => [...prevConnections, ...newConnections]);
    }, 100);
  };

  const handleGenerateMindMap = async () => {
    setIsGeneratingMindMap(true);
    try {
      // Fetch the Groq API key from Firebase
      if (!user?.uid) {
        throw new Error('Please sign in to generate mind maps');
      }

      const settingsRef = doc(db, 'userSettings', user.uid);
      const settingsSnap = await getDoc(settingsRef);
      
      if (!settingsSnap.exists() || !settingsSnap.data().groqApiKey) {
        throw new Error('Please set your Groq API key in Settings first');
      }

      // Get the API key and decrypt it
      const encryptedApiKey = settingsSnap.data().groqApiKey;
      
      let groqApiKey;

      try {
        // Try to decode base64 first (for development environment)
        groqApiKey = atob(encryptedApiKey);
      } catch (e) {
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
          throw new Error('Failed to decrypt API key');
        }

        const { decrypted } = await decryptResponse.json();
        groqApiKey = decrypted;
      }

      if (!groqApiKey?.trim()) {
        throw new Error('Invalid API key format');
      }

      if (!groqApiKey.startsWith('gsk_')) {
        throw new Error('Invalid API key format. API key should start with "gsk_"');
      }

      // Create a central node at the user's current viewport center (user-friendly positioning)
      const canvasEl = document.querySelector('.whiteboard-canvas');
      const canvasBounds = canvasEl.getBoundingClientRect();
      const viewportCenterX = (canvasBounds.width / 2 - panOffset.x) / scale;
      const viewportCenterY = (canvasBounds.height / 2 - panOffset.y) / scale;
      
      const centralNode = {
        id: Date.now(),
        type: 'circle',
        text: mindMapPrompt,
        position: { 
          x: viewportCenterX - 75, // Center of current viewport minus half width
          y: viewportCenterY - 75  // Center of current viewport minus half height
        },
        width: 150,
        height: 150
      };
      
      // Add the central node
      setItems(prevItems => [...prevItems, centralNode]);
      
      // Model configuration
      const MODEL_ID = 'llama-3.3-70b-versatile';
      
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
   - Generate exactly 4 fundamental aspects or key categories of the central topic
   - These should be broad enough to warrant further exploration
   - Each should represent a distinct facet of the main topic
   - Format: MAIN: [concise label, max 4 words]

3. Sub-Branches (Level 2):
   - For each main branch, generate exactly 2 specific sub-topics
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

MAIN: [Main Branch 3]
SUB: [Sub Branch 3.1 - specific detail]
SUB: [Sub Branch 3.2 - specific detail]

MAIN: [Main Branch 4]
SUB: [Sub Branch 4.1 - specific detail]
SUB: [Sub Branch 4.2 - specific detail]

You must generate exactly 4 MAIN branches, and exactly 2 SUB branches for each MAIN branch. Each line must start with either MAIN: or SUB: to indicate the branch type.`
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
        throw new Error(errorData.error?.message || 'Failed to generate mind map branches');
      }

      const data = await response.json();
      
      // Improved parsing with better error handling
      const rawContent = data.choices[0].message.content;
      const branches = rawContent
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const trimmed = line.trim();
          // Handle both "MAIN:" and "SUB:" patterns, also handle cases with extra spaces
          if (trimmed.startsWith('MAIN:')) {
            const text = trimmed.substring(5).trim().replace(/^\[|\]$/g, '').trim();
            return { type: 'MAIN', text: text || 'Main Branch' };
          } else if (trimmed.startsWith('SUB:')) {
            const text = trimmed.substring(4).trim().replace(/^\[|\]$/g, '').trim();
            return { type: 'SUB', text: text || 'Sub Branch' };
          }
          return null;
        })
        .filter(b => b !== null && b.text);

      // Validate we got the expected structure
      const mainBranches = branches.filter(b => b.type === 'MAIN');
      const subBranches = branches.filter(b => b.type === 'SUB');
      
      if (mainBranches.length === 0) {
        throw new Error('No main branches found in response. Please try again.');
      }
      
      if (mainBranches.length !== 4) {
        console.warn(`Expected 4 main branches, got ${mainBranches.length}`);
      }
      
      if (subBranches.length !== mainBranches.length * 2) {
        console.warn(`Expected ${mainBranches.length * 2} sub branches, got ${subBranches.length}`);
      }
      
      // Group sub-branches with their parent main branches
      // The format should be: MAIN, SUB, SUB, MAIN, SUB, SUB, etc.
      const groupedBranches = [];
      let currentMainIndex = -1;
      
      for (const branch of branches) {
        if (branch.type === 'MAIN') {
          currentMainIndex++;
          groupedBranches.push({
            main: branch,
            subs: []
          });
        } else if (branch.type === 'SUB' && currentMainIndex >= 0) {
          if (groupedBranches[currentMainIndex].subs.length < 2) {
            groupedBranches[currentMainIndex].subs.push(branch);
          }
        }
      }
      
      // Use only the groups that have both main and at least one sub
      const validGroups = groupedBranches.filter(g => g.main && g.subs.length > 0);
      
      if (validGroups.length === 0) {
        throw new Error('Failed to parse mind map structure. Please try again.');
      }
      
      // User-friendly viewport-relative layout
      const canvasEl3 = document.querySelector('.whiteboard-canvas');
      if (!canvasEl3) {
        throw new Error('Canvas element not found');
      }
      const canvasBounds3 = canvasEl3.getBoundingClientRect();
      const viewportWidth = canvasBounds3.width;
      const viewportHeight = canvasBounds3.height;
      
      const baseRadius = Math.min(viewportWidth, viewportHeight) * 0.15; // 15% of viewport for better visibility
      const radius = Math.max(baseRadius, 250) * branchDistance; // Ensure minimum radius for visibility
      const angleStep = (2 * Math.PI) / validGroups.length;

      // Add branches and connections
      const newItems = [];
      const newConnections = [];

      // Use the central node's center position (not top-left)
      const centralNodeCenterX = centralNode.position.x + (centralNode.width || 150) / 2;
      const centralNodeCenterY = centralNode.position.y + (centralNode.height || 150) / 2;

      validGroups.forEach((group, index) => {
        const branch = group.main;
        const angle = index * angleStep - Math.PI / 2; // Start from top (-π/2)
        const dimensions = calculateTextDimensions(branch.text, 'rectangle');
        
        // Calculate optimal position with smart spacing
        let currentRadius = radius;
        let position = {
          x: centralNodeCenterX + currentRadius * Math.cos(angle) - dimensions.width / 2,
          y: centralNodeCenterY + currentRadius * Math.sin(angle) - dimensions.height / 2
        };
        
        // Enhanced collision detection with better spacing and symmetry
        const minSpacing = 60; // Increased minimum spacing for better separation
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
          let hasCollision = false;
          
          // Check collision with all existing items using enhanced detection
          for (const existingItem of newItems) {
            if (checkCollision(position, dimensions, existingItem, minSpacing)) {
              hasCollision = true;
              break;
            }
          }
          
          if (!hasCollision) break;
          
          // Increase radius with better progression to maintain symmetry
          const radiusIncrement = 50 + (attempts * 20); // More aggressive radius increase
          currentRadius += radiusIncrement;
          position = {
            x: centralNodeCenterX + currentRadius * Math.cos(angle) - dimensions.width / 2,
            y: centralNodeCenterY + currentRadius * Math.sin(angle) - dimensions.height / 2
          };
          attempts++;
        }
        
        // Improved positioning with better spacing
        const mainBranchNode = {
          id: Date.now() + index * 1000,
          type: 'rectangle',
          text: branch.text,
          position: position,
          width: dimensions.width,
          height: dimensions.height
        };

        newItems.push(mainBranchNode);
        const defaults = getDefaultConnectionSettings();
        newConnections.push({
          id: `connection-${Date.now()}-${index}`,
          from: centralNode.id,
          to: mainBranchNode.id,
          color: defaults.color,
          strokeWidth: defaults.strokeWidth,
          lineType: defaults.lineType,
          lineDesign: defaults.lineDesign || 'curved',
          arrowDirection: defaults.arrowDirection,
          arrowHeadStyle: defaults.arrowHeadStyle
        });

        // Use the grouped sub-branches
        const subBranches = group.subs;

        // Calculate main branch center
        const mainBranchCenterX = mainBranchNode.position.x + mainBranchNode.width / 2;
        const mainBranchCenterY = mainBranchNode.position.y + mainBranchNode.height / 2;
        
        subBranches.forEach((subBranch, subIndex) => {
          const subDimensions = calculateTextDimensions(subBranch.text, 'rectangle');
          
          // Calculate sub-branch position relative to main branch center
          // Position them along the line from central node to main branch
          const subRadius = Math.max(120, currentRadius * 0.5); // Minimum 120px spacing
          const subAngleOffset = (subIndex - 0.5) * 0.4; // Spread sub-branches
          const subAngle = angle + subAngleOffset;
          
          // Calculate initial sub-branch position relative to main branch center
          let subPosition = {
            x: mainBranchCenterX + subRadius * Math.cos(subAngle) - subDimensions.width / 2,
            y: mainBranchCenterY + subRadius * Math.sin(subAngle) - subDimensions.height / 2
          };
          
          // Enhanced collision detection for sub-branches
          const subMinSpacing = 40; // Increased minimum spacing for sub-branches
          let subAttempts = 0;
          const subMaxAttempts = 8;
          let subCurrentRadius = subRadius;
          
          while (subAttempts < subMaxAttempts) {
            let hasCollision = false;
            
            // Check collision with all existing items using enhanced detection
            for (const existingItem of newItems) {
              if (checkCollision(subPosition, subDimensions, existingItem, subMinSpacing)) {
                hasCollision = true;
                break;
              }
            }
            
            if (!hasCollision) break;
            
            // Increase sub-radius with better progression
            const subRadiusIncrement = 30 + (subAttempts * 10); // More aggressive radius increase
            subCurrentRadius += subRadiusIncrement;
            subPosition = {
              x: mainBranchCenterX + subCurrentRadius * Math.cos(subAngle) - subDimensions.width / 2,
              y: mainBranchCenterY + subCurrentRadius * Math.sin(subAngle) - subDimensions.height / 2
            };
            subAttempts++;
          }
          
          const subBranchNode = {
            id: Date.now() + index * 10000 + (subIndex + 1) * 1000,
            type: 'rectangle',
            text: subBranch.text,
            position: subPosition,
            width: subDimensions.width,
            height: subDimensions.height
          };

          newItems.push(subBranchNode);
          const subDefaults = getDefaultConnectionSettings();
          newConnections.push({
            id: `connection-${Date.now()}-${index}-${subIndex}`,
            from: mainBranchNode.id,
            to: subBranchNode.id,
            color: subDefaults.color,
            strokeWidth: subDefaults.strokeWidth,
            lineType: subDefaults.lineType,
            lineDesign: subDefaults.lineDesign || 'curved',
            arrowDirection: subDefaults.arrowDirection,
            arrowHeadStyle: subDefaults.arrowHeadStyle
          });
        });
      });

      // Validate that we created nodes
      if (newItems.length === 0) {
        throw new Error('No nodes were created. Please try again.');
      }

      // Ensure all nodes have valid positions
      const validItems = newItems.filter(item => 
        item.position && 
        typeof item.position.x === 'number' && 
        typeof item.position.y === 'number' &&
        !isNaN(item.position.x) && 
        !isNaN(item.position.y)
      );

      if (validItems.length !== newItems.length) {
        console.warn(`Some nodes had invalid positions. Created ${validItems.length} out of ${newItems.length} nodes.`);
      }

      // Add nodes and connections to canvas
      setItems(prevItems => [...prevItems, ...validItems]);
      setConnections(prevConnections => [...prevConnections, ...newConnections]);
      
      // Center view on the mind map after a short delay to ensure rendering
      setTimeout(() => {
        if (centralNode && centralNode.position) {
          // Pan to center the view on the central node
          const canvasEl = document.querySelector('.whiteboard-canvas');
          if (canvasEl) {
            const canvasBounds = canvasEl.getBoundingClientRect();
            const targetX = -centralNode.position.x * scale + canvasBounds.width / 2;
            const targetY = -centralNode.position.y * scale + canvasBounds.height / 2;
            setPanOffset({ x: targetX, y: targetY });
          }
        }
      }, 100);
      
      setIsMindMapPanelOpen(false);
    } catch (error) {
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

  // Calculate current view size
  useEffect(() => {
    const updateViewSize = () => {
      const canvas = document.querySelector('.whiteboard-canvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const viewWidth = rect.width / scale;
        const footerHeight = showFooter ? 15 : 0;
        const viewHeight = (rect.height - footerHeight) / scale;
        setCanvasViewSize({ width: viewWidth, height: viewHeight });
      }
    };

    updateViewSize();
    const interval = setInterval(updateViewSize, 100); // Update every 100ms

    const handleResize = () => {
      updateViewSize();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, [scale, windowDimensions]);

  // Calculate dimensions based on text content and node type
  const calculateTextDimensions = (text, nodeType = 'rectangle') => {
    // Create a temporary span to measure text
    const span = document.createElement('span');
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.style.maxWidth = '250px'; // Increased max width to prevent squishing
    span.style.font = '13px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    span.style.padding = '10px 14px'; // Better padding to prevent squishing
    span.style.lineHeight = '1.4'; // Optimal line spacing for readability
    span.style.textAlign = 'center'; // Center text in nodes
    span.style.fontWeight = '500'; // Slightly bolder for better visibility
    span.style.whiteSpace = 'nowrap'; // Prevent text wrapping to avoid squishing
    span.textContent = text;
    document.body.appendChild(span);

    // Get dimensions with proper sizing to prevent squishing
    const naturalWidth = span.scrollWidth; // Get natural width without constraints
    const naturalHeight = span.scrollHeight; // Get natural height
    const width = Math.max(naturalWidth + 20, 140); // Natural width + padding, minimum 140px
    const height = Math.max(naturalHeight + 10, 40); // Natural height + padding, minimum 40px

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


  const handleResetView = useCallback(() => {
    showZoomOverlay();
    setScale(1.0);
    setPanOffset({ x: 0, y: 0 });
  }, [showZoomOverlay]);

  const handleZoomToFullWidth = useCallback(() => {
    showZoomOverlay();
    const canvas = document.querySelector('.whiteboard-canvas');
    if (canvas) {
      const { width } = canvas.getBoundingClientRect();
      const newScale = width / 4000; // 4000 is the fixed canvas width
      setScale(newScale);
      setPanOffset({ x: 0, y: panOffset.y }); // Keep the same vertical position
    }
  }, [panOffset.y, showZoomOverlay]);

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
      {/* Connection Edit Menu at top right */}
      {selectedConnection && !isSearchPanelOpen && (() => {
        const connection = connections.find(c => c.id === selectedConnection);
        if (!connection) return null;
        
        // Use key to force re-render when connection properties change
        const connectionKey = `${connection.id}-${connection.strokeWidth || 2}-${connection.color || '#2196F3'}`;
        
        return (
          <div 
            ref={connectionSettingsMenuRef}
            key={connectionKey}
            style={{
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
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: '10px' }}>Connection Settings</div>
            
            {/* Connection Color */}
            <div style={{ marginBottom: '15px' }}>
              <div style={{ fontSize: 13, marginBottom: 6 }}>Color</div>
              <div style={{
                display: 'flex',
                gap: '4px',
                marginBottom: '10px',
                flexWrap: 'nowrap',
                width: '100%',
                justifyContent: 'center',
                overflowX: 'hidden',
                alignItems: 'center',
                height: '30px',
                padding: '2px',
              }}>
                {['#2196F3', '#4CAF50', '#FF9800', '#F44336', '#9C27B0', '#00BCD4', '#FFC107', '#607D8B'].map(color => (
                  <div
                    key={color}
                    onClick={() => handleUpdateConnection(selectedConnection, { color })}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: color,
                      border: '2px solid #eee',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                      outline: connection.color === color ? '2px solid #2196F3' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      flex: '0 0 auto',
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ boxShadow: 'none' }}>
                  <ChromePicker
                    color={connection.color || '#2196F3'}
                    onChange={(color) => handleUpdateConnection(selectedConnection, { color: color.hex })}
                    disableAlpha
                    styles={{
                      default: {
                        picker: {
                          boxShadow: 'none'
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Stroke Width */}
            <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ fontSize: 13 }}>Stroke Width</div>
              <select
                value={Number(connection.strokeWidth) || 2}
                onChange={(e) => {
                  const newWidth = parseInt(e.target.value, 10);
                  handleUpdateConnection(selectedConnection, { strokeWidth: newWidth });
                }}
                style={{
                  flex: '0 0 auto',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '12px',
                  background: 'white',
                  cursor: 'pointer',
                  minWidth: '80px',
                }}
              >
                <option value="1">1px</option>
                <option value="2">2px</option>
                <option value="3">3px</option>
                <option value="4">4px</option>
              </select>
            </div>

            {/* Line Type */}
            <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ fontSize: 13 }}>Line Type</div>
              <select
                value={connection.lineType || 'straight'}
                onChange={(e) => {
                  handleUpdateConnection(selectedConnection, { lineType: e.target.value });
                }}
                style={{
                  flex: '0 0 auto',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '12px',
                  background: 'white',
                  cursor: 'pointer',
                  minWidth: '120px',
                }}
              >
                <option value="straight">Straight</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
            </div>

            {/* Line Design */}
            <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ fontSize: 13 }}>Line Design</div>
              <select
                value={connection.lineDesign || 'curved'}
                onChange={(e) => {
                  handleUpdateConnection(selectedConnection, { lineDesign: e.target.value });
                }}
                style={{
                  flex: '0 0 auto',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '12px',
                  background: 'white',
                  cursor: 'pointer',
                  minWidth: '120px',
                }}
              >
                <option value="sharp">Sharp</option>
                <option value="curved">Curved</option>
                <option value="orthogonal">90° Cuts</option>
              </select>
            </div>

            {/* Arrow Direction */}
            <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ fontSize: 13 }}>Arrow Direction</div>
              <select
                value={connection.arrowDirection || '->'}
                onChange={(e) => {
                  handleUpdateConnection(selectedConnection, { arrowDirection: e.target.value });
                }}
                style={{
                  flex: '0 0 auto',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '12px',
                  background: 'white',
                  cursor: 'pointer',
                  minWidth: '140px',
                }}
              >
                <option value="->">→ (End only)</option>
                <option value="<-">← (Start only)</option>
                <option value="<->">↔ (Both ends)</option>
              </select>
            </div>

            {/* Arrow Head Style */}
            <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ fontSize: 13 }}>Arrow Head Style</div>
              <select
                value={connection.arrowHeadStyle || 'medium'}
                onChange={(e) => {
                  handleUpdateConnection(selectedConnection, { arrowHeadStyle: e.target.value });
                }}
                style={{
                  flex: '0 0 auto',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '12px',
                  background: 'white',
                  cursor: 'pointer',
                  minWidth: '120px',
                }}
              >
                <option value="spear">Spear</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>

            {/* Save as Default Button */}
            <button
              onClick={() => {
                const settings = {
                  color: connection.color || '#2196F3',
                  strokeWidth: connection.strokeWidth || 2,
                  lineType: connection.lineType || 'straight',
                  lineDesign: connection.lineDesign || 'curved',
                  arrowDirection: connection.arrowDirection || '->',
                  arrowHeadStyle: connection.arrowHeadStyle || 'medium'
                };
                saveDefaultConnectionSettings(settings);
              }}
              style={{
                width: '100%',
                padding: '8px',
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                marginTop: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
              title="Save as Default Line Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
            </button>

            {/* Delete Button */}
            <button
              onClick={() => {
                handleDeleteConnection(selectedConnection);
                setSelectedConnection(null);
              }}
              style={{
                width: '100%',
                padding: '8px',
                background: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                marginTop: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
              title="Delete Connection"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
            </button>
          </div>
        );
      })()}

      {/* Color Wheel at top right */}
      {selectedItem && selectedItem.type !== 'chart' && selectedItems.size === 1 && !isSearchPanelOpen && (
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
              <option value="layout">Layout Settings</option>
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
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <ChromePicker
                  color={selectedItem.backgroundColor || colorPicker.background}
                  onChange={handleColorChange}
                  disableAlpha
                  styles={{
                    default: {
                      picker: {
                        boxShadow: 'none'
                      }
                    }
                  }}
                />
              </div>
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
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <ChromePicker
                  color={selectedItem.borderColor || colorPicker.border}
                  onChange={handleBorderColorChange}
                  disableAlpha
                  styles={{
                    default: {
                      picker: {
                        boxShadow: 'none'
                      }
                    }
                  }}
                />
              </div>
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

          {/* Layout Settings Section */}
          {activeColorSection === 'layout' && (
            <>
              <div style={{ fontSize: 13, marginBottom: 6 }}>Layout Settings</div>
              
              {/* Branch Distance Slider */}
              <div style={{ marginBottom: '15px' }}>
                <div style={{ fontSize: 11, marginBottom: 4 }}>Branch Distance: {branchDistance.toFixed(2)}x</div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={branchDistance}
                  onChange={(e) => {
                    const newDistance = parseFloat(e.target.value);
                    setBranchDistance(newDistance);
                    
                    // Live update: regenerate mind map with new distance
                    if (selectedItem && selectedItem.type === 'circle') {
                      // Regenerate the mind map with new distance
                      regenerateMindMapWithNewDistance(selectedItem, [], newDistance);
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '6px',
                    borderRadius: '3px',
                    background: '#ddd',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                />
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  fontSize: '10px', 
                  color: '#666',
                  marginTop: '4px'
                }}>
                  <span>Compact</span>
                  <span>Default</span>
                  <span>Spread Out</span>
                </div>
              </div>
              
              {/* Reset Layout Button */}
              <button
                onClick={() => {
                  setBranchDistance(0.8);
                  if (selectedItem && selectedItem.type === 'circle') {
                    regenerateMindMapWithNewDistance(selectedItem, [], 0.8);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: '#333',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#e9e9e9'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#f5f5f5'}
              >
                Reset to Default
              </button>
            </>
          )}
        </div>
      )}
      <div className="whiteboard-header">
        <div className="header-left-controls">
          <div
            style={{
              width: '32px',
              height: '32px',
              overflow: 'hidden',
              marginRight: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            onClick={() => navigate('/')}
          >
            <img 
              src="/logo_and_name.png" 
              alt="MindMap Logo" 
              style={{
                height: '32px',
                width: 'auto',
                objectFit: 'contain',
                objectPosition: 'left center'
              }}
            />
          </div>
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
              title="Export"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
            {isExportMenuOpen && renderExportMenu()}
          </div>
          <button 
            className="header-button"
            onClick={handleResetBoard}
            title="Reset"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </button>
          <button 
            className="header-button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title="Undo"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v6h6"/>
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
            </svg>
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
        <div className="header-right-controls">
          <button 
            className="header-button save-button"
            onClick={async () => {
              if (!user) {
                alert('Please sign in to save boards');
                return;
              }
              const boardName = prompt('Enter a name for this board:');
              if (boardName && boardName.trim()) {
                try {
                  await handleSaveWhiteboard(boardName.trim());
                  alert('Board saved successfully!');
                } catch (error) {
                  const errorMessage = error.message || error.toString();
                  alert(`Failed to save board: ${errorMessage}`);
                }
              }
            }}
            title="Save New Canvas"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '8px'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
          </button>
          {currentBoardId && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                fontSize: '12px',
                color: isAutoSaving ? '#2196F3' : '#666',
                opacity: isAutoSaving ? 1 : 0.7
              }}
              title={isAutoSaving ? 'Saving...' : lastSaveTime ? `Last saved: ${lastSaveTime.toLocaleTimeString()}` : 'Auto-save enabled'}
            >
              {isAutoSaving ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" className="spinner" strokeDasharray="20" strokeDashoffset="10" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                  Auto-saved
                </>
              )}
            </div>
          )}
          <button 
            className="header-button new-canvas-button"
            onClick={handleNewCanvas}
            title="New Canvas"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Canvas
          </button>
          <UserMenu onSettingsOpen={handleCloseMindMapPanel} />
        </div>
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
          height: showFooter ? 'calc(100% - 15px)' : '100%'
        }}
      >
        <div 
          className={`whiteboard-zoom-overlay ${zoomOverlayVisible ? 'zoom-overlay-visible' : 'zoom-overlay-hidden'}`}
          onMouseEnter={showZoomOverlay}
          onMouseLeave={() => {
            // Start fade-out timer when mouse leaves
            if (zoomOverlayTimeoutRef.current) {
              clearTimeout(zoomOverlayTimeoutRef.current);
            }
            zoomOverlayTimeoutRef.current = setTimeout(() => {
              setZoomOverlayVisible(false);
            }, 2000);
          }}
        >
          <div className="zoom-controls">
            <button onClick={(e) => { 
              e.stopPropagation(); 
              showZoomOverlay();
              setScale(s => Math.min(s * 1.1, 4)); 
            }}>+</button>
            <span>{Math.round(scale * 100)}%</span>
            <button onClick={(e) => { 
              e.stopPropagation(); 
              showZoomOverlay();
              setScale(s => Math.max(s * 0.9, 0.1)); 
            }}>-</button>
            <button 
              className="home-button" 
              onClick={(e) => { 
                e.stopPropagation(); 
                handleResetView(); 
              }}
              title="Reset view"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </button>
            <button 
              className="full-width-button" 
              onClick={(e) => { 
                e.stopPropagation(); 
                handleZoomToFullWidth(); 
              }}
              title="Zoom to full width"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h18M8 8l-4 4 4 4M16 8l4 4-4 4"/>
              </svg>
            </button>
            <div 
              className="viewport-indicator" 
              onClick={(e) => {
                e.stopPropagation();
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
          {/* Render chart items first (in the back), sorted by order */}
          {items
            .filter(item => item.type === 'chart')
            .sort((a, b) => {
              const orderA = a.order !== undefined ? a.order : items.indexOf(a);
              const orderB = b.order !== undefined ? b.order : items.indexOf(b);
              return orderA - orderB;
            })
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
                onDragEnd={saveState}
                onResizeEnd={saveState}
              />
            ))}
          {/* Render non-chart items after (in front), sorted by order */}
          {items
            .filter(item => item.type !== 'chart')
            .sort((a, b) => {
              const orderA = a.order !== undefined ? a.order : items.indexOf(a);
              const orderB = b.order !== undefined ? b.order : items.indexOf(b);
              return orderA - orderB;
            })
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
                onDragEnd={saveState}
                onResizeEnd={saveState}
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
          {selectedItems.size === 1 && (
            <>
              <div className="context-menu-option" onClick={() => handleContextMenuAction('bringToFront')}>
                ⬆️ Bring to Front
              </div>
              <div className="context-menu-option" onClick={() => handleContextMenuAction('bringForward')}>
                ⬆ Bring Forward
              </div>
              <div className="context-menu-option" onClick={() => handleContextMenuAction('pushBackward')}>
                ⬇ Push Backward
              </div>
              <div className="context-menu-option" onClick={() => handleContextMenuAction('pushToBack')}>
                ⬇️ Push to Back
              </div>
              <div className="context-menu-divider"></div>
            </>
          )}
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
          onFullscreenChange={setIsSearchPanelFullscreen}
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

      {isMindMapPanelOpen && !isSearchPanelFullscreen && (
        <div className="mind-map-floating-prompt">
          <div className="mind-map-prompt-container">
            <input
              type="text"
              className="mind-map-prompt-input"
              value={mindMapPrompt}
              onChange={(e) => setMindMapPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isGeneratingMindMap && mindMapPrompt.trim()) {
                  e.preventDefault();
                  handleGenerateMindMap();
                }
                if (e.key === 'Escape') {
                  handleCloseMindMapPanel();
                }
              }}
              placeholder="Generate a mind map..."
              autoFocus
              disabled={isGeneratingMindMap}
            />
            <button 
              className="mind-map-prompt-button"
              onClick={handleGenerateMindMap}
              disabled={isGeneratingMindMap || !mindMapPrompt.trim()}
              title="Generate Mind Map"
            >
              {isGeneratingMindMap ? (
                <span className="loading-spinner"></span>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              )}
            </button>
            <button 
              className="mind-map-prompt-close"
              onClick={handleCloseMindMapPanel}
              title="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
      )}


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

      {/* Footer with canvas and view size */}
      {showFooter && (
        <div className="whiteboard-footer">
          <div className="footer-left">
            <span>
              {currentBoardName ? `Board: ${currentBoardName}` : 'Untitled Board'}
            </span>
          </div>
          <div className="footer-right">
            <span>
              Canvas: {4000} × {4000}px
            </span>
            <span>
              View: {Math.round(canvasViewSize.width)} × {Math.round(canvasViewSize.height)}px
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

export default WhiteboardCanvas; 