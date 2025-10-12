// frontend/src/pages/ShiftPlans/ShiftPlanList.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { shiftPlanService } from '../../services/shiftPlanService';
import { ShiftPlan } from '../../models/ShiftPlan';
import { useNotification } from '../../contexts/NotificationContext';
import { formatDate } from '../../utils/foramatters';

const ShiftPlanList: React.FC = () => {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [shiftPlans, setShiftPlans] = useState<ShiftPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShiftPlans();
  }, []);

  const loadShiftPlans = async () => {
    try {
      const plans = await shiftPlanService.getShiftPlans();
      setShiftPlans(plans);
    } catch (error) {
      console.error('Error loading shift plans:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Die Schichtpläne konnten nicht geladen werden.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Möchten Sie diesen Schichtplan wirklich löschen?')) {
      return;
    }

    try {
      await shiftPlanService.deleteShiftPlan(id);
      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Der Schichtplan wurde erfolgreich gelöscht.'
      });
      loadShiftPlans();
    } catch (error) {
      console.error('Error deleting shift plan:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Der Schichtplan konnte nicht gelöscht werden.'
      });
    }
  };

  if (loading) {
    return <div>Lade Schichtpläne...</div>;
  }

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '30px' 
      }}>
        <h1>📅 Schichtpläne</h1>
        {hasRole(['admin', 'instandhalter']) && (
          <Link to="/shift-plans/new">
            <button style={{ 
              padding: '10px 20px', 
              backgroundColor: '#3498db', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}>
              + Neuen Plan
            </button>
          </Link>
        )}
      </div>

      {shiftPlans.length === 0 ? (
        <div style={{ 
          padding: '40px', 
          textAlign: 'center', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '8px',
          border: '2px dashed #dee2e6'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📋</div>
          <h3>Keine Schichtpläne vorhanden</h3>
          <p>Erstellen Sie Ihren ersten Schichtplan!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {shiftPlans.map(plan => (
            <div 
              key={plan.id}
              style={{
                padding: '20px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 10px 0' }}>{plan.name}</h3>
                <div style={{ color: '#666', fontSize: '14px' }}>
                  <p style={{ margin: '0' }}>
                    Zeitraum: {formatDate(plan.startDate)} - {formatDate(plan.endDate)}
                  </p>
                  <p style={{ margin: '5px 0 0 0' }}>
                    Status: <span style={{
                      color: plan.status === 'published' ? '#2ecc71' : '#f1c40f',
                      fontWeight: 'bold'
                    }}>
                      {plan.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}
                    </span>
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => navigate(`/shift-plans/${plan.id}`)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#2ecc71',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Anzeigen
                </button>
                {hasRole(['admin', 'instandhalter']) && (
                  <>
                    <button
                      onClick={() => navigate(`/shift-plans/${plan.id}/edit`)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#f1c40f',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => handleDelete(plan.id)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#e74c3c',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Löschen
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ShiftPlanList;