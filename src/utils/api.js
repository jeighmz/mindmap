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