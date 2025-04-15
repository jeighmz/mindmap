import React from 'react';
import { useApp } from '../contexts/AppContext';
import '../styles/LandingPage.css';

// Consider importing SVG icons or using a library like react-icons
// import { FiZap, FiUsers, FiSmartphone, FiCpu } from 'react-icons/fi';

const LandingPage = () => {
  const { setCurrentPage } = useApp();

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">Unlock Your Ideas with MindMap</h1>
          <p className="hero-subtitle">
            Visually organize thoughts, brainstorm concepts, and collaborate in real-time.
          </p>
          <button
            className="hero-cta-button"
            onClick={() => setCurrentPage("Whiteboard")}
          >
            Start Mind Mapping Now
          </button>
        </div>
        <div className="hero-visual">
          {/* Placeholder for an image, illustration, or animation */}
          <img src="/mindmap-screenshot.png" alt="Mind Map Application Screenshot" /> 
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h2 className="features-heading">Key Features</h2>
        <div className="features-grid">
          {/* Feature 1: Visualize */}
          <div className="feature-card">
            <img src="/feature-visualize.png" alt="Visualize Ideas Feature Screenshot" className="feature-image" />
            <h3 className="feature-title">Visualize Instantly</h3>
          </div>

          {/* Feature 2: Collaborate */}
          <div className="feature-card">
            <img src="/feature-customize.png" alt="Customize Feature Screenshot" className="feature-image" />
            <h3 className="feature-title">Customize Endlessly</h3>
          </div>
         

          {/* Feature 4: AI Insights */}
          <div className="feature-card">
            <img src="/feature-ai.png" alt="AI Insights Feature Screenshot" className="feature-image" />
            <h3 className="feature-title">AI-Powered Insights</h3>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage; 