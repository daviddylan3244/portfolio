import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Header.css';
import '../styles/Transitions.css';
import '../styles/Store.css';

function Store() {
  const navigate = useNavigate();

  return (
    <div className="page-transition" style={{ backgroundColor: 'transparent', minHeight: '100vh', color: 'white' }}>
      <div className="header-container">
        <div className="header-nav">
          <button 
            className="header-button"
            onClick={() => navigate('/portfolio')}
          >
            Portfolio
          </button>
          <button className="header-button">Store</button>
        </div>
        <span 
          className="header-logo"
          onClick={() => navigate('/')}
        >
          RETURN HOME
        </span>
      </div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '80vh',
        fontFamily: 'Special Elite, monospace'
      }}>
        <div style={{ 
          fontSize: 'clamp(1.5rem, 8vw, 2.5rem)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '4px',
          maxWidth: '100%',
          padding: '0 1rem',
          textAlign: 'center'
        }}>
          <span>Coming Soon</span>
          <div style={{ display: 'inline-flex', marginLeft: '8px' }}>
            <span className="dot-1">.</span>
            <span className="dot-2">.</span>
            <span className="dot-3">.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Store; 