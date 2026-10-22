const {
  getCorsHeaders,
  handlePreflight,
  requireAuth,
  safeErrorBody,
} = require('./utils/auth');
const { initFirebase } = require('./utils/firebase');
const { getUserGroqApiKey } = require('./utils/userSecrets');
const { canUseFeature, incrementUsage } = require('./utils/tierLimits');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Use production model - llama-3.3-70b-versatile was deprecated Aug 16, 2026
// https://console.groq.com/docs/deprecations
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const MODEL_PATTERN = /^[a-zA-Z0-9._/-]{1,100}$/;

const getGroqApiKey = async (userId) => {
  const envKey = process.env.GROQ_API_KEY;
  if (envKey) return envKey;

  if (userId) {
    const userKey = await getUserGroqApiKey(userId).catch(() => null);
    if (userKey) return userKey;
  }

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

  // Initialise Firebase so requireAuth can verify tokens.
  try {
    initFirebase();
  } catch (err) {
    console.error('Firebase init failed:', err.message);
    return {
      statusCode: 503,
      headers,
      body: safeErrorBody('Service temporarily unavailable', 503),
    };
  }

  // Require authentication for all AI features (tier enforcement)
  const authResult = await requireAuth(event);
  if (authResult.error) {
    return {
      statusCode: authResult.error.statusCode,
      headers,
      body: JSON.stringify({ 
        error: {
          message: authResult.error.message,
          type: 'authentication_error',
          code: 'authentication_required'
        }
      }),
    };
  }
  
  const userId = authResult.uid;

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
      featureType = 'aiGeneratedMaps', // Default to map generation
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

    // SERVER-SIDE TIER ENFORCEMENT
    // Check if user has permission to use this feature based on their tier
    const usageCheck = await canUseFeature(userId, featureType);
    
    if (!usageCheck.allowed) {
      const statusCode = usageCheck.reason === 'authentication_required' ? 401 :
                         usageCheck.reason === 'limit_reached' ? 429 :
                         usageCheck.reason === 'feature_not_available' ? 403 : 403;
      
      return {
        statusCode,
        headers,
        body: JSON.stringify({
          error: {
            message: usageCheck.message || 'Feature not available on your current plan',
            type: usageCheck.reason === 'limit_reached' ? 'rate_limit_error' : 'tier_limit_error',
            code: usageCheck.reason,
            tier: usageCheck.tier,
            limit: usageCheck.limit,
            used: usageCheck.used,
            remaining: usageCheck.remaining
          }
        }),
      };
    }

    const groqApiKey = await getGroqApiKey(userId);

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

  if (!groqResponse.ok) {
    let errorData;
    try {
      errorData = JSON.parse(responseBody);
    } catch {
      errorData = {};
    }

    const errorMessage =
      errorData.error?.message ||
      errorData.message ||
      'Groq API request failed';
    const statusCode = groqResponse.status;

    if (statusCode === 401) {
      console.error('Groq API authentication failed - key may be invalid or expired');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: {
            message: 'API key authentication failed. Please check that your Groq API key is valid.',
            type: 'authentication_error',
            code: 'invalid_api_key',
          },
        }),
      };
    }

    if (statusCode === 404) {
      // Model not found - check if it's a deprecated model
      const isDeprecatedModel = model === 'llama-3.3-70b-versatile' || model === 'llama-3.1-8b-instant';
      console.error(`Groq API model not found: ${model}${isDeprecatedModel ? ' (deprecated)' : ''}`);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: {
            message: `The model '${model}' does not exist or you do not have access to it. ${isDeprecatedModel ? 'This model was deprecated in August 2026.' : 'Please check https://console.groq.com/docs/models for available models.'}`,
            type: 'model_not_found_error',
            code: 'model_not_found',
            model,
          },
        }),
      };
    }

    console.error(`Groq API error (${statusCode}):`, errorMessage);
    return {
      statusCode,
      headers,
      body: responseBody,
    };
  }

  // SUCCESS - Increment usage after successful AI call
  try {
    await incrementUsage(userId, featureType);
  } catch (usageError) {
    // Log but don't fail the request if usage tracking fails
    console.error('Failed to increment usage:', usageError);
  }

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
