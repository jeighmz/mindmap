// Get the base API URL based on environment
export const getApiBaseUrl = () => {
  if (process.env.NODE_ENV === 'development') {
    // For local development
    return 'http://localhost:8888/api';
  }
  // For production, use the Netlify Functions path
  return 'https://aimindmap.netlify.app/.netlify/functions';
};

// Helper function for development mode
export const isDevMode = () => process.env.NODE_ENV === 'development';

// Get Groq API key from environment variable
export const getGroqApiKey = () => {
  const apiKey = process.env.REACT_APP_GROQ_API_KEY || window?.env?.REACT_APP_GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error('Groq API key is not configured. Please contact support.');
  }
  
  if (!apiKey.startsWith('gsk_')) {
    throw new Error('Invalid Groq API key format');
  }
  
  return apiKey;
}; 