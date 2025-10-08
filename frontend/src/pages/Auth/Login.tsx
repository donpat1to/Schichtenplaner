// frontend/src/pages/Auth/Login.tsx
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('Versuche Login...');
      await login({ email, password });
      console.log('Login erfolgreich!', 'User:', user);
      console.log('Navigiere zu /');
      navigate('/', { replace: true });
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
      borderRadius: '8px'
    }}>
      <h2>Anmelden</h2>
      
      {error && (
        <div style={{ 
          color: 'red', 
          backgroundColor: '#ffe6e6',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            E-Mail:
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Passwort:
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '10px', 
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Anmeldung...' : 'Anmelden'}
        </button>
      </form>

      <div style={{ marginTop: '15px', textAlign: 'center' }}>
        <p>Test Account:</p>
        <p><strong>Email:</strong> admin@schichtplan.de</p>
        <p><strong>Passwort:</strong> admin123</p>
      </div>
    </div>
  );
};

export default Login;