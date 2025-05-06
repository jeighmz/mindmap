// Get the base API URL based on environment
export const getApiBaseUrl = () => {
  if (process.env.NODE_ENV === 'development') {
    // For local development, try to use base64 encoding/decoding instead of the API
    return null;
  }
  return '/api';
};

// Helper function for development mode
export const isDevMode = () => process.env.NODE_ENV === 'development'; 