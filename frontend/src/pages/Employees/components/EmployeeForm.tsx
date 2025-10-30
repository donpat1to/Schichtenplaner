import React, { useState, useEffect } from 'react';
import { Employee, CreateEmployeeRequest, UpdateEmployeeRequest } from '../../../models/Employee';
import { ROLE_CONFIG, EMPLOYEE_TYPE_CONFIG } from '../../../models/defaults/employeeDefaults';
import { employeeService } from '../../../services/employeeService';
import { useAuth } from '../../../contexts/AuthContext';

interface EmployeeFormProps {
  mode: 'create' | 'edit';
  employee?: Employee;
  onSuccess: () => void;
  onCancel: () => void;
}

type EmployeeType = 'manager' | 'personell' | 'apprentice' | 'guest';
type ContractType = 'small' | 'large' | 'flexible';

// ===== TYP-DEFINITIONEN =====
interface EmployeeFormData {
  // Step 1: Grundinformationen
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
  isActive: boolean;
}

interface PasswordFormData {
  newPassword: string;
  confirmPassword: string;
}

// ===== HOOK FÜR FORMULAR-LOGIK =====
const useEmployeeForm = (mode: 'create' | 'edit', employee?: Employee) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<EmployeeFormData>({
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    employeeType: 'personell',
    contractType: 'small',
    isTrainee: false,
    roles: ['user'],
    canWorkAlone: false,
    isActive: true
  });
  
  const [passwordForm, setPasswordForm] = useState<PasswordFormData>({
    newPassword: '',
    confirmPassword: ''
  });
  
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Steps definition
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

  // Add password step for edit mode
  if (mode === 'edit') {
    steps.push({
      id: 'security',
      title: 'Sicherheit',
      subtitle: 'Passwort und Status'
    });
  }

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

  // Initialize form data when employee is provided
  useEffect(() => {
    if (mode === 'edit' && employee) {
      setFormData({
        firstname: employee.firstname,
        lastname: employee.lastname,
        email: employee.email,
        password: '',
        employeeType: employee.employeeType,
        contractType: employee.contractType,
        isTrainee: employee.isTrainee || false,
        roles: employee.roles || ['user'],
        canWorkAlone: employee.canWorkAlone,
        isActive: employee.isActive
      });
    }
  }, [mode, employee]);

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
    if (mode === 'create' && formData.password.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
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
    
    if (!validateCurrentStep(currentStep)) {
      return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
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
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({
      ...prev,
      [name]: value
    }));
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

    try {
      if (mode === 'create') {
        const createData: CreateEmployeeRequest = {
          firstname: formData.firstname.trim(),
          lastname: formData.lastname.trim(),
          password: formData.password,
          roles: formData.roles,
          employeeType: formData.employeeType,
          contractType: formData.employeeType !== 'guest' ? formData.contractType : undefined,
          canWorkAlone: formData.canWorkAlone,
          isTrainee: formData.isTrainee
        };
        await employeeService.createEmployee(createData);
      } else if (employee) {
        const updateData: UpdateEmployeeRequest = {
          firstname: formData.firstname.trim(),
          lastname: formData.lastname.trim(),
          roles: formData.roles,
          employeeType: formData.employeeType,
          contractType: formData.employeeType !== 'guest' ? formData.contractType : undefined,
          canWorkAlone: formData.canWorkAlone,
          isActive: formData.isActive,
          isTrainee: formData.isTrainee
        };
        await employeeService.updateEmployee(employee.id, updateData);

        // Password change logic
        if (showPasswordSection && passwordForm.newPassword) {
          if (passwordForm.newPassword.length < 6) {
            throw new Error('Das Passwort muss mindestens 6 Zeichen lang sein');
          }
          if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            throw new Error('Die Passwörter stimmen nicht überein');
          }

          await employeeService.changePassword(employee.id, {
            currentPassword: '',
            newPassword: passwordForm.newPassword
          });
        }
      }
      
      return Promise.resolve();
    } catch (err: any) {
      setError(err.message || `Fehler beim ${mode === 'create' ? 'Erstellen' : 'Aktualisieren'} des Mitarbeiters`);
      return Promise.reject(err);
    } finally {
      setLoading(false);
    }
  };

  const isStepCompleted = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0:
        return !!formData.firstname.trim() && 
               !!formData.lastname.trim() && 
               (mode === 'edit' || formData.password.length >= 6);
      case 1:
        return !!formData.employeeType;
      case 2:
        return true; // Permissions step is always valid
      case 3:
        return true; // Security step is always valid
      default:
        return false;
    }
  };

  return {
    // State
    currentStep,
    formData,
    passwordForm,
    loading,
    error,
    steps,
    emailPreview,
    showPasswordSection,
    
    // Actions
    goToNextStep,
    goToPrevStep,
    handleStepChange,
    handleInputChange,
    handlePasswordChange,
    handleRoleChange,
    handleEmployeeTypeChange,
    handleTraineeChange,
    handleContractTypeChange,
    handleSubmit,
    setShowPasswordSection,
    
    // Helpers
    isStepCompleted
  };
};

