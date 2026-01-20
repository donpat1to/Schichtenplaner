// frontend/src/pages/MyAvailability/MyAvailability.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { employeeService } from '../../services/employeeService';
import { Employee } from '../../models/Employee';
import AvailabilityManager from '../Employees/components/AvailabilityManager';

const MyAvailability: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyEmployee();
  }, [user]);

  const loadMyEmployee = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Get all employees and find the current user
      const employees = await employeeService.getEmployees();
      const myEmployee = employees.find(e => e.id === user.id);

      if (myEmployee) {
        setEmployee(myEmployee);
      } else {
        showNotification({
          type: 'error',
          title: 'Fehler',
          message: 'Mitarbeiterdaten konnten nicht geladen werden'
        });
      }
    } catch (error) {
      console.error('Error loading employee:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Daten konnten nicht geladen werden'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    showNotification({
      type: 'success',
      title: 'Gespeichert',
      message: 'Ihre Verfügbarkeit wurde aktualisiert'
    });
    // Stay on the page after saving
  };

  const handleCancel = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
          <div style={{ color: '#666' }}>Lade Ihre Daten...</div>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px'
      }}>
        <div style={{
          textAlign: 'center',
          backgroundColor: '#fff3cd',
          padding: '40px',
          borderRadius: '8px',
          border: '1px solid #ffeaa7'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
          <h3 style={{ margin: '0 0 10px 0', color: '#856404' }}>Mitarbeiterdaten nicht gefunden</h3>
          <p style={{ color: '#856404', margin: '0 0 20px 0' }}>
            Ihre Mitarbeiterdaten konnten nicht geladen werden.
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#51258f',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Zurück zum Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#f1f1f1',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            color: '#333',
            marginBottom: '15px'
          }}
        >
          ← Zurück zum Dashboard
        </button>
      </div>

      <AvailabilityManager
        employee={employee}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default MyAvailability;
