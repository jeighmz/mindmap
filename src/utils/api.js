import { auth } from '../firebase-config';

// Use production model - llama-3.3-70b-versatile was deprecated Aug 16, 2026
// https://console.groq.com/docs/deprecations
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';

// Get the base API URL based on environment
export const getApiBaseUrl = () => {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:8888/api';
  }
  return '/api';
};

export const isDevMode = () => process.env.NODE_ENV === 'development';

export const getAuthHeaders = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated');
  }

  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

export const callGroqChat = async ({
  messages,
  model = DEFAULT_GROQ_MODEL,
  temperature,
  max_tokens,
  top_p,
  stream = false,
  response_format,
}) => {
  // Authenticated users send a Firebase token so the server can identify them.
  // Guest users (no Firebase session) send the request without a token — the
  // server still processes it, and client-side usage limits enforce the 4-map cap.
  const headers = auth.currentUser
    ? await getAuthHeaders()
    : { 'Content-Type': 'application/json' };

  const response = await fetch(`${getApiBaseUrl()}/groq-chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages,
      model,
      temperature,
      max_tokens,
      top_p,
      stream,
      response_format,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = data.error?.message || data.error || data.message || 'Groq API request failed';
    
    if (response.status === 401) {
      throw new Error('AI service authentication failed. The API key may be invalid or expired. Please contact support.');
    }
    
    if (response.status === 404) {
      // Model not found error
      throw new Error(errorMessage);
    }
    
    if (response.status === 429) {
      throw new Error('AI service rate limit exceeded. Please try again in a moment.');
    }
    
    if (response.status >= 500) {
      throw new Error('AI service is temporarily unavailable. Please try again later.');
    }
    
    throw new Error(errorMessage);
  }

  return data;
};

export const callNotionApi = async (endpoint, { method = 'GET', body } = {}) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${getApiBaseUrl()}/notion-api`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ endpoint, method, body }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || `Notion API error (${response.status})`);
  }

  return data;
};