// ===== STEP-INHALTS-KOMPONENTEN =====
interface StepContentProps {
  formData: EmployeeFormData;
  passwordForm: PasswordFormData;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRoleChange: (role: string, checked: boolean) => void;
  onEmployeeTypeChange: (employeeType: EmployeeType) => void;
  onTraineeChange: (isTrainee: boolean) => void;
  onContractTypeChange: (contractType: ContractType) => void;
  emailPreview: string;
  mode: 'create' | 'edit';
  showPasswordSection: boolean;
  onShowPasswordSection: (show: boolean) => void;
  hasRole: (roles: string[]) => boolean;
}

const Step1Content: React.FC<StepContentProps> = ({ 
  formData, 
  onInputChange,
  emailPreview,
  mode
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      <div>
        <label style={{ 
          display: 'block', 
          marginBottom: '0.5rem', 
          fontWeight: '600',
          color: '#495057'
        }}>
          Vorname *
        </label>
        <input
          type="text"
          name="firstname"
          value={formData.firstname}
          onChange={onInputChange}
          required
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
          Nachname *
        </label>
        <input
          type="text"
          name="lastname"
          value={formData.lastname}
          onChange={onInputChange}
          required
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
        {emailPreview || 'max.mustermann@sp.de'}
      </div>
      <div style={{ 
        fontSize: '0.875rem', 
        color: '#6c757d',
        marginTop: '0.25rem'
      }}>
        Die E-Mail Adresse wird automatisch aus Vorname und Nachname generiert.
      </div>
    </div>

    {mode === 'create' && (
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
          minLength={6}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #ced4da',
            borderRadius: '6px',
            fontSize: '1rem'
          }}
          placeholder="Mindestens 6 Zeichen"
        />
        <div style={{ 
          fontSize: '0.875rem', 
          color: '#6c757d',
          marginTop: '0.25rem'
        }}>
          Das Passwort muss mindestens 6 Zeichen lang sein.
        </div>
      </div>
    )}
  </div>
);

const Step2Content: React.FC<StepContentProps> = ({ 
  formData,
  onEmployeeTypeChange,
  onTraineeChange,
  onContractTypeChange,
  hasRole
}) => {
  const contractTypeOptions = [
    { value: 'small' as const, label: 'Kleiner Vertrag', description: '1 Schicht pro Woche' },
    { value: 'large' as const, label: 'Großer Vertrag', description: '2 Schichten pro Woche' },
    { value: 'flexible' as const, label: 'Flexibler Vertrag', description: 'Flexible Arbeitszeiten' }
  ];

  const showContractType = formData.employeeType !== 'guest';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Mitarbeiter Kategorie */}
      <div>
        <h3 style={{ margin: '0 0 1rem 0', color: '#495057' }}>👥 Mitarbeiter Kategorie</h3>
        
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
          <h3 style={{ margin: '0 0 1rem 0', color: '#0c5460' }}>📝 Vertragstyp</h3>
          
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
  hasRole
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
    {/* Eigenständigkeit */}
    <div>
      <h3 style={{ margin: '0 0 1rem 0', color: '#495057' }}>🎯 Eigenständigkeit</h3>
      
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
        <h3 style={{ margin: '0 0 1rem 0', color: '#856404' }}>⚙️ Systemrollen</h3>
        
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

