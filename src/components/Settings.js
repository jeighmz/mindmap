import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase-config';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';
import '../styles/Settings.css';

export default function Settings({ isOpen, onClose }) {
  const { user } = useAuth();
  const [groqApiKey, setGroqApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (user && isOpen) {
      loadSettings();
    }
  }, [user, isOpen]);

  const loadSettings = async () => {
    try {
      const settingsRef = doc(db, 'userSettings', user.uid);
      const settingsSnap = await getDoc(settingsRef);
      
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        setGroqApiKey(data.groqApiKey || '');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const settingsRef = doc(db, 'userSettings', user.uid);
      await setDoc(settingsRef, {
        groqApiKey: groqApiKey.trim()
      }, { merge: true });

      setMessage({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="settings-modal">
        <h2>Settings</h2>
        
        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave}>
          <div className="form-group">
            <label htmlFor="groqApiKey">GROQ API Key</label>
            <input
              type="password"
              id="groqApiKey"
              value={groqApiKey}
              onChange={(e) => setGroqApiKey(e.target.value)}
              placeholder="Enter your GROQ API key"
            />
            <small>Your API key is stored securely and used for AI features</small>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
} 