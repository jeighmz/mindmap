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

      // Log the first few characters of the private key to verify format
      const privateKeyPreview = process.env.FIREBASE_PRIVATE_KEY.substring(0, 50) + '...';
      console.log('Private key preview:', privateKeyPreview);

      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      
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
    return crypto.randomBytes(32).toString('hex');
  } catch (error) {
    console.error('Error generating user key:', error);
    throw new Error(`Failed to generate encryption key: ${error.message}`);
  }
};

// Encrypt data with a user-specific key
const encrypt = (data, userKey) => {
  try {
    if (!data || !userKey) {
      throw new Error('Missing required encryption parameters');
    }

    console.log('Encryption parameters:', {
      hasData: !!data,
      userKeyLength: userKey.length,
      dataType: typeof data
    });

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(userKey, 'hex'), iv);
    
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
const decrypt = (encryptedData, userKey) => {
  try {
    if (!encryptedData || !userKey) {
      throw new Error('Missing required decryption parameters');
    }

    const [ivHex, encrypted, authTagHex] = encryptedData.split(':');
    
    if (!ivHex || !encrypted || !authTagHex) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(userKey, 'hex'), iv);
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
  encrypt,
  decrypt,
  db
}; 