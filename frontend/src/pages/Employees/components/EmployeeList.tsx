// frontend/src/pages/Employees/components/EmployeeList.tsx
import React, { useState } from 'react';
import { Employee } from '../../../types/employee';

interface EmployeeListProps {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (employeeId: string) => void;
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
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchTerm, setSearchTerm] = useState('');

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

      {/* Mitarbeiter Tabelle */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr auto',
          gap: '15px',
          padding: '15px 20px',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #dee2e6',
          fontWeight: 'bold',
          color: '#2c3e50'
        }}>
          <div>Name & E-Mail</div>
          <div>Abteilung</div>
          <div>Rolle</div>
          <div>Status</div>
          <div>Letzter Login</div>
          <div>Aktionen</div>
        </div>

        {filteredEmployees.map(employee => {
          const status = getStatusBadge(employee.isActive);
          
          return (
            <div
              key={employee.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr auto',
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
                </div>
                <div style={{ color: '#666', fontSize: '14px' }}>
                  {employee.email}
                </div>
              </div>

              {/* Abteilung */}
              <div>
                {employee.department || (
                  <span style={{ color: '#999', fontStyle: 'italic' }}>Nicht zugewiesen</span>
                )}
              </div>

              {/* Rolle */}
              <div>
                <span
                  style={{
                    backgroundColor: getRoleBadgeColor(employee.role),
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  {employee.role}
                </span>
              </div>

              {/* Status */}
              <div>
                <span
                  style={{
                    backgroundColor: status.bgColor,
                    color: status.color,
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  {status.text}
                </span>
              </div>

              {/* Letzter Login */}
              <div style={{ fontSize: '14px', color: '#666' }}>
                {employee.lastLogin 
                  ? new Date(employee.lastLogin).toLocaleDateString('de-DE')
                  : 'Noch nie'
                }
              </div>

              {/* Aktionen */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => onManageAvailability(employee)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                  title="Verfügbarkeit verwalten"
                >
                  📅
                </button>

                {(currentUserRole === 'admin' || employee.role !== 'admin') && (
                  <button
                    onClick={() => onEdit(employee)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#f39c12',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    title="Mitarbeiter bearbeiten"
                  >
                    ✏️
                  </button>
                )}

                {currentUserRole === 'admin' && employee.role !== 'admin' && (
                  <button
                    onClick={() => onDelete(employee.id)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    title="Mitarbeiter löschen"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EmployeeList;