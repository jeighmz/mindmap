const admin = require('firebase-admin');
const { decrypt } = require('./encryption');

const getUserNotionApiKey = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const db = admin.firestore();
  const settingsDoc = await db.collection('userSettings').doc(userId).get();

  if (!settingsDoc.exists || !settingsDoc.data().notionApiKey) {
    throw new Error('Notion API key not configured. Add it in Settings.');
  }

  const storedKey = settingsDoc.data().notionApiKey;

  if (!storedKey.includes(':')) {
    return Buffer.from(storedKey, 'base64').toString('utf8');
  }

  return decrypt(storedKey, userId);
};

const getUserGroqApiKey = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const db = admin.firestore();
  const settingsDoc = await db.collection('userSettings').doc(userId).get();

  if (!settingsDoc.exists || !settingsDoc.data().groqApiKey) {
    return null;
  }

  const storedKey = settingsDoc.data().groqApiKey;

  if (!storedKey.includes(':')) {
    const decoded = Buffer.from(storedKey, 'base64').toString('utf8');
    return decoded.startsWith('gsk_') ? decoded : null;
  }

  const decrypted = await decrypt(storedKey, userId);
  return decrypted.startsWith('gsk_') ? decrypted : null;
};

module.exports = {
  getUserNotionApiKey,
  getUserGroqApiKey,
};
