// frontend/src/pages/Setup/Setup.tsx - UPDATED
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE_URL = '/api';

const Setup: React.FC = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    firstname: '',
    lastname: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { checkSetupStatus } = useAuth();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateStep1 = () => {
    if (formData.password.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.firstname.trim()) {
      setError('Bitte geben Sie einen Vornamen ein.');
      return false;
    }
    if (!formData.lastname.trim()) {
      setError('Bitte geben Sie einen Nachnamen ein.');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError('');
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      handleSubmit();
    }
  };

  const handleBack = () => {
    setError('');
    setStep(1);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      const payload = {
        password: formData.password,
        firstname: formData.firstname,
        lastname: formData.lastname
      };

      console.log('🚀 Sending setup request...', payload);

      const response = await fetch(`${API_BASE_URL}/setup/admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Setup fehlgeschlagen');
      }

      const result = await response.json();
      console.log('✅ Setup successful:', result);

      // Setup Status neu prüfen
      await checkSetupStatus();
      
    } catch (err: any) {
      console.error('❌ Setup error:', err);
      setError(err.message || 'Ein unerwarteter Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  // Helper to display generated email preview
  const getEmailPreview = () => {
    if (!formData.firstname.trim() || !formData.lastname.trim()) {
      return 'vorname.nachname@sp.de';
    }
    
    const cleanFirstname = formData.firstname.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLastname = formData.lastname.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${cleanFirstname}.${cleanLastname}@sp.de`;
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f8f9fa',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '3rem',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '500px',
        border: '1px solid #e9ecef'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: 'bold', 
            marginBottom: '0.5rem',
            color: '#2c3e50'
          }}>
            🚀 Erstkonfiguration
          </h1>
          <p style={{ 
            color: '#6c757d',
            fontSize: '1.1rem'
          }}>
            Richten Sie Ihren Administrator-Account ein
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            color: '#721c24',
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '1.5rem'
          }}>
            {error}
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: '600',
                color: '#495057'
              }}>
                Passwort
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ced4da',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  transition: 'border-color 0.3s ease'
                }}
                placeholder="Mindestens 6 Zeichen"
                required
              />
            </div>
            
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: '600',
                color: '#495057'
              }}>
                Passwort bestätigen
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ced4da',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  transition: 'border-color 0.3s ease'
                }}
                placeholder="Passwort wiederholen"
                required
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: '600',
                color: '#495057'
              }}>
                Vorname
              </label>
              <input
                type="text"
                name="firstname"
                value={formData.firstname}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ced4da',
                  borderRadius: '6px',
                  fontSize: '1rem'
                }}
                placeholder="Max"
                required
              />
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: '600',
                color: '#495057'
              }}>
                Nachname
              </label>
              <input
                type="text"
                name="lastname"
                value={formData.lastname}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ced4da',
                  borderRadius: '6px',
                  fontSize: '1rem'
                }}
                placeholder="Mustermann"
                required
              />
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: '600',
                color: '#495057'
              }}>
                Automatisch generierte E-Mail
              </label>
              <div style={{ 
                padding: '0.75rem', 
                backgroundColor: '#e9ecef', 
                border: '1px solid #ced4da',
                borderRadius: '6px',
                color: '#495057',
                fontWeight: '500',
                fontFamily: 'monospace'
              }}>
                {getEmailPreview()}
              </div>
              <div style={{ 
                fontSize: '0.875rem', 
                color: '#6c757d',
                marginTop: '0.25rem'
              }}>
                Die E-Mail wird automatisch aus Vor- und Nachname generiert
              </div>
            </div>
          </div>
        )}

        <div style={{ 
          marginTop: '2rem', 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {step === 2 && (
            <button
              onClick={handleBack}
              style={{
                padding: '0.75rem 1.5rem',
                color: '#6c757d',
                border: '1px solid #6c757d',
                background: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
              disabled={loading}
            >
              ← Zurück
            </button>
          )}
          
          <button
            onClick={handleNext}
            disabled={loading}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: loading ? '#6c757d' : '#51258f',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '1rem',
              marginLeft: step === 1 ? 'auto' : '0',
              transition: 'background-color 0.3s ease'
            }}
          >
            {loading ? '⏳ Wird verarbeitet...' : 
             step === 1 ? 'Weiter →' : 'Setup abschließen'}
          </button>
        </div>

        {step === 2 && (
          <div style={{ 
            marginTop: '1.5rem', 
            textAlign: 'center', 
            color: '#6c757d', 
            fontSize: '0.9rem',
            padding: '1rem',
            backgroundColor: '#e7f3ff',
            borderRadius: '6px',
            border: '1px solid #b6d7e8'
          }}>
            💡 Nach dem erfolgreichen Setup werden Sie zur Anmeldeseite weitergeleitet, 
            wo Sie sich mit Ihrer automatisch generierten E-Mail anmelden können.
          </div>
        )}
      </div>
    </div>
  );
};

export default Setup;