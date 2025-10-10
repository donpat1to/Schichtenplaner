// frontend/src/pages/Employees/EmployeeManagement.tsx - VOLLSTÄNDIG
import React, { useState, useEffect } from 'react';
import { Employee } from '../../types/employee';
import { employeeService } from '../../services/employeeService';
import EmployeeList from './components/EmployeeList';
import EmployeeForm from './components/EmployeeForm';
import AvailabilityManager from './components/AvailabilityManager';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';

type ViewMode = 'list' | 'create' | 'edit' | 'availability';

const EmployeeManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const { hasRole, user: currentUser } = useAuth();
  const { showNotification } = useNotification();

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const data = await employeeService.getEmployees();
      setEmployees(data);
    } catch (err: any) {
      console.error('Error loading employees:', err);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Mitarbeiter konnten nicht geladen werden: ' + err.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = () => {
    setSelectedEmployee(null);
    setViewMode('create');
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setViewMode('edit');
  };

  const handleManageAvailability = (employee: Employee) => {
    setSelectedEmployee(employee);
    setViewMode('availability');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedEmployee(null);
  };

  const handleEmployeeCreated = () => {
    loadEmployees();
    setViewMode('list');
    showNotification({
      type: 'success',
      title: 'Erfolg',
      message: 'Mitarbeiter wurde erfolgreich erstellt'
    });
  };

  const handleEmployeeUpdated = () => {
    loadEmployees();
    setViewMode('list');
    showNotification({
      type: 'success',
      title: 'Erfolg',
      message: 'Mitarbeiter wurde erfolgreich aktualisiert'
    });
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    // Warnung basierend auf Rolle
    let confirmMessage = `Möchten Sie den Mitarbeiter "${employee.name}" wirklich löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden.`;
    
    if (employee.role === 'admin') {
      const adminCount = employees.filter(emp => 
        emp.role === 'admin' && emp.isActive
      ).length;
      
      if (adminCount <= 1) {
        showNotification({
          type: 'error',
          title: 'Aktion nicht möglich',
          message: 'Es muss mindestens ein aktiver Administrator im System verbleiben.'
        });
        return;
      }
      confirmMessage += '\n\n⚠️ Achtung: Dieser Benutzer ist ein Administrator!';
    }

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await employeeService.deleteEmployee(employee.id);
      await loadEmployees();
      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: `Mitarbeiter "${employee.name}" wurde gelöscht`
      });
    } catch (err: any) {
      console.error('Error deleting employee:', err);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Mitarbeiter konnte nicht gelöscht werden: ' + err.message
      });
    }
  };

  const handleAvailabilitySaved = () => {
    showNotification({
      type: 'success',
      title: 'Erfolg',
      message: 'Verfügbarkeiten wurden gespeichert'
    });
    setViewMode('list');
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>⏳ Lade Mitarbeiter...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      {viewMode === 'list' && (
        <>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '30px'
          }}>
            <h1>👥 Mitarbeiterverwaltung</h1>
            {hasRole(['admin', 'instandhalter']) && (
              <button
                onClick={handleCreateEmployee}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                + Neuer Mitarbeiter
              </button>
            )}
          </div>

          <EmployeeList
            employees={employees}
            onEdit={handleEditEmployee}
            onDelete={handleDeleteEmployee}
            onManageAvailability={handleManageAvailability}
            currentUserRole={hasRole(['admin']) ? 'admin' : 'instandhalter'}
          />
        </>
      )}

      {viewMode === 'create' && (
        <EmployeeForm
          mode="create"
          onSuccess={handleEmployeeCreated}
          onCancel={handleBackToList}
        />
      )}

      {viewMode === 'edit' && selectedEmployee && (
        <EmployeeForm
          mode="edit"
          employee={selectedEmployee}
          onSuccess={handleEmployeeUpdated}
          onCancel={handleBackToList}
        />
      )}

      {viewMode === 'availability' && selectedEmployee && (
        <AvailabilityManager
          employee={selectedEmployee}
          onSave={handleAvailabilitySaved}
          onCancel={handleBackToList}
        />
      )}
    </div>
  );
};

export default EmployeeManagement;