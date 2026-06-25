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

module.exports = {
  getUserNotionApiKey,
};
