// frontend/src/pages/Auth/Login.tsx - KORRIGIERT
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();

  // 🔥 NEU: Redirect wenn bereits eingeloggt
  useEffect(() => {
    if (user) {
      console.log('✅ User already logged in, redirecting to dashboard');
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('🔐 Attempting login for:', email);
      await login({ email, password });
      
      // 🔥 WICHTIG: Erfolgsmeldung und Redirect
      console.log('✅ Login successful, redirecting to dashboard');
      showNotification({
        type: 'success',
        title: 'Erfolgreich angemeldet',
        message: `Willkommen zurück!`
      });
      
      // Navigiere zur Startseite
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

  // Wenn bereits eingeloggt, zeige Ladeanzeige
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
        
        <div style={{ marginBottom: '20px' }}>
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

        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Passwort
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px'
            }}
            placeholder="Ihr Passwort"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: loading ? '#ccc' : '#007bff',
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