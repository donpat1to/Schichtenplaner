// frontend/src/pages/Employees/EmployeeManagement.tsx
import React, { useState, useEffect } from 'react';
import { Employee } from '../../types/employee';
import { employeeService } from '../../services/employeeService';
import EmployeeList from './components/EmployeeList';
import EmployeeForm from './components/EmployeeForm';
import AvailabilityManager from './components/AvailabilityManager';
import { useAuth } from '../../contexts/AuthContext';

type ViewMode = 'list' | 'create' | 'edit' | 'availability';

const EmployeeManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const { hasRole } = useAuth();

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('🔄 Loading employees...');
      const data = await employeeService.getEmployees();
      console.log('✅ Employees loaded:', data);
      setEmployees(data);
    } catch (err: any) {
      console.error('❌ Error loading employees:', err);
      setError(err.message || 'Fehler beim Laden der Mitarbeiter');
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

  // KORRIGIERT: Explizit Daten neu laden nach Create/Update
  const handleEmployeeCreated = () => {
    console.log('🔄 Reloading employees after creation...');
    loadEmployees(); // Daten neu laden
    setViewMode('list'); // Zurück zur Liste
  };

  const handleEmployeeUpdated = () => {
    console.log('🔄 Reloading employees after update...');
    loadEmployees(); // Daten neu laden
    setViewMode('list'); // Zurück zur Liste
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    if (!window.confirm('Mitarbeiter wirklich löschen?\nDer Mitarbeiter wird deaktiviert und kann keine Schichten mehr zugewiesen bekommen.')) {
      return;
    }

    try {
      await employeeService.deleteEmployee(employeeId);
      await loadEmployees(); // Liste aktualisieren
    } catch (err: any) {
      setError(err.message || 'Fehler beim Löschen des Mitarbeiters');
    }
  };

  // Debug: Zeige aktuellen State
  console.log('📊 Current state:', { 
    viewMode, 
    employeesCount: employees.length,
    selectedEmployee: selectedEmployee?.name 
  });

  if (loading && viewMode === 'list') {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>⏳ Lade Mitarbeiter...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header mit Titel und Aktionen */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '30px',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div>
          <h1 style={{ margin: 0, color: '#2c3e50' }}>👥 Mitarbeiter Verwaltung</h1>
          <p style={{ margin: '5px 0 0 0', color: '#7f8c8d' }}>
            {employees.length} Mitarbeiter gefunden
          </p>
        </div>

        {viewMode === 'list' && hasRole(['admin']) && (
          <button
            onClick={handleCreateEmployee}
            style={{
              padding: '12px 24px',
              backgroundColor: '#27ae60',
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
            ← Zurück zur Liste
          </button>
        )}
      </div>

      {/* Fehleranzeige */}
      {error && (
        <div style={{
          backgroundColor: '#fee',
          border: '1px solid #f5c6cb',
          color: '#721c24',
          padding: '15px',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          <strong>Fehler:</strong> {error}
          <button
            onClick={() => setError('')}
            style={{
              float: 'right',
              background: 'none',
              border: 'none',
              color: '#721c24',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Inhalt basierend auf View Mode */}
      {viewMode === 'list' && (
        <EmployeeList
          employees={employees}
          onEdit={handleEditEmployee}
          onDelete={handleDeleteEmployee}
          onManageAvailability={handleManageAvailability}
          currentUserRole={hasRole(['admin']) ? 'admin' : 'instandhalter'}
        />
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
          onSave={handleEmployeeUpdated}
          onCancel={handleBackToList}
        />
      )}
    </div>
  );
};

export default EmployeeManagement;