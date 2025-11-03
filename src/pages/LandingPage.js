import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';
import Login from '../components/Login';

// Import SVG icons
import { ReactComponent as ProjectPlanningIcon } from '../assets/icons/project-planning.svg';
import { ReactComponent as BrainstormingIcon } from '../assets/icons/brainstorming.svg';
import { ReactComponent as LearningIcon } from '../assets/icons/learning.svg';
import { ReactComponent as StrategicPlanningIcon } from '../assets/icons/strategic-planning.svg';
import { ReactComponent as ContentCreationIcon } from '../assets/icons/content-creation.svg';
import { ReactComponent as TeamCollaborationIcon } from '../assets/icons/team-collaboration.svg';

// Consider importing SVG icons or using a library like react-icons
// import { FiZap, FiUsers, FiSmartphone, FiCpu } from 'react-icons/fi';

const LandingPage = () => {
  const navigate = useNavigate();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLoginClick = () => {
    setIsRegistering(false);
    setIsLoginOpen(true);
  };

  const handleSignupClick = () => {
    setIsRegistering(true);
    setIsLoginOpen(true);
  };

  return (
    <div className="landing-page">
      {/* Header Section */}
      <header className="header">
        <div className="header-content">
          <div className="header-logo" onClick={() => navigate('/')}>
            <img src="/logo_and_name.png" alt="Mindra" className="header-logo-img" />
          </div>
          <nav className="header-nav">
            <ul className="nav-links">
              <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>Features</a></li>
              <li><a href="#use-cases" onClick={(e) => { e.preventDefault(); scrollToSection('use-cases'); }}>Use Cases</a></li>
              <li><a href="#technology" onClick={(e) => { e.preventDefault(); scrollToSection('technology'); }}>Technology</a></li>
              <li><a href="#integrations" onClick={(e) => { e.preventDefault(); scrollToSection('integrations'); }}>Integrations</a></li>
              <li><a href="/pricing" onClick={(e) => { e.preventDefault(); navigate('/pricing'); }}>Pricing</a></li>
            </ul>
          </nav>
          <div className="header-actions">
            <button className="login-button" onClick={handleLoginClick}>Log In</button>
            <button className="signup-button" onClick={handleSignupClick}>Sign Up</button>
          </div>
        </div>
      </header>

      {/* Login Modal */}
      <Login 
        isOpen={isLoginOpen} 
        onClose={() => setIsLoginOpen(false)}
        fromLandingPage={true}
        initialMode={isRegistering ? 'register' : 'login'}
      />

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-background">
          <div className="hero-gradient-orb hero-gradient-orb-1"></div>
          <div className="hero-gradient-orb hero-gradient-orb-2"></div>
          <div className="hero-gradient-orb hero-gradient-orb-3"></div>
        </div>
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              <span>✨ AI-Powered Mind Mapping</span>
            </div>
            <h1 className="hero-title">
              <span className="hero-title-line">Unlock Your</span>
              <span className="hero-title-gradient">Ideas</span>
            </h1>
            <p className="hero-subtitle">
              Visually organize thoughts, brainstorm concepts, and collaborate in real-time with cutting-edge AI technology.
            </p>
            <div className="hero-cta-group">
              <button
                className="hero-cta-button"
                onClick={() => navigate('/whiteboard')}
              >
                <span>Start Mind Mapping Now</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
              <div className="hero-features-preview">
                <span className="feature-pill">⚡ Instant Generation</span>
                <span className="feature-pill">🎨 Visualize Concepts</span>
                <span className="feature-pill">🤝 Real-time Collaboration</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-visual-wrapper">
              <div className="hero-visual-glow"></div>
              <img src="/mindmap-screenshot.png" alt="Mind Map Application Screenshot" className="hero-screenshot" /> 
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <h2 className="features-heading">Key Features</h2>
        <div className="features-grid">
          {/* Feature 1: Visualize */}
          <div className="feature-card">
            <img src="/feature-visualize.png" alt="Visualize Ideas Feature Screenshot" className="feature-image" />
            <h3 className="feature-title">Visualize Instantly</h3>
          </div>

          {/* Feature 2: Customize */}
          <div className="feature-card">
            <img src="/feature-customize.png" alt="Customize Feature Screenshot" className="feature-image" />
            <h3 className="feature-title">Customize Endlessly</h3>
          </div>

          {/* Feature 3: AI Insights */}
          <div className="feature-card">
            <img src="/feature-ai.png" alt="AI Insights Feature Screenshot" className="feature-image" />
            <h3 className="feature-title">AI-Powered Insights</h3>
          </div>

          {/* Feature 4: Export & Reporting */}
          <div className="feature-card">
            <img src="/feature-export.png" alt="Export & Reporting Feature Screenshot" className="feature-image" />
            <h3 className="feature-title">Export & Reporting</h3>
          </div>

          {/* Feature 5: Concept Expansion */}
          <div className="feature-card">
            <img src="/feature-expand.png" alt="Concept Expansion Feature Screenshot" className="feature-image" />
            <h3 className="feature-title">Expand Concepts</h3>
          </div>

          {/* Feature 6: LLM Chat Integration */}
          <div className="feature-card">
            <img src="/feature-chat.png" alt="LLM Chat Integration Feature Screenshot" className="feature-image" />
            <h3 className="feature-title">Mind-map as input</h3>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" className="use-cases-section">
        <h2 className="use-cases-heading">Transform Your Workflow</h2>
        <p className="use-cases-description">
          From brainstorming to project planning, our AI-powered mind mapping revolutionizes how you work.
        </p>
        
        <div className="use-cases-grid">
          <div className="use-case-card">
            <div className="use-case-icon">
              <ProjectPlanningIcon />
            </div>
            <h3>Project Planning</h3>
            <p>Break down complex projects into manageable tasks. Let AI suggest task dependencies and potential roadblocks.</p>
            <div className="use-case-example">
              <span className="example-label">Example:</span>
              "Create project timeline for website redesign" → AI generates comprehensive project branches
            </div>
          </div>

          <div className="use-case-card">
            <div className="use-case-icon">
              <BrainstormingIcon />
            </div>
            <h3>Creative Brainstorming</h3>
            <p>Generate innovative ideas and explore new perspectives with AI-assisted brainstorming sessions.</p>
            <div className="use-case-example">
              <span className="example-label">Example:</span>
              "Brainstorm marketing strategies" → AI expands with targeted campaign ideas
            </div>
          </div>

          <div className="use-case-card">
            <div className="use-case-icon">
              <LearningIcon />
            </div>
            <h3>Learning & Research</h3>
            <p>Organize research findings and connect concepts. AI helps identify relationships between topics.</p>
            <div className="use-case-example">
              <span className="example-label">Example:</span>
              "Research quantum computing" → AI creates structured knowledge map
            </div>
          </div>

          <div className="use-case-card">
            <div className="use-case-icon">
              <StrategicPlanningIcon />
            </div>
            <h3>Strategic Planning</h3>
            <p>Develop business strategies and analyze market opportunities with AI-powered insights.</p>
            <div className="use-case-example">
              <span className="example-label">Example:</span>
              "Market expansion strategy" → AI suggests market segments and opportunities
            </div>
          </div>

          <div className="use-case-card">
            <div className="use-case-icon">
              <ContentCreationIcon />
            </div>
            <h3>Content Creation</h3>
            <p>Structure your content strategy and generate content ideas with AI assistance. Perfect for blogs, articles, and social media.</p>
            <div className="use-case-example">
              <span className="example-label">Example:</span>
              "Content plan for tech blog" → AI expands into topics, keywords, and content structure
            </div>
          </div>

          <div className="use-case-card">
            <div className="use-case-icon">
              <TeamCollaborationIcon />
            </div>
            <h3>Team Collaboration</h3>
            <p>Foster team ideation and decision-making. AI helps identify connections between different team members' inputs.</p>
            <div className="use-case-example">
              <span className="example-label">Example:</span>
              "Team roadmap planning" → AI synthesizes team input into cohesive action plans
            </div>
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section id="technology" className="tech-section">
        <h2 className="tech-heading">Powered by Next-Gen AI</h2>
        <p className="tech-description">
          Experience lightning-fast mind mapping powered by the world's most advanced AI technologies.
        </p>
        <div className="tech-grid">
          <div className="tech-card">
            <img src="/models/groq.png" alt="Groq Logo" className="tech-logo" />
            <h3 className="tech-title">Groq LPU™ Inference</h3>
            <p className="tech-detail">
              Ultra-fast language and vision processing at unprecedented speeds. Generate mind maps and analyze visual content in milliseconds with Groq's revolutionary LPU™ technology.
            </p>
            <ul className="tech-features">
              <li>Sub-second response times</li>
              <li>Real-time mind map generation</li>
              <li>Visual content understanding</li>
              <li>Seamless thought expansion</li>
            </ul>
          </div>

          <div className="tech-card">
            <img src="/models/deepseek.png" alt="DeepSeek Logo" className="tech-logo" />
            <h3 className="tech-title">DeepSeek AI</h3>
            <p className="tech-detail">
              Harness the power of DeepSeek's advanced language model for deep understanding and contextual analysis of your ideas.
            </p>
            <ul className="tech-features">
              <li>Advanced concept mapping</li>
              <li>Contextual understanding</li>
              <li>Intelligent suggestions</li>
            </ul>
          </div>
        </div>

        <div className="models-section">
          <h3 className="models-heading">Available Models</h3>
          <div className="model-companies">
            <img src="/models/meta.png" alt="Meta" className="company-logo" />
            <img src="/models/google.png" alt="Google" className="company-logo" />
            <img src="/models/openai.png" alt="OpenAI" className="company-logo" />
            <img src="/models/mistral.png" alt="Mistral" className="company-logo" />
            <img src="/models/qwen.png" alt="Qwen" className="company-logo" />
            <img src="/models/deepseek.png" alt="DeepSeek" className="company-logo" />
            <img src="/models/g.png" alt="Groq" className="company-logo" />
          </div>
          <table className="models-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Model</th>
                <th>Context Window</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><img src="/models/g.png" alt="Groq" className="provider-logo" /> Groq</td>
                <td>Llama-3.3-70B-Versatile</td>
                <td>128K + Vision</td>
              </tr>
              <tr>
                <td><img src="/models/g.png" alt="Groq" className="provider-logo" /> Groq</td>
                <td>Llama-3.1-8B-Instant</td>
                <td>128K</td>
              </tr>
              <tr>
                <td><img src="/models/g.png" alt="Groq" className="provider-logo" /> Groq</td>
                <td>Gemma-2-9B-IT</td>
                <td>8K</td>
              </tr>
              <tr>
                <td><img src="/models/g.png" alt="Groq" className="provider-logo" /> Groq</td>
                <td>Llama-Guard-3-8B</td>
                <td>8K</td>
              </tr>
              <tr>
                <td><img src="/models/g.png" alt="Groq" className="provider-logo" /> Groq</td>
                <td>Whisper-Large-V3</td>
                <td>Audio</td>
              </tr>
              <tr>
                <td><img src="/models/g.png" alt="Groq" className="provider-logo" /> Groq</td>
                <td>Mistral-Saba-24B</td>
                <td>32K + Vision</td>
              </tr>
              <tr>
                <td><img src="/models/g.png" alt="Groq" className="provider-logo" /> Groq</td>
                <td>Qwen-QWQ-32B</td>
                <td>128K + Vision</td>
              </tr>
              <tr>
                <td><img src="/models/g.png" alt="Groq" className="provider-logo" /> Groq</td>
                <td>DeepSeek-R1-Distill-70B</td>
                <td>128K</td>
              </tr>
              <tr>
                <td><img src="/models/g.png" alt="Groq" className="provider-logo" /> Groq</td>
                <td>Llama-4-Maverick-17B</td>
                <td>131K + Vision</td>
              </tr>
              <tr>
                <td><img src="/models/g.png" alt="Groq" className="provider-logo" /> Groq</td>
                <td>Compound-Beta</td>
                <td>128K + Vision</td>
              </tr>
              <tr>
                <td><img src="/models/g.png" alt="Groq" className="provider-logo" /> Groq</td>
                <td>Compound-Beta-Mini</td>
                <td>128K + Vision</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Integrations Section */}
      <section id="integrations" className="integrations-section">
        <h3 className="integrations-heading">Integrations</h3>
        <div className="integrations-grid">
          <div className="integration-card">
            <img src="/integrations/notion.png" alt="Notion" className="integration-logo" />
            <h4>Notion</h4>
            <p>Sync your mind maps directly with Notion workspaces</p>
          </div>
          <div className="integration-card">
            <img src="/integrations/figma.png" alt="Figma" className="integration-logo" />
            <h4>Figma</h4>
            <p>Export mind maps to Figma for design collaboration</p>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="cta-section">
        <div className="cta-background-elements">
          <div className="cta-glow cta-glow-1"></div>
          <div className="cta-glow cta-glow-2"></div>
        </div>
        <div className="cta-content">
          <div className="cta-badge">
            <span>🚀 Ready to Transform Your Ideas?</span>
          </div>
          <h2 className="cta-heading">
            Turn Your Thoughts Into <span className="cta-heading-highlight">Visual Masterpieces</span>
          </h2>
          <p className="cta-description">
            Join thousands of creators, innovators, and teams who use AI-powered mind mapping to visualize complex ideas, accelerate brainstorming, and unlock creative potential.
          </p>
          <div className="cta-stats">
            <div className="cta-stat">
              <div className="cta-stat-number">10K+</div>
              <div className="cta-stat-label">Active Users</div>
            </div>
            <div className="cta-stat">
              <div className="cta-stat-number">50K+</div>
              <div className="cta-stat-label">Mind Maps Created</div>
            </div>
            <div className="cta-stat">
              <div className="cta-stat-number">98%</div>
              <div className="cta-stat-label">Satisfaction Rate</div>
            </div>
          </div>
          <div className="cta-buttons">
            <button
              className="cta-button-primary"
              onClick={() => navigate('/whiteboard')}
            >
              <span>Start Creating Free</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
            <button
              className="cta-button-secondary"
              onClick={() => navigate('/pricing')}
            >
              View Pricing
            </button>
          </div>
          <p className="cta-note">
            ✨ No credit card required • Free forever plan available • Cancel anytime
          </p>
        </div>
      </section>
    </div>
  );
};

export default LandingPage; 