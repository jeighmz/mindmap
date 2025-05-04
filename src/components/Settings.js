import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase-config';
import { useAuth } from '../contexts/AuthContext';
import { USER_TIERS, TIER_FEATURES } from '../config/userTiers';
import Modal from './Modal';
import '../styles/Settings.css';
import { getApiBaseUrl } from '../utils/api';

export default function Settings({ isOpen, onClose, onUpgradeClick }) {
  const { user, userTier } = useAuth();
  const [groqApiKey, setGroqApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [error, setError] = useState('');

  const loadSettings = useCallback(async () => {
    if (!user?.uid) {
      console.log('No user UID available for loading settings');
      setMessage({ type: 'error', text: 'Please sign in to access settings' });
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setMessage({ type: '', text: '' });
      
      console.log('Attempting to load settings for user:', user.uid);
      const settingsRef = doc(db, 'userSettings', user.uid);
      const settingsSnap = await getDoc(settingsRef);
      
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        console.log('Retrieved settings - Has API key:', !!data.groqApiKey);
        if (data.groqApiKey) {
          console.log('Retrieved key type:', typeof data.groqApiKey);
          console.log('Retrieved key length:', data.groqApiKey.length);
          try {
            // Try to decode base64 first (for development environment)
            console.log('Attempting base64 decode...');
            const decodedKey = atob(data.groqApiKey);
            console.log('Successfully decoded base64 API key');
            console.log('Decoded key length:', decodedKey.length);
            console.log('Decoded key starts with:', decodedKey.substring(0, 4));
            setGroqApiKey(decodedKey);
          } catch (e) {
            console.log('Base64 decode failed:', e.message);
            if (process.env.NODE_ENV === 'development') {
              // If we're in development and it's not base64, show the encrypted value
              console.log('Development mode - Using raw key value');
              setGroqApiKey(data.groqApiKey);
            } else {
              // In production, try to decrypt
              console.log('Production mode - Attempting to decrypt key...');
              const response = await fetch(`${getApiBaseUrl()}/decryptApiKey`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  userId: user.uid,
                  encryptedData: data.groqApiKey
                })
              });

              if (!response.ok) {
                console.error('Decryption failed with status:', response.status);
                const errorText = await response.text();
                console.error('Decryption error:', errorText);
                throw new Error('Failed to decrypt API key');
              }

              const { decrypted } = await response.json();
              console.log('Successfully decrypted key');
              console.log('Decrypted key length:', decrypted.length);
              console.log('Decrypted key starts with:', decrypted.substring(0, 4));
              setGroqApiKey(decrypted);
            }
          }
        } else {
          console.log('No API key found in settings');
          setGroqApiKey('');
        }
      } else {
        console.log('No existing settings found, creating new document');
        await setDoc(settingsRef, {
          groqApiKey: '',
          updatedAt: new Date().toISOString()
        });
        setGroqApiKey('');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, loadSettings]);

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!user?.uid) {
      setMessage({ type: 'error', text: 'Please sign in to save settings' });
      return;
    }

    const trimmedApiKey = groqApiKey.trim();
    if (!trimmedApiKey) {
      setMessage({ type: 'error', text: 'Please enter a valid API key' });
      return;
    }

    // Validate API key format
    if (!trimmedApiKey.startsWith('gsk_')) {
      setMessage({ type: 'error', text: 'Invalid API key format. Groq API keys should start with "gsk_"' });
      return;
    }

    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      let settingsData;
      
      if (process.env.NODE_ENV === 'development') {
        // In development, store the API key in base64 format
        console.log('Development mode - Original API key length:', trimmedApiKey.length);
        console.log('Development mode - Original API key starts with:', trimmedApiKey.substring(0, 4));
        const encodedKey = btoa(trimmedApiKey);
        console.log('Development mode - Base64 encoded key length:', encodedKey.length);
        console.log('Development mode - Base64 encoded key starts with:', encodedKey.substring(0, 10));
        settingsData = {
          groqApiKey: encodedKey,
          updatedAt: new Date().toISOString()
        };
      } else {
        // In production, encrypt the API key
        console.log('Production mode - Encrypting API key of length:', trimmedApiKey.length);
        const response = await fetch(`${getApiBaseUrl()}/encryptApiKey`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: user.uid,
            apiKey: trimmedApiKey
          })
        });

        if (!response.ok) {
          console.error('Encryption failed with status:', response.status);
          const errorText = await response.text();
          console.error('Encryption error:', errorText);
          throw new Error('Failed to encrypt API key');
        }

        const { encrypted } = await response.json();
        console.log('Production mode - Encrypted key length:', encrypted?.length);
        console.log('Production mode - Encrypted key format:', typeof encrypted);
        settingsData = {
          groqApiKey: encrypted,
          updatedAt: new Date().toISOString()
        };
      }

      console.log('Saving to Firebase - Key type:', typeof settingsData.groqApiKey);
      console.log('Saving to Firebase - Key length:', settingsData.groqApiKey.length);
      
      const settingsRef = doc(db, 'userSettings', user.uid);
      await setDoc(settingsRef, settingsData, { merge: true });
      console.log('Successfully saved settings to Firebase');
      setMessage({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const getTierIcon = (tier) => {
    switch (tier) {
      case 'FREE':
        return '🆓';
      case 'PRO':
        return '💎';
      case 'ENTERPRISE':
        return '🏢';
      default:
        return '📋';
    }
  };

  const formatFeatureName = (feature) => {
    // Convert camelCase to Title Case with spaces
    return feature
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  const handleUpgradeClick = () => {
    onClose();
    if (typeof onUpgradeClick === 'function') {
      onUpgradeClick();
    }
  };

  // Early return if no user
  if (!user) {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        <div className="settings-modal">
          <h2>Settings</h2>
          <div className="message error">
            Please sign in to access settings
          </div>
          <div className="form-actions">
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="settings-modal">
        <h2>Settings</h2>
        
        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        {isLoading ? (
          <div className="loading-message">Loading settings...</div>
        ) : (
          <form onSubmit={handleSave}>
            <div className="subscription-info">
              <div className="tier-display">
                <span className="current-tier">
                  {getTierIcon(userTier)} {userTier} Plan
                </span>
                <button type="button" className="upgrade-button" onClick={handleUpgradeClick}>
                  Upgrade Plan
                </button>
              </div>
              <div className="tier-features">
                <h4>Your Features & Limits</h4>
                <ul>
                  <li>✓ Up to {TIER_FEATURES[userTier].maxMindMaps} mind maps</li>
                  <li>✓ Maximum {TIER_FEATURES[userTier].maxNodesPerMap} nodes per map</li>
                  <li>✓ {TIER_FEATURES[userTier].maxCollaborators} collaborator{TIER_FEATURES[userTier].maxCollaborators !== 1 ? 's' : ''}</li>
                  <li>✓ Export formats: {TIER_FEATURES[userTier].allowedExportFormats.join(', ')}</li>
                  {Object.entries(TIER_FEATURES[userTier].features)
                    .filter(([_, enabled]) => enabled)
                    .map(([feature]) => (
                      <li key={feature}>✓ {formatFeatureName(feature)}</li>
                    ))
                  }
                </ul>
              </div>
            </div>

            <div className="form-group">
              <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                <label htmlFor="groqApiKey">GROQ API Key</label>
                <a 
                  href="https://console.groq.com/keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="groq-dashboard-link"
                >
                  Get API Key
                </a>
              </div>
              <input
                type="password"
                id="groqApiKey"
                value={groqApiKey}
                onChange={(e) => setGroqApiKey(e.target.value)}
                placeholder="Enter your GROQ API key"
                required
              />
              <small>Your API key is stored securely and used for AI features</small>
            </div>

            <div className="form-actions">
              <button type="button" onClick={onClose}>Cancel</button>
              <button 
                type="submit" 
                disabled={isSaving || !groqApiKey.trim()}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
} 