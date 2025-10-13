// frontend/src/pages/Employees/components/EmployeeForm.tsx
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

const EmployeeForm: React.FC<EmployeeFormProps> = ({
  mode,
  employee,
  onSuccess,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'maintenance' | 'user',
    employeeType: 'trainee' as 'manager' | 'trainee' | 'experienced',
    contractType: 'small' as 'small' | 'large',
    canWorkAlone: false,
    isActive: true
  });
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { hasRole } = useAuth();

  useEffect(() => {
    if (mode === 'edit' && employee) {
      setFormData({
        name: employee.name,
        email: employee.email,
        password: '', // Passwort wird beim Bearbeiten nicht angezeigt
        role: employee.role,
        employeeType: employee.employeeType,
        contractType: employee.contractType,
        canWorkAlone: employee.canWorkAlone,
        isActive: employee.isActive
      });
    }
  }, [mode, employee]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  const handleEmployeeTypeChange = (employeeType: 'manager' | 'trainee' | 'experienced') => {
    // Manager and experienced can work alone, trainee cannot
    const canWorkAlone = employeeType === 'manager' || employeeType === 'experienced';
    
    setFormData(prev => ({
      ...prev,
      employeeType,
      canWorkAlone
    }));
  };

  const handleContractTypeChange = (contractType: 'small' | 'large') => {
    setFormData(prev => ({
      ...prev,
      contractType
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'create') {
        const createData: CreateEmployeeRequest = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          role: formData.role,
          employeeType: formData.employeeType,
          contractType: formData.contractType,
          canWorkAlone: formData.canWorkAlone
        };
        await employeeService.createEmployee(createData);
      } else if (employee) {
        const updateData: UpdateEmployeeRequest = {
          name: formData.name.trim(),
          role: formData.role,
          employeeType: formData.employeeType,
          contractType: formData.contractType,
          canWorkAlone: formData.canWorkAlone,
          isActive: formData.isActive,
        };
        await employeeService.updateEmployee(employee.id, updateData);

        // If password change is requested and user is admin
        if (showPasswordSection && passwordForm.newPassword && hasRole(['admin'])) {
          if (passwordForm.newPassword.length < 6) {
            throw new Error('Das neue Passwort muss mindestens 6 Zeichen lang sein');
          }
          if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            throw new Error('Die Passwörter stimmen nicht überein');
          }

          // Use the password change endpoint
          await employeeService.changePassword(employee.id, {
            currentPassword: '', // Empty for admin reset - backend should handle this
            newPassword: passwordForm.newPassword
          });
        }
      }
      
      onSuccess();
    } catch (err: any) {
      setError(err.message || `Fehler beim ${mode === 'create' ? 'Erstellen' : 'Aktualisieren'} des Mitarbeiters`);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = mode === 'create' 
    ? formData.name.trim() && formData.email.trim() && formData.password.length >= 6
    : formData.name.trim() && formData.email.trim();

  const availableRoles = hasRole(['admin']) 
    ? ROLE_CONFIG 
    : ROLE_CONFIG.filter(role => role.value !== 'admin');

  const contractTypeOptions = [
    { value: 'small' as const, label: 'Kleiner Vertrag', description: '1 Schicht pro Woche' },
    { value: 'large' as const, label: 'Großer Vertrag', description: '2 Schichten pro Woche' }
  ];

  return (
    <div style={{
      maxWidth: '700px',
      margin: '0 auto',
      backgroundColor: 'white',
      padding: '30px',
      borderRadius: '8px',
      border: '1px solid #e0e0e0',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ 
        margin: '0 0 25px 0', 
        color: '#2c3e50',
        borderBottom: '2px solid #f0f0f0',
        paddingBottom: '15px'
      }}>
        {mode === 'create' ? '👤 Neuen Mitarbeiter erstellen' : '✏️ Mitarbeiter bearbeiten'}
      </h2>

      {error && (
        <div style={{
          backgroundColor: '#fee',
          border: '1px solid #f5c6cb',
          color: '#721c24',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          <strong>Fehler:</strong> {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gap: '20px' }}>
          
          {/* Grundinformationen */}
          <div style={{
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e9ecef'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#495057' }}>📋 Grundinformationen</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2c3e50' }}>
                  Vollständiger Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                  placeholder="Max Mustermann"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2c3e50' }}>
                  E-Mail Adresse *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={mode === 'edit'} // Email cannot be changed in edit mode
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                    backgroundColor: mode === 'edit' ? '#f8f9fa' : 'white'
                  }}
                  placeholder="max.mustermann@example.com"
                />
              </div>
            </div>

            {mode === 'create' && (
              <div style={{ marginTop: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2c3e50' }}>
                  Passwort *
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px'
                  }}
                  placeholder="Mindestens 6 Zeichen"
                />
                <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '5px' }}>
                  Das Passwort muss mindestens 6 Zeichen lang sein.
                </div>
              </div>
            )}
          </div>

          {/* Vertragstyp (nur für Admins) */}
          {hasRole(['admin']) && (
            <div style={{
              padding: '20px',
              backgroundColor: '#e8f4fd',
              borderRadius: '8px',
              border: '1px solid #b6d7e8'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#0c5460' }}>📝 Vertragstyp</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {contractTypeOptions.map(contract => (
                  <div 
                    key={contract.value}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      padding: '15px',
                      border: `2px solid ${formData.contractType === contract.value ? '#3498db' : '#e0e0e0'}`,
                      borderRadius: '8px',
                      backgroundColor: formData.contractType === contract.value ? '#f0f8ff' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => handleContractTypeChange(contract.value)}
                  >
                    <input
                      type="radio"
                      name="contractType"
                      value={contract.value}
                      checked={formData.contractType === contract.value}
                      onChange={() => handleContractTypeChange(contract.value)}
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
                      backgroundColor: formData.contractType === contract.value ? '#3498db' : '#95a5a6',
                      color: 'white',
                      borderRadius: '15px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {contract.value.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mitarbeiter Kategorie */}
          <div style={{
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e9ecef'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#495057' }}>👥 Mitarbeiter Kategorie</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {EMPLOYEE_TYPE_CONFIG.map(type => (
                <div 
                  key={type.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    padding: '15px',
                    border: `2px solid ${formData.employeeType === type.value ? type.color : '#e0e0e0'}`,
                    borderRadius: '8px',
                    backgroundColor: formData.employeeType === type.value ? '#f8fafc' : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => handleEmployeeTypeChange(type.value)}
                >
                  <input
                    type="radio"
                    name="employeeType"
                    value={type.value}
                    checked={formData.employeeType === type.value}
                    onChange={() => handleEmployeeTypeChange(type.value)}
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
          </div>

          {/* Eigenständigkeit */}
          <div style={{
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e9ecef'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#495057' }}>🎯 Eigenständigkeit</h3>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '15px',
              padding: '15px',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              backgroundColor: '#fff'
            }}>
              <input
                type="checkbox"
                name="canWorkAlone"
                id="canWorkAlone"
                checked={formData.canWorkAlone}
                onChange={handleChange}
                disabled={formData.employeeType === 'manager'}
                style={{ 
                  width: '20px', 
                  height: '20px',
                  opacity: formData.employeeType === 'manager' ? 0.5 : 1
                }}
              />
              <div style={{ flex: 1 }}>
                <label htmlFor="canWorkAlone" style={{ 
                  fontWeight: 'bold', 
                  color: '#2c3e50', 
                  display: 'block',
                  opacity: formData.employeeType === 'manager' ? 0.5 : 1
                }}>
                  Als ausreichend eigenständig markieren
                  {formData.employeeType === 'manager' && ' (Automatisch für Chefs)'}
                </label>
                <div style={{ fontSize: '14px', color: '#7f8c8d' }}>
                  {formData.employeeType === 'manager' 
                    ? 'Chefs sind automatisch als eigenständig markiert.'
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
                opacity: formData.employeeType === 'manager' ? 0.7 : 1
              }}>
                {formData.canWorkAlone ? 'EIGENSTÄNDIG' : 'BETREUUNG'}
              </div>
            </div>
          </div>

          {/* Passwort ändern (nur für Admins im Edit-Modus) */}
          {mode === 'edit' && hasRole(['admin']) && (
            <div style={{
              padding: '20px',
              backgroundColor: '#fff3cd',
              borderRadius: '8px',
              border: '1px solid #ffeaa7'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#856404' }}>🔒 Passwort zurücksetzen</h3>
              
              {!showPasswordSection ? (
                <button
                  type="button"
                  onClick={() => setShowPasswordSection(true)}
                  style={{
                    padding: '10px 16px',
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
                <div style={{ display: 'grid', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2c3e50' }}>
                      Neues Passwort *
                    </label>
                    <input
                      type="password"
                      name="newPassword"
                      value={passwordForm.newPassword}
                      onChange={handlePasswordChange}
                      required
                      minLength={6}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '16px'
                      }}
                      placeholder="Mindestens 6 Zeichen"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2c3e50' }}>
                      Passwort bestätigen *
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={passwordForm.confirmPassword}
                      onChange={handlePasswordChange}
                      required
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '16px'
                      }}
                      placeholder="Passwort wiederholen"
                    />
                  </div>

                  <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                    <strong>Hinweis:</strong> Als Administrator können Sie das Passwort des Benutzers ohne Kenntnis des aktuellen Passworts zurücksetzen.
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordSection(false);
                      setPasswordForm({ newPassword: '', confirmPassword: '' });
                    }}
                    style={{
                      padding: '8px 16px',
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
          )}

          {/* Systemrolle (nur für Admins) */}
          {hasRole(['admin']) && (
            <div style={{
              padding: '20px',
              backgroundColor: '#fff3cd',
              borderRadius: '8px',
              border: '1px solid #ffeaa7'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#856404' }}>⚙️ Systemrolle</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {availableRoles.map(role => (
                  <div 
                    key={role.value}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      padding: '12px',
                      border: `2px solid ${formData.role === role.value ? '#f39c12' : '#e0e0e0'}`,
                      borderRadius: '6px',
                      backgroundColor: formData.role === role.value ? '#fef9e7' : 'white',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        role: role.value as 'admin' | 'maintenance' | 'user'
                      }));
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={role.value}
                      checked={formData.role === role.value}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          role: e.target.value as 'admin' | 'maintenance' | 'user'
                        }));
                      }}
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
            </div>
          )}

          {/* Aktiv Status (nur beim Bearbeiten) */}
          {mode === 'edit' && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              padding: '15px',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              backgroundColor: '#f8f9fa'
            }}>
              <input
                type="checkbox"
                name="isActive"
                id="isActive"
                checked={formData.isActive}
                onChange={handleChange}
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

        {/* Buttons */}
        <div style={{ 
          display: 'flex', 
          gap: '15px', 
          justifyContent: 'flex-end',
          marginTop: '30px',
          paddingTop: '20px',
          borderTop: '1px solid #f0f0f0'
        }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            Abbrechen
          </button>
          
          <button
            type="submit"
            disabled={loading || !isFormValid || (showPasswordSection && (!passwordForm.newPassword || !passwordForm.confirmPassword))}
            style={{
              padding: '12px 24px',
              backgroundColor: loading ? '#bdc3c7' : (isFormValid ? '#27ae60' : '#95a5a6'),
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (loading || !isFormValid) ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {loading ? '⏳ Wird gespeichert...' : (mode === 'create' ? 'Mitarbeiter erstellen' : 'Änderungen speichern')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmployeeForm;