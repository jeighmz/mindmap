import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';

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
            onClick={() => navigate('/whiteboard')}
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
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="use-cases-section">
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
      <section className="tech-section">
        <h2 className="tech-heading">Powered by Next-Gen AI</h2>
        <p className="tech-description">
          Experience lightning-fast mind mapping powered by the world's most advanced AI technologies.
        </p>
        <div className="tech-grid">
          <div className="tech-card">
            <img src="/models/groq.png" alt="Groq Logo" className="tech-logo" />
            <h3 className="tech-title">Groq LPU™ Inference</h3>
            <p className="tech-detail">
              Ultra-fast language processing at unprecedented speeds. Generate mind maps in milliseconds with Groq's revolutionary LPU™ technology.
            </p>
            <ul className="tech-features">
              <li>Sub-second response times</li>
              <li>Real-time mind map generation</li>
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
      </section>

      {/* Call to Action Section */}
      <section className="cta-section">
        <h2 className="cta-heading">Start Mapping Your Next Big Idea</h2>
        <p className="cta-description">
          Join thousands of innovators using AI-powered mind mapping to bring their ideas to life in minutes, not hours.
        </p>
        <button
          className="cta-button"
          onClick={() => navigate('/whiteboard')}
        >
          Create Your First Mind Map
        </button>
      </section>
    </div>
  );
};

export default LandingPage; 