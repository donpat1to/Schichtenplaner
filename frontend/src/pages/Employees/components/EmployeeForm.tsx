import React, { useState } from 'react';
import { CreateEmployeeRequest } from '../../../models/Employee';
import { ROLE_CONFIG, EMPLOYEE_TYPE_CONFIG } from '../../../models/defaults/employeeDefaults';
import { employeeService } from '../../../services/employeeService';
import { useAuth } from '../../../contexts/AuthContext';
import { useBackendValidation } from '../../../hooks/useBackendValidation';
import { useNotification } from '../../../contexts/NotificationContext';

interface EmployeeFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

type EmployeeType = 'manager' | 'personell' | 'apprentice' | 'guest';
type ContractType = 'small' | 'large' | 'flexible';

// ===== TYP-DEFINITIONEN =====
interface EmployeeFormData {
  // Step 1: Grundinformationen
  username: string;
  firstname: string;
  lastname: string;
  email: string;
  password: string;

  // Step 2: Mitarbeiterkategorie
  employeeType: EmployeeType;
  contractType: ContractType | undefined;
  isTrainee: boolean;

  // Step 3: Berechtigungen & Status
  roles: string[];
  canWorkAlone: boolean;
}

// ===== HOOK FÜR FORMULAR-LOGIK =====
const useEmployeeForm = () => {
  const {
    validationErrors,
    getFieldError,
    hasErrors,
    executeWithValidation,
    isSubmitting,
    clearErrors
  } = useBackendValidation();

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<EmployeeFormData>({
    username: '',
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    employeeType: 'personell',
    contractType: 'small',
    isTrainee: false,
    roles: ['user'],
    canWorkAlone: false
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Steps definition - 3 steps for create
  const steps = [
    {
      id: 'basic-info',
      title: 'Grundinformationen',
      subtitle: 'Name und Kontaktdaten'
    },
    {
      id: 'employee-category',
      title: 'Mitarbeiterkategorie',
      subtitle: 'Typ und Vertrag'
    },
    {
      id: 'permissions',
      title: 'Berechtigungen',
      subtitle: 'Rollen und Eigenständigkeit'
    }
  ];

  // Generate email preview
  const generateEmailPreview = (firstname: string, lastname: string): string => {
    const convertUmlauts = (str: string): string => {
      return str
        .toLowerCase()
        .replace(/ü/g, 'ue')
        .replace(/ö/g, 'oe')
        .replace(/ä/g, 'ae')
        .replace(/ß/g, 'ss');
    };

    const cleanFirstname = convertUmlauts(firstname).replace(/[^a-z0-9]/g, '');
    const cleanLastname = convertUmlauts(lastname).replace(/[^a-z0-9]/g, '');

    return `${cleanFirstname}.${cleanLastname}@sp.de`;
  };

  const emailPreview = generateEmailPreview(formData.firstname, formData.lastname);

  // ===== SIMPLE FRONTEND VALIDATION (ONLY FOR REQUIRED FIELDS) =====
  const validateStep1 = (): boolean => {
    // Only check for empty required fields - let backend handle everything else
    if (!formData.username.trim()) {
      setError('Bitte geben Sie einen Benutzernamen ein.');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!formData.employeeType) {
      setError('Bitte wählen Sie eine Mitarbeiterkategorie aus.');
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
  const goToNextStep = (): void => {
    setError('');
    clearErrors();

    if (!validateCurrentStep(currentStep)) {
      return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const goToPrevStep = (): void => {
    setError('');
    clearErrors();
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleStepChange = (stepIndex: number): void => {
    setError('');
    clearErrors();

    // Nur erlauben, zu bereits validierten Schritten zu springen
    if (stepIndex <= currentStep + 1) {
      // Vor dem Wechsel validieren
      if (stepIndex > currentStep && !validateCurrentStep(currentStep)) {
        return;
      }
      setCurrentStep(stepIndex);
    }
  };

  // ===== FORM HANDLER =====
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));

    // Clear field-specific error when user starts typing
    if (validationErrors.length > 0) {
      clearErrors();
    }
  };

  const handleRoleChange = (role: string, checked: boolean) => {
    setFormData(prev => {
      if (checked) {
        return {
          ...prev,
          roles: [role]
        };
      } else {
        const newRoles = prev.roles.filter(r => r !== role);
        return {
          ...prev,
          roles: newRoles.length > 0 ? newRoles : ['user']
        };
      }
    });
  };

  const handleEmployeeTypeChange = (employeeType: EmployeeType) => {
    // Determine contract type based on employee type
    let contractType: ContractType | undefined;
    if (employeeType === 'manager' || employeeType === 'apprentice') {
      contractType = 'flexible';
    } else if (employeeType !== 'guest') {
      contractType = 'small';
    }

    // Determine if can work alone based on employee type
    const canWorkAlone = employeeType === 'manager' ||
      (employeeType === 'personell' && !formData.isTrainee);

    // Reset isTrainee if not personell
    const isTrainee = employeeType === 'personell' ? formData.isTrainee : false;

    setFormData(prev => ({
      ...prev,
      employeeType,
      contractType,
      canWorkAlone,
      isTrainee
    }));
  };

  const handleTraineeChange = (isTrainee: boolean) => {
    setFormData(prev => ({
      ...prev,
      isTrainee,
      canWorkAlone: prev.employeeType === 'personell' ? !isTrainee : prev.canWorkAlone
    }));
  };

  const handleContractTypeChange = (contractType: ContractType) => {
    setFormData(prev => ({
      ...prev,
      contractType
    }));
  };

  const handleSubmit = async (): Promise<void> => {
    setLoading(true);
    setError('');
    clearErrors();

    try {
      const createData: CreateEmployeeRequest = {
        username: formData.username.trim(),
        firstname: formData.firstname.trim() || undefined,
        lastname: formData.lastname.trim() || undefined,
        password: formData.password,
        roles: formData.roles,
        employeeType: formData.employeeType,
        contractType: formData.employeeType !== 'guest' ? formData.contractType : undefined,
        canWorkAlone: formData.canWorkAlone,
        isTrainee: formData.isTrainee
      };

      // Use executeWithValidation ONLY for the API call
      await executeWithValidation(() =>
        employeeService.createEmployee(createData)
      );

      return Promise.resolve();
    } catch (err: any) {
      // Only set error if it's not a validation error (validation errors are handled by the hook)
      if (!err.validationErrors) {
        setError(err.message || 'Fehler beim Erstellen des Mitarbeiters');
      }
      return Promise.reject(err);
    } finally {
      setLoading(false);
    }
  };

  const isStepCompleted = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0:
        return !!formData.username.trim();
      case 1:
        return !!formData.employeeType;
      case 2:
        return true; // Permissions step is always valid
      default:
        return false;
    }
  };

  return {
    // State
    currentStep,
    formData,
    loading: loading || isSubmitting,
    error,
    steps,
    emailPreview,
    validationErrors,
    getFieldError,
    hasErrors,

    // Actions
    goToNextStep,
    goToPrevStep,
    handleStepChange,
    handleInputChange,
    handleRoleChange,
    handleEmployeeTypeChange,
    handleTraineeChange,
    handleContractTypeChange,
    handleSubmit,
    clearErrors,

    // Helpers
    isStepCompleted
  };
};

// ===== STEP-INHALTS-KOMPONENTEN =====
interface StepContentProps {
  formData: EmployeeFormData;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onRoleChange: (role: string, checked: boolean) => void;
  onEmployeeTypeChange: (employeeType: EmployeeType) => void;
  onTraineeChange: (isTrainee: boolean) => void;
  onContractTypeChange: (contractType: ContractType) => void;
  emailPreview: string;
  hasRole: (roles: string[]) => boolean;
  getFieldError: (fieldName: string) => string | null;
  hasErrors: (fieldName?: string) => boolean;
}

const Step1Content: React.FC<StepContentProps> = ({
  formData,
  onInputChange,
  emailPreview
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
    <div>
      <label style={{
        display: 'block',
        marginBottom: '0.5rem',
        fontWeight: '600',
        color: '#495057'
      }}>
        Benutzername *
      </label>
      <input
        type="text"
        name="username"
        value={formData.username}
        onChange={onInputChange}
        required
        style={{
          width: '100%',
          padding: '0.75rem',
          border: '1px solid #ced4da',
          borderRadius: '6px',
          fontSize: '1rem'
        }}
        placeholder="mmustermann"
      />
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
        />
      </div>
    </div>

    {/* Email Preview */}
    <div>
      <label style={{
        display: 'block',
        marginBottom: '0.5rem',
        fontWeight: '600',
        color: '#495057'
      }}>
        E-Mail Adresse (automatisch generiert)
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
        {(formData.firstname?.trim() && formData.lastname?.trim()) ? emailPreview : (formData.username ? `${formData.username.toLowerCase()}@sp.de` : 'benutzername@sp.de')}
      </div>
      <div style={{
        fontSize: '0.875rem',
        color: '#6c757d',
        marginTop: '0.25rem'
      }}>
        Die E-Mail Adresse wird automatisch aus Vorname und Nachname generiert.
      </div>
    </div>

    <div>
      <label style={{
        display: 'block',
        marginBottom: '0.5rem',
        fontWeight: '600',
        color: '#495057'
      }}>
        Passwort *
      </label>
      <input
        type="password"
        name="password"
        value={formData.password}
        onChange={onInputChange}
        required
        style={{
          width: '100%',
          padding: '0.75rem',
          border: '1px solid #ced4da',
          borderRadius: '6px',
          fontSize: '1rem'
        }}
        placeholder="Passwort eingeben"
      />
      <div style={{
        fontSize: '0.875rem',
        color: '#6c757d',
        marginTop: '0.25rem'
      }}>
        Das Passwort muss mindestens 8 Zeichen lang sein und Groß-/Kleinbuchstaben, Zahlen und Sonderzeichen enthalten.
      </div>
    </div>
  </div>
);

const Step2Content: React.FC<StepContentProps> = ({
  formData,
  onEmployeeTypeChange,
  onTraineeChange,
  onContractTypeChange,
  hasRole,
  getFieldError
}) => {
  const contractTypeOptions = [
    { value: 'small' as const, label: 'Kleiner Vertrag', description: '1 Schicht pro Woche' },
    { value: 'large' as const, label: 'Großer Vertrag', description: '2 Schichten pro Woche' },
    { value: 'flexible' as const, label: 'Flexibler Vertrag', description: 'Flexible Arbeitszeiten' }
  ];

  const showContractType = formData.employeeType !== 'guest';
  const employeeTypeError = getFieldError('employeeType');
  const contractTypeError = getFieldError('contractType');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Mitarbeiter Kategorie */}
      <div>
        <h3 style={{ margin: '0 0 1rem 0', color: '#495057' }}>Mitarbeiter Kategorie</h3>

        {employeeTypeError && (
          <div style={{
            color: '#dc3545',
            fontSize: '0.875rem',
            marginBottom: '1rem',
            padding: '0.5rem',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '4px'
          }}>
            {employeeTypeError}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {Object.values(EMPLOYEE_TYPE_CONFIG).map(type => (
            <div
              key={type.value}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                padding: '1rem',
                border: `2px solid ${formData.employeeType === type.value ? type.color : '#e0e0e0'}`,
                borderRadius: '8px',
                backgroundColor: formData.employeeType === type.value ? '#f8fafc' : 'white',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => onEmployeeTypeChange(type.value)}
            >
              <input
                type="radio"
                name="employeeType"
                value={type.value}
                checked={formData.employeeType === type.value}
                onChange={() => onEmployeeTypeChange(type.value)}
                style={{
                  marginRight: '12px',
                  marginTop: '2px',
                  width: '18px',
                  height: '18px'
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: 'bold',
                  color: '#2c3e50',
                  marginBottom: '4px',
                  fontSize: '16px'
                }}>
                  {type.label}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#7f8c8d',
                  lineHeight: '1.4'
                }}>
                  {type.description}
                </div>
              </div>
              <div style={{
                padding: '6px 12px',
                backgroundColor: type.color,
                color: 'white',
                borderRadius: '15px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                {type.value.toUpperCase()}
              </div>
            </div>
          ))}
        </div>

        {/* Trainee checkbox for personell type */}
        {formData.employeeType === 'personell' && (
          <div style={{
            marginTop: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '1rem',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            backgroundColor: '#fff'
          }}>
            <input
              type="checkbox"
              name="isTrainee"
              id="isTrainee"
              checked={formData.isTrainee}
              onChange={(e) => onTraineeChange(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            <div>
              <label htmlFor="isTrainee" style={{ fontWeight: 'bold', color: '#2c3e50', display: 'block' }}>
                Als Neuling markieren
              </label>
              <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                Neulinge benötigen zusätzliche Betreuung und können nicht eigenständig arbeiten.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Vertragstyp (nur für Admins und interne Mitarbeiter) */}
      {hasRole(['admin']) && showContractType && (
        <div>
          <h3 style={{ margin: '0 0 1rem 0', color: '#0c5460' }}>Vertragstyp</h3>

          {contractTypeError && (
            <div style={{
              color: '#dc3545',
              fontSize: '0.875rem',
              marginBottom: '1rem',
              padding: '0.5rem',
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '4px'
            }}>
              {contractTypeError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {contractTypeOptions.map(contract => {
              const isFlexibleDisabled = contract.value === 'flexible' && formData.employeeType === 'personell';
              const isSmallLargeDisabled = (contract.value === 'small' || contract.value === 'large') &&
                (formData.employeeType === 'manager' || formData.employeeType === 'apprentice');
              const isDisabled = isFlexibleDisabled || isSmallLargeDisabled;

              return (
                <div
                  key={contract.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    padding: '1rem',
                    border: `2px solid ${formData.contractType === contract.value ? '#3498db' : '#e0e0e0'}`,
                    borderRadius: '8px',
                    backgroundColor: formData.contractType === contract.value ? '#f0f8ff' : 'white',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    opacity: isDisabled ? 0.6 : 1
                  }}
                  onClick={isDisabled ? undefined : () => onContractTypeChange(contract.value)}
                >
                  <input
                    type="radio"
                    name="contractType"
                    value={contract.value}
                    checked={formData.contractType === contract.value}
                    onChange={isDisabled ? undefined : () => onContractTypeChange(contract.value)}
                    disabled={isDisabled}
                    style={{
                      marginRight: '12px',
                      marginTop: '2px',
                      width: '18px',
                      height: '18px'
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: 'bold',
                      color: '#2c3e50',
                      marginBottom: '4px',
                      fontSize: '16px'
                    }}>
                      {contract.label}
                      {isFlexibleDisabled && (
                        <span style={{
                          fontSize: '12px',
                          color: '#e74c3c',
                          marginLeft: '8px',
                          fontWeight: 'normal'
                        }}>
                          (Nicht verfügbar für Personell)
                        </span>
                      )}
                      {isSmallLargeDisabled && (
                        <span style={{
                          fontSize: '12px',
                          color: '#e74c3c',
                          marginLeft: '8px',
                          fontWeight: 'normal'
                        }}>
                          (Nicht verfügbar für {formData.employeeType === 'manager' ? 'Manager' : 'Auszubildende'})
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#7f8c8d',
                      lineHeight: '1.4'
                    }}>
                      {contract.description}
                    </div>
                  </div>
                  <div style={{
                    padding: '6px 12px',
                    backgroundColor: isDisabled ? '#95a5a6' : (formData.contractType === contract.value ? '#3498db' : '#95a5a6'),
                    color: 'white',
                    borderRadius: '15px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {contract.value.toUpperCase()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const Step3Content: React.FC<StepContentProps> = ({
  formData,
  onInputChange,
  onRoleChange,
  hasRole,
  getFieldError
}) => {
  const rolesError = getFieldError('roles');
  const canWorkAloneError = getFieldError('canWorkAlone');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Eigenständigkeit */}
      <div>
        <h3 style={{ margin: '0 0 1rem 0', color: '#495057' }}>Eigenständigkeit</h3>

        {canWorkAloneError && (
          <div style={{
            color: '#dc3545',
            fontSize: '0.875rem',
            marginBottom: '1rem',
            padding: '0.5rem',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '4px'
          }}>
            {canWorkAloneError}
          </div>
        )}

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          padding: '1rem',
          border: '1px solid #e0e0e0',
          borderRadius: '6px',
          backgroundColor: '#fff'
        }}>
          <input
            type="checkbox"
            name="canWorkAlone"
            id="canWorkAlone"
            checked={formData.canWorkAlone}
            onChange={onInputChange}
            disabled={formData.employeeType === 'manager' || (formData.employeeType === 'personell' && formData.isTrainee)}
            style={{
              width: '20px',
              height: '20px',
              opacity: (formData.employeeType === 'manager' || (formData.employeeType === 'personell' && formData.isTrainee)) ? 0.5 : 1
            }}
          />
          <div style={{ flex: 1 }}>
            <label htmlFor="canWorkAlone" style={{
              fontWeight: 'bold',
              color: '#2c3e50',
              display: 'block',
              opacity: (formData.employeeType === 'manager' || (formData.employeeType === 'personell' && formData.isTrainee)) ? 0.5 : 1
            }}>
              Als ausreichend eigenständig markieren
              {(formData.employeeType === 'manager' || (formData.employeeType === 'personell' && formData.isTrainee)) && ' (Automatisch festgelegt)'}
            </label>
            <div style={{ fontSize: '14px', color: '#7f8c8d' }}>
              {formData.employeeType === 'manager'
                ? 'Chefs sind automatisch als eigenständig markiert.'
                : formData.employeeType === 'personell' && formData.isTrainee
                  ? 'Auszubildende können nicht als eigenständig markiert werden.'
                  : 'Dieser Mitarbeiter kann komplexe Aufgaben eigenständig lösen und benötigt keine ständige Betreuung.'
              }
            </div>
          </div>
          <div style={{
            padding: '6px 12px',
            backgroundColor: formData.canWorkAlone ? '#27ae60' : '#e74c3c',
            color: 'white',
            borderRadius: '15px',
            fontSize: '12px',
            fontWeight: 'bold',
            opacity: (formData.employeeType === 'manager' || (formData.employeeType === 'personell' && formData.isTrainee)) ? 0.7 : 1
          }}>
            {formData.canWorkAlone ? 'EIGENSTÄNDIG' : 'BETREUUNG'}
          </div>
        </div>
      </div>

      {/* Systemrollen (nur für Admins) */}
      {hasRole(['admin']) && (
        <div>
          <h3 style={{ margin: '0 0 1rem 0', color: '#856404' }}>Systemrollen</h3>

          {rolesError && (
            <div style={{
              color: '#dc3545',
              fontSize: '0.875rem',
              marginBottom: '1rem',
              padding: '0.5rem',
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '4px'
            }}>
              {rolesError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {ROLE_CONFIG.map(role => (
              <div
                key={role.value}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  padding: '0.75rem',
                  border: `2px solid ${formData.roles.includes(role.value) ? '#f39c12' : '#e0e0e0'}`,
                  borderRadius: '6px',
                  backgroundColor: formData.roles.includes(role.value) ? '#fef9e7' : 'white',
                  cursor: 'pointer'
                }}
                onClick={() => onRoleChange(role.value, !formData.roles.includes(role.value))}
              >
                <input
                  type="checkbox"
                  name="roles"
                  value={role.value}
                  checked={formData.roles.includes(role.value)}
                  onChange={(e) => onRoleChange(role.value, e.target.checked)}
                  style={{
                    marginRight: '10px',
                    marginTop: '2px'
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                    {role.label}
                  </div>
                  <div style={{ fontSize: '14px', color: '#7f8c8d' }}>
                    {role.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '0.5rem' }}>
            <strong>Hinweis:</strong> Ein Mitarbeiter kann mehrere Rollen haben.
          </div>
        </div>
      )}
    </div>
  );
};

// ===== HAUPTKOMPONENTE =====
const EmployeeForm: React.FC<EmployeeFormProps> = ({
  onSuccess,
  onCancel
}) => {
  const { hasRole } = useAuth();
  const { showNotification } = useNotification();
  const {
    currentStep,
    formData,
    loading,
    error,
    steps,
    emailPreview,
    getFieldError,
    hasErrors,
    goToNextStep,
    goToPrevStep,
    handleStepChange,
    handleInputChange,
    handleRoleChange,
    handleEmployeeTypeChange,
    handleTraineeChange,
    handleContractTypeChange,
    handleSubmit
  } = useEmployeeForm();

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
              {step.subtitle && (
                <div style={{
                  fontSize: '12px',
                  color: '#6c757d',
                  marginTop: '2px'
                }}>
                  {step.subtitle}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderStepContent = (): React.ReactNode => {
    const stepProps = {
      formData,
      onInputChange: handleInputChange,
      onRoleChange: handleRoleChange,
      onEmployeeTypeChange: handleEmployeeTypeChange,
      onTraineeChange: handleTraineeChange,
      onContractTypeChange: handleContractTypeChange,
      emailPreview,
      hasRole,
      getFieldError,
      hasErrors
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

  const handleFinalSubmit = async (): Promise<void> => {
    try {
      await handleSubmit();
      // Show success notification
      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Mitarbeiter wurde erfolgreich erstellt'
      });
      onSuccess();
    } catch (err) {
      // Errors are already handled by the hook and shown as notifications
    }
  };

  const getNextButtonText = (): string => {
    if (loading) return 'Wird gespeichert...';

    if (currentStep === steps.length - 1) {
      return 'Mitarbeiter erstellen';
    }

    return 'Weiter';
  };

  const isLastStep = currentStep === steps.length - 1;

  return (
    <div style={{
      maxWidth: '700px',
      margin: '0 auto',
      backgroundColor: 'white',
      padding: '2rem',
      borderRadius: '8px',
      border: '1px solid #e0e0e0',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{
        margin: '0 0 1.5rem 0',
        color: '#2c3e50',
        borderBottom: '2px solid #f0f0f0',
        paddingBottom: '1rem',
        textAlign: 'center'
      }}>
        Neuen Mitarbeiter erstellen
      </h2>

      {/* Inline Step Indicator */}
      <StepIndicator />

      {/* Aktueller Schritt Titel und Beschreibung */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 'bold',
          marginBottom: '0.5rem',
          color: '#2c3e50'
        }}>
          {steps[currentStep].title}
        </h3>
        {steps[currentStep].subtitle && (
          <p style={{
            color: '#6c757d',
            fontSize: '1rem'
          }}>
            {steps[currentStep].subtitle}
          </p>
        )}
      </div>

      {/* Schritt-Inhalt */}
      <div style={{ minHeight: '300px' }}>
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
          onClick={currentStep === 0 ? onCancel : goToPrevStep}
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            color: loading ? '#adb5bd' : '#6c757d',
            border: `1px solid ${loading ? '#adb5bd' : '#6c757d'}`,
            background: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: '500',
            opacity: loading ? 0.6 : 1
          }}
        >
          {currentStep === 0 ? 'Abbrechen' : 'Zurück'}
        </button>

        <button
          onClick={isLastStep ? handleFinalSubmit : goToNextStep}
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
      {isLastStep && !loading && (
        <div style={{
          marginTop: '1.5rem',
          textAlign: 'center',
          color: '#6c757d',
          fontSize: '0.9rem',
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '6px'
        }}>
          Überprüfen Sie alle Daten, bevor Sie den Mitarbeiter erstellen
        </div>
      )}
    </div>
  );
};

export default EmployeeForm;