const Step4Content: React.FC<StepContentProps> = ({ 
  formData,
  passwordForm,
  onInputChange,
  onPasswordChange,
  showPasswordSection,
  onShowPasswordSection,
  mode
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
    {/* Passwort ändern */}
    <div>
      <h3 style={{ margin: '0 0 1rem 0', color: '#856404' }}>🔒 Passwort zurücksetzen</h3>
      
      {!showPasswordSection ? (
        <button
          type="button"
          onClick={() => onShowPasswordSection(true)}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#f39c12',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          🔑 Passwort zurücksetzen
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Neues Passwort *
            </label>
            <input
              type="password"
              name="newPassword"
              value={passwordForm.newPassword}
              onChange={onPasswordChange}
              required
              minLength={6}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
              placeholder="Mindestens 6 Zeichen"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#2c3e50' }}>
              Passwort bestätigen *
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={passwordForm.confirmPassword}
              onChange={onPasswordChange}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
              placeholder="Passwort wiederholen"
            />
          </div>

          <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
            <strong>Hinweis:</strong> Als Administrator können Sie das Passwort des Benutzers ohne Kenntnis des aktuellen Passworts zurücksetzen.
          </div>

          <button
            type="button"
            onClick={() => onShowPasswordSection(false)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              alignSelf: 'flex-start'
            }}
          >
            Abbrechen
          </button>
        </div>
      )}
    </div>

    {/* Aktiv Status */}
    {mode === 'edit' && (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px',
        padding: '1rem',
        border: '1px solid #e0e0e0',
        borderRadius: '6px',
        backgroundColor: '#f8f9fa'
      }}>
        <input
          type="checkbox"
          name="isActive"
          id="isActive"
          checked={formData.isActive}
          onChange={onInputChange}
          style={{ width: '18px', height: '18px' }}
        />
        <div>
          <label htmlFor="isActive" style={{ fontWeight: 'bold', color: '#2c3e50', display: 'block' }}>
            Mitarbeiter ist aktiv
          </label>
          <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
            Inaktive Mitarbeiter können sich nicht anmelden und werden nicht für Schichten eingeplant.
          </div>
        </div>
      </div>
    )}
  </div>
);

// ===== HAUPTKOMPONENTE =====
const EmployeeForm: React.FC<EmployeeFormProps> = ({
  mode,
  employee,
  onSuccess,
  onCancel
}) => {
  const { hasRole } = useAuth();
  const {
    currentStep,
    formData,
    passwordForm,
    loading,
    error,
    steps,
    emailPreview,
    showPasswordSection,
    goToNextStep,
    goToPrevStep,
    handleStepChange,
    handleInputChange,
    handlePasswordChange,
    handleRoleChange,
    handleEmployeeTypeChange,
    handleTraineeChange,
    handleContractTypeChange,
    handleSubmit,
    setShowPasswordSection,
    isStepCompleted
  } = useEmployeeForm(mode, employee);

  // Inline Step Indicator Komponente (wie in Setup.tsx)
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
      passwordForm,
      onInputChange: handleInputChange,
      onPasswordChange: handlePasswordChange,
      onRoleChange: handleRoleChange,
      onEmployeeTypeChange: handleEmployeeTypeChange,
      onTraineeChange: handleTraineeChange,
      onContractTypeChange: handleContractTypeChange,
      emailPreview,
      mode,
      showPasswordSection,
      onShowPasswordSection: setShowPasswordSection,
      hasRole
    };

    switch (currentStep) {
      case 0:
        return <Step1Content {...stepProps} />;
      case 1:
        return <Step2Content {...stepProps} />;
      case 2:
        return <Step3Content {...stepProps} />;
      case 3:
        return <Step4Content {...stepProps} />;
      default:
        return null;
    }
  };

  const handleFinalSubmit = async (): Promise<void> => {
    try {
      await handleSubmit();
      onSuccess();
    } catch (err) {
      // Error is already handled in handleSubmit
    }
  };

  const getNextButtonText = (): string => {
    if (loading) return '⏳ Wird gespeichert...';
    
    if (currentStep === steps.length - 1) {
      return mode === 'create' ? 'Mitarbeiter erstellen' : 'Änderungen speichern';
    }
    
    return 'Weiter →';
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
        {mode === 'create' ? '👤 Neuen Mitarbeiter erstellen' : '✏️ Mitarbeiter bearbeiten'}
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
          <strong>Fehler:</strong> {error}
        </div>
      )}

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
          {currentStep === 0 ? 'Abbrechen' : '← Zurück'}
        </button>
        
        <button
          onClick={isLastStep ? handleFinalSubmit : goToNextStep}
          disabled={loading}
          style={{
            padding: '0.75rem 2rem',
            backgroundColor: loading ? '#6c757d' : (isLastStep ? '#27ae60' : '#51258f'),
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
          {mode === 'create' 
            ? 'Überprüfen Sie alle Daten, bevor Sie den Mitarbeiter erstellen'
            : 'Überprüfen Sie alle Änderungen, bevor Sie sie speichern'
          }
        </div>
      )}
    </div>
  );
};

export default EmployeeForm;