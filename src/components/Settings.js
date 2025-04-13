import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase-config';
import { useAuth } from '../context/AuthContext';
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
      
      // Log auth state for debugging
      console.log('Current auth state:', {
        isAuthenticated: !!user,
        uid: user.uid,
        email: user.email,
      });
      
      console.log('Attempting to load settings for user:', user.uid);
      const settingsRef = doc(db, 'userSettings', user.uid);
      
      // First try to get the document
      console.log('Fetching document...');
      const settingsSnap = await getDoc(settingsRef);
      
      console.log('Document fetch result:', {
        exists: settingsSnap.exists(),
        id: settingsSnap.id,
      });
      
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        console.log('Settings loaded successfully:', {
          hasGroqApiKey: !!data.groqApiKey,
          updatedAt: data.updatedAt,
        });
        setGroqApiKey(data.groqApiKey || '');
      } else {
        console.log('No existing settings found, creating new document');
        // Initialize empty settings document
        try {
          await setDoc(settingsRef, {
            groqApiKey: '',
            updatedAt: new Date().toISOString()
          });
          console.log('Empty settings document created successfully');
        } catch (initError) {
          console.error('Error creating empty settings:', initError);
          throw initError; // Re-throw to be caught by outer catch block
        }
        setGroqApiKey('');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        name: error.name,
        stack: error.stack,
        userId: user?.uid
      });
      
      let errorMessage = 'Failed to load settings. ';
      if (error.code === 'permission-denied') {
        errorMessage += 'Permission denied. Please try signing out and back in.';
      } else {
        errorMessage += 'Please check your connection and try again.';
      }
      
      setMessage({ type: 'error', text: errorMessage });
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
      console.log('Current auth state before save:', {
        isAuthenticated: !!user,
        uid: user.uid,
        email: user.email,
      });
      
      console.log('Attempting to save settings for user:', user.uid);
      const settingsRef = doc(db, 'userSettings', user.uid);
      
      const settingsData = {
        groqApiKey: groqApiKey.trim(),
        updatedAt: new Date().toISOString()
      };

      console.log('Saving settings data:', {
        hasGroqApiKey: !!settingsData.groqApiKey,
        updatedAt: settingsData.updatedAt
      });

      await setDoc(settingsRef, settingsData, { merge: true });
      console.log('Settings saved successfully');
      
      setMessage({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      console.error('Error saving settings:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        name: error.name,
        stack: error.stack,
        userId: user?.uid
      });
      
      let errorMessage = 'Failed to save settings. ';
      if (error.code === 'permission-denied') {
        errorMessage += 'Permission denied. Please try signing out and back in.';
      } else {
        errorMessage += 'Please check your connection and try again.';
      }
      
      setMessage({ type: 'error', text: errorMessage });
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
              <label htmlFor="groqApiKey">GROQ API Key</label>
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