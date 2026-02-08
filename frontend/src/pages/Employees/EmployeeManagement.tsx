// frontend/src/pages/Employees/EmployeeManagement.tsx
import React, { useState, useEffect } from 'react';
import { Employee } from '../../models/Employee';
import { employeeService } from '../../services/employeeService';
import EmployeeList from './components/EmployeeList';
import EmployeeForm from './components/EmployeeForm';
import AvailabilityManager from './components/AvailabilityManager';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';

type ViewMode = 'list' | 'create' | 'availability';

const EmployeeManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const { hasRole } = useAuth();
  const { showNotification, confirmDialog } = useNotification();

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      console.log('Loading employees...');

      // Add cache-busting parameter to prevent browser caching
      const data = await employeeService.getEmployees(true);
      console.log('Employees loaded:', data);

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

  const handleEmployeeUpdatedInline = () => {
    loadEmployees();
  };

  const handleAvailabilityUpdated = () => {
    loadEmployees();
    setViewMode('list');
    showNotification({
      type: 'success',
      title: 'Erfolg',
      message: 'Verfügbarkeiten wurden erfolgreich aktualisiert'
    });
  };

  // Helper function to get full name
  const getFullName = (employee: Employee): string => {
    return `${employee.firstname} ${employee.lastname}`;
  };

  // Verbesserte Lösch-Funktion mit Bestätigungs-Dialog
  const handleDeleteEmployee = async (employee: Employee) => {
    try {
      const fullName = getFullName(employee);

      // Bestätigungs-Dialog basierend auf Rolle
      let confirmMessage = `Möchten Sie den Mitarbeiter "${fullName}" (${employee.email}) wirklich PERMANENT LÖSCHEN?\n\nDie Daten des Mitarbeiters werden unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`;
      let confirmTitle = 'Mitarbeiter löschen';

      // Check if employee has admin role (now in roles array)
      const isAdmin = employee.roles?.includes('admin') || false;

      if (isAdmin) {
        const adminCount = employees.filter(emp =>
          (emp.roles?.includes('admin') || false) && emp.isActive
        ).length;

        if (adminCount <= 1) {
          showNotification({
            type: 'error',
            title: 'Aktion nicht möglich',
            message: 'Mindestens ein Administrator muss im System verbleiben'
          });
          return;
        }

        confirmTitle = 'Administrator löschen';
        confirmMessage = `Möchten Sie den Administrator "${fullName}" (${employee.email}) wirklich PERMANENT LÖSCHEN?\n\nAchtung: Diese Aktion ist permanent und kann nicht rückgängig gemacht werden.`;
      }

      const confirmed = await confirmDialog({
        title: confirmTitle,
        message: confirmMessage,
        confirmText: 'Permanent löschen',
        cancelText: 'Abbrechen',
        type: 'warning'
      });

      if (!confirmed) return;

      console.log('Starting deletion process for employee:', fullName);
      await employeeService.deleteEmployee(employee.id);
      console.log('Employee deleted, reloading list');

      // Force a fresh reload of employees
      const updatedEmployees = await employeeService.getEmployees();
      setEmployees(updatedEmployees);

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: `Mitarbeiter "${fullName}" wurde erfolgreich gelöscht`
      });

    } catch (err: any) {
      if (err.message.includes('Mindestens ein Administrator')) {
        showNotification({
          type: 'error',
          title: 'Aktion nicht möglich',
          message: err.message
        });
      } else {
        showNotification({
          type: 'error',
          title: 'Fehler',
          message: 'Mitarbeiter konnte nicht gelöscht werden'
        });
      }
    }
  };

  if (loading && viewMode === 'list') {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>Lade Mitarbeiter...</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div>
          <h1 style={{ margin: 0, color: '#2c3e50' }}>Mitarbeiter Verwaltung</h1>
          <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '14px' }}>
            {employees.length} Mitarbeiter gefunden
          </p>
        </div>

        {viewMode === 'list' && hasRole(['admin']) && (
          <button
            onClick={handleCreateEmployee}
            style={{
              padding: '12px 24px',
              backgroundColor: '#51258f',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>+</span>
            Neuer Mitarbeiter
          </button>
        )}

        {viewMode !== 'list' && (
          <button
            onClick={handleBackToList}
            style={{
              padding: '10px 20px',
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Zurück zur Liste
          </button>
        )}
      </div>

      {/* Inhalt basierend auf View Mode */}
      {viewMode === 'list' && (
        <EmployeeList
          employees={employees}
          onDelete={handleDeleteEmployee}
          onManageAvailability={handleManageAvailability}
          onEmployeeUpdated={handleEmployeeUpdatedInline}
        />
      )}

      {viewMode === 'create' && (
        <EmployeeForm
          onSuccess={handleEmployeeCreated}
          onCancel={handleBackToList}
        />
      )}

      {viewMode === 'availability' && selectedEmployee && (
        <AvailabilityManager
          employee={selectedEmployee}
          onSave={handleAvailabilityUpdated}
          onCancel={handleBackToList}
        />
      )}
    </div>
  );
};

export default EmployeeManagement;
