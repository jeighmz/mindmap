import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';
import '../styles/LoginForm.css';

export default function Login({ isOpen, onClose }) {
  const { login, signup, signInWithGoogle } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError('Email is required');
      return false;
    } else if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (password) => {
    if (!password) {
      setPasswordError('Password is required');
      return false;
    } else if (isRegistering && password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    
    if (!isEmailValid || !isPasswordValid) {
      return;
    }
    
    try {
      if (isRegistering) {
        await signup(email, password);
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err) {
      console.error('Auth error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Email already in use');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else {
        setError(err.message);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      onClose();
    } catch (error) {
      console.error('Google sign-in error:', error);
      setError('Failed to sign in with Google. Please try again.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="login-modal">
        <h2>{isRegistering ? 'Create Account' : 'Sign In'}</h2>
        
        {error && <p className="error-message">{error}</p>}

        <form onSubmit={handleEmailSubmit} className="email-form">
          <div className="form-group">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) validateEmail(e.target.value);
              }}
              className={emailError ? 'input-error' : ''}
              required
            />
            {emailError && <p className="input-error-message">{emailError}</p>}
          </div>
          
          <div className="form-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) validatePassword(e.target.value);
              }}
              className={passwordError ? 'input-error' : ''}
              required
            />
            {passwordError && <p className="input-error-message">{passwordError}</p>}
          </div>
          
          <button type="submit" className="email-submit-button">
            {isRegistering ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          onClick={handleGoogleSignIn}
          className="google-sign-in-button"
        >
          <img 
            src="https://www.google.com/favicon.ico" 
            alt="Google" 
            className="google-icon"
          />
          Continue with Google
        </button>

        <div className="auth-switch">
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="switch-auth-mode"
          >
            {isRegistering 
              ? 'Already have an account? Sign in' 
              : 'Need an account? Create one'}
          </button>
        </div>
      </div>
    </Modal>
  );
} 