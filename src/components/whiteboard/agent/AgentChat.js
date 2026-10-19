import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '../../../styles/AgentChat.css';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase-config';
import { useAuth } from '../../../contexts/AuthContext';
import { callGroqChat, DEFAULT_GROQ_MODEL } from '../../../utils/api';
import {
  notionTool,
  createNotionDatabase,
  createNotionPage,
  fetchNotionDatabaseContent,
  writeActionItemsToNotion
} from './tools/notion';

const AgentChat = ({ isOpen, onClose, mindMapItems, connections, highlightedItems = [] }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I can help you analyze your mind map and take actions based on the insights. What would you like to do?'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTools, setSelectedTools] = useState([]);
  const [notionDatabaseId, setNotionDatabaseId] = useState('');
  const [notionConfigured, setNotionConfigured] = useState(false);
  const [actionItems, setActionItems] = useState([]);
  const [currentStep, setCurrentStep] = useState('idle'); // idle, analyzing, planning, confirming, executing
  const [currentAction, setCurrentAction] = useState(null);
  const [savedBoards, setSavedBoards] = useState([]);
  const [referencedBoards, setReferencedBoards] = useState([]);
  const [showBoardSelector, setShowBoardSelector] = useState(false);
  const [notionUpdates, setNotionUpdates] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [notionWebhookId, setNotionWebhookId] = useState('');
  
  const toolCategories = {
    integration: {
      name: 'Integration',
      description: 'Connect with external tools and services',
      tools: [
        notionTool
      ]
    },
    context: {
      name: 'Context',
      description: 'Manage context and memory',
      tools: [
        { id: 'reference', name: 'Reference Boards', icon: '📚', description: 'Use saved boards as context for analysis' },
        { id: 'compare', name: 'Compare Boards', icon: '⚖️', description: 'Compare current board with saved boards' },
        { id: 'merge', name: 'Merge Ideas', icon: '🔄', description: 'Merge ideas from multiple boards' }
      ]
    }
  };

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Load saved boards from localStorage
    const loadSavedBoards = () => {
      const saved = localStorage.getItem('savedWhiteboards');
      if (saved) {
        try {
          const boards = JSON.parse(saved);
          setSavedBoards(boards);
        } catch (error) {
          console.error('Error parsing saved boards:', error);
        }
      }
    };

    loadSavedBoards();
  }, []);

  useEffect(() => {
    const loadNotionSettings = async () => {
      if (!user?.uid) {
        setNotionConfigured(false);
        return;
      }

      try {
        const settingsRef = doc(db, 'userSettings', user.uid);
        const settingsSnap = await getDoc(settingsRef);

        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          setNotionConfigured(!!data.notionApiKey);
          if (data.notionDatabaseId) {
            setNotionDatabaseId(data.notionDatabaseId);
          }
        } else {
          setNotionConfigured(false);
        }
      } catch (error) {
        console.error('Error loading Notion settings:', error);
        setNotionConfigured(false);
      }
    };

    loadNotionSettings();
  }, [user?.uid]);

  // Listen for updates to highlightedItems and update context
  useEffect(() => {
    // Highlighted items are available for context
  }, [highlightedItems]);

  const analyzeMindMap = () => {
    // Extract structure and relationships from mind map
    const centralNode = mindMapItems.find(item => item.id.startsWith('central'));
    const branches = mindMapItems.filter(item => item.id.includes('branch'));
    
    // Create a structured representation
    const mindMapStructure = {
      centralTopic: centralNode?.text || '',
      branches: branches.map(branch => {
        const branchConnections = connections.filter(conn => 
          conn.from === branch.id || conn.to === branch.id
        );
        return {
          text: branch.text,
          connections: branchConnections.length,
          type: branch.type
        };
      })
    };

    return mindMapStructure;
  };

  const toggleTool = (toolId) => {
    if (toolId === 'notion') {
      // Notion tool toggle logic
    }
    
    if (toolId === 'reference') {
      setShowBoardSelector(true);
      return;
    }
    
    setSelectedTools(prev => {
      if (prev.includes(toolId)) {
        return prev.filter(id => id !== toolId);
      } else {
        return [...prev, toolId];
      }
    });
  };

  const getToolContext = () => {
    if (selectedTools.length === 0 && referencedBoards.length === 0) return '';
    
    const toolNames = selectedTools.map(toolId => {
      // Find the tool in any category
      for (const category in toolCategories) {
        const tool = toolCategories[category].tools.find(t => t.id === toolId);
        if (tool) return tool.name;
      }
      return toolId;
    });
    
    let context = '';
    
    if (toolNames.length > 0) {
      context += `The user has selected the following tools: ${toolNames.join(', ')}. Factor these tools into your response.`;
    }
    
    if (referencedBoards.length > 0) {
      context += `\n\nThe user has referenced ${referencedBoards.length} saved boards as context. Use this information to provide more relevant insights.`;
    }
    
    return context;
  };

  const addMessage = (role, content) => {
    setMessages(prev => [...prev, { role, content }]);
  };

  const updateStep = (step) => {
    setCurrentStep(step);
    addMessage('system', `Current step: ${step}`);
  };

  const handleNotionDatabase = async () => {
    const databaseId = await createNotionDatabase(notionConfigured, notionDatabaseId, addMessage);
    if (databaseId) {
      setNotionDatabaseId(databaseId);
      return databaseId;
    }
    console.error('Failed to connect to database');
    return null;
  };

  const handleNotionPage = async (title, properties) => {
    return await createNotionPage(notionConfigured, notionDatabaseId, title, properties, addMessage);
  };

  const handleNotionDatabaseContent = async () => {
    return await fetchNotionDatabaseContent(notionConfigured, notionDatabaseId, addMessage);
  };

  const handleNotionWebhookEvent = useCallback((event) => {
    setNotionUpdates(prev => [{
      type: event.type,
      timestamp: new Date().toISOString(),
      data: event.data
    }, ...prev]);
  }, []);

  // Set up webhook event listener
  useEffect(() => {
    let eventSource;
    
    if (notionWebhookId) {
      eventSource = new EventSource(`/api/webhook/events/${notionWebhookId}`);
      eventSource.onmessage = (e) => handleNotionWebhookEvent(JSON.parse(e.data));
    }
    
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [notionWebhookId, handleNotionWebhookEvent]);

  const processMindMapAnalysis = async () => {
    updateStep('analyzing');
    addMessage('assistant', '🔍 Analyzing your mind map structure...');
    
    const mindMapAnalysis = analyzeMindMap();
    
    // Create a summary of the mind map
    let summary = `## Mind Map Analysis\n\n`;
    summary += `**Central Topic:** ${mindMapAnalysis.centralTopic}\n\n`;
    summary += `**Main Branches:** ${mindMapAnalysis.branches.length}\n\n`;
    
    if (mindMapAnalysis.branches.length > 0) {
      summary += `### Branch Details:\n\n`;
      mindMapAnalysis.branches.forEach((branch, index) => {
        summary += `${index + 1}. **${branch.text}** (${branch.connections} connections)\n`;
      });
    }
    
    addMessage('assistant', summary);
    
    // If Notion integration is selected, prepare for action planning
    if (selectedTools.includes('notion')) {
      addMessage('assistant', 'Would you like me to create action items in Notion based on this mind map?');
    }
    
    updateStep('idle');
  };

  const generateActionPlan = async () => {
    updateStep('planning');
    addMessage('assistant', '📋 Generating action plan based on your mind map...');
    
    const mindMapAnalysis = analyzeMindMap();
    
    try {
      const systemPrompt = `You are an AI agent that helps users create action plans from mind maps.
      Create a detailed action plan based on the following mind map:
      
      Central Topic: ${mindMapAnalysis.centralTopic}
      Number of main branches: ${mindMapAnalysis.branches.length}
      
      For each branch, suggest 2-3 specific, actionable tasks that would help implement or develop the ideas.
      Format your response as a markdown list with the following structure:
      
      ## Action Plan
      
      ### [Branch Name]
      1. [Action Item 1]
      2. [Action Item 2]
      
      Make the action items specific, measurable, and achievable.`;

      const data = await callGroqChat({
        model: DEFAULT_GROQ_MODEL,
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.7,
        max_tokens: 2000,
      });
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from AI service');
      }
      
      const actionPlan = data.choices[0].message.content;
      
      addMessage('assistant', actionPlan);
      
      // Parse action items for Notion integration
      if (selectedTools.includes('notion')) {
        parseActionItems(actionPlan);
      }
      
      updateStep('idle');
    } catch (error) {
      console.error('Error generating action plan:', error);
      addMessage('assistant', `❌ Error generating action plan: ${error.message}`);
      updateStep('idle');
    }
  };

  const parseActionItems = (actionPlan) => {
    // Simple parsing of markdown to extract action items
    const lines = actionPlan.split('\n');
    const items = [];
    let currentBranch = '';
    let currentPriority = 'Medium';
    
    for (const line of lines) {
      // Check for branch/category headers
      if (line.startsWith('### ')) {
        currentBranch = line.replace('### ', '').trim();
        // Reset priority for new branch
        currentPriority = 'Medium';
      } 
      // Check for priority indicators in headers
      else if (line.startsWith('## Priority:')) {
        const priority = line.toLowerCase();
        if (priority.includes('high')) currentPriority = 'High';
        else if (priority.includes('low')) currentPriority = 'Low';
        else currentPriority = 'Medium';
      }
      // Parse action items
      else if (line.match(/^\d+\.\s+/) || line.match(/^[-*]\s+/)) {
        const actionText = line.replace(/^\d+\.\s+|^[-*]\s+/, '').trim();
        if (actionText && currentBranch) {
          // Determine priority from action text if indicated
          let itemPriority = currentPriority;
          if (actionText.toLowerCase().includes('(high)') || actionText.toLowerCase().includes('(urgent)')) {
            itemPriority = 'High';
          } else if (actionText.toLowerCase().includes('(low)')) {
            itemPriority = 'Low';
          }
          
          // Extract any due date if specified in parentheses like (due: YYYY-MM-DD)
          let dueDate = null;
          const dueDateMatch = actionText.match(/\(due:\s*(\d{4}-\d{2}-\d{2})\)/);
          if (dueDateMatch) {
            dueDate = dueDateMatch[1];
          }
          
          // Clean up the action text by removing priority and due date annotations
          let cleanActionText = actionText
            .replace(/\(high\)|\(urgent\)|\(low\)/i, '')
            .replace(/\(due:\s*\d{4}-\d{2}-\d{2}\)/, '')
            .trim();
          
          items.push({
            branch: currentBranch,
            action: cleanActionText,
            status: 'Not started',
            priority: itemPriority,
            dueDate: dueDate,
            notes: `Generated from mind map branch: ${currentBranch}`
          });
        }
      }
    }
    
    setActionItems(items);
    
    if (items.length > 0) {
      addMessage(
        'assistant',
        `I've identified ${items.length} action items from your mind map. Here's what I found:\n\n` +
        items.map((item, index) => 
          `${index + 1}. **${item.action}**\n` +
          `   - Branch: ${item.branch}\n` +
          `   - Priority: ${item.priority}` +
          (item.dueDate ? `\n   - Due: ${item.dueDate}` : '')
        ).join('\n\n') +
        '\n\nWould you like me to create these in Notion? Type "confirm" to proceed or "modify" to make changes.'
      );
    }
    
    return items;
  };

  const createNotionActions = async () => {
    if (actionItems.length === 0) {
      addMessage('assistant', 'No action items to create. Please generate an action plan first.');
      return;
    }
    
    updateStep('confirming');
    addMessage('assistant', 'Please confirm the following action items to be created in Notion:');
    
    let confirmationMessage = '## Action Items to Create\n\n';
    actionItems.forEach((item, index) => {
      confirmationMessage += `${index + 1}. **${item.branch}**: ${item.action}\n`;
    });
    confirmationMessage += '\nReply with "confirm" to create these items in Notion, or "modify" to make changes.';
    
    addMessage('assistant', confirmationMessage);
  };

  const executeNotionActions = async () => {
    updateStep('executing');
    addMessage('system', '🔄 Starting Notion integration process...');
    
    try {
      // Ensure we have action items to process
      if (!actionItems || actionItems.length === 0) {
        addMessage('assistant', '❌ No action items to create. Please generate an action plan first.');
        updateStep('idle');
        return;
      }

      // Ensure database exists
      addMessage('system', '🔄 Checking Notion database connection...');
      const dbId = await handleNotionDatabase();
      if (!dbId) {
        addMessage('assistant', '❌ Failed to connect to Notion database.');
        updateStep('idle');
        return;
      }
      
      // Write all action items to Notion using the new function
      const results = await writeActionItemsToNotion(
        notionConfigured,
        notionDatabaseId,
        actionItems,
        addMessage
      );

      if (results && results.length > 0) {
        // Store the created page IDs for future reference
        const createdPages = results.map(result => ({
          id: result.id,
          title: result.title,
          status: result.status,
          branch: result.branch
        }));
        
        // Update local state with the created pages
        setNotionUpdates(prev => [
          {
            type: 'pages.created',
            timestamp: new Date().toISOString(),
            data: {
              count: createdPages.length,
              pages: createdPages
            }
          },
          ...prev
        ]);
        
        // Clear the action items since they've been created
        setActionItems([]);
        
        addMessage(
          'assistant',
          `✅ Successfully created ${results.length} action items in Notion. You can now view and manage them in your Notion workspace.`
        );
      } else {
        addMessage(
          'assistant',
          '❌ No action items were created in Notion. Please check the error messages above.'
        );
      }
    } catch (error) {
      console.error('Error executing Notion actions:', error);
      addMessage(
        'assistant',
        `❌ Error creating action items in Notion: ${error.message}`
      );
    } finally {
      setCurrentAction(null);
      updateStep('idle');
    }
  };

  // Function to analyze a saved board
  const analyzeSavedBoard = (board) => {
    if (!board || !board.data || !board.data.items) {
      return {
        centralTopic: 'Unknown',
        branches: []
      };
    }
    
    const items = board.data.items;
    const connections = board.data.connections || [];
    
    // Find central topic (usually the first item or one with most connections)
    const centralNode = items.find(item => item.id.startsWith('central')) || items[0];
    
    // Find branches (items connected to central node)
    const branches = items.filter(item => {
      if (item.id === centralNode.id) return false;
      
      // Check if this item is connected to the central node
      return connections.some(conn => 
        (conn.from === centralNode.id && conn.to === item.id) ||
        (conn.to === centralNode.id && conn.from === item.id)
      );
    });
    
    // Count connections for each branch
    const branchesWithConnections = branches.map(branch => {
      const branchConnections = connections.filter(conn => 
        conn.from === branch.id || conn.to === branch.id
      ).length;
      
      return {
        text: branch.text,
        connections: branchConnections
      };
    });
    
    return {
      centralTopic: centralNode ? centralNode.text : 'Unknown',
      branches: branchesWithConnections
    };
  };

  // Function to reference a saved board
  const referenceBoard = (boardId) => {
    const board = savedBoards.find(b => b.id === boardId);
    if (!board) return;
    
    // Check if already referenced
    if (referencedBoards.some(b => b.id === boardId)) {
      addMessage('assistant', `Board "${board.name}" is already referenced.`);
      return;
    }
    
    // Add to referenced boards
    setReferencedBoards(prev => [...prev, board]);
    
    // Analyze the board
    const analysis = analyzeSavedBoard(board);
    
    // Add message about the referenced board
    addMessage('assistant', `✅ Referenced board: "${board.name}"\n\n**Central Topic:** ${analysis.centralTopic}\n**Branches:** ${analysis.branches.length}`);
    
    // Close the selector
    setShowBoardSelector(false);
  };

  // Function to remove a referenced board
  const removeReferencedBoard = (boardId) => {
    setReferencedBoards(prev => prev.filter(b => b.id !== boardId));
    addMessage('assistant', 'Board removed from references.');
  };

  // Function to compare current board with referenced boards
  const compareBoards = () => {
    if (referencedBoards.length === 0) {
      addMessage('assistant', 'No boards referenced for comparison. Please reference some boards first.');
      return;
    }
    
    updateStep('analyzing');
    addMessage('assistant', '🔍 Comparing current board with referenced boards...');
    
    // Analyze current board
    const currentAnalysis = analyzeMindMap();
    
    // Create comparison summary
    let summary = `## Board Comparison\n\n`;
    summary += `### Current Board\n`;
    summary += `**Central Topic:** ${currentAnalysis.centralTopic}\n`;
    summary += `**Main Branches:** ${currentAnalysis.branches.length}\n\n`;
    
    summary += `### Referenced Boards\n`;
    referencedBoards.forEach((board, index) => {
      const analysis = analyzeSavedBoard(board);
      summary += `#### ${index + 1}. ${board.name}\n`;
      summary += `**Central Topic:** ${analysis.centralTopic}\n`;
      summary += `**Main Branches:** ${analysis.branches.length}\n\n`;
    });
    
    // Add insights about similarities and differences
    summary += `### Insights\n`;
    
    // Find common themes across boards
    const allTopics = [currentAnalysis.centralTopic, ...referencedBoards.map(b => analyzeSavedBoard(b).centralTopic)];
    const uniqueTopics = [...new Set(allTopics)];
    
    if (uniqueTopics.length < allTopics.length) {
      summary += `- **Common Themes:** There are ${allTopics.length - uniqueTopics.length} overlapping central topics across the boards.\n`;
    }
    
    // Compare branch counts
    const branchCounts = [currentAnalysis.branches.length, ...referencedBoards.map(b => analyzeSavedBoard(b).branches.length)];
    const avgBranches = branchCounts.reduce((a, b) => a + b, 0) / branchCounts.length;
    
    if (currentAnalysis.branches.length > avgBranches) {
      summary += `- The current board has more branches than the average of referenced boards.\n`;
    } else if (currentAnalysis.branches.length < avgBranches) {
      summary += `- The current board has fewer branches than the average of referenced boards.\n`;
    }
    
    addMessage('assistant', summary);
    updateStep('idle');
  };

  // Function to merge ideas from multiple boards
  const mergeIdeas = () => {
    if (referencedBoards.length === 0) {
      addMessage('assistant', 'No boards referenced for merging. Please reference some boards first.');
      return;
    }
    
    updateStep('planning');
    addMessage('assistant', '🔄 Generating merged ideas from referenced boards...');
    
    // Analyze current board
    const currentAnalysis = analyzeMindMap();
    
    // Collect all branches from referenced boards
    const allBranches = [];
    referencedBoards.forEach(board => {
      const analysis = analyzeSavedBoard(board);
      analysis.branches.forEach(branch => {
        allBranches.push({
          text: branch.text,
          source: board.name
        });
      });
    });
    
    // Create merged ideas summary
    let summary = `## Merged Ideas\n\n`;
    summary += `### Current Board: ${currentAnalysis.centralTopic}\n\n`;
    
    // Group branches by similarity
    const groupedBranches = {};
    allBranches.forEach(branch => {
      // Simple grouping by first word
      const firstWord = branch.text.split(' ')[0].toLowerCase();
      if (!groupedBranches[firstWord]) {
        groupedBranches[firstWord] = [];
      }
      groupedBranches[firstWord].push(branch);
    });
    
    // Add grouped branches to summary
    Object.keys(groupedBranches).forEach(key => {
      if (groupedBranches[key].length > 1) {
        summary += `#### ${key.toUpperCase()}\n`;
        groupedBranches[key].forEach(branch => {
          summary += `- ${branch.text} (from "${branch.source}")\n`;
        });
        summary += '\n';
      }
    });
    
    // Add suggestions for new connections
    summary += `### Suggested New Connections\n`;
    summary += `Consider connecting these ideas from different boards:\n\n`;
    
    // Suggest connections between current board and referenced boards
    currentAnalysis.branches.forEach(branch => {
      const similarBranches = allBranches.filter(b => 
        b.text.toLowerCase().includes(branch.text.toLowerCase().split(' ')[0]) ||
        branch.text.toLowerCase().includes(b.text.toLowerCase().split(' ')[0])
      );
      
      if (similarBranches.length > 0) {
        summary += `- Connect "${branch.text}" with:\n`;
        similarBranches.forEach(b => {
          summary += `  - "${b.text}" (from "${b.source}")\n`;
        });
        summary += '\n';
      }
    });
    
    addMessage('assistant', summary);
    updateStep('idle');
  };

  // Tool registry with capabilities and examples
  const toolRegistry = {
    analyze: {
      name: 'Analyze Structure',
      description: 'Analyze the mind map structure and relationships',
      examples: ['analyze this mind map', 'what\'s the structure of this mind map', 'show me the relationships'],
      execute: async (context) => {
        updateStep('analyzing');
        addMessage('system', '🔍 Analyzing your mind map structure...');
        
        const mindMapAnalysis = analyzeMindMap();
        
        // Create a summary of the mind map
        let summary = `## Mind Map Analysis\n\n`;
        summary += `**Central Topic:** ${mindMapAnalysis.centralTopic}\n\n`;
        summary += `**Main Branches:** ${mindMapAnalysis.branches.length}\n\n`;
        
        if (mindMapAnalysis.branches.length > 0) {
          summary += `### Branch Details:\n\n`;
          mindMapAnalysis.branches.forEach((branch, index) => {
            summary += `${index + 1}. **${branch.text}** (${branch.connections} connections)\n`;
          });
        }
        
        addMessage('assistant', summary);
        updateStep('idle');
        
        return {
          success: true,
          result: mindMapAnalysis,
          message: 'I\'ve analyzed your mind map structure. Would you like me to suggest action items based on this analysis?'
        };
      }
    },
    plan: {
      name: 'Create Action Plan',
      description: 'Generate a step-by-step action plan based on the mind map',
      examples: ['create an action plan', 'what should I do next', 'generate tasks from this mind map'],
      execute: async (context) => {
        updateStep('planning');
        addMessage('system', '📋 Generating action plan based on your mind map...');
        
        const mindMapAnalysis = analyzeMindMap();
        
        try {
          const systemPrompt = `You are an AI agent that helps users create action plans from mind maps.
          Create a detailed action plan based on the following mind map:
          
          Central Topic: ${mindMapAnalysis.centralTopic}
          Number of main branches: ${mindMapAnalysis.branches.length}
          
          For each branch, suggest 2-3 specific, actionable tasks that would help implement or develop the ideas.
          Format your response as a markdown list with the following structure:
          
          ## Action Plan
          
          ### [Branch Name]
          1. [Action Item 1]
          2. [Action Item 2]
          
          Make the action items specific, measurable, and achievable.`;

          const data = await callGroqChat({
            model: DEFAULT_GROQ_MODEL,
            messages: [{ role: 'system', content: systemPrompt }],
            temperature: 0.7,
            max_tokens: 2000,
          });
          
          if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response from AI service');
          }
          
          const actionPlan = data.choices[0].message.content;
          
          addMessage('assistant', actionPlan);
          
          // Parse action items for Notion integration
          if (selectedTools.includes('notion')) {
            parseActionItems(actionPlan);
          }
          
          updateStep('idle');
          
          return {
            success: true,
            result: actionPlan,
            message: 'I\'ve created an action plan based on your mind map. Would you like me to create these tasks in Notion?'
          };
        } catch (error) {
          console.error('Error generating action plan:', error);
          addMessage('assistant', `❌ Error generating action plan: ${error.message}`);
          updateStep('idle');
          
          return {
            success: false,
            error: error.message,
            message: 'I encountered an error while generating the action plan. Please try again.'
          };
        }
      }
    },
    notion: {
      name: 'Notion Integration',
      description: 'Create tasks and pages in Notion',
      examples: ['create tasks in notion', 'add this to notion', 'save to notion'],
      execute: async (context) => {
        if (actionItems.length === 0) {
          addMessage('assistant', 'I don\'t have any action items to create in Notion yet. Would you like me to analyze your mind map and generate an action plan first?');
          return {
            success: false,
            message: 'No action items available for Notion integration.'
          };
        }
        
        updateStep('confirming');
        addMessage('assistant', 'Please confirm the following action items to be created in Notion:');
        
        let confirmationMessage = '## Action Items to Create\n\n';
        actionItems.forEach((item, index) => {
          confirmationMessage += `${index + 1}. **${item.branch}**: ${item.action}\n`;
        });
        confirmationMessage += '\nReply with "confirm" to create these items in Notion, or "modify" to make changes.';
        
        addMessage('assistant', confirmationMessage);
        
        return {
          success: true,
          result: actionItems,
          message: 'I\'ve prepared action items for Notion. Please confirm to create them.'
        };
      }
    },
    confirm: {
      name: 'Confirm Actions',
      description: 'Confirm and execute pending actions',
      examples: ['confirm', 'yes', 'proceed', 'do it'],
      execute: async (context) => {
        if (currentStep !== 'confirming') {
          addMessage('assistant', 'There are no pending actions to confirm. What would you like me to do?');
          return {
            success: false,
            message: 'No pending actions to confirm.'
          };
        }
        
        updateStep('executing');
        addMessage('system', '🔄 Starting Notion integration process...');
        
        // Ensure database exists
        addMessage('system', '🔄 Checking Notion database connection...');
        const dbId = await handleNotionDatabase();
        if (!dbId) {
          updateStep('idle');
          return {
            success: false,
            message: 'Failed to connect to Notion database.'
          };
        }
        
        // Create pages for each action item
        let successCount = 0;
        let failCount = 0;
        
        addMessage('system', `🔄 Creating ${actionItems.length} action items in Notion...`);
        
        for (const item of actionItems) {
          setCurrentAction(item);
          
          const properties = {
            Status: {
              select: {
                name: item.status
              }
            },
            Priority: {
              select: {
                name: item.priority
              }
            },
            Category: {
              select: {
                name: item.branch
              }
            },
            Notes: {
              rich_text: [
                {
                  text: {
                    content: `Action: ${item.action}\n\nSource: Mind Map - ${analyzeMindMap().centralTopic}`
                  }
                }
              ]
            }
          };
          
          const pageId = await handleNotionPage(item.action, properties);
          if (pageId) {
            successCount++;
          } else {
            failCount++;
          }
        }
        
        addMessage('assistant', `✅ Successfully created ${successCount} action items in Notion.${failCount > 0 ? ` ❌ Failed to create ${failCount} items.` : ''}`);
        setCurrentAction(null);
        updateStep('idle');
        
        return {
          success: true,
          result: { successCount, failCount },
          message: `I've created ${successCount} action items in Notion.${failCount > 0 ? ` ${failCount} items failed to create.` : ''}`
        };
      }
    },
    reference: {
      name: 'Reference Boards',
      description: 'Use saved boards as context for analysis',
      examples: ['reference a board', 'use a saved board', 'compare with another board'],
      execute: async (context) => {
        setShowBoardSelector(true);
        return {
          success: true,
          message: 'Please select a board to reference from the list.'
        };
      }
    },
    compare: {
      name: 'Compare Boards',
      description: 'Compare current board with saved boards',
      examples: ['compare boards', 'how does this compare to other boards', 'show differences'],
      execute: async (context) => {
        if (referencedBoards.length === 0) {
          addMessage('assistant', 'No boards referenced for comparison. Please reference some boards first.');
          return {
            success: false,
            message: 'No boards referenced for comparison.'
          };
        }
        
        updateStep('analyzing');
        addMessage('system', '🔍 Comparing current board with referenced boards...');
        
        // Analyze current board
        const currentAnalysis = analyzeMindMap();
        
        // Create comparison summary
        let summary = `## Board Comparison\n\n`;
        summary += `### Current Board\n`;
        summary += `**Central Topic:** ${currentAnalysis.centralTopic}\n`;
        summary += `**Main Branches:** ${currentAnalysis.branches.length}\n\n`;
        
        summary += `### Referenced Boards\n`;
        referencedBoards.forEach((board, index) => {
          const analysis = analyzeSavedBoard(board);
          summary += `#### ${index + 1}. ${board.name}\n`;
          summary += `**Central Topic:** ${analysis.centralTopic}\n`;
          summary += `**Main Branches:** ${analysis.branches.length}\n\n`;
        });
        
        // Add insights about similarities and differences
        summary += `### Insights\n`;
        
        // Find common themes across boards
        const allTopics = [currentAnalysis.centralTopic, ...referencedBoards.map(b => analyzeSavedBoard(b).centralTopic)];
        const uniqueTopics = [...new Set(allTopics)];
        
        if (uniqueTopics.length < allTopics.length) {
          summary += `- **Common Themes:** There are ${allTopics.length - uniqueTopics.length} overlapping central topics across the boards.\n`;
        }
        
        // Compare branch counts
        const branchCounts = [currentAnalysis.branches.length, ...referencedBoards.map(b => analyzeSavedBoard(b).branches.length)];
        const avgBranches = branchCounts.reduce((a, b) => a + b, 0) / branchCounts.length;
        
        if (currentAnalysis.branches.length > avgBranches) {
          summary += `- The current board has more branches than the average of referenced boards.\n`;
        } else if (currentAnalysis.branches.length < avgBranches) {
          summary += `- The current board has fewer branches than the average of referenced boards.\n`;
        }
        
        addMessage('assistant', summary);
        updateStep('idle');
        
        return {
          success: true,
          result: { currentAnalysis, referencedBoards },
          message: 'I\'ve compared your current board with the referenced boards. Is there anything specific about the comparison you\'d like me to explain?'
        };
      }
    },
    merge: {
      name: 'Merge Ideas',
      description: 'Merge ideas from multiple boards',
      examples: ['merge ideas', 'combine boards', 'create a combined view'],
      execute: async (context) => {
        if (referencedBoards.length === 0) {
          addMessage('assistant', 'No boards referenced for merging. Please reference some boards first.');
          return {
            success: false,
            message: 'No boards referenced for merging.'
          };
        }
        
        updateStep('planning');
        addMessage('system', '🔄 Generating merged ideas from referenced boards...');
        
        // Analyze current board
        const currentAnalysis = analyzeMindMap();
        
        // Collect all branches from referenced boards
        const allBranches = [];
        referencedBoards.forEach(board => {
          const analysis = analyzeSavedBoard(board);
          analysis.branches.forEach(branch => {
            allBranches.push({
              text: branch.text,
              source: board.name
            });
          });
        });
        
        // Create merged ideas summary
        let summary = `## Merged Ideas\n\n`;
        summary += `### Current Board: ${currentAnalysis.centralTopic}\n\n`;
        
        // Group branches by similarity
        const groupedBranches = {};
        allBranches.forEach(branch => {
          // Simple grouping by first word
          const firstWord = branch.text.split(' ')[0].toLowerCase();
          if (!groupedBranches[firstWord]) {
            groupedBranches[firstWord] = [];
          }
          groupedBranches[firstWord].push(branch);
        });
        
        // Add grouped branches to summary
        Object.keys(groupedBranches).forEach(key => {
          if (groupedBranches[key].length > 1) {
            summary += `#### ${key.toUpperCase()}\n`;
            groupedBranches[key].forEach(branch => {
              summary += `- ${branch.text} (from "${branch.source}")\n`;
            });
            summary += '\n';
          }
        });
        
        // Add suggestions for new connections
        summary += `### Suggested New Connections\n`;
        summary += `Consider connecting these ideas from different boards:\n\n`;
        
        // Suggest connections between current board and referenced boards
        currentAnalysis.branches.forEach(branch => {
          const similarBranches = allBranches.filter(b => 
            b.text.toLowerCase().includes(branch.text.toLowerCase().split(' ')[0]) ||
            branch.text.toLowerCase().includes(b.text.toLowerCase().split(' ')[0])
          );
          
          if (similarBranches.length > 0) {
            summary += `- Connect "${branch.text}" with:\n`;
            similarBranches.forEach(b => {
              summary += `  - "${b.text}" (from "${b.source}")\n`;
            });
            summary += '\n';
          }
        });
        
        addMessage('assistant', summary);
        updateStep('idle');
        
        return {
          success: true,
          result: { currentAnalysis, groupedBranches },
          message: 'I\'ve merged ideas from your referenced boards. Would you like me to help you implement any of these connections in your current board?'
        };
      }
    }
  };

  // Function to identify tools based on user intent
  const identifyTools = async (userInput) => {
    try {
      // Create a list of tools with their descriptions and examples
      const toolsList = Object.entries(toolRegistry).map(([id, tool]) => ({
        id,
        name: tool.name,
        description: tool.description,
        examples: tool.examples
      }));

      // Create system prompt for tool identification
      const systemPrompt = `You are an AI assistant that helps identify which tools a user wants to use based on their input.
      
      Available tools:
      ${toolsList.map(tool => `- ${tool.name}: ${tool.description} (Examples: ${tool.examples.join(', ')})`).join('\n')}
      
      Analyze the user's input and identify which tools they want to use. Return a JSON array of tool IDs.
      If the user is confirming a previous action, return ["confirm"].
      If the user is modifying a previous action, return ["modify"].
      If no specific tools are mentioned, return an empty array.
      
      Example responses:
      - User: "Analyze this mind map" -> ["analyze"]
      - User: "Create tasks in Notion" -> ["notion"]
      - User: "Compare this with my other boards" -> ["reference", "compare"]
      - User: "Yes, do it" -> ["confirm"]
      - User: "Change the priority to high" -> ["modify"]
      - User: "Hello" -> []`;

      // Extract tools from user input using simple keyword matching
      const tools = [];
      const input = userInput.toLowerCase();
      
      // Check for confirmation words
      if (input.match(/\b(yes|confirm|do it|proceed|okay|sure)\b/)) {
        return ["confirm"];
      }
      
      // Check for modification words
      if (input.match(/\b(modify|change|update|edit|revise)\b/)) {
        return ["modify"];
      }
      
      // Check for tool-specific keywords
      if (input.match(/\b(analyze|analysis|structure|relationship)\b/)) {
        tools.push("analyze");
      }
      if (input.match(/\b(notion|task|todo|action item)\b/)) {
        tools.push("notion");
      }
      if (input.match(/\b(compare|difference|similar|similarity)\b/)) {
        tools.push("compare");
      }
      if (input.match(/\b(reference|board|saved|previous)\b/)) {
        tools.push("reference");
      }
      if (input.match(/\b(merge|combine|join|integrate)\b/)) {
        tools.push("merge");
      }
      
      return [...new Set(tools)]; // Remove duplicates
      
    } catch (error) {
      console.error('Error identifying tools:', error);
      return [];
    }
  };

  // Function to execute tools in an agentic, conversational manner
  const executeToolAgentChat = async (userInput) => {
    try {
      const model = DEFAULT_GROQ_MODEL;
      
      // Identify tools based on user intent
      const identifiedTools = await identifyTools(userInput);
      
      // If no tools identified, proceed with regular chat
      if (identifiedTools.length === 0) {
        return false;
      }
      
      // Execute each identified tool
      for (const toolId of identifiedTools) {
        if (toolRegistry[toolId]) {
          addMessage('system', `🔄 Using tool: ${toolRegistry[toolId].name}`);
          
          try {
            const result = await toolRegistry[toolId].execute({
              userInput,
              selectedTools,
              referencedBoards,
              currentStep
            });
            
            // If the tool returns a message, add it to the chat
            if (result.message) {
              addMessage('assistant', result.message);
            }
            
            // If this is a reference tool, we need to wait for user selection
            if (toolId === 'reference') {
              return true;
            }
          } catch (error) {
            console.error(`Error executing tool ${toolId}:`, error);
            addMessage('assistant', `❌ Error using ${toolRegistry[toolId].name}: ${error.message}`);
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error executing tool agent chat:', error);
      addMessage('assistant', `Error: ${error.message}`);
      return null;
    }
  };

  // Function to process Groq response and extract action items for Notion
  const processGroqResponseForNotion = async (response) => {
    if (!selectedTools.includes('notion')) {
      return;
    }

    // Check if the response contains action items or tasks
    if (response.toLowerCase().includes('action') || 
        response.toLowerCase().includes('task') ||
        response.toLowerCase().includes('todo') ||
        response.toLowerCase().includes('step')) {
      
      // Extract action items from the response
      const lines = response.split('\n');
      const items = [];
      let currentCategory = 'General';
      
      for (const line of lines) {
        // Look for headings that might indicate categories
        if (line.startsWith('## ') || line.startsWith('### ')) {
          currentCategory = line.replace(/^#+\s+/, '').trim();
        }
        // Look for numbered or bulleted items that might be actions
        else if (line.match(/^\d+\.\s+/) || line.match(/^[-*]\s+/)) {
          const actionText = line.replace(/^\d+\.\s+|^[-*]\s+/, '').trim();
          if (actionText && actionText.length > 5) { // Ensure it's a meaningful action
            items.push({
              branch: currentCategory,
              action: actionText,
              status: 'Not started',
              priority: 'Medium'
            });
          }
        }
      }
      
      if (items.length > 0) {
        setActionItems(items);
        addMessage('assistant', `I've identified ${items.length} action items from your request. Would you like me to create these in Notion? Type "confirm" to proceed.`);
        
        // Show the action items for confirmation
        let confirmationMessage = '## Action Items to Create\n\n';
        items.forEach((item, index) => {
          confirmationMessage += `${index + 1}. **${item.branch}**: ${item.action}\n`;
        });
        confirmationMessage += '\nReply with "confirm" to create these items in Notion, or "modify" to make changes.';
        
        addMessage('assistant', confirmationMessage);
      }
    }
  };

  // Add a new function to handle Notion commands
  const handleNotionCommand = async (command) => {
    if (!selectedTools.includes('notion')) {
      addMessage('assistant', '❌ Notion integration is not selected. Please select it from the tools menu.');
      return;
    }
    
    const parts = command.toLowerCase().split(' ');
    
    if (parts.includes('fetch') || parts.includes('get') || parts.includes('show')) {
      // Fetch and display Notion database content
      const pages = await handleNotionDatabaseContent();
      if (pages && pages.length > 0) {
        let message = '## Notion Database Items\n\n';
        pages.forEach((page, index) => {
          message += `${index + 1}. **${page.title}**\n`;
          message += `   - Status: ${page.status}\n`;
          message += `   - Priority: ${page.priority}\n`;
          message += `   - Category: ${page.category}\n`;
          message += `   - [View in Notion](${page.url})\n\n`;
        });
        addMessage('assistant', message);
      }
    } else if (parts.includes('update') || parts.includes('change')) {
      // Update a Notion page
      // This would require more context about which page to update
      addMessage('assistant', 'To update a Notion page, please specify the page ID and the properties to update.');
    } else if (parts.includes('delete') || parts.includes('remove')) {
      // Delete a Notion page
      // This would require more context about which page to delete
      addMessage('assistant', 'To delete a Notion page, please specify the page ID.');
    } else {
      addMessage('assistant', 'I can help you with Notion integration. Try commands like:\n- "fetch notion items"\n- "update notion page"\n- "delete notion page"');
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const userMessage = {
      role: 'user',
      content: inputValue
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);

    try {
      // Check for special commands first
      if (inputValue.toLowerCase() === 'analyze') {
        await processMindMapAnalysis();
      } else if (inputValue.toLowerCase() === 'plan') {
        await generateActionPlan();
      } else if (inputValue.toLowerCase() === 'create notion') {
        await createNotionActions();
      } else if (inputValue.toLowerCase() === 'confirm') {
        await executeNotionActions();
      } else if (inputValue.toLowerCase() === 'modify') {
        addMessage('assistant', 'Please tell me what changes you would like to make to the action items.');
      } else if (inputValue.toLowerCase() === 'compare') {
        await compareBoards();
      } else if (inputValue.toLowerCase() === 'merge') {
        await mergeIdeas();
      } else if (inputValue.toLowerCase().includes('notion') && selectedTools.includes('notion')) {
        // Handle Notion-specific commands
        await handleNotionCommand(inputValue);
      } else {
        // Try to execute tools in an agentic manner
        const toolExecuted = await executeToolAgentChat(inputValue);
        
        // If no tools were executed, proceed with regular chat
        if (!toolExecuted) {
          const model = DEFAULT_GROQ_MODEL;
          const mindMapAnalysis = analyzeMindMap();
          const toolContext = getToolContext();

          let highlightedContext = '';
          if (highlightedItems && highlightedItems.length > 0) {
            const highlightedTexts = highlightedItems.map(item => item.text || 'Untitled').join('\n');
            highlightedContext = `\n\nCurrently selected items:\n${highlightedTexts}\n\nPlease focus your analysis on these specific items when relevant.`;
          }

          const systemPrompt = `You are an AI agent that helps users analyze mind maps and take actions.
          ${toolContext}

          You can:
          1. Analyze mind map structure and relationships
          2. Suggest potential actions based on the content
          3. Help connect ideas to external tools and resources
          4. Provide step-by-step implementation plans

          Current mind map structure:
          Central Topic: ${mindMapAnalysis.centralTopic}
          Number of main branches: ${mindMapAnalysis.branches.length}${highlightedContext}`;

          const data = await callGroqChat({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.slice(-5),
              userMessage
            ],
            temperature: 0.7,
            max_tokens: 1000,
          });
          
          if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response from AI service');
          }
          
          const aiResponse = data.choices[0].message.content;

          // Add AI response to chat
          addMessage('assistant', aiResponse);

          // Process response for potential Notion actions
          await processGroqResponseForNotion(aiResponse);
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
      addMessage('assistant', `Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to clear the chat history
  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Chat history cleared. How can I help you with your mind map?'
      }
    ]);
    setActionItems([]);
    setCurrentStep('idle');
    setCurrentAction(null);
  };

  // Add a component to display Notion updates
  const NotionUpdatesPanel = () => {
    if (notionUpdates.length === 0) return null;
    
    return (
      <div className="notion-updates-panel">
        <h4>Notion Updates</h4>
        <div className="notion-updates-list">
          {notionUpdates.map((update, index) => (
            <div key={index} className="notion-update-item">
              <div className="notion-update-type">{update.type}</div>
              <div className="notion-update-timestamp">
                {new Date(update.timestamp).toLocaleString()}
              </div>
              <div className="notion-update-details">
                {update.type === 'page.created' && (
                  <span>New page created: {update.data.title || 'Untitled'}</span>
                )}
                {update.type === 'page.updated' && (
                  <span>Page updated: {update.data.title || 'Untitled'}</span>
                )}
                {update.type === 'page.deleted' && (
                  <span>Page deleted</span>
                )}
                {update.type === 'database.content_updated' && (
                  <span>Database content updated</span>
                )}
                {update.type === 'database.schema_updated' && (
                  <span>Database schema updated</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="agent-chat-overlay" onClick={onClose}>
      <div className="agent-chat-modal" onClick={e => e.stopPropagation()}>
        <div className="agent-chat-header">
          <h3>Mind Map Agent</h3>
          <div className="header-actions">
            <button className="clear-chat-button" onClick={clearChat} title="Clear chat history">
              <span className="clear-icon">🗑️</span>
            </button>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="tool-menu">
          <div className="tool-categories">
            {Object.entries(toolCategories).map(([category, tools]) => (
              <div key={category} className="tool-category">
                <h4 className="category-title">{category.charAt(0).toUpperCase() + category.slice(1)}</h4>
                <div className="tool-list">
                  {tools.tools.map(tool => (
                    <div 
                      key={tool.id} 
                      className={`tool-item ${selectedTools.includes(tool.id) ? 'selected' : ''}`}
                      onClick={() => toggleTool(tool.id)}
                      title={tool.description}
                    >
                      <span className="tool-icon">{tool.icon}</span>
                      <span className="tool-name">{tool.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Display highlighted items as context */}
        {highlightedItems && highlightedItems.length > 0 && (
          <div className="highlighted-items-context" style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            borderBottom: '1px solid rgba(33, 150, 243, 0.2)',
            fontSize: '11px',
            color: '#666',
            fontStyle: 'italic'
          }}>
            <strong>Context:</strong> {highlightedItems.length} item{highlightedItems.length !== 1 ? 's' : ''} selected
            {highlightedItems.length <= 5 && (
              <span style={{ marginLeft: '8px' }}>
                ({highlightedItems.map(item => item.text || 'Untitled').join(', ')})
              </span>
            )}
          </div>
        )}

        <div className="agent-chat-messages">
          {messages.map((message, index) => (
            <div 
              key={index} 
              className={`chat-message ${message.role === 'assistant' ? 'assistant' : 'user'} ${message.role === 'system' ? 'system' : ''}`}
            >
              <div className="message-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="chat-message assistant">
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          {currentAction && (
            <div className="chat-message system">
              <div className="message-content">
                <div className="progress-indicator">
                  Creating: {currentAction.action}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {referencedBoards.length > 0 && (
          <div className="referenced-boards">
            <div className="referenced-boards-list">
              {referencedBoards.map(board => (
                <div key={board.id} className="referenced-board-item">
                  <span>{board.name}</span>
                  <button 
                    className="remove-reference-btn"
                    onClick={() => removeReferencedBoard(board.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {showBoardSelector && (
          <div className="board-selector">
            <div className="board-selector-header">
              <h4>Select Boards to Reference</h4>
              <button 
                className="close-button"
                onClick={() => setShowBoardSelector(false)}
              >
                ×
              </button>
            </div>
            <div className="board-selector-list">
              {savedBoards.length > 0 ? (
                savedBoards.map(board => (
                  <div 
                    key={board.id} 
                    className={`board-selector-item ${referencedBoards.some(b => b.id === board.id) ? 'selected' : ''}`}
                    onClick={() => referenceBoard(board.id)}
                  >
                    <span>{board.name}</span>
                    <span className="board-date">
                      {new Date(board.savedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="no-boards-message">
                  No saved boards found. Save your current board first.
                </div>
              )}
            </div>
          </div>
        )}

        <NotionUpdatesPanel />

        <div className="agent-chat-input">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about your mind map or request actions..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <button 
            onClick={handleSendMessage}
            disabled={isProcessing || !inputValue.trim()}
          >
            {isProcessing ? (
              <span className="loading-spinner"></span>
            ) : (
              'Send'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentChat;