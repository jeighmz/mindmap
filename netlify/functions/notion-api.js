const admin = require('firebase-admin');
const {
  getCorsHeaders,
  handlePreflight,
  requireAuth,
  authErrorResponse,
  safeErrorBody,
} = require('./utils/auth');
const { getUserNotionApiKey } = require('./utils/userSecrets');

const NOTION_API_BASE = 'https://api.notion.com/v1';
const ALLOWED_PREFIXES = [
  'databases/',
  'pages/',
  'blocks/',
  'search',
  'users/',
];

const initializeFirebase = () => {
  if (admin.apps.length) return;

  if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PROJECT_ID) {
    throw new Error('Missing Firebase credentials');
  }

  let privateKey = process.env.FIREBASE_PRIVATE_KEY.trim().replace(/^["']|["']$/g, '');
  privateKey = privateKey.replace(/\\n/g, '\n');

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
};

const isAllowedEndpoint = (endpoint) => {
  const normalized = String(endpoint || '').replace(/^\/+/, '');
  return ALLOWED_PREFIXES.some(
    (prefix) => normalized === prefix.replace(/\/$/, '') || normalized.startsWith(prefix)
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
    initializeFirebase();

    const { endpoint, method = 'GET', body } = JSON.parse(event.body || '{}');

    if (!endpoint || !isAllowedEndpoint(endpoint)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid Notion API endpoint' }),
      };
    }

    const allowedMethods = ['GET', 'POST', 'PATCH', 'DELETE'];
    if (!allowedMethods.includes(method)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid HTTP method' }),
      };
    }

    const notionApiKey = await getUserNotionApiKey(authResult.uid);
    const notionResponse = await fetch(`${NOTION_API_BASE}/${endpoint.replace(/^\/+/, '')}`, {
      method,
      headers: {
        Authorization: `Bearer ${notionApiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      ...(body !== undefined && body !== null && { body: JSON.stringify(body) }),
    });

    const responseBody = await notionResponse.text();

    return {
      statusCode: notionResponse.status,
      headers,
      body: responseBody,
    };
  } catch (error) {
    console.error('Notion proxy error:', error.message);

    const statusCode = error.message.includes('not configured') ? 400 : 500;
    return {
      statusCode,
      headers,
      body: safeErrorBody(error.message, statusCode),
    };
  }
};
