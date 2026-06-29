const admin = require('firebase-admin');

const initFirebase = () => {
  if (admin.apps.length) return;

  if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PROJECT_ID) {
    throw new Error('Missing Firebase credentials: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY must be set.');
  }

  let privateKey = process.env.FIREBASE_PRIVATE_KEY.trim().replace(/^["']|["']$/g, '');
  privateKey = privateKey.replace(/\\n/g, '\n');

  if (privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    const keyContent = privateKey
      .replace(/-----BEGIN PRIVATE KEY-----\s*/, '')
      .replace(/\s*-----END PRIVATE KEY-----/, '')
      .replace(/\s+/g, '');
    privateKey = `-----BEGIN PRIVATE KEY-----\n${keyContent.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----`;
  } else {
    const keyContent = privateKey.replace(/\s+/g, '');
    if (!keyContent) throw new Error('FIREBASE_PRIVATE_KEY content is empty.');
    privateKey = `-----BEGIN PRIVATE KEY-----\n${keyContent.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----`;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
};

module.exports = { initFirebase };
