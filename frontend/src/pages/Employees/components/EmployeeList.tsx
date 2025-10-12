// frontend/src/pages/Employees/components/EmployeeList.tsx - KORRIGIERT
import React, { useState } from 'react';
import { ROLE_CONFIG, EMPLOYEE_TYPE_CONFIG } from '../../../models/defaults/employeeDefaults';
import { Employee } from '../../../models/Employee';
import { useAuth } from '../../../contexts/AuthContext';

interface EmployeeListProps {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onManageAvailability: (employee: Employee) => void;
}

const EmployeeList: React.FC<EmployeeListProps> = ({
  employees,
  onEdit,
  onDelete,
  onManageAvailability
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const { user: currentUser, hasRole } = useAuth();

  const filteredEmployees = employees.filter(employee => {
    if (filter === 'active' && !employee.isActive) return false;
    if (filter === 'inactive' && employee.isActive) return false;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        employee.name.toLowerCase().includes(term) ||
        employee.email.toLowerCase().includes(term) ||
        employee.employeeType.toLowerCase().includes(term) ||
        employee.role.toLowerCase().includes(term)
      );
    }
    
    return true;
  });

  // Simplified permission checks
  const canDeleteEmployee = (employee: Employee): boolean => {
    if (!hasRole(['admin'])) return false;
    if (employee.id === currentUser?.id) return false;
    if (employee.role === 'admin' && !hasRole(['admin'])) return false;
    return true;
  };

  const canEditEmployee = (employee: Employee): boolean => {
    if (hasRole(['admin'])) return true;
    if (hasRole(['maintenance'])) {
      return employee.role === 'user' || employee.id === currentUser?.id;
    }
    return false;
  };

  // Using shared configuration for consistent styling
  const getEmployeeTypeBadge = (type: 'manager' | 'trainee' | 'experienced') => {
  const config = EMPLOYEE_TYPE_CONFIG.find(t => t.value === type);
  return config || EMPLOYEE_TYPE_CONFIG[0];
};

  const getStatusBadge = (isActive: boolean) => {
    return isActive 
      ? { text: 'Aktiv', color: '#27ae60', bgColor: '#d5f4e6' }
      : { text: 'Inaktiv', color: '#e74c3c', bgColor: '#fadbd8' };
  };

  const getIndependenceBadge = (canWorkAlone: boolean) => {
    return canWorkAlone 
      ? { text: '✅ Eigenständig', color: '#27ae60', bgColor: '#d5f4e6' }
      : { text: '❌ Betreuung', color: '#e74c3c', bgColor: '#fadbd8' };
  };

  if (employees.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '2px dashed #dee2e6'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>👥</div>
        <h3 style={{ color: '#6c757d' }}>Noch keine Mitarbeiter</h3>
        <p style={{ color: '#6c757d', marginBottom: '20px' }}>
          Erstellen Sie den ersten Mitarbeiter, um zu beginnen.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter und Suche */}
      <div style={{
        display: 'flex',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontWeight: 'bold', color: '#2c3e50' }}>Filter:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: 'white'
            }}
          >
            <option value="all">Alle Mitarbeiter</option>
            <option value="active">Nur Aktive</option>
            <option value="inactive">Nur Inaktive</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1 }}>
          <label style={{ fontWeight: 'bold', color: '#2c3e50' }}>Suchen:</label>
          <input
            type="text"
            placeholder="Nach Name, E-Mail oder Typ suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              flex: 1,
              maxWidth: '400px'
            }}
          />
        </div>

        <div style={{ color: '#7f8c8d', fontSize: '14px' }}>
          {filteredEmployees.length} von {employees.length} Mitarbeitern
        </div>
      </div>

      {/* Mitarbeiter Tabelle */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {/* Tabellen-Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr 120px',
          gap: '15px',
          padding: '15px 20px',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #dee2e6',
          fontWeight: 'bold',
          color: '#2c3e50',
          alignItems: 'center'
        }}>
          <div>Name & E-Mail</div>
          <div>Typ</div>
          <div style={{ textAlign: 'center' }}>Eigenständigkeit</div>
          <div style={{ textAlign: 'center' }}>Rolle</div>
          <div style={{ textAlign: 'center' }}>Status</div>
          <div style={{ textAlign: 'center' }}>Letzter Login</div>
          <div style={{ textAlign: 'center' }}>Aktionen</div>
        </div>

        {filteredEmployees.map(employee => {
          const employeeType = getEmployeeTypeBadge(employee.employeeType);
          const independence = getIndependenceBadge(employee.canWorkAlone);
          const roleColor = '#d5f4e6'; // Default color
          const status = getStatusBadge(employee.isActive);
          const canEdit = canEditEmployee(employee);
          const canDelete = canDeleteEmployee(employee);
          
          return (
            <div
              key={employee.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr 120px',
                gap: '15px',
                padding: '15px 20px',
                borderBottom: '1px solid #f0f0f0',
                alignItems: 'center'
              }}
            >
              {/* Name & E-Mail */}
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {employee.name}
                  {employee.id === currentUser?.id && (
                    <span style={{ 
                      marginLeft: '8px',
                      fontSize: '12px',
                      color: '#3498db',
                      fontWeight: 'normal'
                    }}>
                      (Sie)
                    </span>
                  )}
                </div>
                <div style={{ color: '#666', fontSize: '14px' }}>
                  {employee.email}
                </div>
              </div>

              {/* Mitarbeiter Typ */}
              <div style={{ textAlign: 'center' }}>
                <span
                  style={{
                    backgroundColor: employeeType.color,
                    color: employeeType.color,
                    padding: '6px 12px',
                    borderRadius: '15px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    display: 'inline-block'
                  }}
                >
                  {employeeType.label}
                </span>
              </div>

              {/* Eigenständigkeit */}
              <div style={{ textAlign: 'center' }}>
                <span
                  style={{
                    backgroundColor: independence.bgColor,
                    color: independence.color,
                    padding: '6px 12px',
                    borderRadius: '15px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    display: 'inline-block'
                  }}
                >
                  {independence.text}
                </span>
              </div>

              {/* Rolle */}
              <div style={{ textAlign: 'center' }}>
                <span
                  style={{
                    backgroundColor: roleColor,
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '15px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    display: 'inline-block',
                    minWidth: '80px'
                  }}
                >
                  {employee.role === 'admin' ? 'ADMIN' : 
                   employee.role === 'maintenance' ? 'INSTANDHALTER' : 'MITARBEITER'}
                </span>
              </div>

              {/* Status */}
              <div style={{ textAlign: 'center' }}>
                <span
                  style={{
                    backgroundColor: status.bgColor,
                    color: status.color,
                    padding: '6px 12px',
                    borderRadius: '15px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    display: 'inline-block',
                    minWidth: '70px'
                  }}
                >
                  {status.text}
                </span>
              </div>

              {/* Letzter Login */}
              <div style={{ textAlign: 'center', fontSize: '14px', color: '#666' }}>
                {employee.lastLogin 
                  ? new Date(employee.lastLogin).toLocaleDateString('de-DE')
                  : 'Noch nie'
                }
              </div>

              {/* Aktionen */}
              <div style={{ 
                display: 'flex', 
                gap: '8px', 
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}>
                {/* Verfügbarkeit Button */}
                {(employee.role === 'admin' || employee.role === 'maintenance') && (
                  <button
                    onClick={() => onManageAvailability(employee)}
                    style={{
                      padding: '6px 8px',
                      backgroundColor: '#3498db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      minWidth: '32px',
                      height: '32px'
                    }}
                    title="Verfügbarkeit verwalten"
                  >
                    📅
                  </button>
                )}

                {/* Bearbeiten Button */}
                {canEdit && (
                  <button
                    onClick={() => onEdit(employee)}
                    style={{
                      padding: '6px 8px',
                      backgroundColor: '#f39c12',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      minWidth: '32px',
                      height: '32px'
                    }}
                    title="Mitarbeiter bearbeiten"
                  >
                    ✏️
                  </button>
                )}

                {/* Löschen Button */}
                {canDelete && (
                  <button
                    onClick={() => onDelete(employee)}
                    style={{
                      padding: '6px 8px',
                      backgroundColor: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      minWidth: '32px',
                      height: '32px'
                    }}
                    title="Mitarbeiter löschen"
                  >
                    🗑️
                  </button>
                )}

                {/* Platzhalter für Symmetrie */}
                {!canEdit && !canDelete && (employee.role !== 'admin' && employee.role !== 'maintenance') && (
                  <div style={{ width: '32px', height: '32px' }}></div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info-Box über Berechtigungen */}
      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#e8f4fd',
        border: '1px solid #b6d7e8',
        borderRadius: '6px',
        fontSize: '14px',
        color: '#2c3e50'
      }}>
        <strong>💡 Informationen zu Berechtigungen:</strong>
        <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
          <li><strong>Admins</strong> können alle Benutzer bearbeiten und löschen</li>
          <li><strong>Instandhalter</strong> können nur Mitarbeiter bearbeiten</li>
          <li>Mindestens <strong>ein Admin</strong> muss immer im System vorhanden sein</li>
          <li>Benutzer können sich <strong>nicht selbst löschen</strong></li>
        </ul>
      </div>

      {/* Legende für Mitarbeiter Typen */}
      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        border: '1px solid #e9ecef',
        borderRadius: '6px',
        fontSize: '14px'
      }}>
        <strong>🎯 Legende Mitarbeiter Typen:</strong>
        <div style={{ display: 'flex', gap: '15px', marginTop: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{
              backgroundColor: '#fadbd8',
              color: '#e74c3c',
              padding: '4px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>👨‍💼 CHEF</span>
            <span style={{ fontSize: '12px', color: '#666' }}>Vollzugriff</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{
              backgroundColor: '#d6eaf8',
              color: '#3498db',
              padding: '4px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>👴 ERFAHREN</span>
            <span style={{ fontSize: '12px', color: '#666' }}>Langjährige Erfahrung</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{
              backgroundColor: '#d5f4e6',
              color: '#27ae60',
              padding: '4px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>👶 NEULING</span>
            <span style={{ fontSize: '12px', color: '#666' }}>Benötigt Einarbeitung</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeList;