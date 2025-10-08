// frontend/src/pages/Employees/components/EmployeeForm.tsx
import React, { useState, useEffect } from 'react';
import { Employee, CreateEmployeeRequest, UpdateEmployeeRequest } from '../../../types/employee';
import { employeeService } from '../../../services/employeeService';

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
    role: 'user' as 'admin' | 'instandhalter' | 'user',
    phone: '',
    department: '',
    isActive: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode === 'edit' && employee) {
      setFormData({
        name: employee.name,
        email: employee.email,
        password: '', // Passwort wird beim Editieren nicht angezeigt
        role: employee.role,
        phone: employee.phone || '',
        department: employee.department || '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'create') {
        const createData: CreateEmployeeRequest = {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          phone: formData.phone || undefined,
          department: formData.department || undefined
        };
        await employeeService.createEmployee(createData);
      } else if (employee) {
        const updateData: UpdateEmployeeRequest = {
          name: formData.name,
          role: formData.role,
          isActive: formData.isActive,
          phone: formData.phone || undefined,
          department: formData.department || undefined
        };
        await employeeService.updateEmployee(employee.id, updateData);
      }
      
      onSuccess();
    } catch (err: any) {
      setError(err.message || `Fehler beim ${mode === 'create' ? 'Erstellen' : 'Aktualisieren'} des Mitarbeiters`);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    if (mode === 'create') {
      return formData.name.trim() && 
             formData.email.trim() && 
             formData.password.length >= 6;
    }
    return formData.name.trim() && formData.email.trim();
  };

  return (
    <div style={{
      maxWidth: '600px',
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
          {/* Name */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 'bold',
              color: '#2c3e50'
            }}>
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
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
              placeholder="Max Mustermann"
            />
          </div>

          {/* E-Mail */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 'bold',
              color: '#2c3e50'
            }}>
              E-Mail Adresse *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
              placeholder="max.mustermann@example.com"
            />
          </div>

          {/* Passwort (nur bei Erstellung) */}
          {mode === 'create' && (
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: 'bold',
                color: '#2c3e50'
              }}>
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
                  padding: '10px 12px',
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

          {/* Rolle */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 'bold',
              color: '#2c3e50'
            }}>
              Rolle *
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px',
                backgroundColor: 'white'
              }}
            >
              <option value="user">Mitarbeiter (User)</option>
              <option value="instandhalter">Instandhalter</option>
              <option value="admin">Administrator</option>
            </select>
            <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '5px' }}>
              {formData.role === 'admin' && 'Administratoren haben vollen Zugriff auf alle Funktionen.'}
              {formData.role === 'instandhalter' && 'Instandhalter können Schichtpläne erstellen und Mitarbeiter verwalten.'}
              {formData.role === 'user' && 'Mitarbeiter können ihre eigenen Schichten und Verfügbarkeiten einsehen.'}
            </div>
          </div>

          {/* Telefon */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 'bold',
              color: '#2c3e50'
            }}>
              Telefonnummer
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
              placeholder="+49 123 456789"
            />
          </div>

          {/* Abteilung */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 'bold',
              color: '#2c3e50'
            }}>
              Abteilung
            </label>
            <input
              type="text"
              name="department"
              value={formData.department}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
              placeholder="z.B. Produktion, Logistik, Verwaltung"
            />
          </div>

          {/* Aktiv Status (nur beim Bearbeiten) */}
          {mode === 'edit' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                name="isActive"
                id="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                style={{ width: '18px', height: '18px' }}
              />
              <label htmlFor="isActive" style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                Mitarbeiter ist aktiv
              </label>
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
            disabled={loading || !isFormValid()}
            style={{
              padding: '12px 24px',
              backgroundColor: loading ? '#bdc3c7' : (isFormValid() ? '#27ae60' : '#95a5a6'),
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (loading || !isFormValid()) ? 'not-allowed' : 'pointer',
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