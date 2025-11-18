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
import { getAuth } from 'firebase/auth';
import { db, storage } from '../../firebase-config';
/* eslint-disable-next-line no-unused-vars */
import { useAuth } from '../../contexts/AuthContext';
import UserMenu from '../UserMenu';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTierPermissions } from '../../hooks/useTierPermissions';
import { saveBoard, getDemoBoards } from '../../services/boardService';
import { getApiBaseUrl, getGroqApiKey } from '../../utils/api';
import { canGenerateMindMap, canExpandConcept, incrementMindMapCount, incrementExpandCount, getUsageStats } from '../../utils/usageTracker';
import { createNotionPage, writeToNotionDatabase } from './agent/tools/notion';
import { ChromePicker } from 'react-color';
import UsageTracker from './UsageTracker';
import { useApp } from '../../contexts/AppContext';

const WhiteboardCanvas = forwardRef((props, ref) => {
  const { isDarkMode } = useApp();
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
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const [scale, setScale] = useState(1.0); // Changed from 0.4 to 1.0 for 100% default zoom
  
  // Sync ref with state
  useEffect(() => {
    panOffsetRef.current = panOffset;
  }, [panOffset]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [connections, setConnections] = useState([]);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const connectionSettingsMenuRef = useRef(null);
  const primaryDraggingItemIdRef = useRef(null);
  const groupDragStartPositionsRef = useRef(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isRightClickSelecting, setIsRightClickSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [highlightedItems, setHighlightedItems] = useState([]);
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const [isSearchPanelFullscreen, setIsSearchPanelFullscreen] = useState(false);
  const [isMindMapPanelOpen, setIsMindMapPanelOpen] = useState(false);
  const [mindMapPrompt, setMindMapPrompt] = useState('');
  const [isGeneratingMindMap, setIsGeneratingMindMap] = useState(false);
  const [chartGenerationType, setChartGenerationType] = useState('mindmap'); // 'mindmap', 'xy', 'sine', 'sankey'
  const [searchParams, setSearchParams] = useSearchParams();
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
  const lastAutoSaveBoardIdRef = useRef(null); // Track which board was last auto-saved
  const isInitialLoadRef = useRef(true);
  const isGeneratingMindMapRef = useRef(false);
  const previousBoardIdRef = useRef(null);
  const lastSavedContentRef = useRef(null); // Track last saved content to detect actual changes
  const isAutoSavingRef = useRef(false); // Mutex-like lock to prevent concurrent auto-saves
  const originalSavedAtRef = useRef(null); // Track the original savedAt timestamp - never changes after board creation
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
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    textAlign: 'center',
  });
  // Add state for color picker section
  const [activeColorSection, setActiveColorSection] = useState('background');
  // Add state for unit mode (px or mm) for object settings
  const [unitMode, setUnitMode] = useState('px');
  // Add state to control color menu visibility
  const [showColorMenu, setShowColorMenu] = useState(false);
  
  // Add state for footer visibility
  const [showFooter, setShowFooter] = useState(() => {
    const stored = localStorage.getItem('showFooter');
    return stored === null ? true : stored === 'true';
  });
  
  // Add state for zoom overlay visibility (fade-out effect)
  const [zoomOverlayVisible, setZoomOverlayVisible] = useState(true);
  const zoomOverlayTimeoutRef = useRef(null);
  const canvasRef = useRef(null);
  // Add state for drag and drop
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
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

  // Check for prompt in URL params and set it
  useEffect(() => {
    const prompt = searchParams.get('prompt');
    if (prompt) {
      setMindMapPrompt(prompt);
      setIsMindMapPanelOpen(true);
      if (onMindMapPanelOpen) {
        onMindMapPanelOpen();
      }
      // Remove the prompt from URL after setting it
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, onMindMapPanelOpen]);

  // Expose methods to parent through ref
  useImperativeHandle(ref, () => ({
    handleToggleHelp: () => {
      setIsInstructionsCollapsed(prev => !prev);
    },
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
      const canvas = document.querySelector('.whiteboard-canvas');
      
      // We no longer constrain selection to viewport bounds; selection operates in canvas space
      const selectedItems = items.filter(item => {
        // Only select items that are actual whiteboard items (not UI elements)
        // Ensure item has valid position and dimensions
        if (!item.position || typeof item.position.x !== 'number' || typeof item.position.y !== 'number') {
          return false;
        }
        
        // Ensure item has valid dimensions
        if (!item.width || !item.height || item.width <= 0 || item.height <= 0) {
          return false;
        }
        
        // Do not constrain by viewport; items can be anywhere in canvas space
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
      setIsRightClickSelecting(false);
      setSelectionBox(null);
      setSelectionStart(null);
    }
  }, [isPanning, isSelecting, selectionBox, items, scale]);

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
      const effectiveScale = scale * dpr;
      const x = (e.clientX - rect.left - panOffset.x) / effectiveScale;
      const y = (e.clientY - rect.top - panOffset.y) / effectiveScale;
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
    
    // Don't handle if clicking on a whiteboard item (let WhiteboardItem handle it)
    // For right-click on items, let the context menu handler deal with it
    if (e.target.closest('.whiteboard-item')) {
      // Only allow right-click selection if clicking on canvas background, not on items
      return;
    }
    
    // Don't handle if clicking on zoom controls
    if (e.target.closest('.zoom-controls')) {
      return;
    }
    
    // Don't start selection box if clicking from header or instructions panel
    if (e.target.closest('.whiteboard-header, .whiteboard-controls-overlay, .help-toggle-button')) {
      return;
    }
    
    if (e.button === 1 || (e.button === 0 && !isSpacePressed)) {
      // Regular drag (or middle mouse button) = pan
      // Clear any active button states when starting to pan
      setConnectingFrom(null);
      setSelectedConnection(null);
      setSelectedItems(new Set());
      setContextMenu({ visible: false, x: 0, y: 0 });
      
      setIsPanning(true);
      setPanStart({
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y
      });
      e.preventDefault();
    } else if ((e.button === 0 && isSpacePressed) || e.button === 2) {
      // Space + drag OR right-click drag = selection box (group highlight)
      // Don't start if clicking from header, instructions panel, or chat panel
      if (e.target.closest('.whiteboard-header, .whiteboard-controls-overlay, .help-toggle-button, .search-panel, .agent-chat, .chat-modal')) {
        return;
      }
      
      const canvas = document.querySelector('.whiteboard-canvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const effectiveScale = scale * dpr;
        const x = (e.clientX - rect.left - panOffset.x) / effectiveScale;
        const y = (e.clientY - rect.top - panOffset.y) / effectiveScale;
        
        setIsSelecting(true);
        setIsRightClickSelecting(e.button === 2);
        setSelectionStart({ x, y });
        setSelectionBox({ x, y, width: 0, height: 0 });
        setSelectedItems(new Set());
        e.preventDefault(); // Prevent context menu when right-click dragging
      }
    }
  }, [panOffset, scale, isSpacePressed]);

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
      if (isSelecting || isRightClickSelecting) {
        setIsSelecting(false);
        setIsRightClickSelecting(false);
        setSelectionBox(null);
        setSelectionStart(null);
      }
    };

    if (isPanning || isSelecting || isRightClickSelecting) {
      if (isPanning) {
        window.addEventListener('mousemove', handleGlobalMouseMove);
      }
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning, panStart, isSelecting, isRightClickSelecting]);

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
        window.isSpacePressed = true;
        e.preventDefault();
      } else if (e.code === 'AltLeft' || e.code === 'AltRight') {
        setIsAltPressed(true);
        e.preventDefault();
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        setIsShiftPressed(true);
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
        window.isSpacePressed = false;
      } else if (e.code === 'AltLeft' || e.code === 'AltRight') {
        setIsAltPressed(false);
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        setIsShiftPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleUndo, handleRedo]);

  // Initialize window property for Space key state (used by WhiteboardItem)
  useEffect(() => {
    if (typeof window.isSpacePressed === 'undefined') {
      window.isSpacePressed = false;
    }
  }, []);

  // Canvas bounds - items must stay within these limits
  const CANVAS_BOUNDS = {
    minX: 0,
    minY: 0,
    maxX: 4000,
    maxY: 4000
  };

  // Helper function to constrain position to canvas bounds
  const constrainPositionToCanvas = useCallback((position, itemWidth = 0, itemHeight = 0) => {
    const constrainedX = Math.max(
      CANVAS_BOUNDS.minX,
      Math.min(CANVAS_BOUNDS.maxX - itemWidth, position.x)
    );
    const constrainedY = Math.max(
      CANVAS_BOUNDS.minY,
      Math.min(CANVAS_BOUNDS.maxY - itemHeight, position.y)
    );
    return { x: constrainedX, y: constrainedY };
  }, []);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'WHITEBOARD_ITEM',
    canDrop: () => {
      return true; // Always allow drops
    },
    drop: (item, monitor) => {
      if (!item || !item.type) {
        console.error('Invalid item dropped', item);
        return undefined;
      }
      
      const offset = monitor.getClientOffset();
      if (!offset) {
        console.error('No drop offset available');
        return undefined;
      }
      
      const canvasRect = document.querySelector('.whiteboard-canvas')?.getBoundingClientRect();
      
      if (!canvasRect) {
        console.error('Canvas element not found');
        return undefined;
      }
      
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
          case 'rectangle':
            width = 120;
            height = 80;
            break;
          case 'circle':
            width = 100;
            height = 100;
            break;
          case 'text':
            width = 200;
            height = 50;
            break;
          default:
            width = 80;   // Reduced from 100
            height = 40;   // Reduced from 60
        }

        // Calculate the position accounting for scale, pan offset, and device pixel ratio
        // The canvas-content div has transform: translate(panOffset.x, panOffset.y) scale(scale * dpr)
        // So we need to convert screen coordinates to canvas coordinates
        const dpr = window.devicePixelRatio || 1;
        
        // Get mouse position relative to canvas element
        const relativeX = offset.x - canvasRect.left;
        const relativeY = offset.y - canvasRect.top;
        
        // Convert to canvas coordinates (accounting for pan and scale)
        // panOffset is negative when panned, so we subtract it (which adds)
        const canvasX = (relativeX - panOffset.x) / (scale * dpr);
        const canvasY = (relativeY - panOffset.y) / (scale * dpr);
        
        // Center the item on the drop point
        let position = {
          x: Math.round((canvasX - width/2) / 10) * 10,
          y: Math.round((canvasY - height/2) / 10) * 10
        };
        
        // Ensure position values are valid numbers
        if (isNaN(position.x) || isNaN(position.y) || !isFinite(position.x) || !isFinite(position.y)) {
          console.error('Invalid position calculated', { 
            relativeX, relativeY, canvasX, canvasY, position, 
            offset, canvasRect, panOffset, scale, dpr, width, height 
          });
          return undefined;
        }

        // Constrain position to canvas bounds
        position = constrainPositionToCanvas(position, width, height);

        setItems(prevItems => {
          const maxOrder = prevItems.length > 0 ? Math.max(...prevItems.map((i, idx) => i.order !== undefined ? i.order : idx)) : -1;
          const newItem = {
            id: Date.now(),
            type: item.type,
            chartType: item.chartType,
            position: { x: position.x, y: position.y }, // Ensure position is an object
            width: Number(width),
            height: Number(height),
            rotation: 0, // Default rotation
            text: item.type === 'sticky' ? 'New note' : (item.type === 'text' ? '' : (item.type === 'rectangle' || item.type === 'circle' ? '' : '')),
            order: maxOrder + 1,
            // Add default chart configuration for better initial appearance
            ...(item.type === 'chart' && {
              title: 'New Chart',
              xAxisTitle: 'X',
              yAxisTitle: 'Y',
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
            }),
            ...(item.type === 'text' && {
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              textColor: '#000000',
              fontSize: 16,
              fontFamily: '-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif',
              textAlign: 'center',
              isNewText: true
            }),
            ...(item.type === 'rectangle' && {
              backgroundColor: '#ffffff',
              borderColor: '#333333',
              textColor: '#000000',
              fontSize: 14,
              fontFamily: '-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif',
              textAlign: 'center'
            }),
            ...(item.type === 'circle' && {
              backgroundColor: '#ffffff',
              borderColor: '#333333',
              textColor: '#000000',
              fontSize: 14,
              fontFamily: '-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif',
              textAlign: 'center'
            }),
            ...(item.type === 'sticky' && {
              textAlign: 'center'
            })
          };
          // Save state after updating items
          setTimeout(() => saveState(), 0);
          return [...prevItems, newItem];
        });
      }
      return undefined;
    }
  }), [scale, panOffset, saveState, constrainPositionToCanvas]);

  const handleWheel = useCallback((e) => {
    // Enable scroll zoom without requiring Ctrl key
    e.preventDefault();
    showZoomOverlay(); // Show zoom overlay when zooming
    
    // Get canvas element and its position
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    
    // Get mouse position relative to canvas
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Handle different scroll types (trackpad vs mouse wheel)
    // deltaMode: 0 = pixels, 1 = lines, 2 = pages
    let deltaY = e.deltaY;
    if (e.deltaMode === 1) {
      // Line mode (mouse wheel) - convert to pixel-like values
      deltaY = e.deltaY * 20;
    } else if (e.deltaMode === 2) {
      // Page mode - convert to pixel-like values
      deltaY = e.deltaY * 100;
    }
    
    // Use a much smaller, smoother zoom factor for trackpad scrolling
    // Trackpads send many small deltaY values, so we need a gentler multiplier
    const zoomSensitivity = 0.0008; // Smooth sensitivity for trackpad
    const zoomFactor = 1 - (deltaY * zoomSensitivity); // Negative deltaY = zoom in, positive = zoom out
    
    // Zoom towards cursor position
    setScale(s => {
      const newScale = Math.min(Math.max(0.1, s * zoomFactor), 4);
      
      // Use functional update to get current pan offset
      setPanOffset(currentPan => {
        // Calculate the world coordinates of the point under the cursor before zoom
        const worldX = (mouseX - currentPan.x) / s;
        const worldY = (mouseY - currentPan.y) / s;
        
        // Calculate new pan offset so the same world point stays under the cursor
        const newPanX = mouseX - worldX * newScale;
        const newPanY = mouseY - worldY * newScale;
        
        return { x: newPanX, y: newPanY };
      });
      
      return newScale;
    });
  }, [showZoomOverlay]);

  // Add wheel event listener with passive: false to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  const updateItemPosition = useCallback((id, position) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const constrainedPosition = constrainPositionToCanvas(
          position,
          item.width || 0,
          item.height || 0
        );
        return { ...item, position: constrainedPosition };
      }
      return item;
    }));
  }, [items, constrainPositionToCanvas]);

  const updateItemSize = useCallback((id, size) => {
    setItems(items.map(item =>
      item.id === id
        ? { ...item, ...size }
        : item
    ));
  }, [items]);

  const updateItemRotation = useCallback((id, rotation) => {
    setItems(items.map(item =>
      item.id === id
        ? { ...item, rotation: rotation !== undefined ? rotation : (item.rotation || 0) }
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
          id: `connection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      // Bring clicked item to front by updating its order
      const clickedItem = items.find(item => String(item.id) === String(itemId));
      if (clickedItem) {
        const maxOrder = items.length > 0 ? Math.max(...items.map((i, idx) => i.order !== undefined ? i.order : idx)) : -1;
        if (clickedItem.order !== maxOrder + 1) {
          setItems(prevItems => prevItems.map(item => 
            String(item.id) === String(itemId)
              ? { ...item, order: maxOrder + 1 }
              : item
          ));
        }
      }
      
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
    // Filter out duplicates by ID (keep first occurrence) as a safeguard
    const seenIds = new Set();
    const uniqueConnections = connections.filter(conn => {
      if (seenIds.has(conn.id)) {
        return false;
      }
      seenIds.add(conn.id);
      return true;
    });
    
    return uniqueConnections.map(connection => {
      // Use multiple comparison methods to handle string/number ID mismatches
      const startItem = items.find(item => {
        const itemIdStr = String(item.id);
        const connFromStr = String(connection.from);
        const itemIdNum = Number(item.id);
        const connFromNum = Number(connection.from);
        
        return itemIdStr === connFromStr || 
               (!isNaN(itemIdNum) && !isNaN(connFromNum) && itemIdNum === connFromNum) ||
               item.id === connection.from;
      });
      
      const endItem = items.find(item => {
        const itemIdStr = String(item.id);
        const connToStr = String(connection.to);
        const itemIdNum = Number(item.id);
        const connToNum = Number(connection.to);
        
        return itemIdStr === connToStr || 
               (!isNaN(itemIdNum) && !isNaN(connToNum) && itemIdNum === connToNum) ||
               item.id === connection.to;
      });
      
      if (!startItem || !endItem) {
        // Debug missing connections
        if (process.env.NODE_ENV === 'development') {
          console.warn('Connection cannot render - missing item:', {
            connection: { id: connection.id, from: connection.from, to: connection.to },
            startItemFound: !!startItem,
            endItemFound: !!endItem,
            totalItems: items.length,
            itemIds: items.map(i => i.id).slice(0, 5)
          });
        }
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
      
      // Use connection ID as key (should be unique). Add index as fallback for safety
      return (
        <Connector
          key={`conn-${connection.id}`}
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
        // Sort by savedAt descending (most recent first)
        const sortedBoards = [...boards].sort((a, b) => {
          const dateA = new Date(a.savedAt || 0);
          const dateB = new Date(b.savedAt || 0);
          return dateB - dateA;
        });
        setSavedWhiteboards(sortedBoards);
      } catch (error) {
        console.error('Error loading demo boards:', error);
        // Fallback to localStorage if Firebase fails
        const saved = localStorage.getItem('savedWhiteboards');
        if (saved) {
          try {
            const boards = JSON.parse(saved);
            // Sort by savedAt descending (most recent first)
            const sortedBoards = [...boards].sort((a, b) => {
              const dateA = new Date(a.savedAt || 0);
              const dateB = new Date(b.savedAt || 0);
              return dateB - dateA;
            });
            setSavedWhiteboards(sortedBoards);
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
            // For data URLs, we don't need storageRef - just preserve the imageUrl
            if (item.imageUrl && item.imageUrl.startsWith('data:')) {
              // Data URL images don't need storageRef, just keep the imageUrl
              cleanedItem = { ...item };
            } else if (!item.storageRef) {
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
        lastEditedAt: serverTimestamp(), // Manual save - update lastEditedAt
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
      } else {
        // Only set savedAt for new boards
        boardData.savedAt = serverTimestamp();
      }

      // Save to Firestore
      const savedBoard = await saveBoard(boardData, user.uid);
      
      // Store the original savedAt timestamp for new boards
      // For existing boards, preserve the originalSavedAtRef value
      if (!currentBoardId && savedBoard.savedAt) {
        // New board - store the savedAt from the response
        originalSavedAtRef.current = savedBoard.savedAt instanceof Date 
          ? savedBoard.savedAt 
          : new Date(savedBoard.savedAt);
      }
      // For existing boards, originalSavedAtRef.current should already be set from when the board was loaded
      
      // Update the last saved content reference after manual save
      const contentForComparison = {
        items: JSON.stringify(processedItems.map(item => ({
          id: item.id,
          type: item.type,
          position: item.position,
          width: item.width,
          height: item.height,
          text: item.text || '',
          chartType: item.chartType
        })).sort((a, b) => String(a.id).localeCompare(String(b.id)))),
        connections: JSON.stringify(cleanedConnections.map(conn => ({
          from: String(conn.from),
          to: String(conn.to)
        })).sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)))
      };
      lastSavedContentRef.current = contentForComparison;
      
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
      // CRITICAL: Set isInitialLoadRef BEFORE clearing anything to prevent auto-save
      isInitialLoadRef.current = true;
      
      // Clear any pending auto-save and reset tracking refs when switching boards
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      lastAutoSaveBoardIdRef.current = null; // Reset so new board can save
      lastSavedContentRef.current = null; // Reset - will be set after loading
      
      // Clear state before loading new board to prevent stale data
      setItems([]);
      setConnections([]);
      setSelectedItems(new Set());
      
      const boardDoc = await getDoc(doc(db, 'boards', boardId));
      
      if (!boardDoc.exists()) {
        throw new Error('Board not found');
      }

      const boardData = boardDoc.data();
      
      // Store the original savedAt timestamp when loading a board
      // This ensures it never changes, even if the board is refreshed
      if (boardData.savedAt) {
        let convertedDate = null;
        // Convert Firestore Timestamp to Date if needed
        if (typeof boardData.savedAt.toDate === 'function') {
          convertedDate = boardData.savedAt.toDate();
        } else if (boardData.savedAt instanceof Date) {
          convertedDate = boardData.savedAt;
        } else {
          convertedDate = new Date(boardData.savedAt);
        }
        
        // Validate the date - only store if it's valid
        if (convertedDate && !isNaN(convertedDate.getTime())) {
          originalSavedAtRef.current = convertedDate;
        } else {
          originalSavedAtRef.current = null;
        }
      } else {
        originalSavedAtRef.current = null;
      }
      
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
          // If imageUrl is a data URL, use it directly (no storageRef needed)
          if (item.imageUrl && item.imageUrl.startsWith('data:')) {
            return {
              ...item,
              imageUrl: item.imageUrl,
              loadError: null,
              errorOverlay: false
            };
          }

          // If no storageRef and no data URL, show error
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
      
      // Store the loaded content as the baseline for change detection
      // We'll compare this with current content to detect actual changes
      const contentForComparison = {
        items: JSON.stringify(processedItems.map(item => ({
          id: item.id,
          type: item.type,
          position: item.position,
          width: item.width,
          height: item.height,
          text: item.text || '',
          chartType: item.chartType
        })).sort((a, b) => String(a.id).localeCompare(String(b.id)))),
        connections: JSON.stringify((boardData.content.connections || []).map(conn => ({
          from: String(conn.from),
          to: String(conn.to)
        })).sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)))
      };
      lastSavedContentRef.current = contentForComparison;
      
      // Load connections with all properties properly converted
      // Note: Item IDs might be numbers or strings, so we need to match them properly
      const seenIds = new Set();
      const loadedConnections = (boardData.content.connections || []).map((conn, index) => {
        // Convert from/to to match item ID type (items might have number or string IDs)
        const fromId = conn.from;
        const toId = conn.to;
        
        // Find the actual item IDs to match against
        const fromItem = processedItems.find(item => String(item.id) === String(fromId));
        const toItem = processedItems.find(item => String(item.id) === String(toId));
        
        // Generate unique ID if missing or duplicate
        let connectionId = String(conn.id || `connection-${Date.now()}-${index}`);
        // Ensure uniqueness by appending index if duplicate
        if (seenIds.has(connectionId)) {
          connectionId = `${connectionId}-${index}`;
        }
        seenIds.add(connectionId);
        
        // Use the actual item ID (preserving type) if item exists, otherwise use the connection value
        const cleaned = {
          id: connectionId,
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
      // Filter out any remaining duplicates by ID (keep first occurrence)
      const uniqueConnections = loadedConnections.filter((conn, index, self) => 
        index === self.findIndex(c => c.id === conn.id)
      );
      setConnections(uniqueConnections);
      setScale(boardData.content.scale || 1);
      setPanOffset(boardData.content.panOffset || { x: 0, y: 0 });
      
      // If it's a demo board, clear currentBoardId so saving creates a new board
      // isDemoBoard was already determined above
      if (isDemoBoard) {
        setCurrentBoardId(null);
        // Set a name that indicates it's a copy of a demo board
        setCurrentBoardName(boardData.name ? `${boardData.name} (Copy)` : 'Demo Board (Copy)');
        // Clear originalSavedAtRef for demo boards since they'll create new boards
        originalSavedAtRef.current = null;
      } else {
        setCurrentBoardId(boardId);
        setCurrentBoardName(boardData.name || null);
      }
      
      // Keep isInitialLoadRef true for 2 seconds after load to prevent auto-save
      // It was already set to true at the start of this function
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 2000); // Wait 2 seconds after load before allowing auto-save

    } catch (error) {
      // Reset isInitialLoadRef on error
      isInitialLoadRef.current = false;
      throw error; // Re-throw to be handled by the caller
    }
  };

  // Auto-save function for existing boards
  const autoSave = useCallback(async () => {
    // Prevent concurrent auto-saves
    if (isAutoSavingRef.current) {
      return;
    }
    
    const boardIdToSave = currentBoardId;
    const boardNameToSave = currentBoardName;
    
    if (!user || !boardIdToSave || !boardNameToSave || isInitialLoadRef.current || isGeneratingMindMapRef.current) {
      return;
    }

    // Ensure we're still on the same board
    if (currentBoardId !== boardIdToSave || currentBoardName !== boardNameToSave) {
      return;
    }
    
    // Set mutex lock
    isAutoSavingRef.current = true;

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

      // Compare current content with last saved content to detect actual changes
      if (!lastSavedContentRef.current) {
        setIsAutoSaving(false);
        isAutoSavingRef.current = false;
        return;
      }

      const currentContentForComparison = {
        items: JSON.stringify(processedItems.map(item => ({
          id: item.id,
          type: item.type,
          position: item.position,
          width: item.width,
          height: item.height,
          text: item.text || '',
          chartType: item.chartType
        })).sort((a, b) => String(a.id).localeCompare(String(b.id)))),
        connections: JSON.stringify(cleanedConnections.map(conn => ({
          from: String(conn.from),
          to: String(conn.to)
        })).sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)))
      };

      const contentChanged = 
        lastSavedContentRef.current.items !== currentContentForComparison.items ||
        lastSavedContentRef.current.connections !== currentContentForComparison.connections;

      // Ensure we're still on the same board
      if (currentBoardId !== boardIdToSave || currentBoardName !== boardNameToSave) {
        isAutoSavingRef.current = false;
        return;
      }

      // Don't save viewport (scale, panOffset) in auto-save to avoid saving on every view change
      // IMPORTANT: Only update lastEditedAt if content actually changed
      // This ensures the "most recent edit" timestamp accurately reflects actual content changes
      const boardData = {
        id: boardIdToSave, // Use the stored boardId to ensure we save to the correct board
        name: boardNameToSave, // Use the stored boardName
        userId: user.uid,
        // Only include lastEditedAt if content actually changed
        // This prevents auto-saves from updating timestamps for boards that weren't actually edited
        ...(contentChanged && { lastEditedAt: serverTimestamp() }),
        content: {
          items: processedItems,
          connections: cleanedConnections,
          // Viewport changes are not auto-saved - they're only saved on manual save
        }
      };

      // Skip save entirely if content hasn't changed
      if (!contentChanged) {
        isAutoSavingRef.current = false;
        return;
      }

      // Final check before saving
      if (currentBoardId !== boardIdToSave || currentBoardName !== boardNameToSave) {
        isAutoSavingRef.current = false;
        return;
      }

      // Prevent duplicate saves
      if (lastAutoSaveBoardIdRef.current?.id === boardIdToSave) {
        const timeSinceLastSave = Date.now() - (lastAutoSaveBoardIdRef.current?.timestamp || 0);
        if (timeSinceLastSave < 1000) {
          isAutoSavingRef.current = false;
          return;
        }
      }
      
      await saveBoard(boardData, user.uid);
      
      setLastSaveTime(new Date());
      lastAutoSaveBoardIdRef.current = { id: boardIdToSave, timestamp: Date.now() };
      lastSavedContentRef.current = currentContentForComparison;
    } catch (error) {
      // Silently fail for auto-save
    } finally {
      setIsAutoSaving(false);
      isAutoSavingRef.current = false;
    }
  }, [user, currentBoardId, currentBoardName, items, connections, isInitialLoadRef, isGeneratingMindMapRef]);

  // Clear state when currentBoardId becomes null (new board created)
  useEffect(() => {
    // Only clear if we're transitioning from a saved board (had an ID) to a new board (null)
    // This prevents stale data from previous boards appearing on new boards
    if (currentBoardId === null && previousBoardIdRef.current !== null) {
      // We transitioned from a saved board to a new board - clear stale data
      setItems([]);
      setConnections([]);
      setSelectedItems(new Set());
      setConnectingFrom(null);
      // Clear any pending auto-save
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    }
    // Update the ref to track the previous boardId
    previousBoardIdRef.current = currentBoardId;
  }, [currentBoardId]);

  // Auto-save effect - debounced (only for items and connections, not viewport changes)
  useEffect(() => {
    // Clear any pending auto-save when board changes
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }

    // Don't auto-save if no board is loaded, during initial load, or during mind map generation
    if (!currentBoardId || isInitialLoadRef.current || isGeneratingMindMapRef.current) {
      return;
    }

    // Store the current boardId to ensure we only save to the correct board
    const boardIdForThisSave = currentBoardId;
    const boardNameForThisSave = currentBoardName;

    // Set new timeout for auto-save (2 seconds after last change)
    autoSaveTimeoutRef.current = setTimeout(() => {
      if (currentBoardId === boardIdForThisSave && currentBoardName === boardNameForThisSave) {
        autoSave();
      }
      autoSaveTimeoutRef.current = null;
    }, 2000);

    // Cleanup - clear timeout if component unmounts or dependencies change
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [items, connections, currentBoardId, currentBoardName, autoSave, isInitialLoadRef, isGeneratingMindMapRef]);

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
      const canvasEl = canvasRef.current || document.querySelector('.whiteboard-canvas');
      if (!canvasEl) return;

      const canvasRect = canvasEl.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Convert viewport coordinates to canvas coordinates if provided
      let position = e.detail.position;
      if (position.viewportX !== undefined && position.viewportY !== undefined) {
        // Convert viewport center to canvas coordinates
        position = {
          x: Math.round(((position.viewportX - canvasRect.left - panOffset.x) / (scale * dpr) - (e.detail.width || 400) / 2) / 10) * 10,
          y: Math.round(((position.viewportY - canvasRect.top - panOffset.y) / (scale * dpr) - (e.detail.height || 300) / 2) / 10) * 10
        };
      }

      // Constrain position to canvas bounds
      const itemWidth = e.detail.width || 400;
      const itemHeight = e.detail.height || 300;
      position = constrainPositionToCanvas(position, itemWidth, itemHeight);

      const newItemId = Date.now() + Math.random();
      setItems(prevItems => {
        const newItem = {
          ...e.detail,
          position,
          id: newItemId,
          order: prevItems.length > 0 ? Math.max(...prevItems.map((i, idx) => i.order !== undefined ? i.order : idx)) + 1 : 0
        };
        return [...prevItems, newItem];
      });
      setSelectedItems(new Set([newItemId]));
    };

    window.addEventListener('addImageItem', handleAddImageItem);
    return () => window.removeEventListener('addImageItem', handleAddImageItem);
  }, [scale, panOffset, constrainPositionToCanvas]);

  // Handle image file drops
  const handleImageDrop = useCallback((e, dropPosition) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    
    if (files.length === 0) {
      return;
    }

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    files.forEach((file) => {
      // Convert file to data URL immediately for production compatibility
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const img = new Image();
        
        img.onload = () => {
        // Calculate dimensions while maintaining aspect ratio
        const maxWidth = 400;
        const maxHeight = 300;
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (maxHeight / height) * width;
          height = maxHeight;
        }

        // Calculate position based on drop location
        let position;
        if (dropPosition && canvasRect) {
          position = {
            x: Math.round(((dropPosition.x - canvasRect.left - panOffset.x) / (scale * dpr) - width/2) / 10) * 10,
            y: Math.round(((dropPosition.y - canvasRect.top - panOffset.y) / (scale * dpr) - height/2) / 10) * 10
          };
        } else {
          position = { x: 100, y: 100 };
        }

        // Constrain position to canvas bounds
        position = constrainPositionToCanvas(position, width, height);

        const newItemId = Date.now() + Math.random();
        setItems(prevItems => {
          const maxOrder = prevItems.length > 0 ? Math.max(...prevItems.map((i, idx) => i.order !== undefined ? i.order : idx)) : -1;
            return [...prevItems, {
              type: 'image',
              imageUrl: dataUrl, // Use data URL instead of blob URL
              width,
              height,
              position,
              id: newItemId,
              order: maxOrder + 1
            }];
          });
          setSelectedItems(new Set([newItemId]));
        };
        
        img.onerror = () => {
          alert(`Failed to load image "${file.name}"`);
        };
        
        img.src = dataUrl;
      };
      
      reader.onerror = () => {
        alert(`Failed to read image "${file.name}"`);
      };
      
      reader.readAsDataURL(file);
    });
  }, [scale, panOffset, constrainPositionToCanvas]);

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

  // Function to center an item on the viewport with smooth animation
  const centerItemOnViewport = useCallback((itemId) => {
    const item = items.find(i => i.id === itemId);
    if (!item || !item.position) return;

    const canvasEl = document.querySelector('.whiteboard-canvas');
    if (!canvasEl) return;

    const canvasBounds = canvasEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const effectiveScale = scale * dpr;

    // Calculate center of the item
    const itemCenterX = item.position.x + (item.width || 150) / 2;
    const itemCenterY = item.position.y + (item.height || 150) / 2;

    // Calculate pan offset to center the item in the viewport
    // Formula: panOffset = viewportCenter - (canvasPosition * scale)
    const targetX = canvasBounds.width / 2 - itemCenterX * effectiveScale;
    const targetY = canvasBounds.height / 2 - itemCenterY * effectiveScale;

    // Get current pan offset from ref to avoid stale closure
    const startX = panOffsetRef.current.x;
    const startY = panOffsetRef.current.y;
    
    // Animation parameters
    const duration = 400; // milliseconds
    const startTime = performance.now();
    
    // Easing function (ease-out cubic)
    const easeOutCubic = (t) => {
      return 1 - Math.pow(1 - t, 3);
    };

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);

      const currentX = startX + (targetX - startX) * easedProgress;
      const currentY = startY + (targetY - startY) * easedProgress;

      setPanOffset({ x: currentX, y: currentY });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [items, scale]);

  const handleShowColorMenu = () => {
    // Only show color menu for non-image, non-chart items
    if (selectedItems.size === 1) {
      const selectedItemId = Array.from(selectedItems)[0];
      const selectedItem = items.find(item => item.id === selectedItemId);
      if (selectedItem && selectedItem.type !== 'image' && selectedItem.type !== 'chart') {
        setShowColorMenu(true);
        // Center the item when the edit button (color menu) is clicked
        centerItemOnViewport(selectedItemId);
      }
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
            const newPosition = {
              x: basePosition.x + alignedDx,
              y: basePosition.y + alignedDy
            };
            const constrainedPosition = constrainPositionToCanvas(
              newPosition,
              item.width || 0,
              item.height || 0
            );
            return {
              ...item,
              position: constrainedPosition
            };
          }
          return item;
        })
      );
    });
  }, [selectedItems, items, constrainPositionToCanvas]);

  // Hide color menu when selection changes
  useEffect(() => {
    setShowColorMenu(false);
  }, [selectedItems]);

  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (contextMenu.visible && 
          !e.target.closest('.context-menu') && 
          !e.target.closest('.whiteboard-item.selected')) {
        setContextMenu({ visible: false, x: 0, y: 0 });
      }
      // Hide color menu when clicking outside
      if (showColorMenu) {
        const chromePickerElement = document.querySelector('.chrome-picker');
        if (!e.target.closest('.color-menu-panel') && 
            !e.target.closest('.edit-control') &&
            !e.target.closest('.whiteboard-item.selected') &&
            (!chromePickerElement || !chromePickerElement.contains(e.target))) {
          setShowColorMenu(false);
        }
      }
    };

    if (contextMenu.visible || showColorMenu) {
      document.addEventListener('mousedown', handleGlobalClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
    };
  }, [contextMenu.visible, showColorMenu]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (contextMenu.visible) {
          setContextMenu({ visible: false, x: 0, y: 0 });
        }
        if (showColorMenu) {
          setShowColorMenu(false);
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
  }, [connectingFrom, contextMenu.visible, showColorMenu, selectedItems, items, connections, saveState, editingChartId]);

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

  // Function to build comprehensive context from parent nodes and related items
  const buildExpandContext = useCallback((itemId, itemText) => {
    const itemMap = new Map(items.map(item => [item.id, item]));
    const pathToCentral = findPathToCentralNode(itemId);
    
    // Helper to find parent connections
    const findParentConnections = (itemId) => {
      const parents = [];
      connections.forEach(conn => {
        if (conn.to === itemId) {
          parents.push(conn.from);
        }
      });
      return parents;
    };
    
    // Helper to find child connections (nodes this item connects TO)
    const findChildConnections = (itemId) => {
      const children = [];
      connections.forEach(conn => {
        if (conn.from === itemId) {
          children.push(conn.to);
        }
      });
      return children;
    };
    
    let contextParts = [];
    
    // 1. Build hierarchical path context
    if (pathToCentral.length > 1) {
      contextParts.push('=== HIERARCHICAL CONTEXT ===');
      contextParts.push('The concept exists within the following hierarchy (from central topic to current concept):');
      pathToCentral.forEach((item, index) => {
        const level = '  '.repeat(index);
        contextParts.push(`${level}${index === 0 ? 'Central Topic' : `Level ${index}`}: ${item.text || '(unnamed)'}`);
      });
      contextParts.push('');
    }
    
    // 2. Add parent node context with its children
    const parentIds = findParentConnections(itemId);
    if (parentIds.length > 0) {
      parentIds.forEach(parentId => {
        const parentItem = itemMap.get(parentId);
        if (parentItem) {
          contextParts.push('=== PARENT CONTEXT ===');
          contextParts.push(`Direct Parent: ${parentItem.text || '(unnamed)'}`);
          
          // Get all children of the parent (siblings of current item)
          const parentChildren = findChildConnections(parentId);
          if (parentChildren.length > 0) {
            const siblingTexts = parentChildren
              .map(id => itemMap.get(id))
              .filter(item => item && item.id !== itemId)
              .map(item => item.text || '(unnamed)')
              .filter(text => text);
            
            if (siblingTexts.length > 0) {
              contextParts.push(`Sibling Concepts (related concepts at the same level): ${siblingTexts.join(', ')}`);
            }
          }
          contextParts.push('');
        }
      });
    }
    
    // 3. Add existing children context (if any)
    const existingChildren = findChildConnections(itemId);
    if (existingChildren.length > 0) {
      const childTexts = existingChildren
        .map(id => itemMap.get(id))
        .filter(item => item)
        .map(item => item.text || '(unnamed)')
        .filter(text => text);
      
      if (childTexts.length > 0) {
        contextParts.push('=== EXISTING CHILDREN ===');
        contextParts.push(`Current concept already has these sub-concepts: ${childTexts.join(', ')}`);
        contextParts.push('Generate NEW concepts that complement these existing ones.');
        contextParts.push('');
      }
    }
    
    // 4. Build the final context string
    let contextString = '';
    if (contextParts.length > 0) {
      contextString = contextParts.join('\n') + '\n';
    }
    
    // Add the target concept
    contextString += `=== TARGET CONCEPT TO EXPAND ===\n`;
    contextString += `Concept: ${itemText}\n\n`;
    
    return contextString;
  }, [items, connections, findPathToCentralNode]);

  // Add expand functionality
  useEffect(() => {
    window.expandSelectedConcept = async (itemId, text) => {
      if (!text) return;
      
      // Check usage limits for non-signed-in users
      if (!user) {
        if (!canExpandConcept()) {
          alert(`You've reached the limit of 4 concept expansions. Please sign in to continue expanding unlimited concepts.`);
          return;
        }
      }
      
      setExpandingItemId(itemId);
      setIsExpandingConcept(true);

      try {
        // Get the item being expanded
        const sourceItem = items.find(item => item.id === itemId);
        if (!sourceItem) throw new Error('Source item not found');
        
        // Build comprehensive context from parent nodes and related items
        const contextString = buildExpandContext(itemId, text);

        // Get Groq API key from environment
        const groqApiKey = getGroqApiKey();

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
                content: `You are an expert at identifying key related concepts within hierarchical knowledge structures. Your task is to generate exactly 5 closely related sub-concepts that expand upon a given concept, taking into account its full hierarchical context.

CRITICAL INSTRUCTIONS:
1. Analyze the hierarchical context provided - understand the full path from the central topic through parent nodes to the current concept
2. Consider the parent node's context and any sibling concepts to maintain thematic consistency
3. If existing children are listed, generate NEW concepts that complement them without redundancy
4. Each generated concept should:
   - Be directly relevant to the target concept within its hierarchical context
   - Fit naturally within the existing knowledge structure
   - Be 2-4 words long (clear and specific)
   - Use professional, field-appropriate terminology
   - Build upon the information provided by parent nodes

Guidelines:
- Generate exactly 5 related concepts, no more and no less
- Make each concept clear, specific, and actionable
- Ensure concepts are contextually appropriate given the parent nodes and hierarchy
- Avoid generic or redundant information
- Consider how parent concepts inform the scope and direction of child concepts
- The expanded concepts should logically extend from the target concept while respecting the broader context

Format:
- Return only the 5 concepts, one per line
- No prefixes, numbers, or bullet points
- Just plain text, each on its own line

Example for "Machine Learning" (in context of "Artificial Intelligence"):
Neural Network Architecture
Training Data Preparation
Model Optimization Techniques
Hyperparameter Tuning
Performance Metrics Analysis`
              },
              {
                role: 'user',
                content: `${contextString}Based on the comprehensive context provided above, generate exactly 5 key related sub-concepts that expand upon the target concept. Ensure these concepts are informed by the hierarchical structure, parent context, and existing sibling concepts.`
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
        
        // Get the center of the source item
        const sourceCenterX = sourceItem.position.x + (sourceItem.width || 150) / 2;
        const sourceCenterY = sourceItem.position.y + (sourceItem.height || 150) / 2;
        
        // Create new items and connections
        const newItems = [];
        const newConnections = [];

        const baseOrder = items.length > 0 ? Math.max(...items.map((i, idx) => i.order !== undefined ? i.order : idx)) : -1;
        concepts.forEach((concept, i) => {
          const angle = i * angleStep;
          const dimensions = calculateTextDimensions(concept, 'rectangle');
          
          // Calculate position from center of source item, then offset by half the new item's dimensions
          const newItemCenterX = sourceCenterX + radius * Math.cos(angle);
          const newItemCenterY = sourceCenterY + radius * Math.sin(angle);
          
          const newItem = {
            id: Date.now() + i,
            type: 'rectangle',
            text: concept,
            position: {
              x: newItemCenterX - dimensions.width / 2,
              y: newItemCenterY - dimensions.height / 2
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

        // Update state with new items and connections, ensuring all referenced items exist
        setItems(prevItems => {
          const allItems = [...prevItems, ...newItems];
          return allItems;
        });
        
        // Filter connections to only include those where both from and to items exist
        setConnections(prevConnections => {
          const allItemIds = new Set([
            String(itemId), // Source item that's being expanded
            ...newItems.map(item => String(item.id))
          ]);
          
          const validConnections = newConnections.filter(conn => {
            const fromExists = allItemIds.has(String(conn.from));
            const toExists = allItemIds.has(String(conn.to));
            return fromExists && toExists;
          });
          
          return [...prevConnections, ...validConnections];
        });

        // Increment usage counter for non-signed-in users
        if (!user) {
          incrementExpandCount();
        }

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
  }, [items, user, getApiBaseUrl, buildExpandContext]);

  const handleCloseMindMapPanel = () => {
    setIsMindMapPanelOpen(false);
    setMindMapPrompt(''); // Reset the prompt when closing
    if (onMindMapPanelClose) {
      onMindMapPanelClose();
    }
  };

  const cycleChartType = () => {
    const types = ['mindmap', 'xy', 'sine', 'sankey', 'flowchart'];
    const currentIndex = types.indexOf(chartGenerationType);
    const nextIndex = (currentIndex + 1) % types.length;
    setChartGenerationType(types[nextIndex]);
  };

  const getChartTypeIcon = () => {
    switch (chartGenerationType) {
      case 'mindmap':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 4v4" />
            <path d="M12 16v4" />
            <path d="M4 12h4" />
            <path d="M16 12h4" />
          </svg>
        );
      case 'xy':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="20" x2="20" y2="20" />
            <line x1="4" y1="20" x2="4" y2="4" />
            <path d="M7 14l3-3 4 4 4-8" />
          </svg>
        );
      case 'sine':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 12c2-2.67 4-4 6-4s4 1.33 6 4c2 2.67 4 4 6 4s4-1.33 6-4" />
          </svg>
        );
      case 'sankey':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="2" y="5" width="3.5" height="14" rx="0.5" fill="currentColor" opacity="0.85" />
            <rect x="18.5" y="4" width="3.5" height="5.5" rx="0.5" fill="currentColor" opacity="0.85" />
            <rect x="18.5" y="10.5" width="3.5" height="4" rx="0.5" fill="currentColor" opacity="0.85" />
            <rect x="18.5" y="15.5" width="3.5" height="4.5" rx="0.5" fill="currentColor" opacity="0.85" />
            <path d="M5.5 6.5 Q9 6 12.5 5.5 Q16 5 18.5 5.5 L18.5 9.5 Q16 9 12.5 8.5 Q9 8 5.5 8.5 Z" fill="currentColor" opacity="0.6" />
            <path d="M5.5 11 Q9 10.5 12.5 10 Q16 9.5 18.5 10 L18.5 13.5 Q16 13 12.5 12.5 Q9 12 5.5 12.5 Z" fill="currentColor" opacity="0.6" />
            <path d="M5.5 15.5 Q9 15 12.5 14.5 Q16 14 18.5 14.5 L18.5 19 Q16 18.5 12.5 18 Q9 17.5 5.5 18 Z" fill="currentColor" opacity="0.6" />
          </svg>
        );
      case 'flowchart':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="6" cy="6" r="2.5" fill="currentColor" opacity="0.8" />
            <rect x="4" y="12" width="4" height="3" rx="0.5" fill="currentColor" opacity="0.6" />
            <circle cx="14" cy="9" r="2.5" fill="currentColor" opacity="0.8" />
            <path d="M8.5 7 L11 11" stroke="currentColor" strokeWidth="1" opacity="0.6" />
            <path d="M6 13.5 L12 16" stroke="currentColor" strokeWidth="1" opacity="0.6" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getPlaceholderText = () => {
    switch (chartGenerationType) {
      case 'mindmap':
        return 'Generate a mind map...';
      case 'xy':
        return 'Generate an XY chart... (e.g., "x^2+2*x+4", "parabola function")';
      case 'sine':
        return 'Generate a sine wave... (e.g., "sin(x)*cos(x)", "combined waves")';
      case 'sankey':
        return 'Generate a Sankey chart... (e.g., "energy flow", "budget allocation")';
      case 'flowchart':
        return 'Generate a flowchart... (e.g., "order processing flow", "bug fix workflow")';
      default:
        return 'Generate...';
    }
  };

  const getButtonTitle = () => {
    switch (chartGenerationType) {
      case 'mindmap':
        return 'Generate Mind Map';
      case 'xy':
        return 'Generate XY Chart';
      case 'sine':
        return 'Generate Sine Wave';
      case 'sankey':
        return 'Generate Sankey Chart';
      case 'flowchart':
        return 'Generate Flowchart';
      default:
        return 'Generate';
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

  // Helper function to convert blob URL to data URL
  const blobToDataURL = useCallback((blobUrl) => {
    return new Promise((resolve) => {
      if (!blobUrl || !blobUrl.startsWith('blob:')) {
        resolve(blobUrl); // Return as-is if not a blob URL
        return;
      }
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (error) {
          console.warn('Failed to convert blob URL to data URL:', error);
          resolve(blobUrl); // Fallback to original URL
        }
      };
      img.onerror = () => {
        console.warn('Failed to load blob URL for conversion:', blobUrl);
        resolve(blobUrl); // Fallback to original URL
      };
      img.src = blobUrl;
    });
  }, []);

  // Helper function to wait for all images to be fully loaded
  const waitForAllImages = useCallback(async (element) => {
    const images = element.querySelectorAll('img');
    const imagePromises = Array.from(images).map((img) => {
      return new Promise((resolve) => {
        // If image is already loaded and has dimensions, resolve immediately
        if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
          resolve();
          return;
        }

        // For data URLs, create a test image to verify it loads
        if (img.src && img.src.startsWith('data:')) {
          const testImg = new Image();
          testImg.onload = () => {
            // Ensure the original image is also loaded
            if (img.complete && img.naturalWidth > 0) {
              resolve();
            } else {
              // Force reload by clearing and resetting src
              const originalSrc = img.src;
              img.src = '';
              setTimeout(() => {
                img.src = originalSrc;
                // Wait for the reload
                const loadHandler = () => resolve();
                const errorHandler = () => resolve(); // Continue even on error
                img.addEventListener('load', loadHandler, { once: true });
                img.addEventListener('error', errorHandler, { once: true });
                // Timeout fallback
                setTimeout(() => resolve(), 2000);
              }, 10);
            }
          };
          testImg.onerror = () => resolve(); // Continue even on error
          testImg.src = img.src;
        } else if (img.src && img.src.startsWith('blob:')) {
          // Convert blob URL to data URL first
          blobToDataURL(img.src).then((dataUrl) => {
            img.src = dataUrl;
            // Wait for the new src to load
            const loadHandler = () => resolve();
            const errorHandler = () => resolve();
            img.addEventListener('load', loadHandler, { once: true });
            img.addEventListener('error', errorHandler, { once: true });
            // Timeout fallback
            setTimeout(() => resolve(), 2000);
          }).catch(() => resolve());
        } else {
          // For other URLs, wait for load
          const loadHandler = () => resolve();
          const errorHandler = () => resolve();
          img.addEventListener('load', loadHandler, { once: true });
          img.addEventListener('error', errorHandler, { once: true });
          // Timeout fallback
          setTimeout(() => resolve(), 2000);
        }
      });
    });
    
    // Wait for all images with a timeout
    await Promise.race([
      Promise.all(imagePromises),
      new Promise(resolve => setTimeout(resolve, 10000)) // 10 second max timeout
    ]);
    
    // Additional delay to ensure rendering is complete
    await new Promise(resolve => setTimeout(resolve, 200));
  }, [blobToDataURL]);

  const exportToPNG = useCallback(async () => {
    const contentElement = document.querySelector('.canvas-content');
    if (!contentElement) return;

    // Calculate bounds including padding
    const bounds = calculateContentBounds();
    const exportPadding = 20;

    // Wait for all images to be fully loaded before export
    await waitForAllImages(contentElement);

    html2canvas(contentElement, {
      backgroundColor: '#f5f5f5',
      x: bounds.x - exportPadding,
      y: bounds.y - exportPadding,
      width: bounds.width + exportPadding * 2,
      height: bounds.height + exportPadding * 2,
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: false,
      foreignObjectRendering: false, // Disable foreignObject rendering which can cause issues with images
      imageTimeout: 15000, // 15 second timeout for images
      onclone: (clonedDoc) => {
        const clonedContent = clonedDoc.querySelector('.canvas-content');
        if (clonedContent) {
          clonedContent.style.transform = 'none';
          const grid = clonedContent.querySelector('.grid-background');
          if (grid) grid.style.display = 'none';
          
          // Ensure all images in cloned document are properly loaded
          const clonedImages = clonedContent.querySelectorAll('img');
          clonedImages.forEach((img) => {
            // Force images to reload if they're data URLs
            if (img.src && img.src.startsWith('data:')) {
              const originalSrc = img.src;
              img.src = '';
              setTimeout(() => {
                img.src = originalSrc;
              }, 10);
            }
          });
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
  }, [calculateContentBounds, waitForAllImages]);

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
    // Note: onLibraryStateChange is called by the useEffect that watches isSavedBoardsMenuOpen
  }, []);

  // Function to toggle Export menu (closes others)
  const toggleExportMenu = useCallback(() => {
    setIsExportMenuOpen(prev => !prev);
    setIsSavedBoardsMenuOpen(false);
    // Close UserMenu if its state was lifted up
    // Note: onLibraryStateChange is called by the useEffect that watches isSavedBoardsMenuOpen
  }, []);

  // Function to capture canvas as base64 image
  const captureCanvasAsBase64 = useCallback(async () => {
    const contentElement = document.querySelector('.canvas-content');
    if (!contentElement) return null;

    // Calculate bounds including padding
    const bounds = calculateContentBounds();
    const exportPadding = 20;

    // Wait for all images to be fully loaded before export
    await waitForAllImages(contentElement);

    try {
      const canvas = await html2canvas(contentElement, {
        backgroundColor: '#f5f5f5',
        x: bounds.x - exportPadding,
        y: bounds.y - exportPadding,
        width: bounds.width + exportPadding * 2,
        height: bounds.height + exportPadding * 2,
        scale: scale,
        useCORS: true,
        allowTaint: false,
        foreignObjectRendering: false, // Disable foreignObject rendering which can cause issues with images
        imageTimeout: 15000, // 15 second timeout for images
        onclone: (clonedDoc) => {
          const clonedContent = clonedDoc.querySelector('.canvas-content');
          if (clonedContent) {
            clonedContent.style.transform = 'none';
            const grid = clonedContent.querySelector('.grid-background');
            if (grid) grid.style.display = 'none';
            
            // Ensure all images in cloned document are properly loaded
            const clonedImages = clonedContent.querySelectorAll('img');
            clonedImages.forEach((img) => {
              // Force images to reload if they're data URLs
              if (img.src && img.src.startsWith('data:')) {
                const originalSrc = img.src;
                img.src = '';
                setTimeout(() => {
                  img.src = originalSrc;
                }, 10);
              }
            });
          }
        }
      });

      return canvas.toDataURL('image/png');
    } catch (err) {
      return null;
    }
  }, [calculateContentBounds, scale, waitForAllImages]);

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
          originalId: item.id, // preserve original id for mapping
          id: undefined, // new id generated on paste
          position: {
            x: item.position.x,
            y: item.position.y
          }
        }));

      // Get connections between selected items
      const connectionsToCopy = connections
        .filter(conn => selectedItems.has(conn.from) && selectedItems.has(conn.to))
        .map(conn => ({
          // Keep only mapping-relevant fields to avoid stale ids
          label: conn.label || '',
          fromOriginal: conn.from,
          toOriginal: conn.to,
          id: undefined
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
        if (!item || !item.position) return null;
        const newId = `item-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 6)}`;
        return {
          ...item,
          id: newId,
          position: {
            x: item.position.x + PASTE_OFFSET,
            y: item.position.y + PASTE_OFFSET
          }
        };
      }).filter(Boolean);

      // Build original->new id mapping
      const originalToNewId = new Map();
      clipboardData.items.forEach((item, index) => {
        if (item && item.originalId && newItems[index]) {
          originalToNewId.set(item.originalId, newItems[index].id);
        }
      });

      // Create new connections with updated IDs using original mapping
      const newConnections = clipboardData.connections
        .map(conn => {
          if (!conn) return null;
          const newFrom = originalToNewId.get(conn.fromOriginal);
          const newTo = originalToNewId.get(conn.toOriginal);
          if (!newFrom || !newTo) return null; // skip if any missing
          return {
            id: `connection-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            from: newFrom,
            to: newTo,
            label: conn.label || ''
          };
        })
        .filter(Boolean);

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

      // Add new items and connections to the canvas, ensuring all referenced items exist
      setItems(prevItems => {
        const allItems = [...prevItems, ...newItems];
        return allItems;
      });
      
      // Filter connections to only include those where both from and to items exist
      setConnections(prevConnections => {
        const allItemIds = new Set(newItems.map(item => String(item.id)));
        
        const validConnections = newConnections.filter(conn => {
          const fromExists = allItemIds.has(String(conn.from));
          const toExists = allItemIds.has(String(conn.to));
          return fromExists && toExists;
        });
        
        return [...prevConnections, ...validConnections];
      });
      
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
      // Space for selection box
      else if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
        window.isSpacePressed = true;
        e.preventDefault();
      }
      // Alt for alternative actions
      else if (e.code === 'AltLeft' || e.code === 'AltRight') {
        setIsAltPressed(true);
        e.preventDefault();
      }
      // Shift key tracking (no longer used for selection box, but kept for other features)
      else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        setIsShiftPressed(true);
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        window.isSpacePressed = false;
      } else if (e.code === 'AltLeft' || e.code === 'AltRight') {
        setIsAltPressed(false);
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        setIsShiftPressed(false);
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
        
        // Constrain position to canvas bounds
        const constrainedPosition = constrainPositionToCanvas(position, dimensions.width, dimensions.height);
        const mainBranchNode = {
          ...branch,
          position: constrainedPosition,
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
            
            // Constrain sub-branch position to canvas bounds
            const constrainedSubPosition = constrainPositionToCanvas(subPosition, subDimensions.width, subDimensions.height);
            const subBranchNode = {
              ...subBranch,
              position: constrainedSubPosition,
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
      
      
      // Add new items and connections, ensuring all referenced items exist
      setItems(prevItems => {
        const allItems = [...prevItems, ...newItems];
        return allItems;
      });
      
      // Filter connections to only include those where both from and to items exist
      setConnections(prevConnections => {
        const allItemIds = new Set([
          String(centralNode.id),
          ...newItems.map(item => String(item.id))
        ]);
        
        const validConnections = newConnections.filter(conn => {
          const fromExists = allItemIds.has(String(conn.from));
          const toExists = allItemIds.has(String(conn.to));
          return fromExists && toExists;
        });
        
        return [...prevConnections, ...validConnections];
      });
    }, 100);
  };

  const handleGenerateMindMap = async () => {
    // Check usage limits for non-signed-in users
    if (!user) {
      if (!canGenerateMindMap()) {
        alert(`You've reached the limit of 4 mind map generations. Please sign in to continue generating unlimited mind maps.`);
        return;
      }
    }

    setIsGeneratingMindMap(true);
    isGeneratingMindMapRef.current = true;
    try {
      // Get Groq API key from environment
      const groqApiKey = getGroqApiKey();

      // Create a central node at the user's current viewport center (user-friendly positioning)
      const canvasEl = document.querySelector('.whiteboard-canvas');
      if (!canvasEl) {
        throw new Error('Canvas element not found');
      }
      const canvasBounds = canvasEl.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const effectiveScale = scale * dpr;
      
      // Convert viewport center (screen coordinates) to canvas coordinates
      // Formula: canvasX = (screenX - panOffset.x) / effectiveScale
      const viewportCenterX = (canvasBounds.width / 2 - panOffset.x) / effectiveScale;
      const viewportCenterY = (canvasBounds.height / 2 - panOffset.y) / effectiveScale;
      
      // Get base order for new items
      const centralBaseOrder = items.length > 0 ? Math.max(...items.map((i, idx) => i.order !== undefined ? i.order : idx)) : -1;
      
      const centralNode = {
        id: `mindmap-central-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'circle',
        text: mindMapPrompt,
        position: constrainPositionToCanvas({ 
          x: viewportCenterX - 75, // Center of current viewport minus half width
          y: viewportCenterY - 75  // Center of current viewport minus half height
        }, 150, 150),
        width: 150,
        height: 150,
        order: centralBaseOrder + 1 // Assign order to central node
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

      // Calculate base order including the central node that was just added
      const branchBaseOrder = items.length > 0 
        ? Math.max(...items.map((i, idx) => i.order !== undefined ? i.order : idx), centralNode.order || 0)
        : (centralNode.order || 0);

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
        const minSpacing = 80; // Increased minimum spacing for better separation and to prevent overlap
        let attempts = 0;
        const maxAttempts = 15; // Increased attempts to find a valid position
        
        while (attempts < maxAttempts) {
          let hasCollision = false;
          
          // Check collision with central node first
          if (checkCollision(position, dimensions, centralNode, minSpacing)) {
            hasCollision = true;
          }
          
          // Check collision with all existing items using enhanced detection
          if (!hasCollision) {
            for (const existingItem of newItems) {
              if (checkCollision(position, dimensions, existingItem, minSpacing)) {
                hasCollision = true;
                break;
              }
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
        // Use a more unique ID generation to avoid collisions
        const timestamp = Date.now();
        // Constrain position to canvas bounds
        const constrainedPosition = constrainPositionToCanvas(position, dimensions.width, dimensions.height);
        const mainBranchNode = {
          id: `mindmap-${timestamp}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'rectangle',
          text: branch.text,
          position: constrainedPosition,
          width: dimensions.width,
          height: dimensions.height,
          order: branchBaseOrder + 1 + index * 2 // Assign unique order values
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
          const subMinSpacing = 50; // Increased minimum spacing for sub-branches to prevent overlap
          let subAttempts = 0;
          const subMaxAttempts = 10;
          let subCurrentRadius = subRadius;
          
          while (subAttempts < subMaxAttempts) {
            let hasCollision = false;
            
            // Check collision with central node first
            if (checkCollision(subPosition, subDimensions, centralNode, subMinSpacing)) {
              hasCollision = true;
            }
            
            // Check collision with main branch node
            if (!hasCollision && checkCollision(subPosition, subDimensions, mainBranchNode, subMinSpacing)) {
              hasCollision = true;
            }
            
            // Check collision with all existing items using enhanced detection
            if (!hasCollision) {
              for (const existingItem of newItems) {
                if (checkCollision(subPosition, subDimensions, existingItem, subMinSpacing)) {
                  hasCollision = true;
                  break;
                }
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
          
          // Constrain sub-branch position to canvas bounds
          const constrainedSubPosition = constrainPositionToCanvas(subPosition, subDimensions.width, subDimensions.height);
          const subBranchNode = {
            id: `mindmap-${timestamp}-${index}-sub-${subIndex}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'rectangle',
            text: subBranch.text,
            position: constrainedSubPosition,
            width: subDimensions.width,
            height: subDimensions.height,
            order: branchBaseOrder + 1 + index * 2 + subIndex + 1 // Assign unique order values
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

      // Store validItems in a variable accessible to setTimeout
      const mindMapItemsForCentering = [centralNode, ...validItems];
      
      // Add nodes and connections together, ensuring all referenced items exist
      // The central node was already added earlier, but we'll include it explicitly to be safe
      setItems(prevItems => {
        // Ensure central node is included (it should be in prevItems, but check explicitly)
        const centralNodeInPrev = prevItems.find(item => String(item.id) === String(centralNode.id));
        const allItems = centralNodeInPrev 
          ? [...prevItems, ...validItems]
          : [...prevItems, centralNode, ...validItems];
        
        
        // Filter connections to only include those where both from and to items exist
        // Use a Set with both string and number representations to handle type mismatches
        const allItemIds = new Set();
        
        // Add central node ID in all possible formats
        const centralIdStr = String(centralNode.id);
        const centralIdNum = Number(centralNode.id);
        allItemIds.add(centralIdStr);
        if (!isNaN(centralIdNum)) {
          allItemIds.add(centralIdNum);
          allItemIds.add(centralNode.id);
        }
        
        // Add all existing item IDs (including central node if it's there)
        prevItems.forEach(item => {
          const idStr = String(item.id);
          const idNum = Number(item.id);
          allItemIds.add(idStr);
          if (!isNaN(idNum)) {
            allItemIds.add(idNum);
            allItemIds.add(item.id);
          }
        });
        
        // Add all new item IDs (branches)
        validItems.forEach(item => {
          const idStr = String(item.id);
          const idNum = Number(item.id);
          allItemIds.add(idStr);
          if (!isNaN(idNum)) {
            allItemIds.add(idNum);
            allItemIds.add(item.id);
          }
        });
        
        // Filter connections and log for debugging
        const validConnections = newConnections.filter(conn => {
          const fromStr = String(conn.from);
          const toStr = String(conn.to);
          const fromNum = Number(conn.from);
          const toNum = Number(conn.to);
          
          // Check in multiple formats to handle type mismatches
          const fromExists = allItemIds.has(fromStr) || (!isNaN(fromNum) && allItemIds.has(fromNum)) || allItemIds.has(conn.from);
          const toExists = allItemIds.has(toStr) || (!isNaN(toNum) && allItemIds.has(toNum)) || allItemIds.has(conn.to);
          
          if (!fromExists || !toExists) {
            console.warn('Connection filtered out - missing item:', {
              connection: { from: conn.from, to: conn.to, id: conn.id },
              fromExists,
              toExists,
              fromStr,
              toStr,
              fromNum,
              toNum,
              centralNodeId: centralNode.id,
              sampleItemIds: Array.from(allItemIds).slice(0, 5)
            });
          }
          
          return fromExists && toExists;
        });
        
        
        // Update connections in the same state update to ensure they're in sync
        setConnections(prevConnections => [...prevConnections, ...validConnections]);
        
        // Increment usage counter for non-signed-in users
        if (!user) {
          incrementMindMapCount();
        }
        
        return allItems;
      });
      
      // Center view on the mind map after a short delay to ensure rendering
      setTimeout(() => {
        if (centralNode && centralNode.position && mindMapItemsForCentering.length > 0) {
          // Pan to center the view on the mind map
          const canvasEl = document.querySelector('.whiteboard-canvas');
          if (canvasEl) {
            const canvasBounds = canvasEl.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const effectiveScale = scale * dpr;
            
            // Calculate the bounds of the entire mind map to center it properly
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            
            mindMapItemsForCentering.forEach(item => {
              if (item && item.position) {
                minX = Math.min(minX, item.position.x);
                minY = Math.min(minY, item.position.y);
                maxX = Math.max(maxX, item.position.x + (item.width || 150));
                maxY = Math.max(maxY, item.position.y + (item.height || 150));
              }
            });
            
            // Calculate center of the mind map
            const mindMapCenterX = (minX + maxX) / 2;
            const mindMapCenterY = (minY + maxY) / 2;
            
            // Calculate pan offset to center the mind map in the viewport
            // Formula: panOffset = viewportCenter - (canvasPosition * scale)
            const targetX = canvasBounds.width / 2 - mindMapCenterX * effectiveScale;
            const targetY = canvasBounds.height / 2 - mindMapCenterY * effectiveScale;
            
            
            setPanOffset({ x: targetX, y: targetY });
          }
        }
      }, 200); // Increased delay to ensure all items are rendered
      
      // Don't close the panel or clear the prompt - allow multiple generations
      // User can manually close the panel if they want
    } catch (error) {
      alert(error.message || 'Failed to generate mind map. Please try again.');
      // On error, we can optionally clear the prompt, but keep panel open
    } finally {
      setIsGeneratingMindMap(false);
      // Prevent auto-save for a short period after mindmap generation to avoid saving to wrong board
      setTimeout(() => {
        isGeneratingMindMapRef.current = false;
      }, 3000); // Wait 3 seconds after generation completes before allowing auto-save
      // Don't clear the prompt - allow user to generate again with same or modified prompt
    }
  };

  const handleGenerateChart = async () => {
    // Check usage limits for non-signed-in users
    if (!user) {
      if (!canGenerateMindMap()) {
        alert(`You've reached the limit of 4 generations. Please sign in to continue generating unlimited charts.`);
        return;
      }
    }

    setIsGeneratingMindMap(true);
    isGeneratingMindMapRef.current = true;
    try {
      // Get Groq API key from environment
      const groqApiKey = getGroqApiKey();

      // Get viewport center for positioning
      const canvasEl = document.querySelector('.whiteboard-canvas');
      if (!canvasEl) {
        throw new Error('Canvas element not found');
      }
      const canvasBounds = canvasEl.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const effectiveScale = scale * dpr;
      
      const viewportCenterX = (canvasBounds.width / 2 - panOffset.x) / effectiveScale;
      const viewportCenterY = (canvasBounds.height / 2 - panOffset.y) / effectiveScale;
      
      // Get base order for new items
      const baseOrder = items.length > 0 ? Math.max(...items.map((i, idx) => i.order !== undefined ? i.order : idx)) : -1;
      
      // Model configuration
      const MODEL_ID = 'llama-3.3-70b-versatile';
      
      // Create chart-specific prompts
      let systemPrompt = '';
      let userPrompt = '';
      
      if (chartGenerationType === 'xy') {
        systemPrompt = `You are an AI chart generator specializing in creating XY charts (line, bar, or scatter plots). 
Analyze the user's request and generate a complete chart configuration in JSON format.

Return ONLY valid JSON with the following structure:
{
  "title": "Chart title (descriptive, max 50 chars)",
  "xAxisTitle": "X",
  "yAxisTitle": "Y",
  "xAxisStart": 0,
  "xAxisEnd": 10,
  "yAxisStart": 0,
  "yAxisEnd": 100,
  "xAxisMode": "number",
  "yAxisMode": "number",
  "dataMode": "equation",
  "dataEquation": "x^2+2*x+4",
  "xyChartDisplayType": "line",
  "showDataLine": true,
  "showDataPoints": true,
  "dataColor": "#FF5722"
}

Guidelines:
- Choose appropriate axis ranges based on the data
- Generate realistic data points or equations that match the user's description
- Use "line" for trends over time, "bar" for categories, "scatter" for correlations
- For equations, use formats like: x^2, sin(x), x^3-2*x, sqrt(x), etc.
- Ensure data points/equations fit within the axis ranges
- Keep axis titles simple (X, Y) unless the user specifies domain-specific labels`;

        userPrompt = `Generate an XY chart configuration for: ${mindMapPrompt}`;
      } else if (chartGenerationType === 'sine') {
        systemPrompt = `You are an AI chart generator specializing in creating sine wave charts.
Analyze the user's request and generate a complete sine wave configuration in JSON format.

Return ONLY valid JSON with the following structure:
{
  "title": "Chart title (descriptive, max 50 chars)",
  "frequency": 1.0,
  "amplitude": 1.0,
  "periods": 2,
  "waveType": "sine",
  "phaseShift": 0,
  "harmonics": 1,
  "enableModulation": false,
  "modulationDepth": 0.5,
  "xAxisStart": 0,
  "xAxisEnd": 6.28,
  "yAxisStart": -3,
  "yAxisEnd": 3
}

Guidelines:
- frequency: waves per period (typically 0.5 to 5)
- amplitude: peak value (typically 0.5 to 3)
- periods: number of complete cycles (typically 1 to 4)
- waveType: "sine" (e.g., sin(x)*cos(x)), "cosine", or "tangent"
- phaseShift: offset in radians (0 to 6.28)
- harmonics: number of harmonic components (1 to 5)
- xAxisEnd should be approximately 2π * periods
- yAxisEnd should be at least amplitude + 1`;

        userPrompt = `Generate a sine wave chart configuration for: ${mindMapPrompt}`;
      } else if (chartGenerationType === 'sankey') {
        systemPrompt = `You are an AI chart generator specializing in creating Sankey flow diagrams.
Analyze the user's request and generate a complete Sankey chart configuration in JSON format.

Return ONLY valid JSON with the following structure:
{
  "title": "Chart title (descriptive, max 50 chars)",
  "sankeyData": "source1,target1,value1; source2,target2,value2; source1,target3,value3; ...",
  "dataColor": "#4CAF50"
}

CRITICAL FORMAT REQUIREMENTS:
- Each flow entry must be in the format: "source,target,value"
- Multiple flows must be separated by semicolon and space: "; "
- NO spaces before commas within a flow entry
- Example: "Energy Production,Residential Use,500; Energy Production,Commercial Use,300; Solar Power,Energy Production,200;"
- The sankeyData string must end with a semicolon after the last entry

Guidelines:
- Generate 5-15 flow connections
- Use descriptive source and target names (2-4 words each, no commas in names)
- Values should be positive numbers (typically 10-1000)
- Ensure logical flow relationships (e.g., "Energy Production,Residential Use,500")
- Create a meaningful flow diagram that represents the user's request
- Format: "source,target,value; source,target,value; ..." (with semicolon after each entry including the last one)`;

        userPrompt = `Generate a Sankey chart configuration for: ${mindMapPrompt}`;
      } else if (chartGenerationType === 'flowchart') {
        systemPrompt = `You are an expert Flowchart Architect. Convert the user's request into a clear, actionable flowchart using ONLY circle and square nodes connected by arrows.
Return ONLY valid JSON (no markdown, no code fences). Use this schema strictly:
+{
+  "title": string, // concise (<= 50 chars)
+  "nodes": [
+    {
+      "id": string,            // unique, kebab-case [a-z0-9-], no spaces
+      "type": "circle"|"square", // circle = start/end/decision; square = process/action
+      "label": string,         // <= 24 chars, Title Case
+      "description": string,   // <= 80 chars, succinct
+      "phase": string|null,    // optional human label (e.g., Research, Strategy, Activation, Launch, Growth)
+      "phaseIndex": number|null, // optional 1-based ordering for phases (1..N); contiguous if present
+      "parentId": string|null, // optional; use for substeps of a step; max depth = 2
+      "order": number|null     // optional global reading order within same phase/level
+    }
+  ],
+  "connections": [
+    { "from": string, "to": string, "label": string|null } // label <= 18 chars
+  ]
+}
+
+Hard Requirements:
+- Use ONLY these shapes: circle (start/end/decision) and square (process/action).
+- Exactly 1 Start (circle) and at least 1 End (circle). Prefer 1 End unless parallel endings are necessary.
+- 6–15 total nodes. Up to 2 nested substep levels via parentId.
+- All ids must be referenced by at least one connection, no orphans.
+- Graph should be a DAG (no cycles). Ensure clear progression left-to-right by phaseIndex/order.
+- If parentId is used for substeps, connect the parent to the first substep, and connect substeps sequentially if needed.
+- If the request implies phases, set phase names and contiguous phaseIndex values (1..N). Within a phase, set increasing order.
+- Keep labels and descriptions crisp and non-redundant. No commas in ids. No extra keys.
+
+Conventions:
+- Start/End nodes must be type circle with labels "Start" and "End" (or variants like "Go Live" for end if appropriate).
+- Decision points (if any) must be type circle with short question labels (e.g., "Product-Market Fit?").
+- Process steps should be type square.
+
+Go-To-Market (GTM) Hint (if applicable to the request): use phases and indices like:
+  1 Research, 2 Strategy, 3 Enablement, 4 Activation, 5 Launch, 6 Growth.
+
+Self-reflection before drafting (answer silently; do not output this reasoning):
+- What are the major milestones of this process?
+- For each decision or event, what are the possible outcomes and the subsequent paths?
+- Is the flowchart as in-depth and tailored to the user's specific request and domain as it should be? If not, revise phases, nodes, and connections accordingly before producing the final output.
+
+Validation before returning:
+- Ensure ids are unique and referenced by connections. Ensure every connection's from/to exists.
+- Ensure exactly one Start and at least one End. Ensure phaseIndex values (if present) are contiguous starting at 1.
+- Ensure node count between 6 and 15. Ensure connection labels (if present) are <= 18 chars.
+
+Output a single JSON object conforming to the schema above.`;

        userPrompt = `Generate a flowchart configuration for: ${mindMapPrompt}`;
      }

      // Call Groq API
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
              content: systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to generate chart configuration');
      }

      const data = await response.json();
      const rawContent = data.choices[0].message.content;
      
      // Parse JSON response
      let chartConfig;
      try {
        chartConfig = JSON.parse(rawContent);
      } catch (parseError) {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/) || rawContent.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          chartConfig = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error('Invalid JSON response from AI');
        }
      }

      // For flowcharts, generate individual nodes and connections
      if (chartGenerationType === 'flowchart') {
        const nodes = chartConfig.nodes || [];
        const connections = chartConfig.connections || [];
        
        if (nodes.length === 0) {
          throw new Error('No nodes generated for flowchart');
        }

        // Determine start/end by indegree/outdegree for coloring
        const inCount = new Map();
        const outCount = new Map();
        nodes.forEach(n => {
          if (n && n.id) {
            inCount.set(n.id, 0);
            outCount.set(n.id, 0);
          }
        });
        connections.forEach(conn => {
          if (conn && conn.from) {
            outCount.set(conn.from, (outCount.get(conn.from) || 0) + 1);
          }
          if (conn && conn.to) {
            inCount.set(conn.to, (inCount.get(conn.to) || 0) + 1);
          }
        });

        const START_END_COLOR = '#f0f0f0';
        const MIDDLE_COLOR = '#ffffff';
        const getBgColor = (n) => {
          const indeg = inCount.get(n.id) || 0;
          const outdeg = outCount.get(n.id) || 0;
          const isStartNode = n.type === 'circle' && indeg === 0;
          const isEndNode = n.type === 'circle' && outdeg === 0;
          return (isStartNode || isEndNode) ? START_END_COLOR : MIDDLE_COLOR;
        };

        // Layout parameters
        const nodeSpacingX = 220;
        const nodeSpacingY = 140;
        const childOffsetX = 150;
        const childOffsetY = 110;
        const baseY = viewportCenterY - 120;

        // Phase grouping: determine column per phaseIndex (1..N) or inferred by first-seen order of phase
        const phaseOrderMap = new Map();
        let phaseCount = 0;
        nodes.forEach(n => {
          if (n && (n.phaseIndex || n.phase)) {
            if (typeof n.phaseIndex === 'number' && Number.isFinite(n.phaseIndex)) {
              phaseOrderMap.set(`idx-${n.phaseIndex}`, n.phaseIndex);
            } else if (n.phase && !phaseOrderMap.has(n.phase)) {
              phaseCount += 1;
              phaseOrderMap.set(n.phase, phaseCount);
            }
          }
        });

        // If no phases defined, fall back to a single column sequence
        const getPhaseIndex = (n, fallbackIndex) => {
          if (typeof n.phaseIndex === 'number' && Number.isFinite(n.phaseIndex)) return n.phaseIndex;
          if (n.phase && phaseOrderMap.has(n.phase)) return phaseOrderMap.get(n.phase);
          return fallbackIndex;
        };

        // Build parent->children map for substeps
        const childrenMap = new Map();
        nodes.forEach(n => {
          if (n.parentId) {
            if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, []);
            childrenMap.get(n.parentId).push(n);
          }
        });

        // Top-level nodes are those without parentId; group them by phase
        const topLevelByPhase = new Map();
        let fallbackPhaseCounter = 1;
        nodes.filter(n => !n.parentId).forEach(n => {
          const phaseIdx = getPhaseIndex(n, fallbackPhaseCounter);
          if (phaseIdx === fallbackPhaseCounter) fallbackPhaseCounter += 1;
          if (!topLevelByPhase.has(phaseIdx)) topLevelByPhase.set(phaseIdx, []);
          topLevelByPhase.get(phaseIdx).push(n);
        });

        // Sort phases
        const sortedPhaseIndices = Array.from(topLevelByPhase.keys()).sort((a, b) => a - b);
        const numPhases = Math.max(1, sortedPhaseIndices.length);
        const totalWidth = (numPhases - 1) * nodeSpacingX;
        const leftmostX = viewportCenterX - totalWidth / 2;

        // Create items for each node
        const flowchartTitle = chartConfig.title || 'Flowchart';
        const newItems = [];
        const nodeIdMap = {}; // Map AI node IDs to created item IDs

        // Calculate node size based on label length
        const getNodeSize = (label, type) => {
          if (type === 'circle') {
            return { width: 100, height: 100 };
          } else {
            return { width: 120, height: 80 };
          }
        };

        // Position nodes: columns by phase, rows within phase; children near parent
        let globalIdx = 0;
        const placed = new Map(); // aiId -> {x,y}

        const placeNode = (node, baseX, topY, rowIndex) => {
          const nodeSize = getNodeSize(node.label, node.type);
          const x = baseX;
          const y = topY + rowIndex * nodeSpacingY;
          const itemId = `flowchart-${Date.now()}-${globalIdx}-${Math.random().toString(36).substr(2, 9)}`;
          nodeIdMap[node.id] = itemId;
          placed.set(node.id, { x, y });
          const newItem = {
            id: itemId,
            type: node.type === 'circle' ? 'circle' : 'rectangle',
            position: { x, y },
            width: nodeSize.width,
            height: nodeSize.height,
            text: node.label,
            backgroundColor: getBgColor(node),
            order: baseOrder + globalIdx + 1
          };
          globalIdx += 1;
          newItems.push(newItem);
        };

        // Place top-level nodes per phase and then place children relative to parents
        sortedPhaseIndices.forEach((phaseIdx, phaseColumnIndex) => {
          const columnX = leftmostX + phaseColumnIndex * nodeSpacingX;
          const topNodes = (topLevelByPhase.get(phaseIdx) || []).slice().sort((a, b) => {
            const ao = (typeof a.order === 'number' ? a.order : 0);
            const bo = (typeof b.order === 'number' ? b.order : 0);
            return ao - bo;
          });

          topNodes.forEach((node, i) => {
            // Place the parent/top-level node
            placeNode(node, columnX, baseY, i);

            // Place direct children (if any) to the right of the parent
            const kids = (childrenMap.get(node.id) || []).slice().sort((a, b) => {
              const ao = (typeof a.order === 'number' ? a.order : 0);
              const bo = (typeof b.order === 'number' ? b.order : 0);
              return ao - bo;
            });
            kids.forEach((child, cIdx) => {
              const parentPos = placed.get(node.id);
              if (!parentPos) return;
              const childX = columnX + childOffsetX;
              const childY = parentPos.y + cIdx * childOffsetY;
              const nodeSize = getNodeSize(child.label, child.type);
              const itemId = `flowchart-${Date.now()}-${globalIdx}-${Math.random().toString(36).substr(2, 9)}`;
              nodeIdMap[child.id] = itemId;
              placed.set(child.id, { x: childX, y: childY });
              const newItem = {
                id: itemId,
                type: child.type === 'circle' ? 'circle' : 'rectangle',
                position: { x: childX, y: childY },
                width: nodeSize.width,
                height: nodeSize.height,
                text: child.label,
                backgroundColor: getBgColor(child),
                order: baseOrder + globalIdx + 1
              };
              globalIdx += 1;
              newItems.push(newItem);
            });
          });
        });

        // Create connections
        const newConnections = connections
          .filter(conn => nodeIdMap[conn.from] && nodeIdMap[conn.to])
          .map(conn => ({
            id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            from: nodeIdMap[conn.from],
            to: nodeIdMap[conn.to],
            label: conn.label || ''
          }));

        // Add all items to canvas
        setItems(prevItems => [...prevItems, ...newItems]);
        setConnections(prevConnections => [...prevConnections, ...newConnections]);
      } else {
        // Regular chart generation (xy, sine, sankey)
        const chartItem = {
          id: `chart-${chartGenerationType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'chart',
          chartType: chartGenerationType,
          position: {
            x: viewportCenterX - 200, // Center minus half width
            y: viewportCenterY - 150  // Center minus half height
          },
          width: 400,
          height: 300,
          order: baseOrder + 1,
          // Apply AI-generated configuration
          title: chartConfig.title || `${chartGenerationType.toUpperCase()} Chart`,
          ...(chartGenerationType === 'xy' ? {
            xAxisTitle: chartConfig.xAxisTitle || 'X',
            yAxisTitle: chartConfig.yAxisTitle || 'Y',
            xAxisStart: chartConfig.xAxisStart !== undefined ? chartConfig.xAxisStart : 0,
            xAxisEnd: chartConfig.xAxisEnd !== undefined ? chartConfig.xAxisEnd : 10,
            yAxisStart: chartConfig.yAxisStart !== undefined ? chartConfig.yAxisStart : 0,
            yAxisEnd: chartConfig.yAxisEnd !== undefined ? chartConfig.yAxisEnd : 100,
            xAxisMode: chartConfig.xAxisMode || 'number',
            yAxisMode: chartConfig.yAxisMode || 'number',
            dataMode: chartConfig.dataMode || 'points',
            dataPoints: chartConfig.dataPoints || '',
            dataEquation: chartConfig.dataEquation || '',
            xyChartDisplayType: chartConfig.xyChartDisplayType || 'line',
            showDataLine: chartConfig.showDataLine !== undefined ? chartConfig.showDataLine : true,
            showDataPoints: chartConfig.showDataPoints !== undefined ? chartConfig.showDataPoints : true,
            dataColor: chartConfig.dataColor || '#FF5722'
          } : {}),
          ...(chartGenerationType === 'sine' ? {
            frequency: chartConfig.frequency !== undefined ? chartConfig.frequency : 1,
            amplitude: chartConfig.amplitude !== undefined ? chartConfig.amplitude : 1,
            periods: chartConfig.periods !== undefined ? chartConfig.periods : 1,
            waveType: chartConfig.waveType || 'sine',
            phaseShift: chartConfig.phaseShift !== undefined ? chartConfig.phaseShift : 0,
            harmonics: chartConfig.harmonics !== undefined ? chartConfig.harmonics : 1,
            enableModulation: chartConfig.enableModulation !== undefined ? chartConfig.enableModulation : false,
            modulationDepth: chartConfig.modulationDepth !== undefined ? chartConfig.modulationDepth : 0.5,
            xAxisStart: chartConfig.xAxisStart !== undefined ? chartConfig.xAxisStart : 0,
            xAxisEnd: chartConfig.xAxisEnd !== undefined ? chartConfig.xAxisEnd : (2 * Math.PI * (chartConfig.periods || 1)),
            yAxisStart: chartConfig.yAxisStart !== undefined ? chartConfig.yAxisStart : -3,
            yAxisEnd: chartConfig.yAxisEnd !== undefined ? chartConfig.yAxisEnd : 3
          } : {}),
          ...(chartGenerationType === 'sankey' ? {
            sankeyData: chartConfig.sankeyData || '',
            dataColor: chartConfig.dataColor || '#4CAF50'
          } : {})
        };

        // Add chart to canvas
        setItems(prevItems => [...prevItems, chartItem]);
      }

      // Increment usage count
      if (!user) {
        incrementMindMapCount();
      }

      // Don't clear the prompt - allow user to generate again
    } catch (error) {
      console.error('Error generating chart:', error);
      alert(error.message || 'Failed to generate chart. Please try again.');
    } finally {
      setIsGeneratingMindMap(false);
      setTimeout(() => {
        isGeneratingMindMapRef.current = false;
      }, 3000);
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
        fontWeight: selectedItem.fontWeight || 'normal',
        fontStyle: selectedItem.fontStyle || 'normal',
        textDecoration: selectedItem.textDecoration || 'none',
        textAlign: selectedItem.textAlign || 'center',
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

  // Font size presets mapping
  const fontSizePresets = {
    'Header 1': 32,
    'Header 2': 24,
    'Header 3': 20,
    'Body': 14,
    'Small': 12
  };

  // Get current preset name based on font size
  const getCurrentPreset = (fontSize) => {
    const size = parseInt(fontSize);
    // Find the closest preset
    if (size >= 28) return 'Header 1';
    if (size >= 22) return 'Header 2';
    if (size >= 17) return 'Header 3';
    if (size >= 13) return 'Body';
    return 'Small';
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

  // Handler for preset selection
  const handlePresetChange = (presetName) => {
    const size = fontSizePresets[presetName];
    if (size) {
      handleFontSizeChange(size);
    }
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
      {selectedItem && selectedItem.type !== 'chart' && selectedItem.type !== 'image' && selectedItems.size === 1 && !isSearchPanelOpen && showColorMenu && (
        <div 
          className="color-menu-panel"
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
              {selectedItem && selectedItem.type === 'rectangle' && (
                <option value="object">Object Settings</option>
              )}
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
                    border: isDarkMode ? '1px solid #404040' : '1px solid #ddd',
                    fontSize: '12px',
                    background: isDarkMode ? '#2d2d2d' : 'white',
                    color: isDarkMode ? '#e5e5e5' : '#333',
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
                <select
                  value={getCurrentPreset(textStyling.fontSize)}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    border: isDarkMode ? '1px solid #404040' : '1px solid #ddd',
                    backgroundColor: isDarkMode ? '#2d2d2d' : 'white',
                    color: isDarkMode ? '#e5e5e5' : '#333',
                    cursor: 'pointer',
                    outline: 'none',
                    marginBottom: '8px'
                  }}
                >
                  <option value="Header 1">Header 1</option>
                  <option value="Header 2">Header 2</option>
                  <option value="Header 3">Header 3</option>
                  <option value="Body">Body</option>
                  <option value="Small">Small</option>
                </select>
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
              
              {/* Text Formatting Controls */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: 11, marginBottom: 4 }}>Text Formatting</div>
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center',
                }}>
                  <button
                    onClick={() => {
                      if (!selectedItem || selectedItem.type === 'chart') return;
                      const isBold = selectedItem.fontWeight === 'bold' || selectedItem.fontWeight === '700' || selectedItem.fontWeight === 700;
                      const newWeight = isBold ? 'normal' : 'bold';
                      setItems(prevItems => prevItems.map(item =>
                        item.id === selectedItem.id
                          ? { ...item, fontWeight: newWeight }
                          : item
                      ));
                      setTextStyling(prev => ({ ...prev, fontWeight: newWeight }));
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      border: isDarkMode 
                        ? `1px solid ${(selectedItem?.fontWeight === 'bold' || selectedItem?.fontWeight === '700' || selectedItem?.fontWeight === 700) ? '#4285f4' : '#404040'}` 
                        : '1px solid #ddd',
                      borderRadius: '4px',
                      background: isDarkMode
                        ? ((selectedItem?.fontWeight === 'bold' || selectedItem?.fontWeight === '700' || selectedItem?.fontWeight === 700) ? 'rgba(66, 133, 244, 0.3)' : '#2d2d2d')
                        : ((selectedItem?.fontWeight === 'bold' || selectedItem?.fontWeight === '700' || selectedItem?.fontWeight === 700) ? '#e3f2fd' : 'white'),
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: isDarkMode
                        ? ((selectedItem?.fontWeight === 'bold' || selectedItem?.fontWeight === '700' || selectedItem?.fontWeight === 700) ? '#90caf9' : '#e5e5e5')
                        : ((selectedItem?.fontWeight === 'bold' || selectedItem?.fontWeight === '700' || selectedItem?.fontWeight === 700) ? '#1976d2' : '#333'),
                      transition: 'all 0.2s ease',
                    }}
                    title="Bold"
                  >
                    B
                  </button>
                  <button
                    onClick={() => {
                      if (!selectedItem || selectedItem.type === 'chart') return;
                      const isItalic = selectedItem.fontStyle === 'italic';
                      const newStyle = isItalic ? 'normal' : 'italic';
                      setItems(prevItems => prevItems.map(item =>
                        item.id === selectedItem.id
                          ? { ...item, fontStyle: newStyle }
                          : item
                      ));
                      setTextStyling(prev => ({ ...prev, fontStyle: newStyle }));
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      border: isDarkMode 
                        ? `1px solid ${selectedItem?.fontStyle === 'italic' ? '#4285f4' : '#404040'}` 
                        : '1px solid #ddd',
                      borderRadius: '4px',
                      background: isDarkMode
                        ? (selectedItem?.fontStyle === 'italic' ? 'rgba(66, 133, 244, 0.3)' : '#2d2d2d')
                        : (selectedItem?.fontStyle === 'italic' ? '#e3f2fd' : 'white'),
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontStyle: 'italic',
                      color: isDarkMode
                        ? (selectedItem?.fontStyle === 'italic' ? '#90caf9' : '#e5e5e5')
                        : (selectedItem?.fontStyle === 'italic' ? '#1976d2' : '#333'),
                      transition: 'all 0.2s ease',
                    }}
                    title="Italic"
                  >
                    I
                  </button>
                  <button
                    onClick={() => {
                      if (!selectedItem || selectedItem.type === 'chart') return;
                      const isUnderlined = selectedItem.textDecoration === 'underline';
                      const newDecoration = isUnderlined ? 'none' : 'underline';
                      setItems(prevItems => prevItems.map(item =>
                        item.id === selectedItem.id
                          ? { ...item, textDecoration: newDecoration }
                          : item
                      ));
                      setTextStyling(prev => ({ ...prev, textDecoration: newDecoration }));
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      border: isDarkMode 
                        ? `1px solid ${selectedItem?.textDecoration === 'underline' ? '#4285f4' : '#404040'}` 
                        : '1px solid #ddd',
                      borderRadius: '4px',
                      background: isDarkMode
                        ? (selectedItem?.textDecoration === 'underline' ? 'rgba(66, 133, 244, 0.3)' : '#2d2d2d')
                        : (selectedItem?.textDecoration === 'underline' ? '#e3f2fd' : 'white'),
                      cursor: 'pointer',
                      fontSize: '12px',
                      textDecoration: 'underline',
                      color: isDarkMode
                        ? (selectedItem?.textDecoration === 'underline' ? '#90caf9' : '#e5e5e5')
                        : (selectedItem?.textDecoration === 'underline' ? '#1976d2' : '#333'),
                      transition: 'all 0.2s ease',
                    }}
                    title="Underline"
                  >
                    U
                  </button>
                </div>
              </div>
              
              {/* Text Alignment Control */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: 11, marginBottom: 4 }}>Text Alignment</div>
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center',
                }}>
                  <button
                    onClick={() => {
                      if (!selectedItem || selectedItem.type === 'chart') return;
                      setItems(prevItems => prevItems.map(item =>
                        item.id === selectedItem.id
                          ? { ...item, textAlign: 'left' }
                          : item
                      ));
                      setTextStyling(prev => ({ ...prev, textAlign: 'left' }));
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      border: isDarkMode 
                        ? `1px solid ${selectedItem?.textAlign === 'left' ? '#4285f4' : '#404040'}` 
                        : '1px solid #ddd',
                      borderRadius: '4px',
                      background: isDarkMode
                        ? (selectedItem?.textAlign === 'left' ? 'rgba(66, 133, 244, 0.3)' : '#2d2d2d')
                        : (selectedItem?.textAlign === 'left' ? '#e3f2fd' : 'white'),
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: isDarkMode
                        ? (selectedItem?.textAlign === 'left' ? '#90caf9' : '#e5e5e5')
                        : (selectedItem?.textAlign === 'left' ? '#1976d2' : '#333'),
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Align Left"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="12" x2="15" y2="12" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (!selectedItem || selectedItem.type === 'chart') return;
                      setItems(prevItems => prevItems.map(item =>
                        item.id === selectedItem.id
                          ? { ...item, textAlign: 'center' }
                          : item
                      ));
                      setTextStyling(prev => ({ ...prev, textAlign: 'center' }));
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      border: isDarkMode 
                        ? `1px solid ${selectedItem?.textAlign === 'center' ? '#4285f4' : '#404040'}` 
                        : '1px solid #ddd',
                      borderRadius: '4px',
                      background: isDarkMode
                        ? (selectedItem?.textAlign === 'center' ? 'rgba(66, 133, 244, 0.3)' : '#2d2d2d')
                        : (selectedItem?.textAlign === 'center' ? '#e3f2fd' : 'white'),
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: isDarkMode
                        ? (selectedItem?.textAlign === 'center' ? '#90caf9' : '#e5e5e5')
                        : (selectedItem?.textAlign === 'center' ? '#1976d2' : '#333'),
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Align Center"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="7" y1="12" x2="17" y2="12" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (!selectedItem || selectedItem.type === 'chart') return;
                      setItems(prevItems => prevItems.map(item =>
                        item.id === selectedItem.id
                          ? { ...item, textAlign: 'right' }
                          : item
                      ));
                      setTextStyling(prev => ({ ...prev, textAlign: 'right' }));
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      border: isDarkMode 
                        ? `1px solid ${selectedItem?.textAlign === 'right' ? '#4285f4' : '#404040'}` 
                        : '1px solid #ddd',
                      borderRadius: '4px',
                      background: isDarkMode
                        ? (selectedItem?.textAlign === 'right' ? 'rgba(66, 133, 244, 0.3)' : '#2d2d2d')
                        : (selectedItem?.textAlign === 'right' ? '#e3f2fd' : 'white'),
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: isDarkMode
                        ? (selectedItem?.textAlign === 'right' ? '#90caf9' : '#e5e5e5')
                        : (selectedItem?.textAlign === 'right' ? '#1976d2' : '#333'),
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Align Right"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="9" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                  </button>
                </div>
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

          {/* Object Settings Section - Only for rectangles */}
          {activeColorSection === 'object' && selectedItem && selectedItem.type === 'rectangle' && (
            <>
              <div style={{ fontSize: 13, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Object Settings</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => setUnitMode('px')}
                    style={{
                      padding: '2px 8px',
                      fontSize: '10px',
                      borderRadius: '4px',
                      border: isDarkMode ? '1px solid #404040' : '1px solid #ddd',
                      background: isDarkMode ? (unitMode === 'px' ? '#4285f4' : '#2d2d2d') : (unitMode === 'px' ? '#e3f2fd' : 'white'),
                      color: isDarkMode ? (unitMode === 'px' ? '#90caf9' : '#e5e5e5') : (unitMode === 'px' ? '#1976d2' : '#333'),
                      cursor: 'pointer',
                      fontWeight: unitMode === 'px' ? '600' : '400',
                    }}
                    title="Use pixels"
                  >
                    px
                  </button>
                  <button
                    onClick={() => setUnitMode('mm')}
                    style={{
                      padding: '2px 8px',
                      fontSize: '10px',
                      borderRadius: '4px',
                      border: isDarkMode ? '1px solid #404040' : '1px solid #ddd',
                      background: isDarkMode ? (unitMode === 'mm' ? '#4285f4' : '#2d2d2d') : (unitMode === 'mm' ? '#e3f2fd' : 'white'),
                      color: isDarkMode ? (unitMode === 'mm' ? '#90caf9' : '#e5e5e5') : (unitMode === 'mm' ? '#1976d2' : '#333'),
                      cursor: 'pointer',
                      fontWeight: unitMode === 'mm' ? '600' : '400',
                    }}
                    title="Use millimeters"
                  >
                    mm
                  </button>
                </div>
              </div>
              
              {/* Corner Radius Control */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: 10, marginBottom: 3 }}>Corner Radius: {selectedItem.cornerRadius || 0}px</div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={selectedItem.cornerRadius || 0}
                  onChange={(e) => {
                    const cornerRadius = parseInt(e.target.value) || 0;
                    setItems(prevItems => prevItems.map(item =>
                      item.id === selectedItem.id
                        ? { ...item, cornerRadius }
                        : item
                    ));
                  }}
                  style={{
                    width: '100%',
                    height: '4px',
                    borderRadius: '2px',
                    background: isDarkMode ? '#404040' : '#ddd',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                />
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={selectedItem.cornerRadius || 0}
                  onChange={(e) => {
                    const cornerRadius = Math.max(0, Math.min(50, parseInt(e.target.value) || 0));
                    setItems(prevItems => prevItems.map(item =>
                      item.id === selectedItem.id
                        ? { ...item, cornerRadius }
                        : item
                    ));
                  }}
                  style={{
                    width: '100%',
                    marginTop: '3px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: isDarkMode ? '1px solid #404040' : '1px solid #ddd',
                    fontSize: '12px',
                    background: isDarkMode ? '#2d2d2d' : 'white',
                    color: isDarkMode ? '#e5e5e5' : '#333',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Width Control */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: 10, marginBottom: 3 }}>
                  Width: {unitMode === 'px' 
                    ? `${selectedItem.width || 0}px (${((selectedItem.width || 0) * 0.264583).toFixed(2)} mm)`
                    : `${((selectedItem.width || 0) * 0.264583).toFixed(2)}mm (${selectedItem.width || 0}px)`
                  }
                </div>
                <input
                  type="number"
                  min={unitMode === 'px' ? 10 : (10 * 0.264583).toFixed(2)}
                  max={unitMode === 'px' ? 2000 : (2000 * 0.264583).toFixed(2)}
                  step={unitMode === 'px' ? 1 : 0.01}
                  value={unitMode === 'px' 
                    ? (selectedItem.width || 0)
                    : ((selectedItem.width || 0) * 0.264583).toFixed(2)
                  }
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    const width = unitMode === 'px' 
                      ? Math.max(10, Math.min(2000, value))
                      : Math.max(10, Math.min(2000, Math.round(value / 0.264583)));
                    setItems(prevItems => prevItems.map(item =>
                      item.id === selectedItem.id
                        ? { ...item, width }
                        : item
                    ));
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: isDarkMode ? '1px solid #404040' : '1px solid #ddd',
                    fontSize: '12px',
                    background: isDarkMode ? '#2d2d2d' : 'white',
                    color: isDarkMode ? '#e5e5e5' : '#333',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Height Control */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: 10, marginBottom: 3 }}>
                  Height: {unitMode === 'px' 
                    ? `${selectedItem.height || 0}px (${((selectedItem.height || 0) * 0.264583).toFixed(2)} mm)`
                    : `${((selectedItem.height || 0) * 0.264583).toFixed(2)}mm (${selectedItem.height || 0}px)`
                  }
                </div>
                <input
                  type="number"
                  min={unitMode === 'px' ? 10 : (10 * 0.264583).toFixed(2)}
                  max={unitMode === 'px' ? 2000 : (2000 * 0.264583).toFixed(2)}
                  step={unitMode === 'px' ? 1 : 0.01}
                  value={unitMode === 'px' 
                    ? (selectedItem.height || 0)
                    : ((selectedItem.height || 0) * 0.264583).toFixed(2)
                  }
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    const height = unitMode === 'px' 
                      ? Math.max(10, Math.min(2000, value))
                      : Math.max(10, Math.min(2000, Math.round(value / 0.264583)));
                    setItems(prevItems => prevItems.map(item =>
                      item.id === selectedItem.id
                        ? { ...item, height }
                        : item
                    ));
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: isDarkMode ? '1px solid #404040' : '1px solid #ddd',
                    fontSize: '12px',
                    background: isDarkMode ? '#2d2d2d' : 'white',
                    color: isDarkMode ? '#e5e5e5' : '#333',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}
      <div className="whiteboard-header">
        <div className="header-logo-island">
          <div
            style={{
              width: '24px',
              height: '24px',
              overflow: 'hidden',
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
                height: '24px',
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
        ref={(node) => {
          drop(node);
          canvasRef.current = node;
        }}
        className={`whiteboard-canvas ${isPanning ? 'panning' : ''} ${isDraggingOver ? 'drag-over' : ''}`}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
        onContextMenu={(e) => {
          // Prevent context menu when right-click dragging for selection
          if (isRightClickSelecting || isSelecting) {
            e.preventDefault();
          }
        }}
        onDragOver={(e) => {
          // Only prevent default for file drops, let react-dnd handle its own drops
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(true);
          }
          // Don't prevent default for react-dnd items - let react-dnd handle them
        }}
        onDragEnter={(e) => {
          // Only prevent default for file drops, let react-dnd handle its own drops
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(true);
          }
          // Don't prevent default for react-dnd items - let react-dnd handle them
        }}
        onDragLeave={(e) => {
          // Only prevent default for file drops
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            e.stopPropagation();
          }
          // Only hide drag over if we're actually leaving the canvas
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsDraggingOver(false);
          }
        }}
        onDrop={(e) => {
          // Only handle file drops here, let react-dnd handle its own drops
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(false);
            const dropPosition = {
              x: e.clientX,
              y: e.clientY
            };
            handleImageDrop(e, dropPosition);
          }
          // Don't prevent default for react-dnd items - let react-dnd handle them
        }}
        style={{
          cursor: isPanning ? 'grabbing' : (isSpacePressed || isRightClickSelecting ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'20\' height=\'20\' viewBox=\'0 0 32 32\'%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'8\' stroke=\'%23000000\' stroke-width=\'2.5\' fill=\'none\'/%3E%3Cline x1=\'20\' y1=\'20\' x2=\'28\' y2=\'28\' stroke=\'%23000000\' stroke-width=\'2.5\' stroke-linecap=\'round\'/%3E%3C/svg%3E") 10 10, crosshair' : 'grab'),
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          height: showFooter ? 'calc(100% - 15px)' : '100%',
          ...(isDraggingOver && {
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            border: '2px dashed #2196F3'
          })
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
              <span className="mouse-action">Drag</span> to pan
              <span className="touch-tip">• Use two fingers to pan on touch devices</span>
            </div>
            <div className="control-tip">
              <span className="mouse-action">Drag</span> an object to move it
            </div>
            <div className="control-tip">
              <span className="keyboard-key">SPACE</span> + <span className="mouse-action">Drag</span> to group highlight for AI insights
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
            .filter(item => {
              // Only render items with valid position and dimensions
              if (!item || !item.position || typeof item.position.x !== 'number' || typeof item.position.y !== 'number') {
                console.warn('Filtered out chart item - invalid position', item);
                return false;
              }
              if (!item.width || !item.height || item.width <= 0 || item.height <= 0) {
                console.warn('Filtered out chart item - invalid dimensions', item);
                return false;
              }
              return item.type === 'chart';
            })
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
                updateRotation={updateItemRotation}
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
                onShowColorMenu={handleShowColorMenu}
              />
            ))}
          {/* Render non-chart items after (in front), sorted by order */}
          {items
            .filter(item => {
              // Only render items with valid position and dimensions
              if (!item || !item.position || typeof item.position.x !== 'number' || typeof item.position.y !== 'number') {
                console.warn('Filtered out non-chart item - invalid position', item);
                return false;
              }
              if (!item.width || !item.height || item.width <= 0 || item.height <= 0) {
                console.warn('Filtered out non-chart item - invalid dimensions', item);
                return false;
              }
              return item.type !== 'chart';
            })
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
                updateRotation={updateItemRotation}
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
                onShowColorMenu={handleShowColorMenu}
              />
            ))}
        </div>

        {selectionBox && (
          <div
            className="selection-box"
            style={{
              position: 'absolute',
              left: selectionBox.x * (scale * (window.devicePixelRatio || 1)) + panOffset.x,
              top: selectionBox.y * (scale * (window.devicePixelRatio || 1)) + panOffset.y,
              width: selectionBox.width * (scale * (window.devicePixelRatio || 1)),
              height: selectionBox.height * (scale * (window.devicePixelRatio || 1)),
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
                Bring to Front
              </div>
              <div className="context-menu-option" onClick={() => handleContextMenuAction('bringForward')}>
                Bring Forward
              </div>
              <div className="context-menu-option" onClick={() => handleContextMenuAction('pushBackward')}>
                Push Backward
              </div>
              <div className="context-menu-option" onClick={() => handleContextMenuAction('pushToBack')}>
                Push to Back
              </div>
              <div className="context-menu-divider"></div>
            </>
          )}
          <div className="context-menu-option" onClick={() => handleContextMenuAction('delete')}>
            Delete Selected ({selectedItems.size})
          </div>
          <div className="context-menu-option" onClick={() => handleContextMenuAction('move')}>
            Move Selected ({selectedItems.size})
          </div>
        </div>
      )}

      {isSearchPanelOpen && (
        <SearchPanel
          highlightedItems={highlightedItems}
          onClose={handleCloseSearchPanel}
          onFullscreenChange={setIsSearchPanelFullscreen}
          currentBoardId={currentBoardId}
          onHighlightedItemsChange={setHighlightedItems}
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
              chartType: editingChart.chartType,
              // Data plotting settings (for XY charts)
              dataMode: editingChart.dataMode || 'none',
              dataPoints: editingChart.dataPoints || '',
              dataEquation: editingChart.dataEquation || '',
              dataPointCount: editingChart.dataPointCount || 100,
              showDataLine: editingChart.showDataLine !== false,
              showDataPoints: editingChart.showDataPoints !== false,
              dataColor: editingChart.dataColor || '#FF5722',
              xyChartDisplayType: editingChart.xyChartDisplayType || 'line',
              // Sankey chart settings
              sankeyData: editingChart.sankeyData || '',
              sankeyFileName: editingChart.sankeyFileName || ''
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
                  if (chartGenerationType === 'mindmap') {
                    handleGenerateMindMap();
                  } else {
                    handleGenerateChart();
                  }
                }
                if (e.key === 'Escape') {
                  handleCloseMindMapPanel();
                }
              }}
              placeholder={getPlaceholderText()}
              autoFocus
              disabled={isGeneratingMindMap}
            />
            <button 
              className="mind-map-prompt-chart-type"
              onClick={cycleChartType}
              title={`Switch chart type (Current: ${getButtonTitle()})`}
              disabled={isGeneratingMindMap}
            >
              {getChartTypeIcon()}
            </button>
            <button 
              className="mind-map-prompt-button"
              onClick={() => {
                if (chartGenerationType === 'mindmap') {
                  handleGenerateMindMap();
                } else {
                  handleGenerateChart();
                }
              }}
              disabled={isGeneratingMindMap || !mindMapPrompt.trim()}
              title={getButtonTitle()}
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

      {/* Usage Tracker for non-signed-in users */}
      {!user && <UsageTracker key={user ? 'hidden' : 'visible'} isSearchPanelOpen={isSearchPanelOpen} />}

      {/* Image upload indicator */}
      {isUploadingImage && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '20px 30px',
            borderRadius: '8px',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '16px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div className="loading-spinner" style={{
            width: '20px',
            height: '20px',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderTop: '2px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span>Uploading image...</span>
        </div>
      )}


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