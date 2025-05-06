import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase-config';
import { useAuth } from '../contexts/AuthContext';
import { USER_TIERS, TIER_FEATURES } from '../config/userTiers';
import Modal from './Modal';
import '../styles/Settings.css';
import { getApiBaseUrl } from '../utils/api';
import {
  getAuth,
  updateProfile
} from 'firebase/auth';

const TierIcon = ({ tier }) => {
  switch (tier) {
    case 'FREE':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M8 12h8"/>
        </svg>
      );
    case 'PRO':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      );
    case 'ENTERPRISE':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18"/>
        </svg>
      );
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <line x1="10" y1="9" x2="8" y2="9"/>
        </svg>
      );
  }
};

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

export default function Settings({ isOpen, onClose, onUpgradeClick }) {
  const { user, userTier } = useAuth();
  const [groqApiKey, setGroqApiKey] = useState('');
  const [displayName, setDisplayName] = useState('');
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
      
      // Set display name from user object
      setDisplayName(user.displayName || '');
      
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

    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      // Update display name if changed
      const trimmedDisplayName = displayName.trim();
      if (trimmedDisplayName !== user.displayName) {
        const auth = getAuth();
        await updateProfile(auth.currentUser, {
          displayName: trimmedDisplayName || null
        });

        // Update display name in Firestore
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          displayName: trimmedDisplayName || null,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // Handle API key update
      const trimmedApiKey = groqApiKey.trim();
      if (trimmedApiKey) {
        // Validate API key format
        if (!trimmedApiKey.startsWith('gsk_')) {
          setMessage({ type: 'error', text: 'Invalid API key format. Groq API keys should start with "gsk_"' });
          return;
        }

        let settingsData;
        const apiBaseUrl = getApiBaseUrl();
        
        try {
          if (process.env.NODE_ENV === 'development') {
            // In development, store the API key in base64 format
            console.log('Development mode - Storing API key in base64 format');
            const encodedKey = btoa(trimmedApiKey);
            settingsData = {
              groqApiKey: encodedKey,
              updatedAt: new Date().toISOString()
            };
          } else {
            // In production, encrypt the API key
            console.log('Encrypting API key...');
            console.log('Using API URL:', `${apiBaseUrl}/encryptApiKey`);
            
            const response = await fetch(`${apiBaseUrl}/encryptApiKey`, {
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
              const errorText = await response.text();
              console.error('Encryption failed:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
              });
              throw new Error(`Failed to encrypt API key: ${response.statusText}`);
            }

            const { encrypted } = await response.json();
            if (!encrypted) {
              throw new Error('No encrypted data received from server');
            }

            settingsData = {
              groqApiKey: encrypted,
              updatedAt: new Date().toISOString()
            };
          }

          // Save API key settings to Firebase
          const settingsRef = doc(db, 'userSettings', user.uid);
          await setDoc(settingsRef, settingsData, { merge: true });
          setMessage({ type: 'success', text: 'Settings saved successfully' });
        } catch (error) {
          console.error('Error processing API key:', error);
          setMessage({ 
            type: 'error', 
            text: `Failed to save API key: ${error.message}. Please try again.` 
          });
          return;
        }
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: `Failed to save settings: ${error.message}` });
    } finally {
      setIsSaving(false);
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
                  <TierIcon tier={userTier} />
                  <span className="tier-name">{userTier} Plan</span>
                </span>
                <button type="button" className="upgrade-button" onClick={handleUpgradeClick}>
                  Upgrade Plan
                </button>
              </div>
              <div className="tier-features">
                <h4>Your Features & Limits</h4>
                <ul>
                  <li><CheckIcon /> Up to {TIER_FEATURES[userTier].maxMindMaps} mind maps</li>
                  <li><CheckIcon /> Maximum {TIER_FEATURES[userTier].maxNodesPerMap} nodes per map</li>
                  <li><CheckIcon /> {TIER_FEATURES[userTier].maxCollaborators} collaborator{TIER_FEATURES[userTier].maxCollaborators !== 1 ? 's' : ''}</li>
                  <li><CheckIcon /> Export formats: {TIER_FEATURES[userTier].allowedExportFormats.join(', ')}</li>
                  {Object.entries(TIER_FEATURES[userTier].features)
                    .filter(([_, enabled]) => enabled)
                    .map(([feature]) => (
                      <li key={feature}><CheckIcon /> {formatFeatureName(feature)}</li>
                    ))
                  }
                </ul>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="displayName">Display Name</label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
              />
              <small>Your name will be visible to other users</small>
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