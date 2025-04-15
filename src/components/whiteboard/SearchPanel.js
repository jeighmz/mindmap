import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase-config';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/SearchPanel.css';

const SearchPanel = ({ highlightedItems, onClose }) => {
  const { user } = useAuth();
  const [activeCompletionEngine, setActiveCompletionEngine] = useState('groq');
  const [aiCompletions, setAiCompletions] = useState({
    groq: '',
    deepseek: ''
  });
  const [isCompletionLoading, setIsCompletionLoading] = useState({
    groq: false,
    deepseek: false
  });
  const [systemInstructions, setSystemInstructions] = useState(
    'You are an AI assistant that analyzes concepts and provides insightful connections between ideas.'
  );
  
  // Debug environment variables on component mount
  useEffect(() => {
    // Log environment variables for debugging
    console.log('Environment Variables Check:');
    console.log('REACT_APP_GROQ_API_KEY exists:', !!process.env.REACT_APP_GROQ_API_KEY);
    if (process.env.REACT_APP_GROQ_API_KEY) {
      console.log('REACT_APP_GROQ_API_KEY length:', process.env.REACT_APP_GROQ_API_KEY.length);
      console.log('REACT_APP_GROQ_API_KEY first 5 chars:', process.env.REACT_APP_GROQ_API_KEY.substring(0, 5));
    }
    console.log('REACT_APP_GROQ_MODEL:', process.env.REACT_APP_GROQ_MODEL);
    
    // Check if we're in development or production
    console.log('NODE_ENV:', process.env.NODE_ENV);
  }, []);

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
    
    return userSettings.groqApiKey;
  };

  // Function to extract relevant text from highlighted items
  const getPromptFromHighlightedItems = () => {
    return highlightedItems.map(item => item.text).join('\n\n');
  };

  // Function to call Groq API
  const callGroqAPI = async (prompt) => {
    setIsCompletionLoading(prev => ({ ...prev, groq: true }));
    try {
      const apiKey = await getUserApiKey();
      const model = process.env.REACT_APP_GROQ_MODEL || 'llama-3.3-70b-versatile';

      console.log('Making API call to Groq with model:', model);

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: systemInstructions
            },
            {
              role: 'user',
              content: `Generate insights and connections based on the following whiteboard items:\n\n${prompt}`
            }
          ],
          temperature: 0.7,
          max_completion_tokens: 1024,
          top_p: 0.9,
          stream: false,
          response_format: { type: "text" }
        })
      });
      
      if (!response.ok) {
        let errorMessage = '';
        try {
          const errorData = await response.json();
          console.error('Groq API Error Data:', errorData);
          errorMessage = errorData.error?.message || errorData.error?.type || response.statusText;
        } catch (parseError) {
          console.error('Error parsing Groq API error response:', parseError);
          errorMessage = `Status ${response.status}: ${response.statusText}`;
        }
        throw new Error(`Groq API Error: ${errorMessage}`);
      }
      
      const data = await response.json();
      console.log("Groq API response:", data);
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('Unexpected Groq API response format:', data);
        throw new Error('Unexpected response format from Groq API');
      }
      
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Groq API call failed:', error);
      return `Error: ${error.message}`;
    } finally {
      setIsCompletionLoading(prev => ({ ...prev, groq: false }));
    }
  };

  // Function to call DeepSeek API
  const callDeepSeekAPI = async (prompt) => {
    setIsCompletionLoading(prev => ({ ...prev, deepseek: true }));
    try {
      const apiKey = await getUserApiKey();
      const model = process.env.REACT_APP_DEEPSEEK_MODEL || 'deepseek-r1-distill-llama-70b';

      console.log('Making DeepSeek API call using Groq endpoint with model:', model);
      
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: `${systemInstructions} You are DeepSeek-R1-Distill-Llama-70B, a model with strong mathematical and logical reasoning capabilities.`
            },
            {
              role: 'user',
              content: `Analyze the following whiteboard items and provide insights. Focus on logical relationships, patterns, and mathematical concepts if present:\n\n${prompt}`
            }
          ],
          temperature: 0.6,
          max_tokens: 1024
        })
      });
      
      if (!response.ok) {
        let errorMessage = '';
        try {
          const errorData = await response.json();
          console.error('DeepSeek (via Groq) API Error Data:', errorData);
          errorMessage = errorData.error?.message || errorData.error?.type || response.statusText;
        } catch (parseError) {
          console.error('Error parsing API error response:', parseError);
          errorMessage = `Status ${response.status}: ${response.statusText}`;
        }
        throw new Error(`DeepSeek API Error: ${errorMessage}`);
      }
      
      const data = await response.json();
      console.log("DeepSeek API response:", data);
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('Unexpected API response format:', data);
        throw new Error('Unexpected response format from DeepSeek API');
      }
      
      return data.choices[0].message.content;
    } catch (error) {
      console.error('DeepSeek API call failed:', error);
      return `Error: ${error.message}`;
    } finally {
      setIsCompletionLoading(prev => ({ ...prev, deepseek: false }));
    }
  };

  const handleGenerateCompletion = async () => {
    const prompt = getPromptFromHighlightedItems();
    
    // Generate Groq completion
    const groqCompletion = await callGroqAPI(prompt);
    setAiCompletions(prev => ({ ...prev, groq: groqCompletion }));
    
    // Generate DeepSeek completion (simulated if no API key)
    const deepseekCompletion = await callDeepSeekAPI(prompt);
    setAiCompletions(prev => ({ ...prev, deepseek: deepseekCompletion }));
  };

  return (
    <div className="search-panel">
      <div className="search-panel-header">
        <h3>AI Analysis Panel</h3>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="search-panel-content">
        <div className="highlighted-items">
          <h4>Selected Items:</h4>
          {highlightedItems.length > 0 ? (
            <ul>
              {highlightedItems.map(item => (
                <li key={item.id}>{item.text}</li>
              ))}
            </ul>
          ) : (
            <p className="empty-selection-message">No items selected. Select items on the whiteboard to analyze them.</p>
          )}
        </div>

        <div className="system-instructions">
          <div className="instructions-header">
            <h4>System Instructions:</h4>
            <button 
              className="reset-instructions"
              onClick={() => setSystemInstructions('You are an AI assistant that analyzes concepts and provides insightful connections between ideas.')}
              title="Reset to default instructions"
            >
              Reset
            </button>
          </div>
          <textarea
            className="instructions-input"
            value={systemInstructions}
            onChange={(e) => setSystemInstructions(e.target.value)}
            placeholder="Add custom instructions for the AI models..."
            rows={3}
          />
          <p className="instructions-hint">These instructions will guide how the AI analyzes your whiteboard items.</p>
        </div>

        <div className="action-buttons">
          <button 
            className="ai-button"
            onClick={handleGenerateCompletion}
            disabled={isCompletionLoading.groq || isCompletionLoading.deepseek || highlightedItems.length === 0}
          >
            {(isCompletionLoading.groq || isCompletionLoading.deepseek) 
              ? 'Analyzing...' 
              : 'Analyze Whiteboard Items'}
          </button>
        </div>

        {(aiCompletions.groq || aiCompletions.deepseek) && (
          <div className="completion-results">
            <div className="completion-tabs">
              <button 
                className={`tab-button ${activeCompletionEngine === 'groq' ? 'active' : ''}`}
                onClick={() => setActiveCompletionEngine('groq')}
              >
                <div className="tab-content">
                  <span className="tab-name">Groq</span>
                  <span className="tab-model">{process.env.REACT_APP_GROQ_MODEL || 'Llama 3.3 70B'}</span>
                </div>
              </button>
              <button 
                className={`tab-button ${activeCompletionEngine === 'deepseek' ? 'active' : ''}`}
                onClick={() => setActiveCompletionEngine('deepseek')}
              >
                <div className="tab-content">
                  <span className="tab-name">DeepSeek</span>
                  <span className="tab-model">R1 Distill Llama 70B</span>
                </div>
              </button>
            </div>
            <div className="completion-content">
              {isCompletionLoading[activeCompletionEngine] ? (
                <div className="loading-indicator">
                  <div className="spinner"></div>
                  <p>Generating completion with {activeCompletionEngine === 'groq' ? 'Groq' : 'DeepSeek'}...</p>
                </div>
              ) : (
                <div className="completion-result">
                  {aiCompletions[activeCompletionEngine].startsWith('Error:') ? (
                    <div className="error-message">
                      <h4>Error Occurred</h4>
                      <p>{aiCompletions[activeCompletionEngine]}</p>
                      <p className="help-text">
                        {activeCompletionEngine === 'groq' 
                          ? 'Please check your Groq API key in the .env file.' 
                          : 'Please check your Groq API key in the .env file. DeepSeek models are accessed through the Groq API.'}
                      </p>
                    </div>
                  ) : (
                    <pre className="completion-text">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {aiCompletions[activeCompletionEngine]}
                      </ReactMarkdown>
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPanel; 