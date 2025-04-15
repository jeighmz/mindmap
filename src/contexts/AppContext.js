import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [currentPage, setCurrentPage] = useState("Main");
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [mediaSearchOpen, setMediaSearchOpen] = useState(false);
  const [mediaSearchType, setMediaSearchType] = useState(null); // 'crypto', 'stock', 'etf', 'private'
  const [mediaSearchQuery, setMediaSearchQuery] = useState('');

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