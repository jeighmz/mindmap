import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';
import UserMenu from '../components/UserMenu';
import { useAuth } from '../contexts/AuthContext';
import Login from '../components/Login';

const TechnologyPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

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
    </div>
  );
};

export default TechnologyPage;

