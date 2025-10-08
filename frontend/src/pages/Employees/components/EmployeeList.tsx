// frontend/src/pages/Employees/components/EmployeeList.tsx - KORRIGIERT
import React, { useState } from 'react';
import { Employee } from '../../../types/employee';
import { useAuth } from '../../../contexts/AuthContext';

interface EmployeeListProps {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void; // Jetzt mit Employee-Objekt
  onManageAvailability: (employee: Employee) => void;
  currentUserRole: 'admin' | 'instandhalter';
}


const EmployeeList: React.FC<EmployeeListProps> = ({
  employees,
  onEdit,
  onDelete,
  onManageAvailability,
  currentUserRole
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const { user: currentUser } = useAuth();

  const filteredEmployees = employees.filter(employee => {
    // Status-Filter
    if (filter === 'active' && !employee.isActive) return false;
    if (filter === 'inactive' && employee.isActive) return false;
    
    // Suchfilter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        employee.name.toLowerCase().includes(term) ||
        employee.email.toLowerCase().includes(term) ||
        employee.department?.toLowerCase().includes(term) ||
        employee.role.toLowerCase().includes(term)
      );
    }
    
    return true;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return '#e74c3c';
      case 'instandhalter': return '#3498db';
      case 'user': return '#27ae60';
      default: return '#95a5a6';
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive 
      ? { text: 'Aktiv', color: '#27ae60', bgColor: '#d5f4e6' }
      : { text: 'Inaktiv', color: '#e74c3c', bgColor: '#fadbd8' };
  };

  // NEU: Kann Benutzer löschen?
  const canDeleteEmployee = (employee: Employee): boolean => {
    // Nur Admins können löschen
    if (currentUserRole !== 'admin') return false;
    
    // Kann sich nicht selbst löschen
    if (employee.id === currentUser?.id) return false;
    
    // Admins können nur von Admins gelöscht werden
    if (employee.role === 'admin' && currentUserRole !== 'admin') return false;
    
    return true;
  };

  // NEU: Kann Benutzer bearbeiten?
  const canEditEmployee = (employee: Employee): boolean => {
    // Admins können alle bearbeiten
    if (currentUserRole === 'admin') return true;
    
    // Instandhalter können nur User und sich selbst bearbeiten
    if (currentUserRole === 'instandhalter') {
      return employee.role === 'user' || employee.id === currentUser?.id;
    }
    
    return false;
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
            placeholder="Nach Name, E-Mail oder Abteilung suchen..."
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

      {/* Mitarbeiter Tabelle - SYMMETRISCH KORRIGIERT */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {/* Tabellen-Header - SYMMETRISCH */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 120px', // Feste Breite für Aktionen
          gap: '15px',
          padding: '15px 20px',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #dee2e6',
          fontWeight: 'bold',
          color: '#2c3e50',
          alignItems: 'center'
        }}>
          <div>Name & E-Mail</div>
          <div>Abteilung</div>
          <div style={{ textAlign: 'center' }}>Rolle</div>
          <div style={{ textAlign: 'center' }}>Status</div>
          <div style={{ textAlign: 'center' }}>Letzter Login</div>
          <div style={{ textAlign: 'center' }}>Aktionen</div>
        </div>

        {filteredEmployees.map(employee => {
          const status = getStatusBadge(employee.isActive ?? true);
          const canEdit = canEditEmployee(employee);
          const canDelete = canDeleteEmployee(employee);
          
          return (
            <div
              key={employee.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 120px', // Gleiche Spalten wie Header
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

              {/* Abteilung */}
              <div style={{ color: '#666' }}>
                {employee.department || (
                  <span style={{ color: '#999', fontStyle: 'italic' }}>Nicht zugewiesen</span>
                )}
              </div>

              {/* Rolle - ZENTRIERT */}
              <div style={{ textAlign: 'center' }}>
                <span
                  style={{
                    backgroundColor: getRoleBadgeColor(employee.role),
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
                   employee.role === 'instandhalter' ? 'INSTANDHALTER' : 'MITARBEITER'}
                </span>
              </div>

              {/* Status - ZENTRIERT */}
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

              {/* Letzter Login - ZENTRIERT */}
              <div style={{ textAlign: 'center', fontSize: '14px', color: '#666' }}>
                {employee.lastLogin 
                  ? new Date(employee.lastLogin).toLocaleDateString('de-DE')
                  : 'Noch nie'
                }
              </div>

              {/* Aktionen - ZENTRIERT und SYMMETRISCH */}
              <div style={{ 
                display: 'flex', 
                gap: '8px', 
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}>
                {/* Verfügbarkeit Button - immer sichtbar für berechtigte */}
                {(currentUserRole === 'admin' || currentUserRole === 'instandhalter') && (
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

                {/* Löschen Button - NUR FÜR ADMINS */}
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
                    title="Mitarbeiter deaktivieren"
                  >
                    🗑️
                  </button>
                )}

                {/* Platzhalter für Symmetrie wenn keine Aktionen */}
                {!canEdit && !canDelete && (currentUserRole !== 'admin' && currentUserRole !== 'instandhalter') && (
                  <div style={{ width: '32px', height: '32px' }}></div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* NEU: Info-Box über Berechtigungen */}
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
    </div>
  );
};

export default EmployeeList;