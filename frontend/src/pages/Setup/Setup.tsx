// frontend/src/pages/Setup/Setup.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Setup: React.FC = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    department: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login, checkSetupStatus } = useAuth();

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
    if (!formData.name.trim()) {
      setError('Bitte geben Sie einen Namen ein.');
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
        name: formData.name,
        ...(formData.phone ? { phone: formData.phone } : {}),
        ...(formData.department ? { department: formData.department } : {})
      };

      console.log('🚀 Sending setup request with payload:', payload);

      const response = await fetch('http://localhost:3002/api/setup/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log('📨 Setup response:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Failed to parse response as JSON:', responseText);
        throw new Error('Invalid server response');
      }

      if (!response.ok) {
        throw new Error(result.error || 'Setup fehlgeschlagen');
      }

      console.log('✅ Setup successful:', result);

      // WICHTIG: Setup Status neu prüfen und dann zu Login navigieren
      await checkSetupStatus();
      
      // Kurze Verzögerung damit der State aktualisiert werden kann
      setTimeout(() => {
        navigate('/login');
      }, 100);
      
    } catch (err: any) {
      console.error('❌ Setup error:', err);
      setError(typeof err === 'string' ? err : err.message || 'Ein unerwarteter Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Erstkonfiguration</h1>
          <p className="text-gray-600">
            Konfigurieren Sie den Administrator-Account
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin E-Mail
              </label>
              <div className="p-2 bg-gray-100 border rounded">
                admin@instandhaltung.de
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Passwort
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Mindestens 6 Zeichen"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Passwort bestätigen
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Passwort wiederholen"
                required
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Vollständiger Name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefon (optional)
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+49 123 456789"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Abteilung (optional)
              </label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="z.B. IT"
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-between">
          {step === 2 && (
            <button
              onClick={handleBack}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
              disabled={loading}
            >
              Zurück
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={loading}
            className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 ${
              step === 1 ? 'ml-auto' : ''
            }`}
          >
            {loading ? (
              '⏳ Verarbeite...'
            ) : step === 1 ? (
              'Weiter'
            ) : (
              'Setup abschließen'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Setup;