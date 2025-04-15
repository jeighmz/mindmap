const crypto = require('crypto');

// Generate a unique encryption key for a user
const generateUserKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Encrypt data with a user-specific key
const encrypt = (data, userKey) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(userKey, 'hex'), iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return IV, encrypted data, and auth tag as a single string
  return iv.toString('hex') + ':' + encrypted + ':' + authTag.toString('hex');
};

// Decrypt data with a user-specific key
const decrypt = (encryptedData, userKey) => {
  const [ivHex, encrypted, authTagHex] = encryptedData.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(userKey, 'hex'), iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

module.exports = {
  generateUserKey,
  encrypt,
  decrypt
}; 