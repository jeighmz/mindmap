import React, { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useDrop } from 'react-dnd';
import WhiteboardItem from './WhiteboardItem';
import Connector from './Connector';
import SavedWhiteboardsMenu from './SavedWhiteboardsMenu';
import SearchPanel from './SearchPanel';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase-config';
import { useAuth } from '../../context/AuthContext';

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
  };

  const generateMindMap = async () => {
    if (!mindMapPrompt.trim()) return;
    
    setIsGeneratingMindMap(true);
    
    try {
      // Get environment variables directly from window.env if available, fallback to process.env
      const apiKey = window?.env?.REACT_APP_GROQ_API_KEY || process.env.REACT_APP_GROQ_API_KEY;
      const model = window?.env?.REACT_APP_GROQ_MODEL || process.env.REACT_APP_GROQ_MODEL || 'llama-3.3-70b-versatile';
      
      // Create a system prompt for mind map generation
      const systemPrompt = `You are an AI assistant that creates mind maps. 
      Given a topic or prompt, generate a hierarchical mind map structure with:
      1. A central topic
      2. 3-5 main branches (first level)
      3. 2-3 sub-branches for each main branch (second level)
      4. 1-2 sub-sub-branches for each sub-branch (third level)
      
      Format your response as a JSON object with the following structure:
      {
        "centralTopic": "The main topic",
        "branches": [
          {
            "id": "branch1",
            "text": "First main branch",
            "subBranches": [
              {
                "id": "subBranch1",
                "text": "First sub-branch",
                "subSubBranches": [
                  {
                    "id": "subSubBranch1",
                    "text": "First sub-sub-branch"
                  }
                ]
              }
            ]
          }
        ]
      }
      
      Make sure each item has a unique ID and meaningful text that relates to the central topic.`;
      
      // Call the Groq API to generate the mind map structure
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate a mind map for: ${mindMapPrompt}` }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }
      
      const data = await response.json();
      const mindMapContent = data.choices[0].message.content;
      
      // Parse the JSON response
      let mindMapData;
      try {
        // Extract JSON from the response (in case there's additional text)
        const jsonMatch = mindMapContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          mindMapData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON found in response');
        }
      } catch (error) {
        console.error('Error parsing mind map data:', error);
        throw new Error('Failed to parse mind map data');
      }
      
      // Clear existing items and connections
      setItems([]);
      setConnections([]);
      
      // Create the central topic item
      const centralItemId = `central-${Date.now()}`;
      const centralItem = {
        id: centralItemId,
        text: mindMapData.centralTopic,
        position: { x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 50 },
        width: 200,
        height: 100,
        type: 'circle'  // Central topic is a circle
      };
      
      // Add the central item
      setItems(prevItems => [...prevItems, centralItem]);
      
      // Calculate positions for branches
      const branchCount = mindMapData.branches.length;
      const angleStep = (2 * Math.PI) / branchCount;
      const radius = 250; // Distance from central item
      
      // Create branch items and connections
      const newItems = [centralItem];
      const newConnections = [];
      
      mindMapData.branches.forEach((branch, branchIndex) => {
        // Calculate position for this branch
        const angle = branchIndex * angleStep;
        const branchX = centralItem.position.x + radius * Math.cos(angle);
        const branchY = centralItem.position.y + radius * Math.sin(angle);
        
        // Create branch item
        const branchItemId = `branch-${Date.now()}-${branchIndex}`;
        const branchItem = {
          id: branchItemId,
          text: branch.text,
          position: { x: branchX, y: branchY },
          width: 180,
          height: 80,
          type: 'rectangle'  // Main branches are rectangles
        };
        
        // Add connection from central to branch
        const branchConnectionId = `conn-${centralItemId}-${branchItemId}`;
        const branchConnection = {
          id: branchConnectionId,
          from: centralItemId,
          to: branchItemId,
          label: ''
        };
        
        newItems.push(branchItem);
        newConnections.push(branchConnection);
        
        // Create sub-branches
        const subBranchCount = branch.subBranches.length;
        const subBranchAngleStep = angleStep / (subBranchCount + 1);
        const subBranchRadius = 200;
        
        branch.subBranches.forEach((subBranch, subBranchIndex) => {
          // Calculate position for this sub-branch
          const subBranchAngle = angle - (angleStep / 2) + (subBranchIndex + 1) * subBranchAngleStep;
          const subBranchX = branchX + subBranchRadius * Math.cos(subBranchAngle);
          const subBranchY = branchY + subBranchRadius * Math.sin(subBranchAngle);
          
          // Create sub-branch item
          const subBranchItemId = `subBranch-${Date.now()}-${branchIndex}-${subBranchIndex}`;
          const subBranchItem = {
            id: subBranchItemId,
            text: subBranch.text,
            position: { x: subBranchX, y: subBranchY },
            width: 160,
            height: 70,
            type: 'rectangle',  // Changed from 'sticky' to 'rectangle'
            style: { textAlign: 'center' }  // Center text
          };
          
          // Add connection from branch to sub-branch
          const subBranchConnectionId = `conn-${branchItemId}-${subBranchItemId}`;
          const subBranchConnection = {
            id: subBranchConnectionId,
            from: branchItemId,
            to: subBranchItemId,
            label: ''
          };
          
          newItems.push(subBranchItem);
          newConnections.push(subBranchConnection);
          
          // Create sub-sub-branches if they exist
          if (subBranch.subSubBranches && subBranch.subSubBranches.length > 0) {
            const subSubBranchCount = subBranch.subSubBranches.length;
            const subSubBranchAngleStep = subBranchAngleStep / (subSubBranchCount + 1);
            const subSubBranchRadius = 150; // Distance from sub-branch
            
            subBranch.subSubBranches.forEach((subSubBranch, subSubBranchIndex) => {
              // Calculate position for this sub-sub-branch
              const subSubBranchAngle = subBranchAngle - (subBranchAngleStep / 2) + (subSubBranchIndex + 1) * subSubBranchAngleStep;
              const subSubBranchX = subBranchX + subSubBranchRadius * Math.cos(subSubBranchAngle);
              const subSubBranchY = subBranchY + subSubBranchRadius * Math.sin(subSubBranchAngle);
              
              // Create sub-sub-branch item
              const subSubBranchItemId = `subSubBranch-${Date.now()}-${branchIndex}-${subBranchIndex}-${subSubBranchIndex}`;
              const subSubBranchItem = {
                id: subSubBranchItemId,
                text: subSubBranch.text,
                position: { x: subSubBranchX, y: subSubBranchY },
                width: 140,
                height: 60,
                type: 'circle'  // Sub-sub-branches are circles
              };
              
              // Add connection from sub-branch to sub-sub-branch
              const subSubBranchConnectionId = `conn-${subBranchItemId}-${subSubBranchItemId}`;
              const subSubBranchConnection = {
                id: subSubBranchConnectionId,
                from: subBranchItemId,
                to: subSubBranchItemId,
                label: ''
              };
              
              newItems.push(subSubBranchItem);
              newConnections.push(subSubBranchConnection);
            });
          }
        });
      });
      
      // Update state with all new items and connections
      setItems(newItems);
      setConnections(newConnections);
      
      // Close the mind map panel
      setIsMindMapPanelOpen(false);
      
    } catch (error) {
      console.error('Error generating mind map:', error);
      alert('Failed to generate mind map. Please try again.');
    } finally {
      setIsGeneratingMindMap(false);
      handleCloseMindMapPanel();
    }
  };

  // Notify parent component when items or connections change
  useEffect(() => {
    if (onUpdate) {
      onUpdate(items, connections);
    }
  }, [items, connections, onUpdate]);

  // Touch handlers for mobile/tablet panning
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) { // Two finger touch for panning
      e.preventDefault();
      setIsPanning(true);
      const touch1 = e.touches[0];
      setPanStart({
        x: touch1.clientX - panOffset.x,
        y: touch1.clientY - panOffset.y
      });
    } else if (e.touches.length === 1) {
      // Store the start point for potential pan
      const touch = e.touches[0];
      setTouchStartPoint({
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      });
    }
  }, [panOffset]);

  const handleTouchMove = useCallback((e) => {
    if (isPanning && e.touches.length >= 1) {
      e.preventDefault();
      const touch = e.touches[0];
      setPanOffset({
        x: touch.clientX - panStart.x,
        y: touch.clientY - panStart.y
      });
    } else if (e.touches.length === 1 && touchStartPoint) {
      // Check if it's a panning gesture (moved more than 10px)
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartPoint.x;
      const deltaY = touch.clientY - touchStartPoint.y;
      
      // If moved more than 10px in any direction and not potentially a tap
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        e.preventDefault();
        setIsPanning(true);
        setPanStart({
          x: touchStartPoint.x - panOffset.x, 
          y: touchStartPoint.y - panOffset.y
        });
        setTouchStartPoint(null);
      }
    }
  }, [isPanning, panStart, touchStartPoint, panOffset]);

  const handleTouchEnd = useCallback((e) => {
    if (isPanning) {
      setIsPanning(false);
      // Set final pan offset based on last touch position
      if (e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        setPanOffset({
          x: touch.clientX - panStart.x,
          y: touch.clientY - panStart.y
        });
      }
    }
    setTouchStartPoint(null);
  }, [isPanning, panStart]);

  // Modify expandSelectedConcept function to use useCallback
  const expandSelectedConcept = useCallback(async (itemId, itemText) => {
    const selectedItem = items.find(item => item.id === itemId);
    if (!selectedItem) return;
    
    setIsExpandingConcept(true);
    setExpandingItemId(itemId);
    
    try {
      if (!user) {
        throw new Error('Please sign in to use AI features');
      }

      // Get the user's API key from Firestore
      const settingsRef = doc(db, 'userSettings', user.uid);
      const settingsSnap = await getDoc(settingsRef);
      const userSettings = settingsSnap.exists() ? settingsSnap.data() : {};
      
      if (!userSettings.groqApiKey) {
        throw new Error('Please set your GROQ API key in Settings to use AI features');
      }
      
      const apiKey = userSettings.groqApiKey;
      const model = 'llama-3.3-70b-versatile';
      
      // Create a system prompt for concept expansion
      const systemPrompt = `You are an AI assistant that helps expand concepts in mind maps.
      Given a concept or idea, generate 3-5 related sub-concepts that would help develop this idea further.
      
      Format your response as a JSON array of objects, each with a unique ID and text description:
      [
        { "id": "concept1", "text": "First related concept" },
        { "id": "concept2", "text": "Second related concept" }
      ]
      
      Make sure each concept is meaningful, concise (3-5 words), and directly related to the main concept.`;
      
      // Call the Groq API to generate the related concepts
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate related concepts for: ${itemText}` }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }
      
      const data = await response.json();
      const conceptsContent = data.choices[0].message.content;
      
      // Parse the JSON response
      let relatedConcepts;
      try {
        // Extract JSON from the response (in case there's additional text)
        const jsonMatch = conceptsContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          relatedConcepts = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON found in response');
        }
      } catch (error) {
        console.error('Error parsing concepts data:', error);
        throw new Error('Failed to parse concepts data');
      }
      
      if (!Array.isArray(relatedConcepts) || relatedConcepts.length === 0) {
        throw new Error('Invalid format for related concepts');
      }
      
      // Calculate positions for new concept items around the selected item
      const conceptCount = relatedConcepts.length;
      const angleStep = (2 * Math.PI) / conceptCount;
      const radius = 200; // Distance from selected item
      
      const newItems = [...items];
      const newConnections = [...connections];
      
      // Create the new items and connections
      relatedConcepts.forEach((concept, index) => {
        // Calculate position for this concept
        const angle = index * angleStep;
        const conceptX = selectedItem.position.x + radius * Math.cos(angle);
        const conceptY = selectedItem.position.y + radius * Math.sin(angle);
        
        // Create concept item
        const conceptItemId = `concept-${Date.now()}-${index}`;
        const conceptItem = {
          id: conceptItemId,
          text: concept.text,
          position: { x: conceptX, y: conceptY },
          width: 150,
          height: 70,
          type: 'circle'
        };
        
        // Add connection from selected item to new concept
        const connectionId = `conn-${selectedItem.id}-${conceptItemId}`;
        const connection = {
          id: connectionId,
          from: selectedItem.id,
          to: conceptItemId,
          label: ''
        };
        
        newItems.push(conceptItem);
        newConnections.push(connection);
      });
      
      // Update state with new items and connections
      setItems(newItems);
      setConnections(newConnections);
      
    } catch (error) {
      console.error('Error expanding concept:', error);
      alert(error.message || 'Failed to expand concept. Please try again.');
    } finally {
      setIsExpandingConcept(false);
      setExpandingItemId(null);
    }
  }, [items, connections, setItems, setConnections, setExpandingItemId, user]);
  
  // Set up global function for expanding concepts
  useEffect(() => {
    window.expandSelectedConcept = expandSelectedConcept;
    
    return () => {
      window.expandSelectedConcept = undefined;
    };
  }, [expandSelectedConcept]);

  return (
    <div className={`whiteboard-container ${isSearchPanelOpen ? 'panel-open' : ''}`} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={drop}
        className={`whiteboard-canvas ${isPanning ? 'panning' : ''}`}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleCanvasClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          cursor: isPanning ? 'grabbing' : (isSpacePressed || isAltPressed ? 'grab' : 'default'),
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          height: '100%'
        }}
      >
        <div className="whiteboard-menu-overlay">
          <SavedWhiteboardsMenu
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
        </div>

        <div className="whiteboard-zoom-overlay">
          <div className="zoom-controls">
            <button onClick={() => setScale(s => Math.min(s * 1.1, 4))}>+</button>
            <span>{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.max(s * 0.9, 0.1))}>-</button>
          </div>
        </div>

        <div className="whiteboard-controls-overlay">
          <div className="controls-help">
            <div className="control-tip">
              <span className="keyboard-key">Alt</span> + <span className="mouse-action">Drag</span> or 
              <span className="keyboard-key">Space</span> + <span className="mouse-action">Drag</span> to pan
              <span className="touch-tip">• Use two fingers to pan on touch devices</span>
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
                onClick={generateMindMap}
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
    </div>
  );
});

export default WhiteboardCanvas; 