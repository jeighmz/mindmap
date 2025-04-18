import React, { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useDrop } from 'react-dnd';
import html2canvas from 'html2canvas';
import WhiteboardItem from './WhiteboardItem';
import Connector from './Connector';
import SavedWhiteboardsMenu from './SavedWhiteboardsMenu';
import SearchPanel from './SearchPanel';
// import PublishModal from './PublishModal';  // Temporarily removed
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase-config';
/* eslint-disable-next-line no-unused-vars */
import { useAuth } from '../../contexts/AuthContext';
import UserMenu from '../UserMenu';
import PricingTable from '../Pricing';
import { useNavigate } from 'react-router-dom';
import { useTierPermissions } from '../../hooks/useTierPermissions';

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
  const [scale, setScale] = useState(1);
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
  const [isSavedBoardsMenuOpen, setIsSavedBoardsMenuOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const navigate = useNavigate();
  const { userTier } = useAuth();
  const { canExport, getCurrentTier } = useTierPermissions();

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
      setPanOffset(prev => ({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      }));
    }

    if (isSelecting && selectionBox) {
      const selectedItems = items.filter(item => {
        return (
          item.position.x < selectionBox.x + selectionBox.width &&
          item.position.x + item.width > selectionBox.x &&
          item.position.y < selectionBox.y + selectionBox.height &&
          item.position.y + item.height > selectionBox.y
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
  }, [isPanning, panStart, isSelecting, selectionBox, items]);

  const handleMouseMove = useCallback((e) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
    
    const canvas = document.querySelector('.whiteboard-canvas');
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - panOffset.x) / scale;
      const y = (e.clientY - rect.top - panOffset.y) / scale;
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
        const x = (e.clientX - rect.left - panOffset.x) / scale;
        const y = (e.clientY - rect.top - panOffset.y) / scale;
        
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
    const handleGlobalMouseUp = (e) => {
      if (isPanning) {
        handleMouseUp(e);
      }
    };

    const handleGlobalMouseMove = (e) => {
      if (isPanning) {
        setPanOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y
        });
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
  }, [isPanning, panStart, handleMouseUp]);

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
        const newItem = {
          id: Date.now(),
          type: item.type,
          position: {
            x: (offset.x - canvasRect.left - 50) / scale,
            y: (offset.y - canvasRect.top - 50) / scale
          },
          text: item.type === 'sticky' ? 'New note' : '',
          width: item.type === 'sticky' ? 200 : 100,
          height: item.type === 'sticky' ? 200 : 60
        };
        setItems(prevItems => [...prevItems, newItem]);
      }
      return undefined;
    }
  }), [scale]);

  const handleWheel = (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(s => Math.min(Math.max(0.1, s * delta), 4));
    }
  };

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

  const updateItemText = (id, text) => {
    setItems(items.map(item =>
      item.id === id
        ? { ...item, text }
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

  const handleSaveWhiteboard = (name) => {
    const newBoard = {
      id: Date.now(),
      name,
      savedAt: new Date().toISOString(),
      data: {
        items,
        connections,
        scale,
        panOffset
      }
    };

    const updatedBoards = [...savedWhiteboards, newBoard];
    setSavedWhiteboards(updatedBoards);
    localStorage.setItem('savedWhiteboards', JSON.stringify(updatedBoards));
    setCurrentBoardId(newBoard.id);
  };

  const handleLoadWhiteboard = (boardId, content) => {
    console.log('handleLoadWhiteboard called with:', { boardId, content });
    
    // For personal boards, use the passed content directly
    if (content) {
      console.log('Loading personal board with content:', content);
      console.log('Content structure check:', {
        hasItems: Array.isArray(content.items),
        itemsLength: content.items?.length || 0,
        hasConnections: Array.isArray(content.connections),
        connectionsLength: content.connections?.length || 0,
        scale: content.scale,
        panOffset: content.panOffset
      });
      
      setItems(content.items || []);
      setConnections(content.connections || []);
      setScale(content.scale || 1);
      setPanOffset(content.panOffset || { x: 0, y: 0 });
      setCurrentBoardId(boardId);
      return;
    }

    // For demo boards stored in localStorage
    const board = savedWhiteboards.find(b => b.id === boardId);
    if (board) {
      console.log('Loading demo board from localStorage:', board);
      setItems(board.data.items);
      setConnections(board.data.connections);
      setScale(board.data.scale);
      setPanOffset(board.data.panOffset);
      setCurrentBoardId(boardId);
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
    const exportPadding = 20; // Add some padding around the content

    html2canvas(contentElement, {
      backgroundColor: '#f5f5f5', // Match canvas background or set to null for transparent
      // Use the calculated bounds to capture only the relevant area
      x: bounds.x - exportPadding, 
      y: bounds.y - exportPadding,
      width: bounds.width + exportPadding * 2,
      height: bounds.height + exportPadding * 2,
      // Apply the current scale to the capture
      scale: scale, 
      // Ensure foreign objects (like SVGs for connectors) are rendered
      useCORS: true, 
      logging: true, // Enable logging for debugging
      onclone: (clonedDoc) => {
        // Optional: Make adjustments to the cloned document before rendering
        // For example, ensure connector SVGs are correctly styled/positioned if needed
        const clonedContent = clonedDoc.querySelector('.canvas-content');
        if (clonedContent) {
          // Reset transform on the cloned content div as html2canvas handles positioning via x, y
          clonedContent.style.transform = 'none'; 
          // Ensure grid background is removed if you don't want it in export
          const grid = clonedContent.querySelector('.grid-background');
          if (grid) grid.style.display = 'none'; 
        }
      }
    }).then(canvas => {
      // Create a link to download the generated canvas image
      const link = document.createElement('a');
      link.download = 'mindmap.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }).catch(err => {
      console.error("Error exporting to PNG:", err);
      alert("Could not export to PNG. See console for details.");
    });

  }, [calculateContentBounds, scale]);

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

  const renderExportMenu = () => {
    const currentTier = getCurrentTier();
    
    return (
      <div className="export-menu">
        <button 
          onClick={() => { exportToPNG(); toggleExportMenu(); }}
          className={canExport('png') ? '' : 'disabled'}
          disabled={!canExport('png')}
        >
          🖼️ Export as PNG
          {!canExport('png') && <span className="upgrade-note">Available in Free tier</span>}
        </button>

        <button 
          onClick={() => { exportToPDF(); toggleExportMenu(); }}
          className={canExport('pdf') ? '' : 'disabled'}
          disabled={!canExport('pdf')}
        >
          📄 Export as PDF
          {!canExport('pdf') && <span className="upgrade-note">Available in Starter tier</span>}
        </button>

        <button 
          onClick={() => { exportToMarkdown(); toggleExportMenu(); }}
          className={canExport('markdown') ? '' : 'disabled'}
          disabled={!canExport('markdown')}
        >
          📝 Export as Markdown
          {!canExport('markdown') && <span className="upgrade-note">Available in Starter tier</span>}
        </button>

        <button 
          onClick={() => { exportToJSON(); toggleExportMenu(); }}
          className={canExport('json') ? '' : 'disabled'}
          disabled={!canExport('json')}
        >
          🔧 Export as JSON
          {!canExport('json') && <span className="upgrade-note">Available in Pro tier</span>}
        </button>

        <button 
          onClick={() => { exportToMM(); toggleExportMenu(); }}
          className={canExport('mm') ? '' : 'disabled'}
          disabled={!canExport('mm')}
        >
          🗺️ Export as Mind Map (.mm)
          {!canExport('mm') && <span className="upgrade-note">Available in Pro tier</span>}
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

  return (
    <div className={`whiteboard-container ${isSearchPanelOpen ? 'panel-open' : ''}`} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div className="whiteboard-header">
        <div className="header-left-controls">
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
              📥 Export
            </button>
            {isExportMenuOpen && renderExportMenu()}
          </div>
          <button 
            className="header-button"
            onClick={() => setIsPricingOpen(true)}
          >
            💎 Pricing
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
          </div>
        </div>

        <div className="whiteboard-controls-overlay">
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
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
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
          {items.map(item => (
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
              left: selectionBox.x * scale + panOffset.x,
              top: selectionBox.y * scale + panOffset.y,
              width: selectionBox.width * scale,
              height: selectionBox.height * scale,
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
                onClick={() => setIsMindMapPanelOpen(false)}
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
    </div>
  );
});

export default WhiteboardCanvas; 