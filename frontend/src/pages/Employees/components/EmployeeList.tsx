// EmployeeList.tsx
import React, { useState } from 'react';
import { ROLE_CONFIG, EMPLOYEE_TYPE_CONFIG } from '../../../models/defaults/employeeDefaults';
import { Employee } from '../../../models/Employee';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotification } from '../../../contexts/NotificationContext';

interface EmployeeListProps {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onManageAvailability: (employee: Employee) => void;
}

type SortField = 'name' | 'employeeType' | 'canWorkAlone' | 'role' | 'lastLogin';
type SortDirection = 'asc' | 'desc';

// FIXED: Use the actual employee types from the Employee interface
type EmployeeType = 'manager' | 'personell' | 'apprentice' | 'guest';

const EmployeeList: React.FC<EmployeeListProps> = ({
  employees,
  onEdit,
  onDelete,
  onManageAvailability
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const { user: currentUser, hasRole } = useAuth();
  const { showNotification, confirmDialog } = useNotification();

  // Filter employees based on active/inactive and search term
  const filteredEmployees = employees.filter(employee => {
    if (filter === 'active' && !employee.isActive) return false;
    if (filter === 'inactive' && employee.isActive) return false;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const fullName = `${employee.firstname} ${employee.lastname}`.toLowerCase();
      return (
        fullName.includes(term) ||
        employee.email.toLowerCase().includes(term) ||
        employee.employeeType.toLowerCase().includes(term) ||
        (employee.roles && employee.roles.some(role => role.toLowerCase().includes(term)))
      );
    }
    
    return true;
  });

  // Helper to get highest role for sorting
  const getHighestRole = (roles: string[]): string => {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('maintenance')) return 'maintenance';
    return 'user';
  };

  // Sort employees based on selected field and direction
  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'name':
        aValue = `${a.firstname} ${a.lastname}`.toLowerCase();
        bValue = `${b.firstname} ${b.lastname}`.toLowerCase();
        break;
      case 'employeeType':
        aValue = a.employeeType;
        bValue = b.employeeType;
        break;
      case 'canWorkAlone':
        aValue = a.canWorkAlone;
        bValue = b.canWorkAlone;
        break;
      case 'role':
        aValue = getHighestRole(a.roles || []);
        bValue = getHighestRole(b.roles || []);
        break;
      case 'lastLogin':
        // Handle null values for lastLogin (put them at the end)
        aValue = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
        bValue = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
        break;
      default:
        return 0;
    }

    if (sortDirection === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  // Simplified permission checks
  const canDeleteEmployee = (employee: Employee): boolean => {
    if (!hasRole(['admin'])) return false;
    if (employee.id === currentUser?.id) return false;
    if (employee.roles?.includes('admin') && !hasRole(['admin'])) return false;
    return true;
  };

  const canEditEmployee = (employee: Employee): boolean => {
    if (hasRole(['admin'])) return true;
    if (hasRole(['maintenance'])) {
      return !employee.roles?.includes('admin') || employee.id === currentUser?.id;
    }
    return false;
  };

  const getEmployeeTypeBadge = (type: EmployeeType, isTrainee: boolean = false) => {
    const config = EMPLOYEE_TYPE_CONFIG[type];

    // FIXED: Updated color mapping for actual employee types
    const bgColor =
      type === 'manager'
        ? '#fadbd8' // light red
        : type === 'personell'
        ? isTrainee ? '#d5f4e6' : '#d6eaf8' // light green for trainee, light blue for experienced
        : type === 'apprentice'
        ? '#e8d7f7' // light purple for apprentice
        : '#f8f9fa'; // light gray for guest

    return { text: config.label, color: config.color, bgColor };
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive 
      ? { text: 'Aktiv', color: '#27ae60', bgColor: '#d5f4e6' }
      : { text: 'Inaktiv', color: '#e74c3c', bgColor: '#fadbd8' };
  };

  const getIndependenceBadge = (canWorkAlone: boolean) => {
    return canWorkAlone 
      ? { text: 'Eigenständig', color: '#27ae60', bgColor: '#d5f4e6' }
      : { text: 'Betreuung', color: '#e74c3c', bgColor: '#fadbd8' };
  };

  type Role = 'admin' | 'maintenance' | 'user';

  const getRoleBadge = (roles: string[] = []) => {
    const highestRole = getHighestRole(roles);
    const { label, color } = ROLE_CONFIG.find(r => r.value === highestRole)!;

    const bgColor =
      highestRole === 'user'
        ? '#d5f4e6'
        : highestRole === 'maintenance'
        ? '#d6eaf8'
        : '#fadbd8'; // admin

    return { text: label, color, bgColor, roles };
  };

  const formatRoleDisplay = (roles: string[] = []) => {
    if (roles.length === 0) return 'MITARBEITER';
    if (roles.includes('admin')) return 'ADMIN';
    if (roles.includes('maintenance')) return 'INSTANDHALTER';
    return 'MITARBEITER';
  };

  const handleDeleteClick = async (employee: Employee) => {
    const confirmed = await confirmDialog({
      title: 'Mitarbeiter löschen',
      message: `Sind Sie sicher, dass Sie ${employee.firstname} ${employee.lastname} löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.`,
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      type: 'warning'
    });

    if (confirmed) {
      try {
        onDelete(employee);
        showNotification({
          type: 'success',
          title: 'Erfolg',
          message: `${employee.firstname} ${employee.lastname} wurde erfolgreich gelöscht.`
        });
      } catch (error: any) {
        // Error will be handled by parent component through useBackendValidation
        // We just need to re-throw it so the parent can catch it
        throw error;
      }
    }
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
          {sortedEmployees.length} von {employees.length} Mitarbeitern
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
          <div 
            onClick={() => handleSort('name')}
            style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            Name & E-Mail {getSortIndicator('name')}
          </div>
          <div 
            onClick={() => handleSort('employeeType')}
            style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}
          >
            Typ {getSortIndicator('employeeType')}
          </div>
          <div 
            onClick={() => handleSort('canWorkAlone')}
            style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}
          >
            Eigenständigkeit {getSortIndicator('canWorkAlone')}
          </div>
          <div 
            onClick={() => handleSort('role')}
            style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}
          >
            Rolle {getSortIndicator('role')}
          </div>
          <div style={{ textAlign: 'center' }}>Status</div>
          <div 
            onClick={() => handleSort('lastLogin')}
            style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}
          >
            Letzter Login {getSortIndicator('lastLogin')}
          </div>
          <div style={{ textAlign: 'center' }}>Aktionen</div>
        </div>

        {sortedEmployees.map(employee => {
          // FIXED: Type assertion to ensure type safety
          const employeeType = getEmployeeTypeBadge(employee.employeeType as EmployeeType, employee.isTrainee);
          const independence = getIndependenceBadge(employee.canWorkAlone);
          const roleInfo = getRoleBadge(employee.roles);
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
                  {employee.firstname} {employee.lastname}
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
                    backgroundColor: employeeType.bgColor,
                    color: employeeType.color,
                    padding: '6px 12px',
                    borderRadius: '15px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    display: 'inline-block'
                  }}
                >
                  {employeeType.text}
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
                    backgroundColor: roleInfo.bgColor,
                    color: roleInfo.color,
                    padding: '6px 12px',
                    borderRadius: '15px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    display: 'inline-block',
                    minWidth: '80px'
                  }}
                  title={employee.roles?.join(', ') || 'user'}
                >
                  {formatRoleDisplay(employee.roles)}
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
                    onClick={() => handleDeleteClick(employee)}
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
                {!canEdit && !canDelete && (
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
            }}>👨‍🏭 PERSONAL</span>
            <span style={{ fontSize: '12px', color: '#666' }}>Reguläre Mitarbeiter</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{
              backgroundColor: '#e8d7f7',
              color: '#9b59b6',
              padding: '4px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>👨‍🎓 AUSZUBILDENDER</span>
            <span style={{ fontSize: '12px', color: '#666' }}>Auszubildende</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{
              backgroundColor: '#f8f9fa',
              color: '#95a5a6',
              padding: '4px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>👤 GAST</span>
            <span style={{ fontSize: '12px', color: '#666' }}>Externe Mitarbeiter</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeList;