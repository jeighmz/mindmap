// Get the base API URL based on environment
export const getApiBaseUrl = () => {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:8888/api';
  }
  return '/api';
}; 