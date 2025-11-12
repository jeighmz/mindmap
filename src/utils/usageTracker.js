// Utility functions to track usage limits for non-signed-in users

const STORAGE_KEY = 'mindmap_usage_tracker';
const MIND_MAP_LIMIT = 4;
const EXPAND_LIMIT = 4;
const QUERY_LIMIT = 4;

// Get current usage data from localStorage
export const getUsageData = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading usage data:', error);
  }
  
  // Return default structure if no data exists
  return {
    mindMapsGenerated: 0,
    conceptsExpanded: 0,
    queriesSent: 0,
    lastReset: Date.now()
  };
};

// Save usage data to localStorage
const saveUsageData = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving usage data:', error);
  }
};

// Increment mind map generation count
export const incrementMindMapCount = () => {
  const data = getUsageData();
  data.mindMapsGenerated = (data.mindMapsGenerated || 0) + 1;
  saveUsageData(data);
  return data.mindMapsGenerated;
};

// Increment concept expansion count
export const incrementExpandCount = () => {
  const data = getUsageData();
  data.conceptsExpanded = (data.conceptsExpanded || 0) + 1;
  saveUsageData(data);
  return data.conceptsExpanded;
};

// Increment query count
export const incrementQueryCount = () => {
  const data = getUsageData();
  data.queriesSent = (data.queriesSent || 0) + 1;
  saveUsageData(data);
  return data.queriesSent;
};

// Check if mind map generation is allowed
export const canGenerateMindMap = () => {
  const data = getUsageData();
  return (data.mindMapsGenerated || 0) < MIND_MAP_LIMIT;
};

// Check if concept expansion is allowed
export const canExpandConcept = () => {
  const data = getUsageData();
  return (data.conceptsExpanded || 0) < EXPAND_LIMIT;
};

// Check if query is allowed
export const canSendQuery = () => {
  const data = getUsageData();
  return (data.queriesSent || 0) < QUERY_LIMIT;
};

// Get remaining mind map generations
export const getRemainingMindMaps = () => {
  const data = getUsageData();
  const used = data.mindMapsGenerated || 0;
  return Math.max(0, MIND_MAP_LIMIT - used);
};

// Get remaining concept expansions
export const getRemainingExpands = () => {
  const data = getUsageData();
  const used = data.conceptsExpanded || 0;
  return Math.max(0, EXPAND_LIMIT - used);
};

// Get remaining queries
export const getRemainingQueries = () => {
  const data = getUsageData();
  const used = data.queriesSent || 0;
  return Math.max(0, QUERY_LIMIT - used);
};

// Get usage statistics
export const getUsageStats = () => {
  const data = getUsageData();
  return {
    mindMapsGenerated: data.mindMapsGenerated || 0,
    conceptsExpanded: data.conceptsExpanded || 0,
    queriesSent: data.queriesSent || 0,
    mindMapLimit: MIND_MAP_LIMIT,
    expandLimit: EXPAND_LIMIT,
    queryLimit: QUERY_LIMIT,
    remainingMindMaps: getRemainingMindMaps(),
    remainingExpands: getRemainingExpands(),
    remainingQueries: getRemainingQueries()
  };
};

// Reset usage (for testing or admin purposes)
export const resetUsage = () => {
  localStorage.removeItem(STORAGE_KEY);
};

