import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [currentPage, setCurrentPage] = useState("Main");
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [mediaSearchOpen, setMediaSearchOpen] = useState(false);
  const [mediaSearchType, setMediaSearchType] = useState(null); // 'crypto', 'stock', 'etf', 'private'
  const [mediaSearchQuery, setMediaSearchQuery] = useState('');
  
  // Dark mode state with localStorage persistence
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    const darkMode = saved ? JSON.parse(saved) : false;
    // Apply class immediately to prevent flash
    if (darkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
    return darkMode;
  });

  // Apply dark mode class to document root when state changes
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  const handleBack = () => {
    setSelectedArticle(null);
  };

  // Add any whiteboard-specific state here if needed
  const [whiteboardState, setWhiteboardState] = useState({
    elements: [],
    selectedElement: null,
  });

  const value = {
    currentPage,
    setCurrentPage,
    selectedArticle,
    setSelectedArticle,
    handleBack,
    whiteboardState,
    setWhiteboardState,
    mediaSearchOpen,
    setMediaSearchOpen,
    mediaSearchType,
    setMediaSearchType,
    mediaSearchQuery,
    setMediaSearchQuery,
    isDarkMode,
    setIsDarkMode,
    toggleDarkMode,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}; 