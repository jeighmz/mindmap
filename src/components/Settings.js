import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase-config';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';
import '../styles/Settings.css';

export default function Settings({ isOpen, onClose }) {
  const { user } = useAuth();
  const [groqApiKey, setGroqApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

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
        if (data.groqApiKey) {
          // Decrypt the API key using the Netlify Function
          const response = await fetch('/.netlify/functions/decryptApiKey', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.uid,
              encryptedData: data.groqApiKey
            })
          });

          if (!response.ok) {
            throw new Error('Failed to decrypt API key');
          }

          const { decrypted } = await response.json();
          setGroqApiKey(decrypted);
        } else {
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

    if (!groqApiKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter a valid API key' });
      return;
    }

    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      // Encrypt the API key using the Netlify Function
      const response = await fetch('/.netlify/functions/encryptApiKey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          apiKey: groqApiKey.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to encrypt API key');
      }

      const { encrypted } = await response.json();
      
      const settingsRef = doc(db, 'userSettings', user.uid);
      const settingsData = {
        groqApiKey: encrypted,
        updatedAt: new Date().toISOString()
      };

      await setDoc(settingsRef, settingsData, { merge: true });
      setMessage({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setIsSaving(false);
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