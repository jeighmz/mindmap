import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '../../styles/SearchPanel.css';

const SearchPanel = ({ highlightedItems, onClose }) => {
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

  // Function to extract relevant text from highlighted items
  const getPromptFromHighlightedItems = () => {
    return highlightedItems.map(item => item.text).join('\n\n');
  };

  // Function to call Groq API
  const callGroqAPI = async (prompt) => {
    setIsCompletionLoading(prev => ({ ...prev, groq: true }));
    try {
      // Get environment variables directly from window.env if available, fallback to process.env
      const apiKey = window?.env?.REACT_APP_GROQ_API_KEY || process.env.REACT_APP_GROQ_API_KEY;
      const model = window?.env?.REACT_APP_GROQ_MODEL || process.env.REACT_APP_GROQ_MODEL || 'llama-3.3-70b-versatile';

      console.log('API Call - GROQ Key exists:', !!apiKey);
      console.log('API Call - GROQ Model:', model);

      // Hardcoded key for testing - remove this in production
      // This is just for development testing to ensure the API works
      const testKey = apiKey || "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";

      if (!testKey) {
        console.error('Missing API key for Groq');
        return 'Error: API key not configured. Please check your environment setup.';
      }

      // Make actual API call to Groq using the latest API reference
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testKey}`
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
      return `Error: Could not generate completion with Groq. ${error.message}`;
    } finally {
      setIsCompletionLoading(prev => ({ ...prev, groq: false }));
    }
  };

  // Function to call DeepSeek API
  const callDeepSeekAPI = async (prompt) => {
    setIsCompletionLoading(prev => ({ ...prev, deepseek: true }));
    try {
      // Get API key and model information
      const apiKey = window?.env?.REACT_APP_GROQ_API_KEY || process.env.REACT_APP_GROQ_API_KEY;
      // Use the model from environment vars or default to deepseek-r1-distill-llama-70b
      const model = window?.env?.REACT_APP_DEEPSEEK_MODEL || process.env.REACT_APP_DEEPSEEK_MODEL || 'deepseek-r1-distill-llama-70b';

      // Check if API key is available
      if (!apiKey) {
        console.warn('Missing API key - using simulated response for DeepSeek');
        // Fall back to simulation
      } else {
        console.log('Making DeepSeek API call using Groq endpoint with model:', model);
        
        // DeepSeek model is accessed through the same Groq API
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
                content: `Analyze the following whiteboard items and provide insights. Focus on logical relationships, patterns, and mathematical concepts if present:

${prompt}`
              }
            ],
            temperature: 0.6, // As per best practices in docs (0.5-0.7, ideally 0.6)
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
      }

      // Simulated response if API call wasn't made or failed
      // Generate a simulation that reflects DeepSeek-R1-Distill-Llama-70B capabilities
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Extract items for analysis
      const items = prompt.split('\n\n').filter(item => item.trim().length > 0);
      const itemCount = items.length;
      
      if (itemCount === 0) {
        return "No items selected. Please select some whiteboard items to analyze.";
      }
      
      // Determine if content has mathematical elements
      const hasMathContent = prompt.toLowerCase().match(/(\bmathematical\b|\bmath\b|\bequation\b|\balgebra\b|\bformula\b|\bcalculate\b|\bnumber\b|\bsum\b|\bequal\b|\bfunction\b)/);
      
      // Determine if content has logical reasoning elements
      const hasLogicalContent = prompt.toLowerCase().match(/(\blogic\b|\breasoning\b|\bargument\b|\bconclusion\b|\bpremise\b|\binference\b|\bdeduction\b|\bvalid\b|\binvalid\b)/);
      
      // Determine if content has coding elements
      const hasCodeContent = prompt.toLowerCase().match(/(\bcode\b|\bfunction\b|\balgorithm\b|\bprogramming\b|\bvariable\b|\bclass\b|\bmethod\b|\bobject\b|\bloop\b)/);
      
      // Build a response that showcases DeepSeek's strengths based on content
      let response = `# DeepSeek R1 Distill Analysis\n\n`;
      
      if (hasMathContent) {
        response += `## Mathematical Analysis\n`;
        response += `I've analyzed the mathematical concepts in your whiteboard items and identified the following:\n\n`;
        
        // Add some simulated mathematical analysis
        response += `- The relationship between the elements follows a ${Math.random() > 0.5 ? 'linear' : 'non-linear'} pattern\n`;
        response += `- There's a ${Math.random() > 0.7 ? 'direct' : 'inverse'} correlation between the concepts\n`;
        
        // Add a formula if appropriate
        response += `\nThis can be formalized as:\n\n`;
        response += `\`\`\`\nf(x) = ${Math.random() > 0.5 ? 'ax² + bx + c' : 'a·log(x) + b'} where parameters depend on specific constraints\n\`\`\`\n\n`;
      }
      
      if (hasLogicalContent || !hasMathContent) {
        response += `## Logical Framework\n`;
        response += `The ${itemCount} whiteboard item${itemCount !== 1 ? 's' : ''} can be structured into a logical framework:\n\n`;
        
        // Add logical framework
        for (let i = 0; i < Math.min(itemCount, 3); i++) {
          const abbreviated = items[i].substring(0, 30) + (items[i].length > 30 ? '...' : '');
          response += `${i+1}. "${abbreviated}" ${i === 0 ? 'serves as a premise' : `builds upon ${i === 1 ? 'the premise' : 'previous points'}`}\n`;
        }
        
        if (itemCount > 3) {
          response += `${itemCount - 3} additional items extend this framework further.\n`;
        }
        
        response += `\nThis structure follows ${Math.random() > 0.5 ? 'deductive' : 'inductive'} reasoning principles.\n\n`;
      }
      
      if (hasCodeContent) {
        response += `## Implementation Strategy\n\n`;
        response += `Based on the concepts presented, here's a code implementation approach:\n\n`;
        
        response += `\`\`\`python
# Implementation based on logical analysis
class ConceptGraph:
    def __init__(self):
        self.nodes = {}
        self.edges = []
        
    def add_node(self, node_id, attributes=None):
        """Add a node representing a concept"""
        self.nodes[node_id] = attributes or {}
        
    def add_edge(self, source, target, relation_type):
        """Connect concepts with labeled relationships"""
        self.edges.append({
            'source': source,
            'target': target, 
            'type': relation_type,
            'weight': self._calculate_weight(source, target)
        })
    
    def _calculate_weight(self, source, target):
        """Calculate relationship strength based on concept similarity"""
        # Implementation would use vector embeddings or feature similarity
        return 0.5  # Placeholder
        
    def find_paths(self, start, end, max_depth=3):
        """Find logical paths between concepts"""
        # BFS or DFS algorithm implementation
        return []
\`\`\`\n\n`;
      }
      
      response += `## Key Insights\n\n`;
      
      // Generate insights based on item count
      if (itemCount === 1) {
        response += `The single item presents a focused concept that can be expanded into a broader framework.\n`;
      } else if (itemCount == 2) {
        response += `The two items show a clear ${Math.random() > 0.5 ? 'cause-effect' : 'complementary'} relationship.\n`;
      } else {
        response += `The multiple items form a ${itemCount > 4 ? 'complex network' : 'coherent system'} with interdependent relationships.\n`;
      }
      
      response += `\nTo strengthen this analysis, consider:\n`;
      response += `- Establishing clear definitions for each key concept\n`;
      response += `- Identifying the axioms or fundamental assumptions\n`;
      response += `- Testing the framework with concrete examples\n\n`;
      
      response += `*Note: This is a simulated response based on the DeepSeek-R1-Distill-Llama-70B model's capabilities. For a real API call, ensure your Groq API key is configured with access to this model.*`;
      
      return response;
    } catch (error) {
      console.error('DeepSeek API call failed:', error);
      return `Error: Could not generate completion with DeepSeek. ${error.message}`;
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

  // Groq tab content
  const renderGroqTab = () => {
    return (
      <div className="completion-container">
        <button
          className="analyze-button"
          onClick={() => setActiveCompletionEngine('groq')}
          disabled={highlightedItems.length === 0 || isCompletionLoading.groq}
        >
          {isCompletionLoading.groq ? 'Analyzing...' : 'Analyze with Groq'}
        </button>
        {aiCompletions.groq && (
          <div className="completion-text">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {aiCompletions.groq}
            </ReactMarkdown>
          </div>
        )}
      </div>
    );
  };

  // DeepSeek tab content
  const renderDeepSeekTab = () => {
    return (
      <div className="completion-container">
        <p className="api-info">DeepSeek-R1-Distill model is accessed through the Groq API. Uses the same API key as the Groq tab.</p>
        
        <button
          className="analyze-button"
          onClick={() => setActiveCompletionEngine('deepseek')}
          disabled={highlightedItems.length === 0 || isCompletionLoading.deepseek}
        >
          {isCompletionLoading.deepseek ? 'Analyzing...' : 'Analyze with DeepSeek'}
        </button>
        {aiCompletions.deepseek && (
          <div className="completion-text">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {aiCompletions.deepseek}
            </ReactMarkdown>
          </div>
        )}
      </div>
    );
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