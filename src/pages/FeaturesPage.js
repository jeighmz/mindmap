import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';

const FeaturesPage = () => {
  const navigate = useNavigate();

  return (
      <section id="features" className="features-section">
        <h2 className="features-heading">Key Features</h2>
        <p className="features-description">
          Discover powerful tools designed to help you visualize ideas, collaborate effectively, and unlock your creative potential with AI-powered mind mapping.
        </p>
        <div className="features-grid">
          {/* Feature 1: Visualize */}
          <div className="feature-card">
            <div className="feature-image-wrapper">
              <video 
                src="/videos/Generate-button.mov" 
                className="feature-image feature-video"
                controls
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="feature-content">
              <h3 className="feature-title">Visualize Instantly</h3>
              <p className="feature-description">
                Transform your thoughts into beautiful, interactive mind maps in seconds. Our intuitive interface 
                lets you create, edit, and organize ideas with ease.
              </p>
              <ul className="feature-benefits">
                <li>Drag-and-drop interface</li>
                <li>Real-time visual updates</li>
                <li>Multiple layout options</li>
              </ul>
            </div>
          </div>

          {/* Feature 2: Customize */}
          <div className="feature-card">
            <div className="feature-image-wrapper">
              <video 
                src="/videos/customize.mov" 
                className="feature-image feature-video"
                controls
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="feature-content">
              <h3 className="feature-title">Customize Endlessly</h3>
              <p className="feature-description">
                Make every mind map uniquely yours with extensive customization options. Choose colors, fonts, 
                shapes, and styles that match your brand or personal preference.
              </p>
              <ul className="feature-benefits">
                <li>Unlimited color schemes</li>
                <li>Custom node shapes</li>
                <li>Personal branding options</li>
              </ul>
            </div>
          </div>

          {/* Feature 3: AI Insights */}
          <div className="feature-card">
            <div className="feature-image-wrapper">
              <video 
                src="/videos/ai-powered.mov" 
                className="feature-image feature-video"
                controls
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="feature-content">
              <h3 className="feature-title">AI-Powered Insights</h3>
              <p className="feature-description">
                Leverage cutting-edge AI to enhance your mind maps. Get intelligent suggestions, automatic 
                connections, and deep insights that help you think more creatively.
              </p>
              <ul className="feature-benefits">
                <li>Group select items</li>
                <li>Chat with your mind maps</li>
                <li>Vision model capability</li>
              </ul>
            </div>
          </div>

          {/* Feature 5: Concept Expansion */}
          <div className="feature-card">
            <div className="feature-image-wrapper">
              <video 
                src="/videos/expand.mov" 
                className="feature-image feature-video"
                controls
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="feature-content">
              <h3 className="feature-title">Expand Concepts</h3>
              <p className="feature-description">
                Let AI help you explore ideas deeper. With a single click, expand any concept into a detailed 
                branch with related ideas, subtopics, and connections.
              </p>
              <ul className="feature-benefits">
                <li>One-click expansion</li>
                <li>Context-aware suggestions</li>
                <li>Infinite depth exploration</li>
              </ul>
            </div>
          </div>

          {/* Feature 6: LLM Chat Integration */}
          <div className="feature-card">
            <div className="feature-image-wrapper">
              <video 
                src="/videos/mind-mapinput.mov" 
                className="feature-image feature-video"
                controls
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="feature-content">
              <h3 className="feature-title">Mind-map as Input</h3>
              <p className="feature-description">
                Use your mind maps as context for AI conversations. Chat with advanced language models using 
                your visual ideas as input for more intelligent and contextual responses.
              </p>
              <ul className="feature-benefits">
                <li>Visual context for AI</li>
                <li>Multiple model support</li>
                <li>Conversation history</li>
              </ul>
            </div>
          </div>

          {/* Feature 6: Export & Reporting */}
          <div className="feature-card">
            <div className="feature-image-wrapper">
              <img src="/feature-export.png" alt="Export & Reporting Feature Screenshot" className="feature-image" />
            </div>
            <div className="feature-content">
              <h3 className="feature-title">Export & Reporting</h3>
              <p className="feature-description">
                Share your mind maps in any format you need. Export to PDF, PNG, SVG, or integrate directly 
                with your favorite tools for seamless workflow integration.
              </p>
              <ul className="feature-benefits">
                <li>Multiple export formats</li>
                <li>High-resolution images</li>
                <li>One-click sharing</li>
              </ul>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="features-cta">
          <h2 className="features-cta-title">Ready to Experience These Features?</h2>
          <p className="features-cta-description">
            Start creating your first mind map and discover how these powerful features can transform your workflow.
          </p>
          <button 
            className="features-cta-button"
            onClick={() => navigate('/whiteboard')}
          >
            Start Creating Free
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </section>
  );
};

export default FeaturesPage;

