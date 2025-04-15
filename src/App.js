import React from "react";
import "./styles/App.css";
import { AppProvider } from "./contexts/AppContext";
import Layout from "./layouts/Layout";
import { AuthProvider } from './contexts/AuthContext';
import UserMenu from './components/UserMenu';

function MainContent() {
  return (
    <div className="app">
      <div className="floating-user-menu">
        <UserMenu />
      </div>
      <main>
        <div className="mindmap-container">
          <Layout />
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <MainContent />
      </AppProvider>
    </AuthProvider>
  );
}

export default App;