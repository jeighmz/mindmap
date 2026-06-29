const {
  getCorsHeaders,
  handlePreflight,
  requireAuth,
  authErrorResponse,
  safeErrorBody,
} = require('./utils/auth');
const { getUserGroqApiKey } = require('./utils/userSecrets');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const MODEL_PATTERN = /^[a-zA-Z0-9._/-]{1,100}$/;

const getGroqApiKey = async (userId) => {
  const envKey = process.env.GROQ_API_KEY;
  if (envKey) return envKey;

  const userKey = await getUserGroqApiKey(userId).catch(() => null);
  if (userKey) return userKey;

  throw new Error(
    'Groq API key is not configured. Set GROQ_API_KEY in the Netlify environment variables.'
  );
};

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  const headers = getCorsHeaders(origin);

  const preflight = handlePreflight(event);
  if (preflight) return preflight;

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const authResult = await requireAuth(event);
  if (authResult.error) {
    return authErrorResponse(authResult, headers);
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const {
      messages,
      model = DEFAULT_MODEL,
      temperature,
      max_tokens,
      top_p,
      stream = false,
      response_format,
    } = payload;

    if (!Array.isArray(messages) || messages.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'messages array is required' }),
      };
    }

    if (!MODEL_PATTERN.test(model)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid model' }),
      };
    }

    const groqApiKey = await getGroqApiKey(authResult.uid);

    const groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        ...(temperature !== undefined && { temperature }),
        ...(max_tokens !== undefined && { max_tokens }),
        ...(top_p !== undefined && { top_p }),
        ...(response_format && { response_format }),
        stream,
      }),
    });

    const responseBody = await groqResponse.text();

    return {
      statusCode: groqResponse.status,
      headers,
      body: responseBody,
    };
  } catch (error) {
    console.error('Groq proxy error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: safeErrorBody(error.message, 500),
    };
  }
};
