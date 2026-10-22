import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase-config';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/SearchPanel.css';
import { callGroqChat, DEFAULT_GROQ_MODEL } from '../../utils/api';
import { canSendQuery, incrementQueryCount, getRemainingQueries, getUsageStats } from '../../utils/usageTracker';
import { canUseFeatureByTier, incrementUsage } from '../../utils/tierUsageTracker';
import { TIER_FEATURES, USER_TIERS } from '../../config/userTiers';
import { saveChatHistory, loadChatHistory } from '../../services/boardService';

// SVG Icons as components
const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AddIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const SendIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

const RemoveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SaveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17 21v-8H7v8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 3v5h8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DeleteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="10" y1="11" x2="10" y2="17" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="14" y1="11" x2="14" y2="17" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const FullscreenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const HistoryIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SpinnerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'block' }}>
    <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" transform="translate(0,0)"/>
  </svg>
);

const SearchPanel = ({ highlightedItems, onClose, onFullscreenChange, currentBoardId, onHighlightedItemsChange, isClosing = false }) => {
  const { user, userTier } = useAuth();
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [tabs, setTabs] = useState([{ 
    id: 'default', 
    messages: [{
      role: 'assistant',
      content: 'Hello! I\'m here to help you analyze your mind map. You can ask me questions about your concepts, request insights, or get suggestions for connections between ideas. What would you like to explore?'
    }], 
    name: 'Chat 1' 
  }]);
  const [activeTabId, setActiveTabId] = useState('default');
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSavingHistory, setIsSavingHistory] = useState(false);
  const [editingTabId, setEditingTabId] = useState(null);
  const [editingHistoryId, setEditingHistoryId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [savingChatId, setSavingChatId] = useState(null);
  const [selectedModel, setSelectedModel] = useState({
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'OpenAI'
  });
  // Track which images have been sent
  const [sentImageIds, setSentImageIds] = useState(new Set());
  const [queryLimitError, setQueryLimitError] = useState(null);
  // Track previous highlightedItems to detect changes
  const previousHighlightedItemsRef = useRef([]);
  // Track pending highlighted items (newly selected items that differ from tab's items)
  const [pendingHighlightedItems, setPendingHighlightedItems] = useState([]);
  
  // Get all highlighted images (for checking if we need to show vision model prompt)
  const allHighlightedImages = highlightedItems.filter(item => item.type === 'image' && item.imageUrl);
  
  // Get highlighted images for preview (excluding already sent ones)
  const highlightedImages = allHighlightedImages.filter(item => !sentImageIds.has(item.id));

  const availableModels = [
    // Production Models (as of Oct 2026)
    { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B (131K context)', provider: 'OpenAI' },
    { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B (131K context)', provider: 'OpenAI' },
    { id: 'whisper-large-v3', name: 'Whisper Large V3 (Speech-to-Text)', provider: 'OpenAI', disabled: true },
    { id: 'whisper-large-v3-turbo', name: 'Whisper Large V3 Turbo (Speech-to-Text)', provider: 'OpenAI', disabled: true },
    
    // Preview Models (evaluation only)
    { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (131K context)', provider: 'Alibaba Cloud' },
    { id: 'openai/gpt-oss-safeguard-20b', name: 'GPT-OSS Safeguard 20B (Safety)', provider: 'OpenAI', disabled: true },
    
    // Deprecated models (for reference only - will fail if used)
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B [DEPRECATED Aug 2026]', provider: 'Meta', disabled: true },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B [DEPRECATED Aug 2026]', provider: 'Meta', disabled: true }
  ];

  // Check if vision model support is available for this tier
  const tierFeatures = TIER_FEATURES[userTier] || TIER_FEATURES[USER_TIERS.FREE];
  const canUseVisionModels = tierFeatures.features.visionModelSupport;
  
  // Vision models that support image input (currently none in production)
  const visionModels = [
    // Vision models were deprecated - placeholder for future vision model support
  ];

  const isVisionModel = canUseVisionModels && visionModels.includes(selectedModel.id);
  
  // Check if we should show vision model prompt (must be after isVisionModel is defined)
  const shouldShowVisionModelPrompt = allHighlightedImages.length > 0 && !isVisionModel;

  // System message that guides the AI's behavior
  const systemMessage = {
    role: 'system',
    content: 'You are an AI assistant that analyzes concepts and provides insightful connections between ideas. Your responses should be clear, concise, and focused on identifying patterns, relationships, and key insights from the user\'s whiteboard items.'
  };

  // Helper function to compare if two arrays of highlighted items are the same (by ID)
  const areHighlightedItemsEqual = (items1, items2) => {
    if (!items1 || !items2) {
      // If both are empty/null, consider them equal
      if ((!items1 || items1.length === 0) && (!items2 || items2.length === 0)) return true;
      return false;
    }
    if (items1.length !== items2.length) return false;
    
    const ids1 = new Set(items1.map(item => item.id).filter(id => id !== undefined));
    const ids2 = new Set(items2.map(item => item.id).filter(id => id !== undefined));
    
    if (ids1.size !== ids2.size) return false;
    
    for (const id of ids1) {
      if (!ids2.has(id)) return false;
    }
    
    return true;
  };

  // Ref to track save timeout
  const saveTimeoutRef = useRef(null);
  const saveFunctionRef = useRef(null);

  // Load chat history when board changes
  useEffect(() => {
    if (currentBoardId && user) {
      loadBoardChatHistory();
      // Don't reset tabs - let them persist or load from saved chats
    } else {
      setChatHistory([]);
      // Reset to default tab only if no board
      if (!currentBoardId) {
        setTabs([{ 
          id: 'default', 
          messages: [{
            role: 'assistant',
            content: 'Hello! I\'m here to help you analyze your mind map. You can ask me questions about your concepts, request insights, or get suggestions for connections between ideas. What would you like to explore?'
          }], 
          name: 'Chat 1' 
        }]);
        setActiveTabId('default');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBoardId, user]);

  // Load chat history for current board
  const loadBoardChatHistory = async () => {
    if (!currentBoardId || !user) {
      return;
    }
    
    setIsLoadingHistory(true);
    try {
      const history = await loadChatHistory(currentBoardId);
      
      setChatHistory(history);
    } catch (error) {
      console.error('Error loading chat history:', error);
      setChatHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Save chat history for current board (memoized with useCallback)
  const saveBoardChatHistory = useCallback(async (tabsToSave) => {
    if (!currentBoardId || !user) return;
    
    setIsSavingHistory(true);
    try {
      // Use provided tabs or current tabs state
      const tabsData = tabsToSave || tabs;
      
      // Get existing saved chats from Firestore to preserve them
      const existingHistory = await loadChatHistory(currentBoardId);
      const savedChats = existingHistory.filter(chat => chat.saved === true);
      
      // Convert current tabs to chat history format (only for auto-save, NOT for saved chats)
      const currentTabsAsHistory = tabsData.map(tab => ({
        tabId: tab.id,
        tabName: tab.name,
        messages: tab.messages,
        highlightedItems: tab.highlightedItems || [], // Preserve historical highlighted items
        saved: tab.saved || false, // Only true if explicitly saved, never auto-mark as saved
        savedAt: tab.savedAt || null
      }));
      
      // Merge: Keep ALL saved chats, add/update current tabs (but don't mark new tabs as saved)
      // Create a map of existing saved chats by tabId
      const savedChatsMap = new Map();
      savedChats.forEach(chat => {
        const id = chat.tabId || chat.id;
        if (id) savedChatsMap.set(id, chat);
      });
      
      // Merge current tabs with saved chats
      const mergedHistory = [];
      
      // First, add ALL saved chats (they are historical records, keep them even if not in current tabs)
      savedChats.forEach(savedChat => {
        const id = savedChat.tabId || savedChat.id;
        const isInCurrentTabs = tabsData.some(tab => tab.id === id);
        if (!isInCurrentTabs) {
          // Keep saved chat as historical record (not in current tabs)
          mergedHistory.push(savedChat);
        }
      });
      
      // Then, add/update with current tabs
      currentTabsAsHistory.forEach(tabHistory => {
        const existingSaved = savedChatsMap.get(tabHistory.tabId);
        if (existingSaved && existingSaved.saved) {
          // This is a saved chat that's currently open - preserve ALL SAVED historical content
          // Don't overwrite saved chat with current tab content - keep the saved version
          // This preserves: messages, tabName, savedAt, and all other saved properties
          mergedHistory.push(existingSaved);
        } else {
          // New or unsaved tab - add it but don't mark as saved
          mergedHistory.push({
            ...tabHistory,
            saved: false, // Explicitly not saved
            savedAt: null
          });
        }
      });
      
      await saveChatHistory(currentBoardId, mergedHistory);
    } catch (error) {
      console.error('Error saving chat history:', error);
    } finally {
      // Add a small delay before hiding the spinner to make it visible
      setTimeout(() => {
        setIsSavingHistory(false);
      }, 300);
    }
  }, [currentBoardId, user, tabs]);

  // Store save function in ref so it can be accessed in updateTabMessages
  useEffect(() => {
    saveFunctionRef.current = saveBoardChatHistory;
  }, [saveBoardChatHistory]);

  // Debounced save when tabs change
  useEffect(() => {
    if (!currentBoardId || !user) return;
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set new timeout
    saveTimeoutRef.current = setTimeout(() => {
      saveBoardChatHistory();
    }, 2000); // Save 2 seconds after last change

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [tabs, currentBoardId, user, saveBoardChatHistory]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isModelDropdownOpen && !e.target.closest('.custom-select-wrapper')) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModelDropdownOpen]);

  // Load a chat from history
  const loadChatFromHistory = (historyItem) => {
    if (historyItem.messages && historyItem.messages.length > 0) {
      const tabId = historyItem.tabId || `history-${Date.now()}`;
      // Preserve ALL historical data including tabName and highlightedItems
      const historicalHighlightedItems = historyItem.highlightedItems || [];
      
      // Check if the current active tab has content (user messages)
      const activeTab = tabs.find(tab => tab.id === activeTabId);
      const currentTabHasContent = activeTab && activeTab.messages.some(msg => msg.role === 'user');
      
      // Restore highlighted items to the whiteboard
      if (onHighlightedItemsChange && historicalHighlightedItems.length > 0) {
        onHighlightedItemsChange(historicalHighlightedItems);
      }
      
      // Update the previous highlighted items ref to prevent triggering new tab creation
      previousHighlightedItemsRef.current = [...historicalHighlightedItems];
      
      // Clear pending items when loading from history
      setPendingHighlightedItems([]);
      
      if (currentTabHasContent) {
        // Current tab has content - add as a new tab instead of replacing
        const newTab = {
          id: tabId,
          name: historyItem.tabName || 'Restored Chat', // Use historical tabName
          messages: historyItem.messages, // Use historical messages
          highlightedItems: historicalHighlightedItems, // Use historical highlighted items
          saved: historyItem.saved || false, // Preserve saved status
          savedAt: historyItem.savedAt || null // Preserve saved timestamp
        };
        
        // Check if a tab with this ID already exists
        const existingTabIndex = tabs.findIndex(tab => tab.id === tabId);
        
        if (existingTabIndex >= 0) {
          // Tab already exists - update it
          const updatedTabs = [...tabs];
          updatedTabs[existingTabIndex] = newTab;
          setTabs(updatedTabs);
        } else {
          // Add as new tab
          setTabs([...tabs, newTab]);
        }
        
        setActiveTabId(tabId);
      } else {
        // Current tab has no content - replace it
        setTabs([{
          id: tabId,
          name: historyItem.tabName || 'Restored Chat', // Use historical tabName
          messages: historyItem.messages, // Use historical messages
          highlightedItems: historicalHighlightedItems, // Use historical highlighted items
          saved: historyItem.saved || false, // Preserve saved status
          savedAt: historyItem.savedAt || null // Preserve saved timestamp
        }]);
        setActiveTabId(tabId);
      }
      
      setIsHistoryOpen(false);
    }
  };

  useEffect(() => {
    // Reset sent images when highlighted items change (images deselected)
    const currentImageIds = new Set(
      highlightedItems
        .filter(item => item.type === 'image' && item.imageUrl)
        .map(item => item.id)
        .filter(id => id !== undefined)
    );
    
    // Remove any sent image IDs that are no longer in highlighted items
    setSentImageIds(prev => {
      const filtered = Array.from(prev).filter(id => currentImageIds.has(id));
      return new Set(filtered);
    });
    
    // Check if highlightedItems have actually changed (compare with previous)
    const previousItems = previousHighlightedItemsRef.current;
    const itemsChanged = !areHighlightedItemsEqual(highlightedItems, previousItems);
    
    if (itemsChanged && highlightedItems.length > 0) {
      const activeTab = tabs.find(tab => tab.id === activeTabId);
      
      if (activeTab) {
        const activeTabItems = activeTab.highlightedItems || [];
        const itemsAreDifferent = !areHighlightedItemsEqual(highlightedItems, activeTabItems);
        
        // CRITICAL GUARD: Check if user has sent any messages (chat has started)
        // Once user has sent a message, NEVER update the greeting OR tab's highlightedItems
        // They must remain completely static to preserve chat history
        const hasUserMessages = activeTab.messages.some(msg => msg.role === 'user');
        
        if (hasUserMessages) {
          // User has already sent messages - greeting and highlightedItems are LOCKED
          // Only handle pending items for preview, NEVER call updateTabMessages
          if (itemsAreDifferent) {
            setPendingHighlightedItems([...highlightedItems]);
          } else {
            // Items are the same, clear pending
            setPendingHighlightedItems([]);
          }
          // CRITICAL: Do NOT call updateTabMessages here - exit early
          // The tab's highlightedItems must remain completely unchanged
        } else {
          // No user messages yet - can still update greeting and tab's highlightedItems
          if (itemsAreDifferent) {
            setPendingHighlightedItems([]);
            // Update the greeting to mention selected items
            if (activeTab.messages.length === 0) {
              updateTabMessages(activeTabId, [
                {
                  role: 'assistant',
                  content: `I see you've selected ${highlightedItems.length} item${highlightedItems.length === 1 ? '' : 's'}. How would you like me to analyze them?`
                }
              ], highlightedItems);
            } else if (activeTab.messages.length === 1) {
              // Only update if it's still the initial greeting
              const isInitialGreeting = activeTab.messages[0].role === 'assistant' && 
                (activeTab.messages[0].content.toLowerCase().includes('hello') || 
                 activeTab.messages[0].content.toLowerCase().includes('selected'));
              if (isInitialGreeting) {
                updateTabMessages(activeTabId, [
                  {
                    role: 'assistant',
                    content: `I see you've selected ${highlightedItems.length} item${highlightedItems.length === 1 ? '' : 's'}. How would you like me to analyze them?`
                  }
                ], highlightedItems);
              }
            }
          } else {
            // Items are the same, clear pending
            setPendingHighlightedItems([]);
          }
        }
      }
    } else if (highlightedItems.length === 0) {
      // Items deselected, clear pending
      setPendingHighlightedItems([]);
    }
    
    // Update previous items reference
    previousHighlightedItemsRef.current = [...highlightedItems];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedItems, activeTabId, inputMessage]);

  const updateTabMessages = (tabId, newMessages, itemsToStore = null) => {
    setTabs(prevTabs => {
      const updatedTabs = prevTabs.map(tab => {
        if (tab.id === tabId) {
          // CRITICAL: Check if user messages exist in EITHER old or new messages array
          // Once ANY user message exists, highlightedItems are LOCKED forever
          const hadUserMessagesBefore = tab.messages.some(msg => msg.role === 'user');
          const hasUserMessagesInNew = newMessages.some(msg => msg.role === 'user');
          const userMessagesExist = hadUserMessagesBefore || hasUserMessagesInNew;
          
          // Store highlightedItems with the tab when messages are updated
          // If user messages exist (in old OR new), preserve existing items (lock them)
          // NEVER update highlightedItems once user has sent a message
          let itemsToSave;
          if (userMessagesExist) {
            // User messages exist - highlightedItems are LOCKED, never change them
            // ALWAYS use existing tab items, completely ignore itemsToStore parameter
            itemsToSave = tab.highlightedItems || [];
          } else {
            // No user messages exist yet - can update items (this might be the first user message)
            itemsToSave = itemsToStore !== null ? itemsToStore : (tab.highlightedItems || []);
          }
          
          return { 
            ...tab, 
            messages: newMessages,
            highlightedItems: itemsToSave
          };
        }
        return tab;
      });
      
      // Save immediately after updating messages (if we have a board and user)
      if (currentBoardId && user && saveFunctionRef.current) {
        // Clear existing timeout and save immediately
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        // Save after a short delay to ensure state is updated
        setTimeout(() => {
          if (saveFunctionRef.current) {
            saveFunctionRef.current(updatedTabs);
          }
        }, 100);
      }
      
      return updatedTabs;
    });
  };

  const addNewTab = () => {
    const newTabId = `tab-${Date.now()}`;
    const newTabNumber = tabs.length + 1;
    setTabs(prevTabs => [...prevTabs, { 
      id: newTabId, 
      messages: [{
        role: 'assistant',
        content: 'Hello! I\'m here to help you analyze your mind map. You can ask me questions about your concepts, request insights, or get suggestions for connections between ideas. What would you like to explore?'
      }], 
      name: `Chat ${newTabNumber}`,
      highlightedItems: highlightedItems.length > 0 ? [...highlightedItems] : []
    }]);
    setActiveTabId(newTabId);
  };

  const closeTab = (tabId, event) => {
    event.stopPropagation();
    if (tabs.length > 1) {
      const tabIndex = tabs.findIndex(tab => tab.id === tabId);
      setTabs(prevTabs => prevTabs.filter(tab => tab.id !== tabId));
      if (activeTabId === tabId) {
        const newActiveTab = tabs[tabIndex === 0 ? 1 : tabIndex - 1];
        setActiveTabId(newActiveTab.id);
      }
    }
  };

  const handleTabDoubleClick = (tabId, event) => {
    event.stopPropagation();
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      setEditingTabId(tabId);
      setEditingName(tab.name);
    }
  };

  const handleTabRename = (tabId, newName) => {
    if (!newName.trim()) {
      setEditingTabId(null);
      return;
    }

    setTabs(prevTabs => {
      const updatedTabs = prevTabs.map(tab => 
        tab.id === tabId ? { ...tab, name: newName.trim() } : tab
      );
      
      // Save after renaming
      if (currentBoardId && user && saveFunctionRef.current) {
        setTimeout(() => {
          if (saveFunctionRef.current) {
            saveFunctionRef.current(updatedTabs);
          }
        }, 100);
      }
      
      return updatedTabs;
    });
    
    setEditingTabId(null);
    setEditingName('');
  };

  const handleHistoryRename = async (historyItem, newName) => {
    if (!newName.trim()) {
      setEditingHistoryId(null);
      return;
    }

    const updatedHistory = chatHistory.map(item => 
      item.tabId === historyItem.tabId 
        ? { ...item, tabName: newName.trim() }
        : item
    );
    
    setChatHistory(updatedHistory);
    
    // If this is a saved chat, update it in Firestore to preserve the new name
    if (historyItem.saved && currentBoardId && user) {
      try {
        await saveChatHistory(currentBoardId, updatedHistory);
      } catch (error) {
        console.error('Error saving renamed chat:', error);
      }
    }
    
    // Also update the tab if it exists
    setTabs(prevTabs => {
      const updatedTabs = prevTabs.map(tab => 
        tab.id === historyItem.tabId ? { ...tab, name: newName.trim() } : tab
      );
      
      // Save after renaming (for unsaved chats)
      if (currentBoardId && user && saveFunctionRef.current && !historyItem.saved) {
        setTimeout(() => {
          if (saveFunctionRef.current) {
            saveFunctionRef.current(updatedTabs);
          }
        }, 100);
      }
      
      return updatedTabs;
    });
    
    setEditingHistoryId(null);
    setEditingName('');
  };

  const handleDeleteSavedChat = async (historyItem, event) => {
    event.stopPropagation();
    
    if (!currentBoardId || !user) return;
    
    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete "${historyItem.tabName || 'this chat'}"? This will free up a saved chat slot.`)) {
      return;
    }
    
    try {
      // Get current chat history
      const currentHistory = await loadChatHistory(currentBoardId);
      
      // Remove the saved chat from history
      const updatedHistory = currentHistory.filter(
        item => (item.tabId || item.id) !== (historyItem.tabId || historyItem.id)
      );
      
      // Save to Firestore
      await saveChatHistory(currentBoardId, updatedHistory);
      
      // Update local state
      setChatHistory(updatedHistory);
    } catch (error) {
      console.error('Error deleting saved chat:', error);
      alert('Failed to delete chat. Please try again.');
    }
  };

  const handleSaveChat = async (historyItem, event) => {
    event.stopPropagation();
    
    if (!currentBoardId || !user) return;
    
    const chatId = historyItem.tabId || historyItem.id;
    setSavingChatId(chatId);
    
    try {
      // Get current chat history
      const currentHistory = await loadChatHistory(currentBoardId);
      
      // Check if there's a current tab with this ID - if so, use its current content for resave
      const currentTab = tabs.find(tab => tab.id === chatId);
      
      // Use current tab's content if available (for resave), otherwise use historical content
      const messagesToSave = currentTab?.messages?.length > 0 
        ? currentTab.messages 
        : historyItem.messages || [];
      
      const highlightedItemsToSave = currentTab?.highlightedItems?.length > 0
        ? currentTab.highlightedItems
        : historyItem.highlightedItems || [];
      
      const tabNameToSave = currentTab?.name || historyItem.tabName || 'Untitled Chat';
      
      // Ensure we have messages
      if (!messagesToSave || messagesToSave.length === 0) {
        alert('Cannot save chat: No messages found in this chat.');
        setSavingChatId(null);
        return;
      }
      
      // Check if this chat already exists in saved history
      const existingIndex = currentHistory.findIndex(
        item => (item.tabId || item.id) === chatId
      );
      
      // Mark as saved with timestamp, using current tab content if available, otherwise historical
      const chatToSave = {
        tabId: chatId,
        tabName: tabNameToSave,
        messages: messagesToSave,
        highlightedItems: highlightedItemsToSave,
        saved: true,
        savedAt: new Date().toISOString()
      };
      
      let updatedHistory;
      if (existingIndex >= 0) {
        // Update existing chat with historical content
        updatedHistory = [...currentHistory];
        updatedHistory[existingIndex] = chatToSave;
      } else {
        // Add new saved chat
        updatedHistory = [...currentHistory, chatToSave];
      }
      
      // Save to Firestore
      await saveChatHistory(currentBoardId, updatedHistory);
      
      // Reload chat history from Firestore to ensure we have the latest decrypted version
      // This ensures the UI reflects the updated savedAt timestamp and any other changes
      await loadBoardChatHistory();
    } catch (error) {
      console.error('Error saving chat:', error);
      alert('Failed to save chat. Please try again.');
    } finally {
      setSavingChatId(null);
    }
  };


  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    // Check if user is trying to use a vision model without permission
    if (isVisionModel && !canUseVisionModels) {
      setQueryLimitError('Vision models are not available on the Free plan. Please upgrade to Starter or higher to use vision models.');
      setTimeout(() => setQueryLimitError(null), 5000);
      return;
    }

    // Check query limit for non-signed-in users
    if (!user && !canSendQuery()) {
      const { queryLimit } = getUsageStats();
      setQueryLimitError(`Query limit reached. You've used all ${queryLimit} queries. Sign in for unlimited access.`);
      setTimeout(() => setQueryLimitError(null), 5000);
      return;
    }

    // Check tier limits for signed-in users (AI Analysis Panel)
    if (user) {
      const tierFeatures = TIER_FEATURES[userTier] || TIER_FEATURES[USER_TIERS.FREE];
      const limit = tierFeatures.dailyAIAnalysisMessages;
      
      if (limit === 0) {
        setQueryLimitError('AI Analysis Panel is not available on the Free plan. Please upgrade to Starter or higher to use this feature.');
        setTimeout(() => setQueryLimitError(null), 5000);
        return;
      }
      
      if (limit !== -1) {
        const usageCheck = await canUseFeatureByTier(user.uid, userTier, 'aiAnalysis');
        if (!usageCheck.allowed) {
          if (usageCheck.reason === 'limit_reached') {
            setQueryLimitError(`You've reached your daily limit of ${limit} AI Analysis messages. Please upgrade to Pro or higher for unlimited messages, or try again tomorrow.`);
          } else {
            setQueryLimitError('AI Analysis Panel is not available on your current plan. Please upgrade to use this feature.');
          }
          setTimeout(() => setQueryLimitError(null), 5000);
          return;
        }
      }
    }

    try {
      setIsLoading(true);
      setQueryLimitError(null);
      const userMessage = inputMessage.trim();
      setInputMessage('');
      
      // Increment query count
      if (user) {
        await incrementUsage(user.uid, 'aiAnalysisMessages');
      } else {
        incrementQueryCount();
      }

      const activeTab = tabs.find(tab => tab.id === activeTabId);
      const newMessages = [...activeTab.messages];
      
      // Use pending items if they exist (new selection), otherwise use tab's items
      const itemsToUse = pendingHighlightedItems.length > 0 ? pendingHighlightedItems : highlightedItems;
      
      // Add highlighted images as separate messages for UI display (always show in UI)
      const imagesToSend = itemsToUse.filter(item => item.type === 'image' && item.imageUrl && !sentImageIds.has(item.id));
      
      // Mark all images as sent at once
      if (imagesToSend.length > 0) {
        const newSentIds = imagesToSend.map(item => item.id).filter(id => id !== undefined);
        setSentImageIds(prev => new Set([...prev, ...newSentIds]));
      }
      
      imagesToSend.forEach((imageItem, index) => {
        newMessages.push({
          role: 'user',
          content: '',
          image: imageItem.imageUrl,
          imageAlt: `Highlighted image ${index + 1}`
        });
      });
      
      // Add the user's text message
      newMessages.push({ 
        role: 'user', 
        content: userMessage
      });
      
      // Check if user has already sent messages - if so, lock the tab's highlightedItems
      const hasExistingUserMessages = activeTab.messages.some(msg => msg.role === 'user');
      
      // If we used pending items, only merge them if user hasn't sent messages yet
      // Once user has sent messages, the tab's highlightedItems are locked and should not change
      let finalItemsForTab = activeTab.highlightedItems || [];
      if (pendingHighlightedItems.length > 0 && !hasExistingUserMessages) {
        // Only merge if this is the first user message - after that, tab items are locked
        const existingIds = new Set(finalItemsForTab.map(item => item.id));
        finalItemsForTab = [
          ...finalItemsForTab,
          ...pendingHighlightedItems.filter(item => !existingIds.has(item.id))
        ];
      }
      // Clear pending items after using them (they were used for AI context)
      setPendingHighlightedItems([]);
      
      // Update messages - preserve existing highlightedItems if user has already sent messages
      updateTabMessages(activeTabId, newMessages, finalItemsForTab);

      // Get the context from items to use (text items only)
      const textItems = itemsToUse.filter(item => item.type !== 'image' || !item.imageUrl);
      const itemsContext = textItems.map(item => item.text).join('\n\n');
      
      // Prepare the full context for the AI
      const fullPrompt = `Context from whiteboard:\n${itemsContext}\n\nUser question: ${userMessage}`;

      // Prepare messages array based on whether we're using a vision model and have images
      let messages = [systemMessage];
      
      // Collect all images for API (only if model supports vision)
      const allImages = [];
      if (isVisionModel) {
        const imagesToSend = itemsToUse.filter(item => item.type === 'image' && item.imageUrl && !sentImageIds.has(item.id));
        imagesToSend.forEach(imageItem => {
          if (imageItem.imageUrl) {
            allImages.push(imageItem.imageUrl);
          }
        });
      }
      
      if (isVisionModel && allImages.length > 0) {
        // Build content array with text and all images
        const content = [
          { type: 'text', text: fullPrompt }
        ];
        
        // Add all images to the content array
        allImages.forEach(imageUrl => {
          content.push({
            type: 'image_url',
            image_url: {
              url: imageUrl
            }
          });
        });
        
        messages.push({
          role: 'user',
          content: content
        });
      } else {
        messages.push({ role: 'user', content: fullPrompt });
      }

      const data = await callGroqChat({
        model: selectedModel.id,
        featureType: 'aiAnalysis',
        messages,
        temperature: 0.7,
        max_tokens: 1024,
        top_p: 0.9,
        stream: false,
      });

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from AI service');
      }

      const aiResponse = data.choices[0].message.content;

      updateTabMessages(activeTabId, [...newMessages, { role: 'assistant', content: aiResponse }]);

    } catch (error) {
      console.error('Error in chat:', error);
      const activeTab = tabs.find(tab => tab.id === activeTabId);
      updateTabMessages(activeTabId, [
        ...activeTab.messages,
        { role: 'assistant', content: `Error: ${error.message}. Please check your API key in settings.` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  const renderChatContent = () => (
    <>
      {showSettings && (
        <div className="chat-settings">
          <div className="model-selection">
            <label>Model:</label>
            <div className="custom-select-wrapper">
              <div 
                className="custom-select"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              >
                <span className="select-display">
                  {visionModels.includes(selectedModel.id) && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  )}
                  {selectedModel.name}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto' }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
              {isModelDropdownOpen && (
                <div className="custom-select-dropdown">
                  {availableModels.map(model => {
                    const isVisionModelDisabled = model.isVision && !canUseVisionModels;
                    const isModelDisabled = model.disabled || isVisionModelDisabled;
                    
                    return (
                      <div
                        key={model.id}
                        className={`custom-select-option ${isModelDisabled ? 'disabled' : ''} ${selectedModel.id === model.id ? 'selected' : ''}`}
                        onClick={() => {
                          if (isModelDisabled) {
                            if (isVisionModelDisabled) {
                              setQueryLimitError('Vision models are not available on the Free plan. Please upgrade to Starter or higher to use vision models.');
                              setTimeout(() => setQueryLimitError(null), 5000);
                            }
                            return;
                          }
                          setSelectedModel(model);
                          setIsModelDropdownOpen(false);
                        }}
                      >
                        {model.isVision && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                            <circle cx="12" cy="13" r="4" />
                          </svg>
                        )}
                        {model.name}
                        {isVisionModelDisabled && <span style={{ fontSize: '11px', color: '#999', marginLeft: '8px' }}>(Upgrade required)</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="selected-items">
            <label>Selected items:</label>
            <div className="items-count">
              {highlightedItems.length} item{highlightedItems.length !== 1 ? 's' : ''} selected
            </div>
          </div>
        </div>
      )}

      <div className="chat-tabs">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`chat-tab ${activeTabId === tab.id ? 'active' : ''}`}
            onClick={() => {
              if (editingTabId !== tab.id) {
                setActiveTabId(tab.id);
                // Clear pending items when switching tabs
                setPendingHighlightedItems([]);
              }
            }}
            onDoubleClick={(e) => handleTabDoubleClick(tab.id, e)}
          >
            {editingTabId === tab.id ? (
              <input
                type="text"
                className="tab-rename-input"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => handleTabRename(tab.id, editingName)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleTabRename(tab.id, editingName);
                  } else if (e.key === 'Escape') {
                    setEditingTabId(null);
                    setEditingName('');
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span className="tab-name">{tab.name}</span>
            )}
            {tabs.length > 1 && (
              <button
                className="tab-close"
                onClick={(e) => closeTab(tab.id, e)}
              >
                <CloseIcon />
              </button>
            )}
          </div>
        ))}
        <button className="new-tab-button" onClick={addNewTab}>
          <AddIcon />
        </button>
      </div>

      <div className={isFullscreen ? "modal-chat-messages" : "chat-messages"}>
        {activeTab.messages.map((message, index) => {
          // Check if this is the first assistant message and if it's the "analyze them" message
          const isFirstAnalyzeMessage = index === 0 && 
                                       message.role === 'assistant' && 
                                       message.content && 
                                       message.content.toLowerCase().includes('analyze');
          
          const isImageOnly = message.image && !message.content;
          
          return (
            <div 
              key={index} 
              className={`message ${message.role} ${isImageOnly ? 'image-only' : ''}`}
            >
              <div className="message-content">
                {message.content && (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                )}
                {message.image && (
                  <div className="message-screenshot" style={{ 
                    marginTop: message.content ? '8px' : '0',
                    marginBottom: '0'
                  }}>
                    <img 
                      src={message.image} 
                      alt={message.imageAlt || "Image"} 
                      style={{
                        display: 'block',
                        maxWidth: '100%',
                        maxHeight: '300px',
                        width: 'auto',
                        height: 'auto',
                        objectFit: 'contain',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        backgroundColor: isImageOnly ? 'transparent' : 'rgba(255,255,255,0.1)'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = '<div style="padding: 8px; color: #999; font-size: 12px;">Failed to load image</div>';
                      }}
                    />
                  </div>
                )}
                {/* Display highlighted items as tags below the first analyze message */}
                {/* CRITICAL: Use activeTab.highlightedItems (locked) not current highlightedItems prop */}
                {isFirstAnalyzeMessage && activeTab.highlightedItems && activeTab.highlightedItems.length > 0 && (
                  <div className="highlighted-items-tags" style={{
                    marginTop: '12px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px'
                  }}>
                    {activeTab.highlightedItems
                      .filter(item => item.type !== 'image') // Exclude images since they're shown as image messages
                      .map((item, itemIndex) => (
                        <span
                          key={itemIndex}
                          className="item-tag"
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            backgroundColor: 'rgba(33, 150, 243, 0.1)',
                            border: '1px solid rgba(33, 150, 243, 0.3)',
                            borderRadius: '12px',
                            fontSize: '12px',
                            color: '#1976d2',
                            fontWeight: '500'
                          }}
                        >
                          {item.text || 'Untitled'}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="message assistant">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
      </div>

      <div className={isFullscreen ? "modal-chat-input" : "chat-input"}>
        {queryLimitError && (
          <div className="query-limit-error" style={{
            padding: '8px 12px',
            marginBottom: '8px',
            backgroundColor: '#ffebee',
            border: '1px solid #f44336',
            borderRadius: '4px',
            color: '#c62828',
            fontSize: '13px'
          }}>
            {queryLimitError}
          </div>
        )}
        {isVisionModel && highlightedImages.length > 0 && (
          <div className="highlighted-images-preview">
            {highlightedImages.map((imageItem, index) => (
              <div key={imageItem.id || index} className="image-preview-item">
                <img src={imageItem.imageUrl} alt={`Preview ${index + 1}`} />
              </div>
            ))}
          </div>
        )}
        {pendingHighlightedItems.length > 0 && (
          <div className="pending-items-preview" style={{
            marginBottom: '8px',
            padding: '6px 10px',
            backgroundColor: '#e3f2fd',
            border: '1px solid #90caf9',
            borderRadius: '4px',
            fontSize: '11px'
          }}>
            <div style={{ 
              fontWeight: 500, 
              color: '#1976d2', 
              marginBottom: '4px',
              fontSize: '11px'
            }}>
              New selection ({pendingHighlightedItems.length} item{pendingHighlightedItems.length !== 1 ? 's' : ''})
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px'
            }}>
              {pendingHighlightedItems
                .filter(item => item.type !== 'image' || !item.imageUrl)
                .slice(0, 5)
                .map((item, index) => (
                  <span
                    key={item.id || index}
                    style={{
                      padding: '2px 6px',
                      backgroundColor: '#bbdefb',
                      color: '#0d47a1',
                      borderRadius: '3px',
                      fontSize: '11px',
                      border: '1px solid #90caf9'
                    }}
                  >
                    {item.text || 'Untitled'}
                  </span>
                ))}
              {pendingHighlightedItems.filter(item => item.type !== 'image' || !item.imageUrl).length > 5 && (
                <span style={{
                  padding: '2px 6px',
                  backgroundColor: '#bbdefb',
                  color: '#0d47a1',
                  borderRadius: '3px',
                  fontSize: '11px',
                  border: '1px solid #90caf9'
                }}>
                  +{pendingHighlightedItems.filter(item => item.type !== 'image' || !item.imageUrl).length - 5} more
                </span>
              )}
              {pendingHighlightedItems.filter(item => item.type === 'image' && item.imageUrl).length > 0 && (
                <span style={{
                  padding: '2px 6px',
                  backgroundColor: '#bbdefb',
                  color: '#0d47a1',
                  borderRadius: '3px',
                  fontSize: '11px',
                  border: '1px solid #90caf9'
                }}>
                  {pendingHighlightedItems.filter(item => item.type === 'image' && item.imageUrl).length} image{pendingHighlightedItems.filter(item => item.type === 'image' && item.imageUrl).length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        )}
        <div className="chat-input-controls">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={
              !user && !canSendQuery()
                ? "Query limit reached. Sign in for unlimited access."
                : highlightedItems.length > 0
                ? "Ask me about the selected items..."
                : "Select items on the whiteboard to analyze them"
            }
            disabled={isLoading || (!user && !canSendQuery())}
          />
          <button 
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading || (!user && !canSendQuery())}
            className="send-button"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className={`search-panel chat-focused ${isFullscreen ? 'faded-out' : ''} ${isClosing ? 'closing' : ''}`}>
        <div className="chat-header">
          <h3>AI Analysis Chat</h3>
          <div className="header-actions">
            {(userTier === USER_TIERS.PRO || userTier === USER_TIERS.CREATOR_AI) && (
              <button 
                className={`history-button ${isSavingHistory ? 'saving' : ''}`}
                onClick={() => {
                  if (currentBoardId && user) {
                    loadBoardChatHistory();
                  }
                  setIsHistoryOpen(true);
                }}
                title={isSavingHistory ? "Saving chat history..." : "View chat history"}
                disabled={!currentBoardId || !user}
              >
                {isSavingHistory ? <SpinnerIcon /> : <HistoryIcon />}
              </button>
            )}
            <button 
              className="fullscreen-button"
              onClick={() => {
                setIsFullscreen(true);
                if (onFullscreenChange) {
                  onFullscreenChange(true);
                }
              }}
              title="Switch to full screen"
            >
              <FullscreenIcon />
              Full Screen
            </button>
            <button 
              className={`settings-button ${shouldShowVisionModelPrompt ? 'vision-model-prompt' : ''}`}
              onClick={() => setShowSettings(!showSettings)}
              title={shouldShowVisionModelPrompt ? "Switch to a vision model to analyze images" : "Chat settings"}
            >
              <SettingsIcon />
              {shouldShowVisionModelPrompt && (
                <span className="vision-model-badge">Vision</span>
              )}
            </button>
            <button className="close-button" onClick={onClose} title="Close panel">
              <CloseIcon />
            </button>
          </div>
        </div>
        {renderChatContent()}
      </div>

      {isFullscreen && (
        <div className="chat-modal">
          <div className="chat-modal-content">
            <div className="modal-header">
              <h3>AI Analysis Chat</h3>
              <div className="header-actions">
                {(userTier === USER_TIERS.PRO || userTier === USER_TIERS.CREATOR_AI) && (
                  <button 
                    className={`history-button ${isSavingHistory ? 'saving' : ''}`}
                    onClick={() => {
                      if (currentBoardId && user) {
                        loadBoardChatHistory();
                      }
                      setIsHistoryOpen(true);
                    }}
                    title={isSavingHistory ? "Saving chat history..." : "View chat history"}
                    disabled={!currentBoardId || !user}
                  >
                    {isSavingHistory ? <SpinnerIcon /> : <HistoryIcon />}
                  </button>
                )}
                <button 
                  className={`settings-button ${shouldShowVisionModelPrompt ? 'vision-model-prompt' : ''}`}
                  onClick={() => setShowSettings(!showSettings)}
                  title={shouldShowVisionModelPrompt ? "Switch to a vision model to analyze images" : "Chat settings"}
                >
                  <SettingsIcon />
                  {shouldShowVisionModelPrompt && (
                    <span className="vision-model-badge">Vision</span>
                  )}
                </button>
                <button 
                  className="settings-button minimize-button"
                  onClick={() => {
                    setIsFullscreen(false);
                    if (onFullscreenChange) {
                      onFullscreenChange(false);
                    }
                  }}
                  title="Minimize"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
                <button 
                  className="settings-button"
                  onClick={onClose}
                  title="Close panel"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
            <div className="modal-body">
              {renderChatContent()}
            </div>
          </div>
        </div>
      )}

      {isHistoryOpen && (
        <div className="chat-history-modal" onClick={(e) => {
          if (e.target.classList.contains('chat-history-modal')) {
            setIsHistoryOpen(false);
          }
        }}>
          <div className="chat-history-content">
            <div className="chat-history-header">
              <h3>Chat History</h3>
              <button 
                className="close-button"
                onClick={() => setIsHistoryOpen(false)}
                title="Close history"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="chat-history-body">
              {isLoadingHistory ? (
                <div className="loading-indicator">
                  <div className="spinner"></div>
                  <p>Loading chat history...</p>
                </div>
              ) : chatHistory.length === 0 ? (
                <div className="empty-history">
                  <p>No chat history found for this board.</p>
                  <p className="empty-history-hint">Start chatting to save your conversations!</p>
                </div>
              ) : (
                <div className="history-list">
                  {chatHistory.map((historyItem, index) => (
                    <div 
                      key={historyItem.id || index} 
                      className="history-item"
                      onClick={(e) => {
                        if (!e.target.closest('.history-rename-input') && 
                            !e.target.closest('.history-rename-button') &&
                            !e.target.closest('.history-save-button') &&
                            !e.target.closest('.history-delete-button')) {
                          loadChatFromHistory(historyItem);
                        }
                      }}
                    >
                      <div className="history-item-header">
                        <div className="history-item-name-wrapper">
                          {editingHistoryId === (historyItem.tabId || historyItem.id) ? (
                            <input
                              type="text"
                              className="history-rename-input"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onBlur={() => handleHistoryRename(historyItem, editingName)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleHistoryRename(historyItem, editingName);
                                } else if (e.key === 'Escape') {
                                  setEditingHistoryId(null);
                                  setEditingName('');
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                          ) : (
                            <span 
                              className="history-item-name"
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setEditingHistoryId(historyItem.tabId || historyItem.id);
                                setEditingName(historyItem.tabName || `Chat ${index + 1}`);
                              }}
                            >
                              {historyItem.tabName || `Chat ${index + 1}`}
                            </span>
                          )}
                          {historyItem.saved && (
                            <span className="history-saved-badge" title="Saved permanently">
                              <CheckIcon />
                            </span>
                          )}
                        </div>
                        <div className="history-item-actions">
                          <span className="history-item-count">
                            {historyItem.messages?.length || 0} messages
                          </span>
                          <div className="history-action-buttons">
                            <button
                              className="history-save-button"
                              onClick={(e) => handleSaveChat(historyItem, e)}
                              disabled={savingChatId === (historyItem.tabId || historyItem.id)}
                              title={historyItem.saved ? "Resave chat (update saved version)" : "Save chat permanently"}
                            >
                              {savingChatId === (historyItem.tabId || historyItem.id) ? (
                                <SpinnerIcon />
                              ) : (
                                <SaveIcon />
                              )}
                            </button>
                            {historyItem.saved && (
                              <button
                                className="history-delete-button"
                                onClick={(e) => handleDeleteSavedChat(historyItem, e)}
                                title="Delete saved chat (free up slot)"
                              >
                                <DeleteIcon />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {historyItem.messages && historyItem.messages.length > 0 && (
                        <div className="history-item-preview">
                          {historyItem.messages.slice(0, 2).map((msg, msgIndex) => (
                            <div key={msgIndex} className="history-message-preview">
                              <span className="history-message-role">{msg.role === 'user' ? 'You' : 'AI'}:</span>
                              <span className="history-message-text">
                                {msg.content ? (msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '')) : (msg.image ? '[Image]' : '')}
                              </span>
                            </div>
                          ))}
                          {historyItem.messages.length > 2 && (
                            <div className="history-more">+{historyItem.messages.length - 2} more messages</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SearchPanel; 