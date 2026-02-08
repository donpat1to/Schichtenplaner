// EmployeeRowDetails.tsx
import React, { useState, useEffect } from 'react';
import { Employee, UpdateEmployeeRequest } from '../../../models/Employee';
import { ROLE_CONFIG, EMPLOYEE_TYPE_CONFIG } from '../../../models/defaults/employeeDefaults';
import { employeeService } from '../../../services/employeeService';
import { useAuth } from '../../../contexts/AuthContext';
import { useBackendValidation } from '../../../hooks/useBackendValidation';
import { useNotification } from '../../../contexts/NotificationContext';

interface EmployeeRowDetailsProps {
  employee: Employee;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onSave: (data: UpdateEmployeeRequest) => Promise<void>;
  onCancel: () => void;
}

type EmployeeType = 'manager' | 'personell' | 'apprentice' | 'guest';
type ContractType = 'small' | 'large' | 'flexible';

interface EditFormData {
  username: string;
  firstname: string;
  lastname: string;
  employeeType: EmployeeType;
  contractType: ContractType | undefined;
  canWorkAlone: boolean;
  isTrainee: boolean;
  isActive: boolean;
  roles: string[];
}

const EmployeeRowDetails: React.FC<EmployeeRowDetailsProps> = ({
  employee,
  isEditMode,
  onToggleEditMode,
  onSave,
  onCancel
}) => {
  const { hasRole } = useAuth();
  const { showNotification } = useNotification();
  const {
    validationErrors,
    getFieldError,
    executeWithValidation,
    isSubmitting,
    clearErrors
  } = useBackendValidation();

  // Password reset state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [formData, setFormData] = useState<EditFormData>({
    username: employee.username,
    firstname: employee.firstname || '',
    lastname: employee.lastname || '',
    employeeType: employee.employeeType,
    contractType: employee.contractType,
    canWorkAlone: employee.canWorkAlone,
    isTrainee: employee.isTrainee,
    isActive: employee.isActive,
    roles: employee.roles || ['user']
  });

  // Reset form data when employee changes or edit mode changes
  useEffect(() => {
    setFormData({
      username: employee.username,
      firstname: employee.firstname || '',
      lastname: employee.lastname || '',
      employeeType: employee.employeeType,
      contractType: employee.contractType,
      canWorkAlone: employee.canWorkAlone,
      isTrainee: employee.isTrainee,
      isActive: employee.isActive,
      roles: employee.roles || ['user']
    });
    setShowPasswordSection(false);
    setPasswordForm({ newPassword: '', confirmPassword: '' });
    setPasswordError('');
    clearErrors();
  }, [employee, isEditMode, clearErrors]);

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

    if (cleanFirstname && cleanLastname) {
      return `${cleanFirstname}.${cleanLastname}@sp.de`;
    }
    return `${formData.username.toLowerCase()}@sp.de`;
  };

  const emailPreview = generateEmailPreview(formData.firstname, formData.lastname);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleEmployeeTypeChange = (employeeType: EmployeeType) => {
    let contractType: ContractType | undefined;
    if (employeeType === 'manager' || employeeType === 'apprentice') {
      contractType = 'flexible';
    } else if (employeeType !== 'guest') {
      contractType = formData.contractType || 'small';
    }

    const canWorkAlone = employeeType === 'manager' ||
      (employeeType === 'personell' && !formData.isTrainee);

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

  const handleRoleChange = (role: string, checked: boolean) => {
    setFormData(prev => {
      if (checked) {
        return { ...prev, roles: [role] };
      } else {
        const newRoles = prev.roles.filter(r => r !== role);
        return { ...prev, roles: newRoles.length > 0 ? newRoles : ['user'] };
      }
    });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
    setPasswordError('');
  };

  const handlePasswordReset = async () => {
    // Validate passwords match
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Die Passwörter stimmen nicht überein');
      return;
    }

    if (!passwordForm.newPassword) {
      setPasswordError('Bitte geben Sie ein neues Passwort ein');
      return;
    }

    setIsChangingPassword(true);
    try {
      await executeWithValidation(() =>
        employeeService.changePassword(employee.id, {
          currentPassword: '',
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword
        })
      );
      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Passwort wurde erfolgreich zurückgesetzt'
      });
      setShowPasswordSection(false);
      setPasswordForm({ newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      if (!err.validationErrors) {
        setPasswordError(err.message || 'Fehler beim Zurücksetzen des Passworts');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSave = async () => {
    const updateData: UpdateEmployeeRequest = {
      username: formData.username.trim(),
      firstname: formData.firstname.trim() || undefined,
      lastname: formData.lastname.trim() || undefined,
      roles: formData.roles,
      employeeType: formData.employeeType,
      contractType: formData.employeeType !== 'guest' ? formData.contractType : undefined,
      canWorkAlone: formData.canWorkAlone,
      isActive: formData.isActive,
      isTrainee: formData.isTrainee
    };

    try {
      await executeWithValidation(() => onSave(updateData));
    } catch (err) {
      // Errors are handled by the hook
    }
  };

  const handleCancel = () => {
    setFormData({
      username: employee.username,
      firstname: employee.firstname || '',
      lastname: employee.lastname || '',
      employeeType: employee.employeeType,
      contractType: employee.contractType,
      canWorkAlone: employee.canWorkAlone,
      isTrainee: employee.isTrainee,
      isActive: employee.isActive,
      roles: employee.roles || ['user']
    });
    clearErrors();
    onCancel();
  };

  // Badge helper functions
  const getBadgeStyle = (bgColor: string, textColor: string) => ({
    backgroundColor: bgColor,
    color: textColor,
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold' as const,
    display: 'inline-block'
  });

  const getEmployeeTypeBadge = (type: EmployeeType, isTrainee: boolean = false) => {
    const config = EMPLOYEE_TYPE_CONFIG[type];
    const bgColor = type === 'manager' ? '#fadbd8'
      : type === 'personell' ? (isTrainee ? '#d5f4e6' : '#d6eaf8')
      : type === 'apprentice' ? '#e8d7f7'
      : '#f8f9fa';
    return { text: config.label, color: config.color, bgColor };
  };

  const getContractTypeBadge = (contractType?: ContractType) => {
    if (!contractType) return null;
    const labels: Record<ContractType, string> = {
      small: 'Kleiner Vertrag',
      large: 'Großer Vertrag',
      flexible: 'Flexibler Vertrag'
    };
    return { text: labels[contractType], color: '#3498db', bgColor: '#d6eaf8' };
  };

  const formatRoleDisplay = (roles: string[] = []) => {
    if (roles.includes('admin')) return 'ADMIN';
    if (roles.includes('maintenance')) return 'INSTANDHALTER';
    return 'MITARBEITER';
  };

  const getRoleBadge = (roles: string[] = []) => {
    const highestRole = roles.includes('admin') ? 'admin'
      : roles.includes('maintenance') ? 'maintenance' : 'user';
    const config = ROLE_CONFIG.find(r => r.value === highestRole)!;
    const bgColor = highestRole === 'user' ? '#d5f4e6'
      : highestRole === 'maintenance' ? '#d6eaf8' : '#fadbd8';
    return { text: config.label, color: config.color, bgColor };
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Noch nie';
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isAdmin = hasRole(['admin']);

  // Contract type options
  const contractTypeOptions = [
    { value: 'small' as const, label: 'Kleiner Vertrag' },
    { value: 'large' as const, label: 'Großer Vertrag' },
    { value: 'flexible' as const, label: 'Flexibler Vertrag' }
  ];

  const showContractType = formData.employeeType !== 'guest';
  const isFlexibleOnly = formData.employeeType === 'manager' || formData.employeeType === 'apprentice';

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f8f9fa',
      borderTop: '1px solid #e0e0e0',
      animation: 'slideDown 0.2s ease-out'
    }}>
      <style>
        {`
          @keyframes slideDown {
            from { opacity: 0; max-height: 0; }
            to { opacity: 1; max-height: 1000px; }
          }
        `}
      </style>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '30px'
      }}>
        {/* Left Column - Basic Info */}
        <div>
          <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50', borderBottom: '2px solid #e0e0e0', paddingBottom: '8px' }}>
            Grundinformationen
          </h4>

          {/* Username */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontWeight: 'bold', color: '#6c757d', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Benutzername
            </label>
            {isEditMode && isAdmin ? (
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${getFieldError('username') ? '#dc3545' : '#ced4da'}`,
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            ) : (
              <div style={{ color: '#2c3e50', fontSize: '14px' }}>@{employee.username}</div>
            )}
            {getFieldError('username') && (
              <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '4px' }}>{getFieldError('username')}</div>
            )}
          </div>

          {/* First Name / Last Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontWeight: 'bold', color: '#6c757d', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Vorname
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  name="firstname"
                  value={formData.firstname}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              ) : (
                <div style={{ color: '#2c3e50', fontSize: '14px' }}>{employee.firstname || '-'}</div>
              )}
            </div>
            <div>
              <label style={{ fontWeight: 'bold', color: '#6c757d', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Nachname
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  name="lastname"
                  value={formData.lastname}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              ) : (
                <div style={{ color: '#2c3e50', fontSize: '14px' }}>{employee.lastname || '-'}</div>
              )}
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontWeight: 'bold', color: '#6c757d', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              E-Mail
            </label>
            {isEditMode ? (
              <div style={{
                padding: '8px 12px',
                backgroundColor: '#e9ecef',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                color: '#495057',
                fontSize: '14px',
                fontFamily: 'monospace'
              }}>
                {emailPreview}
              </div>
            ) : (
              <div style={{ color: '#2c3e50', fontSize: '14px' }}>{employee.email}</div>
            )}
          </div>

          {/* Employee Type */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontWeight: 'bold', color: '#6c757d', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Mitarbeitertyp
            </label>
            {isEditMode ? (
              <select
                name="employeeType"
                value={formData.employeeType}
                onChange={(e) => handleEmployeeTypeChange(e.target.value as EmployeeType)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                {Object.values(EMPLOYEE_TYPE_CONFIG).map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            ) : (
              <span style={getBadgeStyle(
                getEmployeeTypeBadge(employee.employeeType, employee.isTrainee).bgColor,
                getEmployeeTypeBadge(employee.employeeType, employee.isTrainee).color
              )}>
                {getEmployeeTypeBadge(employee.employeeType, employee.isTrainee).text}
              </span>
            )}
          </div>

          {/* Contract Type */}
          {(showContractType || employee.contractType) && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontWeight: 'bold', color: '#6c757d', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Vertragstyp
              </label>
              {isEditMode && showContractType ? (
                <select
                  name="contractType"
                  value={formData.contractType || ''}
                  onChange={handleInputChange}
                  disabled={isFlexibleOnly}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '14px',
                    backgroundColor: isFlexibleOnly ? '#e9ecef' : 'white'
                  }}
                >
                  {contractTypeOptions.map(option => (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={isFlexibleOnly && option.value !== 'flexible'}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                employee.contractType ? (
                  <span style={getBadgeStyle('#d6eaf8', '#3498db')}>
                    {getContractTypeBadge(employee.contractType)?.text}
                  </span>
                ) : (
                  <span style={{ color: '#6c757d', fontSize: '14px' }}>-</span>
                )
              )}
            </div>
          )}

          {/* Trainee Toggle (only for personell) */}
          {(formData.employeeType === 'personell' || employee.employeeType === 'personell') && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontWeight: 'bold', color: '#6c757d', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Neuling
              </label>
              {isEditMode ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.isTrainee}
                    onChange={(e) => handleTraineeChange(e.target.checked)}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span style={{ fontSize: '14px', color: '#2c3e50' }}>Als Neuling markieren</span>
                </label>
              ) : (
                <span style={getBadgeStyle(
                  employee.isTrainee ? '#d5f4e6' : '#f8f9fa',
                  employee.isTrainee ? '#27ae60' : '#6c757d'
                )}>
                  {employee.isTrainee ? 'Ja' : 'Nein'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Status & Permissions */}
        <div>
          <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50', borderBottom: '2px solid #e0e0e0', paddingBottom: '8px' }}>
            Status & Berechtigungen
          </h4>

          {/* Can Work Alone */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontWeight: 'bold', color: '#6c757d', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Eigenständigkeit
            </label>
            {isEditMode ? (
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: formData.employeeType === 'manager' || formData.isTrainee ? 'not-allowed' : 'pointer',
                opacity: formData.employeeType === 'manager' || formData.isTrainee ? 0.6 : 1
              }}>
                <input
                  type="checkbox"
                  name="canWorkAlone"
                  checked={formData.canWorkAlone}
                  onChange={handleInputChange}
                  disabled={formData.employeeType === 'manager' || formData.isTrainee}
                  style={{ width: '16px', height: '16px' }}
                />
                <span style={{ fontSize: '14px', color: '#2c3e50' }}>Kann eigenständig arbeiten</span>
              </label>
            ) : (
              <span style={getBadgeStyle(
                employee.canWorkAlone ? '#d5f4e6' : '#fadbd8',
                employee.canWorkAlone ? '#27ae60' : '#e74c3c'
              )}>
                {employee.canWorkAlone ? 'Eigenständig' : 'Betreuung nötig'}
              </span>
            )}
          </div>

          {/* Is Active (admin only) */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontWeight: 'bold', color: '#6c757d', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Status
            </label>
            {isEditMode && isAdmin ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                  style={{ width: '16px', height: '16px' }}
                />
                <span style={{ fontSize: '14px', color: '#2c3e50' }}>Mitarbeiter ist aktiv</span>
              </label>
            ) : (
              <span style={getBadgeStyle(
                employee.isActive ? '#d5f4e6' : '#fadbd8',
                employee.isActive ? '#27ae60' : '#e74c3c'
              )}>
                {employee.isActive ? 'Aktiv' : 'Inaktiv'}
              </span>
            )}
          </div>

          {/* Roles (admin only) */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontWeight: 'bold', color: '#6c757d', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Systemrolle
            </label>
            {isEditMode && isAdmin ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ROLE_CONFIG.map(role => (
                  <label key={role.value} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    padding: '6px 10px',
                    border: `1px solid ${formData.roles.includes(role.value) ? role.color : '#e0e0e0'}`,
                    borderRadius: '4px',
                    backgroundColor: formData.roles.includes(role.value) ? '#f8f9fa' : 'white'
                  }}>
                    <input
                      type="radio"
                      name="role"
                      checked={formData.roles.includes(role.value)}
                      onChange={() => handleRoleChange(role.value, true)}
                      style={{ width: '14px', height: '14px' }}
                    />
                    <span style={{ fontSize: '13px', color: '#2c3e50' }}>{role.label}</span>
                  </label>
                ))}
              </div>
            ) : (
              <span style={getBadgeStyle(
                getRoleBadge(employee.roles).bgColor,
                getRoleBadge(employee.roles).color
              )}>
                {formatRoleDisplay(employee.roles)}
              </span>
            )}
          </div>

          {/* Created At */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontWeight: 'bold', color: '#6c757d', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Erstellt am
            </label>
            <div style={{ color: '#2c3e50', fontSize: '14px' }}>{formatDate(employee.createdAt)}</div>
          </div>

          {/* Last Login */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontWeight: 'bold', color: '#6c757d', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Letzter Login
            </label>
            <div style={{ color: '#2c3e50', fontSize: '14px' }}>{formatDate(employee.lastLogin)}</div>
          </div>

          {/* Password Reset (admin only, edit mode only) */}
          {isEditMode && isAdmin && (
            <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #e0e0e0' }}>
              <label style={{ fontWeight: 'bold', color: '#6c757d', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                Passwort zurücksetzen
              </label>
              {!showPasswordSection ? (
                <button
                  type="button"
                  onClick={() => setShowPasswordSection(true)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f39c12',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '13px'
                  }}
                >
                  Passwort zurücksetzen
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <input
                      type="password"
                      name="newPassword"
                      value={passwordForm.newPassword}
                      onChange={handlePasswordChange}
                      placeholder="Neues Passwort"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: `1px solid ${passwordError || getFieldError('newPassword') ? '#dc3545' : '#ced4da'}`,
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                    {getFieldError('newPassword') && (
                      <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '4px' }}>
                        {getFieldError('newPassword')}
                      </div>
                    )}
                  </div>
                  <div>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={passwordForm.confirmPassword}
                      onChange={handlePasswordChange}
                      placeholder="Passwort bestätigen"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: `1px solid ${passwordError || getFieldError('confirmPassword') ? '#dc3545' : '#ced4da'}`,
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                    {getFieldError('confirmPassword') && (
                      <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '4px' }}>
                        {getFieldError('confirmPassword')}
                      </div>
                    )}
                  </div>
                  {passwordError && (
                    <div style={{ color: '#dc3545', fontSize: '12px' }}>{passwordError}</div>
                  )}
                  <div style={{ fontSize: '12px', color: '#6c757d' }}>
                    Das Passwort muss mindestens 8 Zeichen lang sein und Groß-/Kleinbuchstaben, Zahlen und Sonderzeichen enthalten.
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handlePasswordReset}
                      disabled={isChangingPassword}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#f39c12',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isChangingPassword ? 'not-allowed' : 'pointer',
                        fontWeight: '500',
                        fontSize: '13px',
                        opacity: isChangingPassword ? 0.7 : 1
                      }}
                    >
                      {isChangingPassword ? 'Speichern...' : 'Passwort speichern'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordSection(false);
                        setPasswordForm({ newPassword: '', confirmPassword: '' });
                        setPasswordError('');
                      }}
                      disabled={isChangingPassword}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#95a5a6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isChangingPassword ? 'not-allowed' : 'pointer',
                        fontWeight: '500',
                        fontSize: '13px'
                      }}
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{
        marginTop: '20px',
        paddingTop: '15px',
        borderTop: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px'
      }}>
        {isEditMode ? (
          <>
            <button
              onClick={handleCancel}
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                backgroundColor: '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                opacity: isSubmitting ? 0.7 : 1
              }}
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                backgroundColor: '#51258f',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                opacity: isSubmitting ? 0.7 : 1
              }}
            >
              {isSubmitting ? 'Speichern...' : 'Speichern'}
            </button>
          </>
        ) : (
          <button
            onClick={onToggleEditMode}
            style={{
              padding: '8px 16px',
              backgroundColor: '#51258f',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Bearbeiten
          </button>
        )}
      </div>
    </div>
  );
};

export default EmployeeRowDetails;
