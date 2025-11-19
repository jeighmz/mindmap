import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "./styles/App.css";
import { AppProvider } from "./contexts/AppContext";
import { AuthProvider } from './contexts/AuthContext';
import WhiteboardPage from './pages/WhiteboardPage';
import LandingPage from './pages/LandingPage';
import PricingPage from './pages/PricingPage';
import FeaturesPage from './pages/FeaturesPage';
import UseCasesPage from './pages/UseCasesPage';
import TechnologyPage from './pages/TechnologyPage';
import IntegrationsPage from './pages/IntegrationsPage';
import Community from './components/Community';

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppProvider>
          <div className="app">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/whiteboard" element={<WhiteboardPage />} />
              <Route path="/whiteboard/:boardId" element={<WhiteboardPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/use-cases" element={<UseCasesPage />} />
              <Route path="/technology" element={<TechnologyPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/community" element={<Community />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </AppProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;