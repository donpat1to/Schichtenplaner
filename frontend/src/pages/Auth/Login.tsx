// frontend/src/pages/Auth/Login.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';

interface IdpProvider {
  id: string;
  name: string;
  type: string;
  loginUrl: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
// For redirects (OAuth flow), we need the actual backend URL, not the proxy path
// In production (same origin), this is empty; in dev, it points to the backend directly
const APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:3002';

const Login: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [idpProviders, setIdpProviders] = useState<IdpProvider[]>([]);
  const [showIdpList, setShowIdpList] = useState(false);
  const [idpLoading, setIdpLoading] = useState(true);
  const { login, user, refreshUser } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Handle IDP callback - check for tokens in URL
  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const errorMessage = searchParams.get('message'); // Auth error message
    const provider = searchParams.get('provider');

    if (error) {
      showNotification({
        type: 'error',
        title: 'Anmeldung fehlgeschlagen',
        message: errorDescription || errorMessage || `Fehler: ${error}`
      });
      // Clear URL params
      setSearchParams({});
      return;
    }

    if (token) {
      console.log(`✅ Received token from IDP: ${provider}`);
      // Store token and refresh user
      localStorage.setItem('token', token);
      const refreshToken = searchParams.get('refresh_token');
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
      }
      // Clear URL params
      setSearchParams({});
      // Refresh user data and navigate
      refreshUser();
      showNotification({
        type: 'success',
        title: 'Erfolgreich angemeldet',
        message: `Willkommen! (via ${provider})`
      });
      navigate('/');
    }
  }, [searchParams, setSearchParams, refreshUser, showNotification, navigate]);

  // Fetch available IDP providers
  useEffect(() => {
    const fetchIdpProviders = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/external/providers`);
        if (response.ok) {
          const data = await response.json();
          setIdpProviders(data.providers || []);
        }
      } catch (error) {
        console.log('No external auth providers available');
      } finally {
        setIdpLoading(false);
      }
    };
    fetchIdpProviders();
  }, []);

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
      console.log('🔐 Attempting login for:', identifier);
      await login({ identifier, password });

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

  const handleIdpLogin = (provider: IdpProvider) => {
    const returnUrl = window.location.origin;
    // Use APP_URL for redirects (OAuth flow needs direct backend access, not proxy)
    window.location.href = `${APP_URL}/api${provider.loginUrl}?returnUrl=${encodeURIComponent(returnUrl)}`;
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
            Benutzername oder E-Mail
          </label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            style={{
              padding: '0.875rem 1rem',
              border: '1.5px solid #e8e8e8',
              borderRadius: '8px',
              fontSize: '0.95rem',
              background: '#FBFAF6',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              color: '#161718',
              width: '100%',
              paddingRight: '40px',
              boxSizing: 'border-box' as const,
            }}
            placeholder="Benutzername / Email"
          />
        </div>

        <div style={{
          marginBottom: '30px', display: 'flex',
          flexDirection: 'column' as const,
          gap: '0.5rem',
          width: '100%',
        }}>
          <label style={{
            display: 'block', marginBottom: '8px', fontWeight: 'bold', width: '100%',
          }}>
            Passwort
          </label>
          <div style={{
            position: 'relative' as const,
            width: '100%',
          }}>
            <input
              ref={passwordInputRef}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                padding: '0.875rem 1rem',
                border: '1.5px solid #e8e8e8',
                borderRadius: '8px',
                fontSize: '0.95rem',
                background: '#FBFAF6',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                color: '#161718',
                width: '100%',
                paddingRight: '40px',
                boxSizing: 'border-box' as const,
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
                position: 'absolute' as const,
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '5px',
                borderRadius: '4px',
                transition: 'background-color 0.2s',
                userSelect: 'none' as const,
                WebkitUserSelect: 'none' as const,
                touchAction: 'manipulation' as const,
                backgroundColor: showPassword ? '#e0e0e0' : 'transparent',
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

        {/* IDP Login Section */}
        {!idpLoading && idpProviders.length > 0 && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              margin: '24px 0',
              gap: '12px'
            }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e0e0e0' }} />
              <span style={{ color: '#888', fontSize: '14px' }}>oder</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e0e0e0' }} />
            </div>

            {idpProviders.length === 1 ? (
              // Single provider - direct button
              <button
                type="button"
                onClick={() => handleIdpLogin(idpProviders[0])}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#fff',
                  color: '#333',
                  border: '1.5px solid #e0e0e0',
                  borderRadius: '4px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f5f5f5';
                  e.currentTarget.style.borderColor = '#ccc';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#fff';
                  e.currentTarget.style.borderColor = '#e0e0e0';
                }}
              >
                Anmelden via {idpProviders[0].name}
              </button>
            ) : (
              // Multiple providers - expandable list
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowIdpList(!showIdpList)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#fff',
                    color: '#333',
                    border: '1.5px solid #e0e0e0',
                    borderRadius: '4px',
                    fontSize: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                    e.currentTarget.style.borderColor = '#ccc';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#fff';
                    e.currentTarget.style.borderColor = '#e0e0e0';
                  }}
                >
                  Anmelden via IdP
                  <span style={{
                    transform: showIdpList ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}>
                    ▼
                  </span>
                </button>

                {showIdpList && (
                  <div style={{
                    marginTop: '8px',
                    border: '1.5px solid #e0e0e0',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    {idpProviders.map((provider, index) => (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => handleIdpLogin(provider)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          backgroundColor: '#fff',
                          color: '#333',
                          border: 'none',
                          borderTop: index > 0 ? '1px solid #e0e0e0' : 'none',
                          fontSize: '14px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background-color 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = '#f5f5f5';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = '#fff';
                        }}
                      >
                        {provider.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </form>
    </div>
  );
};

export default Login;