const admin = require('firebase-admin');

const LOCAL_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8888',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8888',
];

const getAllowedOrigins = () => {
  const origins = [...LOCAL_ORIGINS];

  for (const envVar of ['SITE_URL', 'URL', 'DEPLOY_PRIME_URL']) {
    if (process.env[envVar]) {
      origins.push(process.env[envVar].replace(/\/$/, ''));
    }
  }

  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach((origin) => {
      const trimmed = origin.trim();
      if (trimmed) origins.push(trimmed);
    });
  }

  return [...new Set(origins)];
};

const isProduction = () =>
  process.env.NODE_ENV === 'production' || process.env.CONTEXT === 'production';

const getCorsHeaders = (origin) => {
  const allowed = getAllowedOrigins();
  let allowOrigin = null;

  if (origin && allowed.includes(origin)) {
    allowOrigin = origin;
  } else if (!isProduction() && origin && /localhost|127\.0\.0\.1/.test(origin)) {
    allowOrigin = origin;
  } else if (allowed.length > 0) {
    allowOrigin = allowed.find((o) => o.startsWith('https://')) || allowed[0];
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin || 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json',
  };
};

const handlePreflight = (event) => {
  if (event.httpMethod !== 'OPTIONS') {
    return null;
  }

  const origin = event.headers.origin || event.headers.Origin;
  return {
    statusCode: 204,
    headers: getCorsHeaders(origin),
    body: '',
  };
};

const requireAuth = async (event, requestedUserId) => {
  const authHeader = event.headers.authorization || event.headers.Authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      error: { statusCode: 401, message: 'Missing or invalid authorization token' },
    };
  }

  try {
    const token = authHeader.slice(7);
    const decoded = await admin.auth().verifyIdToken(token);

    if (requestedUserId && decoded.uid !== requestedUserId) {
      return {
        error: { statusCode: 403, message: 'Forbidden' },
      };
    }

    return { uid: decoded.uid, decoded };
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return {
      error: { statusCode: 401, message: 'Invalid or expired authorization token' },
    };
  }
};

const authErrorResponse = (authResult, headers) => ({
  statusCode: authResult.error.statusCode,
  headers,
  body: JSON.stringify({ error: authResult.error.message }),
});

const safeErrorBody = (message, statusCode = 500) =>
  JSON.stringify({
    error: isProduction() && statusCode >= 500 ? 'Internal server error' : message,
  });

module.exports = {
  getAllowedOrigins,
  getCorsHeaders,
  handlePreflight,
  requireAuth,
  authErrorResponse,
  safeErrorBody,
  isProduction,
};
