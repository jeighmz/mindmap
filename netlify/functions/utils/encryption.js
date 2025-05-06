const crypto = require('crypto');
const admin = require('firebase-admin');

let db;

const initializeFirebase = () => {
  try {
    if (!admin.apps.length) {
      // Debug logging for environment variables
      const envVars = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmailExists: !!process.env.FIREBASE_CLIENT_EMAIL,
        privateKeyExists: !!process.env.FIREBASE_PRIVATE_KEY,
      };
      console.log('Environment variables check:', envVars);

      if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        throw new Error('Missing required Firebase Admin environment variables');
      }

      // Handle private key formatting
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      // Remove any surrounding quotes and spaces
      privateKey = privateKey.trim().replace(/^["']|["']$/g, '');
      
      // Replace escaped newlines with actual newlines
      privateKey = privateKey.replace(/\\n/g, '\n');
      
      // Ensure the key has the proper PEM format
      if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
        privateKey = '-----BEGIN PRIVATE KEY-----\n' + privateKey;
      }
      if (!privateKey.endsWith('-----END PRIVATE KEY-----')) {
        privateKey = privateKey + '\n-----END PRIVATE KEY-----';
      }

      const config = {
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey
        })
      };

      console.log('Initializing Firebase with config:', {
        projectId: config.credential.projectId,
        clientEmailExists: !!config.credential.clientEmail,
        privateKeyExists: !!config.credential.privateKey
      });

      admin.initializeApp(config);
      console.log('Firebase Admin initialized successfully');
    }
    
    db = admin.firestore();
    return true;
  } catch (error) {
    console.error('Firebase initialization error:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    throw new Error(`Firebase initialization failed: ${error.message}`);
  }
};

// Initialize Firebase when the module loads
initializeFirebase();

// Generate a unique encryption key for a user
const generateUserKey = () => {
  try {
    const key = crypto.randomBytes(32);
    return key;
  } catch (error) {
    console.error('Error generating user key:', error);
    throw new Error(`Failed to generate encryption key: ${error.message}`);
  }
};

// Get or create a user's encryption key
const getUserKey = async (userId) => {
  try {
    // Try to get existing key
    const userKeyDoc = await db.collection('userKeys').doc(userId).get();
    
    if (userKeyDoc.exists) {
      const keyData = userKeyDoc.data().key;
      return Buffer.from(keyData, 'base64');
    }
    
    // Generate new key if none exists
    const newKey = generateUserKey();
    await db.collection('userKeys').doc(userId).set({
      key: newKey.toString('base64'),
      createdAt: new Date().toISOString()
    });
    
    return newKey;
  } catch (error) {
    console.error('Error getting/creating user key:', error);
    throw new Error(`Failed to get/create user key: ${error.message}`);
  }
};

// Encrypt data with a user-specific key
const encrypt = async (data, userId) => {
  try {
    if (!data || !userId) {
      throw new Error('Missing required encryption parameters');
    }

    const userKey = await getUserKey(userId);

    console.log('Encryption parameters:', {
      hasData: !!data,
      hasUserId: !!userId,
      dataType: typeof data,
      userKeyLength: userKey.length
    });

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', userKey, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    const result = iv.toString('hex') + ':' + encrypted + ':' + authTag.toString('hex');
    console.log('Encryption successful, result length:', result.length);
    
    return result;
  } catch (error) {
    console.error('Encryption error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

// Decrypt data with a user-specific key
const decrypt = async (encryptedData, userId) => {
  try {
    if (!encryptedData || !userId) {
      throw new Error('Missing required decryption parameters');
    }

    const userKey = await getUserKey(userId);

    const [ivHex, encrypted, authTagHex] = encryptedData.split(':');
    
    if (!ivHex || !encrypted || !authTagHex) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', userKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

module.exports = {
  generateUserKey,
  getUserKey,
  encrypt,
  decrypt,
  db
}; 