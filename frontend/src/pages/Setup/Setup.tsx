import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE_URL = '/api';

// ===== TYP-DEFINITIONEN =====
interface SetupFormData {
  password: string;
  confirmPassword: string;
  firstname: string;
  lastname: string;
}

interface SetupStep {
  id: string;
  title: string;
  subtitle?: string;
}

// ===== HOOK FÜR SETUP-LOGIK =====
const useSetup = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<SetupFormData>({
    password: '',
    confirmPassword: '',
    firstname: '',
    lastname: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { checkSetupStatus } = useAuth();

  const steps: SetupStep[] = [
    {
      id: 'profile-setup', 
      title: 'Profilinformationen',
      subtitle: 'Geben Sie Ihre persönlichen Daten ein'
    },
    {
      id: 'password-setup',
      title: 'Passwort erstellen',
      subtitle: 'Legen Sie ein sicheres Passwort fest'
    },
    {
      id: 'confirmation',
      title: 'Bestätigung',
      subtitle: 'Setup abschließen'
    }
  ];

  // ===== VALIDIERUNGS-FUNKTIONEN =====
  const validateStep1 = (): boolean => {
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

  const validateStep2 = (): boolean => {
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

  const validateCurrentStep = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0:
        return validateStep1();
      case 1:
        return validateStep2();
      default:
        return true;
    }
  };

  // ===== NAVIGATIONS-FUNKTIONEN =====
  const goToNextStep = async (): Promise<void> => {
    setError('');
    
    if (!validateCurrentStep(currentStep)) {
      return;
    }

    // Wenn wir beim letzten Schritt sind, Submit ausführen
    if (currentStep === steps.length - 1) {
      await handleSubmit();
      return;
    }

    // Ansonsten zum nächsten Schritt gehen
    setCurrentStep(prev => prev + 1);
  };

  const goToPrevStep = (): void => {
    setError('');
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleStepChange = (stepIndex: number): void => {
    setError('');
    
    // Nur erlauben, zu bereits validierten Schritten zu springen
    // oder zum nächsten Schritt nach dem aktuellen
    if (stepIndex <= currentStep + 1) {
      // Vor dem Wechsel validieren
      if (stepIndex > currentStep && !validateCurrentStep(currentStep)) {
        return;
      }
      setCurrentStep(stepIndex);
    }
  };

  // ===== FORM HANDLER =====
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (): Promise<void> => {
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

  // ===== HELPER FUNCTIONS =====
  const getEmailPreview = (): string => {
    if (!formData.firstname.trim() || !formData.lastname.trim()) {
      return 'vorname.nachname@sp.de';
    }
    
    const cleanFirstname = formData.firstname.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLastname = formData.lastname.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${cleanFirstname}.${cleanLastname}@sp.de`;
  };

  const isStepCompleted = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0:
        return formData.password.length >= 6 && 
               formData.password === formData.confirmPassword;
      case 1:
        return !!formData.firstname.trim() && !!formData.lastname.trim();
      default:
        return false;
    }
  };

  return {
    // State
    currentStep,
    formData,
    loading,
    error,
    steps,
    
    // Actions
    goToNextStep,
    goToPrevStep,
    handleStepChange,
    handleInputChange,
    
    // Helpers
    getEmailPreview,
    isStepCompleted
  };
};

// ===== STEP-INHALTS-KOMPONENTEN =====
interface StepContentProps {
  formData: SetupFormData;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  getEmailPreview: () => string;
  currentStep: number;
}

const Step1Content: React.FC<StepContentProps> = ({ 
  formData, 
  onInputChange,
  getEmailPreview 
}) => (
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
        onChange={onInputChange}
        style={{
          width: '100%',
          padding: '0.75rem',
          border: '1px solid #ced4da',
          borderRadius: '6px',
          fontSize: '1rem'
        }}
        placeholder="Max"
        required
        autoComplete="given-name"
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
        onChange={onInputChange}
        style={{
          width: '100%',
          padding: '0.75rem',
          border: '1px solid #ced4da',
          borderRadius: '6px',
          fontSize: '1rem'
        }}
        placeholder="Mustermann"
        required
        autoComplete="family-name"
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
);


const Step2Content: React.FC<StepContentProps> = ({ 
  formData, 
  onInputChange 
}) => (
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
        onChange={onInputChange}
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
        autoComplete="new-password"
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
        onChange={onInputChange}
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
        autoComplete="new-password"
      />
    </div>
  </div>
);

const Step3Content: React.FC<StepContentProps> = ({ 
  formData,
  getEmailPreview 
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
    <div style={{ 
      backgroundColor: '#f8f9fa', 
      padding: '1.5rem', 
      borderRadius: '8px',
      border: '1px solid #e9ecef'
    }}>
      <h3 style={{ 
        marginBottom: '1rem', 
        color: '#2c3e50',
        fontSize: '1.1rem',
        fontWeight: '600'
      }}>
        Zusammenfassung
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6c757d' }}>E-Mail:</span>
          <span style={{ fontWeight: '500' }}>{getEmailPreview()}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6c757d' }}>Vorname:</span>
          <span style={{ fontWeight: '500' }}>{formData.firstname || '-'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6c757d' }}>Nachname:</span>
          <span style={{ fontWeight: '500' }}>{formData.lastname || '-'}</span>
        </div>
      </div>
    </div>
    
    <div style={{ 
      padding: '1rem',
      backgroundColor: '#e7f3ff',
      borderRadius: '6px',
      border: '1px solid #b6d7e8',
      color: '#2c3e50'
    }}>
      <strong>💡 Wichtig:</strong> Nach dem Setup können Sie sich mit Ihrer 
      automatisch generierten E-Mail anmelden.
    </div>
  </div>
);

// ===== HAUPTKOMPONENTE =====
const Setup: React.FC = () => {
  const {
    currentStep,
    formData,
    loading,
    error,
    steps,
    goToNextStep,
    goToPrevStep,
    handleStepChange,
    handleInputChange,
    getEmailPreview
  } = useSetup();

  const renderStepContent = (): React.ReactNode => {
    const stepProps = {
      formData,
      onInputChange: handleInputChange,
      getEmailPreview,
      currentStep
    };

    switch (currentStep) {
      case 0:
        return <Step1Content {...stepProps} />;
      case 1:
        return <Step2Content {...stepProps} />;
      case 2:
        return <Step3Content {...stepProps} />;
      default:
        return null;
    }
  };

  const getNextButtonText = (): string => {
    if (loading) return '⏳ Wird verarbeitet...';
    
    switch (currentStep) {
      case 0:
        return 'Weiter →';
      case 1:
        return 'Weiter →';
      case 2:
        return 'Setup abschließen';
      default:
        return 'Weiter →';
    }
  };

  // Inline Step Indicator Komponente
  const StepIndicator: React.FC = () => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      marginBottom: '2.5rem',
      position: 'relative',
      width: '100%'
    }}>
      {/* Verbindungslinien */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '0',
        right: '0',
        height: '2px',
        backgroundColor: '#e9ecef',
        zIndex: 1
      }} />
      
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isClickable = index <= currentStep + 1;
        
        return (
          <div 
            key={step.id}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              zIndex: 2,
              position: 'relative',
              flex: 1
            }}
          >
            <button
              onClick={() => isClickable && handleStepChange(index)}
              disabled={!isClickable}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: '2px solid',
                borderColor: isCompleted || isCurrent ? '#51258f' : '#e9ecef',
                backgroundColor: isCompleted ? '#51258f' : 'white',
                color: isCompleted ? 'white' : (isCurrent ? '#51258f' : '#6c757d'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: isClickable ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s ease',
                marginBottom: '8px'
              }}
            >
              {index + 1}
            </button>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: isCurrent ? '600' : '400',
                color: isCurrent ? '#51258f' : '#6c757d'
              }}>
                {step.title}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

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
        maxWidth: '600px',
        border: '1px solid #e9ecef'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
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
            fontSize: '1.1rem',
            marginBottom: '2rem'
          }}>
            Richten Sie Ihren Administrator-Account ein
          </p>
        </div>

        {/* Aktueller Schritt Titel und Beschreibung */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ 
            fontSize: '1.5rem', 
            fontWeight: 'bold', 
            marginBottom: '0.5rem',
            color: '#2c3e50'
          }}>
            {steps[currentStep].title}
          </h2>
          {steps[currentStep].subtitle && (
            <p style={{ 
              color: '#6c757d',
              fontSize: '1rem'
            }}>
              {steps[currentStep].subtitle}
            </p>
          )}
        </div>

        {/* Inline Step Indicator */}
        <StepIndicator />

        {/* Fehleranzeige */}
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

        {/* Schritt-Inhalt */}
        <div style={{ minHeight: '200px' }}>
          {renderStepContent()}
        </div>

        {/* Navigations-Buttons */}
        <div style={{ 
          marginTop: '2rem', 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={goToPrevStep}
            disabled={loading || currentStep === 0}
            style={{
              padding: '0.75rem 1.5rem',
              color: loading || currentStep === 0 ? '#adb5bd' : '#6c757d',
              border: `1px solid ${loading || currentStep === 0 ? '#adb5bd' : '#6c757d'}`,
              background: 'none',
              borderRadius: '6px',
              cursor: loading || currentStep === 0 ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              opacity: loading || currentStep === 0 ? 0.6 : 1
            }}
          >
            ← Zurück
          </button>
          
          <button
            onClick={goToNextStep}
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
              transition: 'background-color 0.3s ease'
            }}
          >
            {getNextButtonText()}
          </button>
        </div>

        {/* Zusätzliche Informationen */}
        {currentStep === 2 && !loading && (
          <div style={{ 
            marginTop: '1.5rem', 
            textAlign: 'center', 
            color: '#6c757d', 
            fontSize: '0.9rem',
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '6px'
          }}>
            Überprüfen Sie Ihre Daten, bevor Sie das Setup abschließen
          </div>
        )}
      </div>
    </div>
  );
};

export default Setup;