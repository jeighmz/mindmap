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
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const SettingsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
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

const SearchPanel = ({ highlightedItems, onClose }) => {
  const { user } = useAuth();
  const [tabs, setTabs] = useState([{ id: 'default', messages: [], name: 'Chat 1' }]);
  const [activeTabId, setActiveTabId] = useState('default');
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedModel, setSelectedModel] = useState({
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    provider: 'Meta'
  });

  const availableModels = [
    // Production Models
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (128K context)', provider: 'Meta' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (128K context)', provider: 'Meta' },
    { id: 'llama3-70b-8192', name: 'Llama 3 70B (8K context)', provider: 'Meta' },
    { id: 'llama3-8b-8192', name: 'Llama 3 8B (8K context)', provider: 'Meta' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B (8K context)', provider: 'Google' },
    
    // Preview Models
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B (128K context)', provider: 'DeepSeek' },
    { id: 'llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick 17B (128K context)', provider: 'Meta' },
    { id: 'llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B (128K context)', provider: 'Meta' },
    { id: 'mistral-saba-24b', name: 'Mistral Saba 24B (32K context)', provider: 'Mistral' },
    { id: 'qwen-qwq-32b', name: 'Qwen QWQ 32B (128K context)', provider: 'Alibaba Cloud' }
  ];

  // System message that guides the AI's behavior
  const systemMessage = {
    role: 'system',
    content: 'You are an AI assistant that analyzes concepts and provides insightful connections between ideas. Your responses should be clear, concise, and focused on identifying patterns, relationships, and key insights from the user\'s whiteboard items.'
  };

  useEffect(() => {
    // Add initial message when items are selected
    if (highlightedItems.length > 0) {
      const activeTab = tabs.find(tab => tab.id === activeTabId);
      if (activeTab && activeTab.messages.length === 0) {
        updateTabMessages(activeTabId, [
          {
            role: 'assistant',
            content: `I see you've selected ${highlightedItems.length} item${highlightedItems.length === 1 ? '' : 's'}. How would you like me to analyze them?`
          }
        ]);
      }
    }
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
      messages: [], 
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

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    try {
      setIsLoading(true);
      const userMessage = inputMessage.trim();
      setInputMessage('');

      const activeTab = tabs.find(tab => tab.id === activeTabId);
      const newMessages = [...activeTab.messages, { role: 'user', content: userMessage }];
      updateTabMessages(activeTabId, newMessages);

      // Get the context from highlighted items
      const itemsContext = highlightedItems.map(item => item.text).join('\n\n');
      
      // Prepare the full context for the AI
      const fullPrompt = `Context from whiteboard:\n${itemsContext}\n\nUser question: ${userMessage}`;

      const apiKey = await getUserApiKey();

      const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: selectedModel.id,
          messages: [
            systemMessage,
            { role: 'user', content: fullPrompt }
          ],
          temperature: 0.7,
          max_tokens: 1024,
          top_p: 0.9
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
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
      // In development mode, try to decode base64
      if (process.env.NODE_ENV === 'development') {
        try {
          return atob(userSettings.groqApiKey);
        } catch (e) {
          // If not base64 encoded, return as is (for development convenience)
          return userSettings.groqApiKey;
        }
      }

      // In production, use the decryption API
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

  return (
    <div className="search-panel chat-focused">
      <div className="chat-header">
        <h3>AI Analysis Chat</h3>
        <div className="header-actions">
          <button 
            className="settings-button"
            onClick={() => setShowSettings(!showSettings)}
            title="Chat settings"
          >
            <SettingsIcon />
          </button>
          <button className="close-button" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="chat-settings">
          <div className="model-selection">
            <label>Model:</label>
            <select
              value={selectedModel.id}
              onChange={(e) => {
                const model = availableModels.find(m => m.id === e.target.value);
                setSelectedModel(model);
              }}
            >
              {availableModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
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

      <div className="chat-messages">
        {activeTab.messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            <div className="message-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
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

      <div className="chat-input">
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
          disabled={highlightedItems.length === 0 || isLoading}
        />
        <button 
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || isLoading || highlightedItems.length === 0}
          className="send-button"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
};

export default SearchPanel; 