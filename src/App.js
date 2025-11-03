import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "./styles/App.css";
import { AppProvider } from "./contexts/AppContext";
import { AuthProvider } from './contexts/AuthContext';
import WhiteboardPage from './pages/WhiteboardPage';
import LandingPage from './pages/LandingPage';
import PricingPage from './pages/PricingPage';
import Community from './components/Community';
import DevelopmentBanner from './components/DevelopmentBanner';

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppProvider>
          <div className="app">
            <DevelopmentBanner />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/whiteboard" element={<WhiteboardPage />} />
              <Route path="/pricing" element={<PricingPage />} />
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