import React, { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, storage } from '../firebase-config';
import { useAuth } from '../contexts/AuthContext';
import { USER_TIERS, TIER_FEATURES } from '../config/userTiers';
import Modal from './Modal';
import '../styles/Settings.css';
import { getApiBaseUrl } from '../utils/api';
import {
  getAuth,
  updateProfile
} from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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

const SETTINGS_SECTIONS = {
  GENERAL: 'general',
  PROFILE: 'profile',
  INTEGRATIONS: 'integrations',
  SUBSCRIPTION: 'subscription'
};

export default function Settings({ isOpen, onClose, onUpgradeClick }) {
  const { user, userTier, refreshUserData } = useAuth();
  const [notionApiKey, setNotionApiKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState(SETTINGS_SECTIONS.GENERAL);
  const [showCoordinates, setShowCoordinates] = useState(() => {
    const stored = localStorage.getItem('showCoordinates');
    return stored === null ? true : stored === 'true';
  });
  const [showFooter, setShowFooter] = useState(() => {
    const stored = localStorage.getItem('showFooter');
    return stored === null ? true : stored === 'true';
  });
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const fileInputRef = useRef(null);
  const [integrationSearch, setIntegrationSearch] = useState('');
  const [messageFadeOut, setMessageFadeOut] = useState(false);

  const loadSettings = useCallback(async () => {
    const currentUser = user; // Capture user at callback creation
    if (!currentUser?.uid) {
      setMessage({ type: 'error', text: 'Please sign in to access settings' });
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setMessage({ type: '', text: '' });
      
      // Set display name from user object
      setDisplayName(currentUser.displayName || '');
      
      // Set profile picture preview from user object
      setProfilePicturePreview(currentUser.photoURL || null);
      
      const settingsRef = doc(db, 'userSettings', currentUser.uid);
      const settingsSnap = await getDoc(settingsRef);
      
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();

        // Load Notion API key
        if (data.notionApiKey) {
          try {
            const decodedKey = atob(data.notionApiKey);
            setNotionApiKey(decodedKey);
          } catch (e) {
            if (process.env.NODE_ENV === 'development') {
              setNotionApiKey(data.notionApiKey);
            } else {
              const response = await fetch(`${getApiBaseUrl()}/decryptApiKey`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: currentUser.uid,
                  encryptedData: data.notionApiKey
                })
              });

              if (!response.ok) {
                throw new Error('Failed to decrypt API key');
              }

              const { decrypted } = await response.json();
              setNotionApiKey(decrypted);
            }
          }
        }
      } else {
        await setDoc(settingsRef, {
          notionApiKey: '',
          updatedAt: new Date().toISOString()
        });
        setNotionApiKey('');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]); // Only depend on user.uid, not the whole user object

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, loadSettings]);

  // Update profile picture preview when user photoURL changes (but not if user is actively selecting a new picture)
  useEffect(() => {
    if (user?.photoURL && !profilePicture) {
      // Only update if it's different and user isn't in the middle of selecting a new picture
      setProfilePicturePreview(prev => {
        if (prev !== user.photoURL) {
          return user.photoURL;
        }
        return prev;
      });
    }
  }, [user?.photoURL, profilePicture]);

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
      const auth = getAuth();
      const updateData = {};
      
      if (trimmedDisplayName !== user.displayName) {
        updateData.displayName = trimmedDisplayName || null;
      }

      // Handle profile picture upload or removal
      if (profilePicture) {
        // Upload new profile picture
        setIsUploadingPicture(true);
        try {
          // Create a reference to the profile picture in storage
          const fileExtension = profilePicture.name.split('.').pop();
          const storageRef = ref(storage, `profilePictures/${user.uid}_${Date.now()}.${fileExtension}`);
          
          // Upload the file
          await uploadBytes(storageRef, profilePicture);
          
          // Get the download URL
          const photoURL = await getDownloadURL(storageRef);
          updateData.photoURL = photoURL;
          
          // Update preview
          setProfilePicturePreview(photoURL);
        } catch (error) {
          console.error('Error uploading profile picture:', error);
          setMessage({ type: 'error', text: 'Failed to upload profile picture. Please try again.' });
          setIsSaving(false);
          setIsUploadingPicture(false);
          return;
        } finally {
          setIsUploadingPicture(false);
        }
      } else if (profilePicturePreview === null && user.photoURL) {
        // User removed their profile picture
        updateData.photoURL = null;
      }

      // Update Firebase Auth profile if there are changes
      if (Object.keys(updateData).length > 0) {
        await updateProfile(auth.currentUser, updateData);
      }

      // Update Firestore user document
      const userRef = doc(db, 'users', user.uid);
      const firestoreUpdate = {
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      await setDoc(userRef, firestoreUpdate, { merge: true });

      // Clear the profile picture file input
      if (profilePicture) {
        setProfilePicture(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }

      // Handle API keys update
      const trimmedNotionKey = notionApiKey.trim();
      let settingsData = {};

      // Process Notion API key
      if (trimmedNotionKey) {
        // Warn but don't block - let the API call validate the key
        if (!trimmedNotionKey.startsWith('secret_')) {
          console.warn('Notion API key does not start with "secret_" - this may be invalid, but proceeding anyway');
        }

        if (process.env.NODE_ENV === 'development') {
          settingsData.notionApiKey = btoa(trimmedNotionKey);
        } else {
          try {
            const response = await fetch(`${getApiBaseUrl()}/encryptApiKey`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: user.uid,
                apiKey: trimmedNotionKey
              })
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || 'Failed to encrypt Notion API key');
            }

            const { encrypted } = await response.json();
            settingsData.notionApiKey = encrypted;
          } catch (error) {
            // If encryption fails, still allow saving in development mode
            if (process.env.NODE_ENV === 'development') {
              console.warn('Encryption failed, using base64 encoding as fallback:', error);
              settingsData.notionApiKey = btoa(trimmedNotionKey);
            } else {
              throw error;
            }
          }
        }
      }

      // Add timestamp
      settingsData.updatedAt = new Date().toISOString();

      // Save settings to Firebase
      const settingsRef = doc(db, 'userSettings', user.uid);
      await setDoc(settingsRef, settingsData, { merge: true });
      setMessage({ type: 'success', text: 'Settings saved successfully' });
      
      // Refresh user data to update profile picture in UI
      // Wait a moment for Firebase Auth to propagate the changes
      setTimeout(async () => {
        if (refreshUserData) {
          await refreshUserData();
        }
      }, 500);
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

  const renderProfileSection = () => (
    <div className="settings-section">
      <h3>Profile</h3>
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

    </div>
  );

  const integrations = [
    {
      id: 'notion',
      name: 'Notion',
      description: 'Sync mind maps with Notion workspaces',
      icon: '📝',
      color: '#000000',
      enabled: !!notionApiKey,
      hasApiKey: true,
      apiKeyUrl: 'https://www.notion.so/my-integrations'
    },
    {
      id: 'figma',
      name: 'Figma',
      description: 'Export mind maps to Figma',
      icon: '🎨',
      color: '#F24E1E',
      enabled: false,
      hasApiKey: false
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Share mind maps in Slack channels',
      icon: '💬',
      color: '#4A154B',
      enabled: false,
      hasApiKey: false
    },
    {
      id: 'google-drive',
      name: 'Google Drive',
      description: 'Save and sync to Google Drive',
      icon: '☁️',
      color: '#4285F4',
      enabled: false,
      hasApiKey: false
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      description: 'Backup mind maps to Dropbox',
      icon: '📦',
      color: '#0061FF',
      enabled: false,
      hasApiKey: false
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Export mind maps as markdown',
      icon: '🐙',
      color: '#181717',
      enabled: false,
      hasApiKey: false
    },
    {
      id: 'trello',
      name: 'Trello',
      description: 'Create cards from mind map nodes',
      icon: '📋',
      color: '#0079BF',
      enabled: false,
      hasApiKey: false
    },
    {
      id: 'asana',
      name: 'Asana',
      description: 'Convert mind maps to tasks',
      icon: '✅',
      color: '#F06A6A',
      enabled: false,
      hasApiKey: false
    },
    {
      id: 'jira',
      name: 'Jira',
      description: 'Generate issues from mind maps',
      icon: '🎯',
      color: '#0052CC',
      enabled: false,
      hasApiKey: false
    },
    {
      id: 'confluence',
      name: 'Confluence',
      description: 'Publish mind maps to Confluence',
      icon: '📚',
      color: '#172B4D',
      enabled: false,
      hasApiKey: false
    },
    {
      id: 'microsoft-teams',
      name: 'Microsoft Teams',
      description: 'Share mind maps in Teams',
      icon: '👥',
      color: '#6264A7',
      enabled: false,
      hasApiKey: false
    },
    {
      id: 'zoom',
      name: 'Zoom',
      description: 'Present mind maps in Zoom',
      icon: '📹',
      color: '#2D8CFF',
      enabled: false,
      hasApiKey: false
    },
    {
      id: 'onedrive',
      name: 'OneDrive',
      description: 'Sync with Microsoft OneDrive',
      icon: '💾',
      color: '#0078D4',
      enabled: false,
      hasApiKey: false
    },
    {
      id: 'evernote',
      name: 'Evernote',
      description: 'Export to Evernote notes',
      icon: '🐘',
      color: '#00A82D',
      enabled: false,
      hasApiKey: false
    },
    {
      id: 'obsidian',
      name: 'Obsidian',
      description: 'Export mind maps to Obsidian',
      icon: '💎',
      color: '#483699',
      enabled: false,
      hasApiKey: false
    },
    {
      id: 'roam-research',
      name: 'Roam Research',
      description: 'Sync with Roam Research',
      icon: '🕸️',
      color: '#4A5568',
      enabled: false,
      hasApiKey: false
    }
  ];

  const filteredIntegrations = integrations.filter(integration =>
    integration.name.toLowerCase().includes(integrationSearch.toLowerCase()) ||
    integration.description.toLowerCase().includes(integrationSearch.toLowerCase())
  );

  const handleIntegrationClick = (integration) => {
    setMessageFadeOut(false);
    if (integration.id === 'notion') {
      // For Notion, we'll show the API key input in a modal or inline
      // For now, just focus on the search or show a message
      setMessage({ type: 'info', text: 'Use the API key field below to connect Notion' });
      setTimeout(() => {
        setMessageFadeOut(true);
        setTimeout(() => {
          setMessage({ type: '', text: '' });
          setMessageFadeOut(false);
        }, 500);
      }, 10000);
    } else {
      setMessage({ type: 'info', text: `${integration.name} integration coming soon!` });
      setTimeout(() => {
        setMessageFadeOut(true);
        setTimeout(() => {
          setMessage({ type: '', text: '' });
          setMessageFadeOut(false);
        }, 500);
      }, 10000);
    }
  };

  const renderIntegrationsSection = () => (
    <div className="settings-section">
      <h3>Integrations</h3>
      <p>Coming soon...</p>
    </div>
  );

  const renderSubscriptionSection = () => {
    const formatLimit = (value) => value === -1 ? 'Unlimited' : value;
    const formatCollaborators = (value) => {
      if (value === -1) return 'Unlimited collaborators';
      if (value === 0) return 'No collaborators';
      return `${value} collaborator${value !== 1 ? 's' : ''}`;
    };
    
    return (
      <div className="settings-section">
        <h3>Subscription</h3>
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
              <li><CheckIcon /> Up to {formatLimit(TIER_FEATURES[userTier].maxMindMaps)} mind maps</li>
              <li><CheckIcon /> Maximum {formatLimit(TIER_FEATURES[userTier].maxNodesPerMap)} nodes per map</li>
              <li><CheckIcon /> {formatCollaborators(TIER_FEATURES[userTier].maxCollaborators)}</li>
              <li><CheckIcon /> Export: {TIER_FEATURES[userTier].allowedExportFormats.join(', ')}</li>
              {Object.entries(TIER_FEATURES[userTier].features)
                .filter(([_, enabled]) => enabled)
                .map(([feature]) => (
                  <li key={feature}><CheckIcon /> {formatFeatureName(feature)}</li>
                ))
              }
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image size must be less than 5MB' });
      return;
    }

    setProfilePicture(file);
    setMessage({ type: '', text: '' });

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePicturePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // General section for toggling coordinates
  const renderGeneralSection = () => (
    <div className="settings-section">
      <h3>General</h3>
      
      <div className="form-group">
        <label htmlFor="profilePicture">Profile Picture</label>
        <div className="profile-picture-container">
          <div className="profile-picture-preview">
            <img 
              src={profilePicturePreview || '/default-avatar.png'} 
              alt="Profile" 
              className="profile-picture-preview-img"
            />
            {isUploadingPicture && (
              <div className="profile-picture-uploading">Uploading...</div>
            )}
          </div>
          <div className="profile-picture-actions">
            <input
              ref={fileInputRef}
              type="file"
              id="profilePicture"
              accept="image/*"
              onChange={handleProfilePictureChange}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="profile-picture-upload-button"
              disabled={isUploadingPicture}
            >
              {profilePicture ? 'Change Picture' : 'Upload Picture'}
            </button>
            {(profilePicturePreview && profilePicturePreview !== '/default-avatar.png') && (
              <button
                type="button"
                onClick={() => {
                  setProfilePicture(null);
                  setProfilePicturePreview(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="profile-picture-remove-button"
                disabled={isUploadingPicture}
              >
                Remove
              </button>
            )}
          </div>
        </div>
        <small>Upload a profile picture (max 5MB). Changes will be saved when you click Save.</small>
      </div>

      <div className="form-group">
        <label htmlFor="showCoordinates" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            id="showCoordinates"
            checked={showCoordinates}
            onChange={e => {
              setShowCoordinates(e.target.checked);
              localStorage.setItem('showCoordinates', e.target.checked);
            }}
            style={{ marginTop: '2px', cursor: 'pointer' }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, marginBottom: '4px' }}>Show coordinates under each object</div>
            <small style={{ display: 'block', marginTop: '4px' }}>Toggle the display of (x, y) coordinates below each whiteboard item.</small>
          </div>
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="showFooter" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            id="showFooter"
            checked={showFooter}
            onChange={e => {
              setShowFooter(e.target.checked);
              localStorage.setItem('showFooter', e.target.checked);
              // Dispatch custom event to notify other components
              window.dispatchEvent(new Event('showFooterChanged'));
            }}
            style={{ marginTop: '2px', cursor: 'pointer' }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, marginBottom: '4px' }}>Show footer</div>
            <small style={{ display: 'block', marginTop: '4px' }}>Toggle the display of the footer showing board name and canvas/view dimensions.</small>
          </div>
        </label>
      </div>
    </div>
  );

  // Early return if no user
  if (!user) {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        <div className="settings-container">
          <div className="settings-sidebar">
            <h2>Settings</h2>
          </div>
          <div className="settings-content">
            <div className="message error">
              Please sign in to access settings
            </div>
            <div className="form-actions">
              <button type="button" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="settings-container">
        <div className="settings-sidebar">
          <h2>Settings</h2>
          <nav className="settings-nav">
            <button
              className={`nav-item ${activeSection === SETTINGS_SECTIONS.GENERAL ? 'active' : ''}`}
              onClick={() => setActiveSection(SETTINGS_SECTIONS.GENERAL)}
            >
              General
            </button>
            <button
              className={`nav-item ${activeSection === SETTINGS_SECTIONS.PROFILE ? 'active' : ''}`}
              onClick={() => setActiveSection(SETTINGS_SECTIONS.PROFILE)}
            >
              Profile
            </button>
            <button
              className={`nav-item ${activeSection === SETTINGS_SECTIONS.INTEGRATIONS ? 'active' : ''}`}
              onClick={() => setActiveSection(SETTINGS_SECTIONS.INTEGRATIONS)}
            >
              Integrations
            </button>
            <button
              className={`nav-item ${activeSection === SETTINGS_SECTIONS.SUBSCRIPTION ? 'active' : ''}`}
              onClick={() => setActiveSection(SETTINGS_SECTIONS.SUBSCRIPTION)}
            >
              Subscription
            </button>
          </nav>
        </div>

        <div className="settings-content">
          {message.text && (
            <div className={`message ${message.type} ${messageFadeOut ? 'fade-out' : ''}`}>
              {message.text}
            </div>
          )}

          {isLoading ? (
            <div className="loading-message">Loading settings...</div>
          ) : (
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {activeSection === SETTINGS_SECTIONS.GENERAL && renderGeneralSection()}
                {activeSection === SETTINGS_SECTIONS.PROFILE && renderProfileSection()}
                {activeSection === SETTINGS_SECTIONS.INTEGRATIONS && renderIntegrationsSection()}
                {activeSection === SETTINGS_SECTIONS.SUBSCRIPTION && renderSubscriptionSection()}
              </div>

              <div className="form-actions">
                <button type="button" onClick={onClose}>Cancel</button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Modal>
  );
} 