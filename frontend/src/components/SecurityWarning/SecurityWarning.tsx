// src/components/SecurityWarning/SecurityWarning.tsx
import React, { useState, useEffect } from 'react';

const SecurityWarning: React.FC = () => {
  const [isHttp, setIsHttp] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if current protocol is HTTP
    const checkProtocol = () => {
      setIsHttp(window.location.protocol === 'http:');
    };

    checkProtocol();
    window.addEventListener('load', checkProtocol);
    
    return () => window.removeEventListener('load', checkProtocol);
  }, []);

  if (!isHttp || isDismissed) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: '#ff6b35',
      color: 'white',
      padding: '10px 20px',
      textAlign: 'center',
      zIndex: 10000,
      fontSize: '14px',
      fontWeight: 'bold',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    }}>
      ⚠️ SECURITY WARNING: This site is being accessed over HTTP. 
      For secure communication, please use HTTPS.
      <button 
        onClick={() => setIsDismissed(true)}
        style={{
          marginLeft: '15px',
          background: 'rgba(255,255,255,0.2)',
          border: '1px solid white',
          color: 'white',
          padding: '2px 8px',
          borderRadius: '3px',
          cursor: 'pointer'
        }}
      >
        Dismiss
      </button>
    </div>
  );
};

export default SecurityWarning;