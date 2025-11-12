import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';
import UserMenu from '../components/UserMenu';
import { useAuth } from '../contexts/AuthContext';
import Login from '../components/Login';

// Import SVG icons
import { ReactComponent as ProjectPlanningIcon } from '../assets/icons/project-planning.svg';
import { ReactComponent as BrainstormingIcon } from '../assets/icons/brainstorming.svg';
import { ReactComponent as LearningIcon } from '../assets/icons/learning.svg';
import { ReactComponent as StrategicPlanningIcon } from '../assets/icons/strategic-planning.svg';
import { ReactComponent as ContentCreationIcon } from '../assets/icons/content-creation.svg';
import { ReactComponent as TeamCollaborationIcon } from '../assets/icons/team-collaboration.svg';

const UseCasesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleTryIt = (message) => {
    navigate(`/whiteboard?prompt=${encodeURIComponent(message)}`);
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
              <li><a href="/features" onClick={(e) => { e.preventDefault(); navigate('/features'); }}>Features</a></li>
              <li><a href="/use-cases" onClick={(e) => { e.preventDefault(); navigate('/use-cases'); }}>Use Cases</a></li>
              <li><a href="/technology" onClick={(e) => { e.preventDefault(); navigate('/technology'); }}>Technology</a></li>
              <li><a href="/integrations" onClick={(e) => { e.preventDefault(); navigate('/integrations'); }}>Integrations</a></li>
              <li><a href="/pricing" onClick={(e) => { e.preventDefault(); navigate('/pricing'); }}>Pricing</a></li>
            </ul>
          </nav>
          <div className="header-actions">
            {user ? (
              <UserMenu />
            ) : (
              <>
                <button className="login-button" onClick={handleLoginClick}>Log In</button>
                <button className="signup-button" onClick={handleSignupClick}>Sign Up</button>
              </>
            )}
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
            <button 
              className="use-case-try-button"
              onClick={() => handleTryIt("Create project timeline for website redesign")}
            >
              Try it
            </button>
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
            <button 
              className="use-case-try-button"
              onClick={() => handleTryIt("Brainstorm marketing strategies")}
            >
              Try it
            </button>
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
            <button 
              className="use-case-try-button"
              onClick={() => handleTryIt("Research quantum computing")}
            >
              Try it
            </button>
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
            <button 
              className="use-case-try-button"
              onClick={() => handleTryIt("Market expansion strategy")}
            >
              Try it
            </button>
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
            <button 
              className="use-case-try-button"
              onClick={() => handleTryIt("Content plan for tech blog")}
            >
              Try it
            </button>
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
            <button 
              className="use-case-try-button"
              onClick={() => handleTryIt("Team roadmap planning")}
            >
              Try it
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default UseCasesPage;

