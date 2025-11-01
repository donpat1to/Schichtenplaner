// frontend/src/pages/Auth/Login.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      console.log('✅ User already logged in, redirecting to dashboard');
      navigate('/');
    }
  }, [user, navigate]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseDown = () => {
    // Start timeout to show password after a brief delay (300ms)
    holdTimeoutRef.current = setTimeout(() => {
      setShowPassword(true);
    }, 300);
  };

  const handleMouseUp = () => {
    // Clear the timeout if user releases before delay completes
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    // Always hide password on release
    setShowPassword(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault(); // Prevent context menu on mobile
    handleMouseDown();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    handleMouseUp();
  };

  // Prevent context menu on long press
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('🔐 Attempting login for:', email);
      await login({ email, password });

      console.log('✅ Login successful, redirecting to dashboard');
      showNotification({
        type: 'success',
        title: 'Erfolgreich angemeldet',
        message: `Willkommen zurück!`
      });
      
      navigate('/');
      
    } catch (error: any) {
      console.error('❌ Login error:', error);
      showNotification({
        type: 'error',
        title: 'Anmeldung fehlgeschlagen',
        message: error.message || 'Bitte überprüfen Sie Ihre Anmeldedaten'
      });
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>⏳ Weiterleiten...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <form onSubmit={handleSubmit} style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: '30px' }}>Anmeldung</h2>
        
        <div style={{ marginBottom: '20px', width: '100%' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            E-Mail
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px'
            }}
            placeholder="ihre-email@example.com"
          />
        </div>

        <div style={{ marginBottom: '30px', width: '100%' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Passwort
          </label>
          <div style={{ position: 'relative' }}>
            <input
              ref={passwordInputRef}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px',
                paddingRight: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
              placeholder="Ihr Passwort"
            />
            <button
              type="button"
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp} // Handle mouse leaving while pressed
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd} // Handle touch cancellation
              onContextMenu={handleContextMenu}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '1px',
                borderRadius: '1px',
                backgroundColor: showPassword ? '#e0e0e0' : 'transparent',
                transition: 'background-color 0.2s',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'manipulation'
              }}
              title="Gedrückt halten zum Anzeigen des Passworts"
            >
              {showPassword ? '👁' : '👁'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: loading ? '#ccc' : '#51258f',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '⏳ Wird angemeldet...' : 'Anmelden'}
        </button>
      </form>
    </div>
  );
};

export default Login;