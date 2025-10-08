// frontend/src/pages/Auth/Login.tsx
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('admin@schichtplan.de');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();

  console.log('Login Komponente - State:', { email, password, error, loading });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('Login startet mit:', { email });
      await login({ email, password });
      console.log('Login erfolgreich abgeschlossen');
      // Force refresh als Fallback
      window.location.reload();
    } catch (err: any) {
      console.error('Login Fehler:', err);
      setError(err.message || 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      maxWidth: '400px', 
      margin: '100px auto', 
      padding: '20px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      backgroundColor: '#f9f9f9'
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Anmelden</h2>
      
      {error && (
        <div style={{ 
          color: 'red', 
          backgroundColor: '#ffe6e6',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '15px',
          border: '1px solid #ffcccc'
        }}>
          <strong>Fehler:</strong> {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            E-Mail:
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ 
              width: '100%', 
              padding: '10px', 
              border: '1px solid #ccc', 
              borderRadius: '4px',
              fontSize: '16px'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Passwort:
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ 
              width: '100%', 
              padding: '10px', 
              border: '1px solid #ccc', 
              borderRadius: '4px',
              fontSize: '16px'
            }}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '12px', 
            backgroundColor: loading ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          {loading ? '⏳ Anmeldung...' : '🔐 Anmelden'}
        </button>
      </form>

      <div style={{ 
        marginTop: '20px', 
        padding: '15px',
        backgroundColor: '#e7f3ff',
        borderRadius: '4px',
        border: '1px solid #b3d9ff'
      }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Test Account:</h4>
        <p style={{ margin: '5px 0' }}><strong>Email:</strong> admin@schichtplan.de</p>
        <p style={{ margin: '5px 0' }}><strong>Passwort:</strong> admin123</p>
      </div>
    </div>
  );
};

export default Login;