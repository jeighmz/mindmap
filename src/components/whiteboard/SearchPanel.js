import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase-config';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/SearchPanel.css';
import { getApiBaseUrl } from '../../utils/api';

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

const FullscreenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SearchPanel = ({ highlightedItems, onClose, onFullscreenChange }) => {
  const { user } = useAuth();
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
  const [selectedModel, setSelectedModel] = useState({
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    provider: 'Meta'
  });
  const [screenshot, setScreenshot] = useState(null);

  const availableModels = [
    // Production Models
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (128K context)', provider: 'Meta' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (128K context)', provider: 'Meta' },
    { id: 'llama3-70b-8192', name: 'Llama 3 70B (8K context)', provider: 'Meta', disabled: true },
    { id: 'llama3-8b-8192', name: 'Llama 3 8B (8K context)', provider: 'Meta', disabled: true },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B (8K context)', provider: 'Google', disabled: true },
    
    // Preview Models
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B (128K context)', provider: 'DeepSeek', disabled: true },
    { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick 17B (128K context)', provider: 'Meta', isVision: true },
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B (128K context)', provider: 'Meta', isVision: true },
    { id: 'mistral-saba-24b', name: 'Mistral Saba 24B (32K context)', provider: 'Mistral', disabled: true },
    { id: 'qwen-qwq-32b', name: 'Qwen QWQ 32B (128K context)', provider: 'Alibaba Cloud', disabled: true },
    { id: 'groq/compound', name: 'Groq Compound (128K context)', provider: 'Groq' },
    { id: 'qwen/qwen3-32b', name: 'Qwen 3 32B (128K context)', provider: 'Alibaba Cloud' },
    { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B (128K context)', provider: 'OpenAI', disabled: true },
    { id: 'whisper-large-v3-turbo', name: 'Whisper Large V3 Turbo (Speech-to-Text)', provider: 'OpenAI', disabled: true }
  ];

  // Vision models that support image input
  const visionModels = [
    'meta-llama/llama-4-maverick-17b-128e-instruct',
    'meta-llama/llama-4-scout-17b-16e-instruct'
  ];

  const isVisionModel = visionModels.includes(selectedModel.id);

  // System message that guides the AI's behavior
  const systemMessage = {
    role: 'system',
    content: 'You are an AI assistant that analyzes concepts and provides insightful connections between ideas. Your responses should be clear, concise, and focused on identifying patterns, relationships, and key insights from the user\'s whiteboard items.'
  };

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

  useEffect(() => {
    // Add or update message when items are selected (but don't override if user has already started chatting)
    if (highlightedItems.length > 0) {
      const activeTab = tabs.find(tab => tab.id === activeTabId);
      if (activeTab && activeTab.messages.length <= 1) {
        // Only add/update the message if there's just the initial greeting
        const hasOnlyGreeting = activeTab.messages.length === 1 && 
          activeTab.messages[0].role === 'assistant' && 
          activeTab.messages[0].content.toLowerCase().includes('hello');
        
        if (hasOnlyGreeting) {
          // Update the greeting to mention selected items
          updateTabMessages(activeTabId, [
            {
              role: 'assistant',
              content: `I see you've selected ${highlightedItems.length} item${highlightedItems.length === 1 ? '' : 's'}. How would you like me to analyze them?`
            }
          ]);
        } else if (activeTab.messages.length === 0) {
          // If no messages at all, add the selection message
          updateTabMessages(activeTabId, [
            {
              role: 'assistant',
              content: `I see you've selected ${highlightedItems.length} item${highlightedItems.length === 1 ? '' : 's'}. How would you like me to analyze them?`
            }
          ]);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedItems, activeTabId]);

  const updateTabMessages = (tabId, newMessages) => {
    setTabs(prevTabs => 
      prevTabs.map(tab => 
        tab.id === tabId ? { ...tab, messages: newMessages } : tab
      )
    );
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
      name: `Chat ${newTabNumber}` 
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

  const handleScreenshot = async () => {
    try {
      const canvas = document.querySelector('.whiteboard-canvas');
      if (!canvas) {
        throw new Error('Could not find whiteboard canvas');
      }

      const html2canvas = (await import('html2canvas')).default;
      const screenshot = await html2canvas(canvas, {
        backgroundColor: '#f5f5f5',
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
      });

      const base64Image = screenshot.toDataURL('image/png');
      setScreenshot(base64Image);
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      alert('Failed to capture screenshot. Please try again.');
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    try {
      setIsLoading(true);
      const userMessage = inputMessage.trim();
      setInputMessage('');

      const activeTab = tabs.find(tab => tab.id === activeTabId);
      const newMessages = [...activeTab.messages];
      
      // Collect images from highlighted items (always collect for UI display)
      const highlightedImages = highlightedItems.filter(item => item.type === 'image' && item.imageUrl);
      
      // Store screenshot before clearing (for API call)
      const screenshotForApi = screenshot;
      
      // If there's a screenshot, add it as a separate message first
      if (screenshot) {
        newMessages.push({
          role: 'user',
          content: '',
          image: screenshot,
          imageAlt: 'Mindmap screenshot'
        });
        setScreenshot(null); // Clear the screenshot after sending
      }
      
      // Add highlighted images as separate messages for UI display (always show in UI)
      highlightedImages.forEach((imageItem, index) => {
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
      
      updateTabMessages(activeTabId, newMessages);

      // Get the context from highlighted items (text items only)
      const textItems = highlightedItems.filter(item => item.type !== 'image' || !item.imageUrl);
      const itemsContext = textItems.map(item => item.text).join('\n\n');
      
      // Prepare the full context for the AI
      const fullPrompt = `Context from whiteboard:\n${itemsContext}\n\nUser question: ${userMessage}`;

      const apiKey = await getUserApiKey();

      // Prepare messages array based on whether we're using a vision model and have images
      let messages = [systemMessage];
      
      // Collect all images for API (only if model supports vision)
      const allImages = [];
      if (isVisionModel) {
        if (screenshotForApi) {
          allImages.push(screenshotForApi);
        }
        highlightedImages.forEach(imageItem => {
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

      // Log the request for debugging (development only)
      if (process.env.NODE_ENV === 'development') {
        console.log('Sending request to Groq API:', {
          model: selectedModel.id,
          messages: messages.map(msg => ({
            ...msg,
            content: Array.isArray(msg.content) 
              ? msg.content.map(c => c.type === 'image_url' 
                ? { ...c, image_url: { url: c.image_url.url.substring(0, 100) + '...' } }
                : c)
              : msg.content
          })),
          isVisionModel,
          hasScreenshot: !!screenshot,
          highlightedImageCount: highlightedImages.length
        });
      }

      const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: selectedModel.id,
          messages: messages,
          temperature: 0.7,
          max_tokens: 1024,
          top_p: 0.9,
          stream: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Groq API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`Failed to get response from AI: ${response.statusText}`);
      }

      const data = await response.json();
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

  // Function to get user's API key from settings
  const getUserApiKey = async () => {
    if (!user) {
      throw new Error('Please sign in to use AI features');
    }

    const settingsRef = doc(db, 'userSettings', user.uid);
    const settingsSnap = await getDoc(settingsRef);
    const userSettings = settingsSnap.exists() ? settingsSnap.data() : {};
    
    if (!userSettings.groqApiKey) {
      throw new Error('Please set your GROQ API key in Settings to use AI features');
    }

    try {
      // First try base64 decoding
      try {
        const decoded = atob(userSettings.groqApiKey);
        if (decoded.startsWith('gsk_')) {
          return decoded;
        }
      } catch (e) {
        // If not base64 encoded, continue to API attempt
        console.log('Not a valid base64 encoded key, trying API...');
      }

      // If base64 decode failed or didn't return a valid key, try the API
      const apiBaseUrl = getApiBaseUrl();
      if (!apiBaseUrl) {
        throw new Error('API base URL not configured');
      }

      const decryptResponse = await fetch(`${apiBaseUrl}/decryptApiKey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          encryptedData: userSettings.groqApiKey
        })
      });

      if (!decryptResponse.ok) {
        // If API fails, try base64 one more time or return as-is for development
        if (process.env.NODE_ENV === 'development') {
          return userSettings.groqApiKey;
        }
        throw new Error('Failed to decrypt API key');
      }

      const { decrypted } = await decryptResponse.json();
      return decrypted;
    } catch (error) {
      console.error('Error accessing API key:', error);
      throw new Error('Failed to access API key. Please check your settings and try again.');
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
                  {availableModels.map(model => (
                    <div
                      key={model.id}
                      className={`custom-select-option ${model.disabled ? 'disabled' : ''} ${selectedModel.id === model.id ? 'selected' : ''}`}
                      onClick={() => {
                        if (!model.disabled) {
                          setSelectedModel(model);
                          setIsModelDropdownOpen(false);
                          if (!visionModels.includes(model.id)) {
                            setScreenshot(null);
                          }
                        }
                      }}
                    >
                      {model.isVision && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                      )}
                      {model.name}
                    </div>
                  ))}
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
            onClick={() => setActiveTabId(tab.id)}
          >
            <span className="tab-name">{tab.name}</span>
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
                        if (process.env.NODE_ENV === 'development') {
                          console.error('Failed to load image in chat:', {
                            url: message.image,
                            alt: message.imageAlt,
                            messageIndex: index
                          });
                        }
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = '<div style="padding: 8px; color: #999; font-size: 12px;">Failed to load image</div>';
                      }}
                    />
                  </div>
                )}
                {/* Display highlighted items as tags below the first analyze message */}
                {isFirstAnalyzeMessage && highlightedItems.length > 0 && (
                  <div className="highlighted-items-tags" style={{
                    marginTop: '12px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px'
                  }}>
                    {highlightedItems
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
        {screenshot && (
          <div className="screenshot-preview-container">
            <img src={screenshot} alt="Screenshot preview" />
            <button 
              className="remove-screenshot"
              onClick={() => setScreenshot(null)}
              title="Remove screenshot"
            >
              <RemoveIcon />
              Remove
            </button>
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
              highlightedItems.length > 0
                ? "Ask me about the selected items..."
                : "Select items on the whiteboard to analyze them"
            }
            disabled={isLoading}
          />
          <button 
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
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
      <div className={`search-panel chat-focused ${isFullscreen ? 'faded-out' : ''}`}>
        <div className="chat-header">
          <h3>AI Analysis Chat</h3>
          <div className="header-actions">
            {isVisionModel && (
              <button 
                className="settings-button"
                onClick={handleScreenshot}
                title="Capture mindmap screenshot"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="13" r="4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
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
              className="settings-button"
              onClick={() => setShowSettings(!showSettings)}
              title="Chat settings"
            >
              <SettingsIcon />
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
                {isVisionModel && (
                  <button 
                    className="settings-button"
                    onClick={handleScreenshot}
                    title="Capture mindmap screenshot"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="13" r="4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}
                <button 
                  className="settings-button"
                  onClick={() => setShowSettings(!showSettings)}
                  title="Chat settings"
                >
                  <SettingsIcon />
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
    </>
  );
};

export default SearchPanel; 