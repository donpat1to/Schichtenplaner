// frontend/src/pages/ShiftPlans/ShiftPlanList.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { shiftPlanService } from '../../services/shiftPlanService';
import { ShiftPlan } from '../../models/ShiftPlan';
import { useNotification } from '../../contexts/NotificationContext';
import { useBackendValidation } from '../../hooks/useBackendValidation';
import { formatDate } from '../../utils/foramatters';

const ShiftPlanList: React.FC = () => {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const { showNotification, confirmDialog } = useNotification();
  const { executeWithValidation, isSubmitting } = useBackendValidation();
  
  const [shiftPlans, setShiftPlans] = useState<ShiftPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShiftPlans();
  }, []);

  const loadShiftPlans = async () => {
    await executeWithValidation(async () => {
      try {
        const plans = await shiftPlanService.getShiftPlans();
        setShiftPlans(plans);
      } catch (error) {
        console.error('Error loading shift plans:', error);
        // Error is automatically handled by executeWithValidation
      } finally {
        setLoading(false);
      }
    });
  };

  const handleDelete = async (id: string, planName: string) => {
    const confirmed = await confirmDialog({
      title: 'Schichtplan löschen',
      message: `Möchten Sie den Schichtplan "${planName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      type: 'warning'
    });

    if (!confirmed) return;

    await executeWithValidation(async () => {
      await shiftPlanService.deleteShiftPlan(id);
      
      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Der Schichtplan wurde erfolgreich gelöscht.'
      });
      
      loadShiftPlans();
    });
  };

  const getStatusBadge = (status: string) => {
    const config = {
      draft: { text: 'Entwurf', color: '#f39c12', bgColor: '#fef5e7' },
      published: { text: 'Veröffentlicht', color: '#27ae60', bgColor: '#d5f4e6' },
      archived: { text: 'Archiviert', color: '#95a5a6', bgColor: '#f8f9fa' }
    };

    const statusConfig = config[status as keyof typeof config] || config.draft;

    return (
      <span
        style={{
          backgroundColor: statusConfig.bgColor,
          color: statusConfig.color,
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 'bold',
          display: 'inline-block'
        }}
      >
        {statusConfig.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px',
        fontSize: '18px',
        color: '#666'
      }}>
        Lade Schichtpläne...
      </div>
    );
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
        {hasRole(['admin', 'maintenance']) && (
          <Link to="/shift-plans/new">
            <button style={{ 
              padding: '10px 20px', 
              backgroundColor: '#51258f', 
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
          {hasRole(['admin', 'maintenance']) && (
            <Link to="/shift-plans/new">
              <button style={{ 
                marginTop: '15px',
                padding: '10px 20px', 
                backgroundColor: '#51258f', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer'
              }}>
                Ersten Plan erstellen
              </button>
            </Link>
          )}
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
                alignItems: 'center',
                border: plan.status === 'published' ? '2px solid #d5f4e6' : '1px solid #e0e0e0'
              }}
            >
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>{plan.name}</h3>
                <div style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
                  <p style={{ margin: '0' }}>
                    <strong>Zeitraum:</strong> {formatDate(plan.startDate)} - {formatDate(plan.endDate)}
                  </p>
                  <p style={{ margin: '5px 0 0 0' }}>
                    <strong>Status:</strong> {getStatusBadge(plan.status)}
                  </p>
                </div>
                <div style={{ fontSize: '12px', color: '#95a5a6' }}>
                  Erstellt am: {formatDate(plan.createdAt || '')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => navigate(`/shift-plans/${plan.id}`)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    minWidth: '80px'
                  }}
                >
                  Anzeigen
                </button>
                {hasRole(['admin', 'maintenance']) && (
                  <>
                    <button
                      onClick={() => navigate(`/shift-plans/${plan.id}/edit`)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#f39c12',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        minWidth: '80px'
                      }}
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => handleDelete(plan.id, plan.name)}
                      disabled={isSubmitting}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: isSubmitting ? '#bdc3c7' : '#e74c3c',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        minWidth: '80px',
                        opacity: isSubmitting ? 0.6 : 1
                      }}
                    >
                      {isSubmitting ? 'Löscht...' : 'Löschen'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info for users without edit permissions */}
      {!hasRole(['admin', 'maintenance']) && shiftPlans.length > 0 && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#e8f4fd',
          border: '1px solid #b6d7e8',
          borderRadius: '6px',
          fontSize: '14px',
          color: '#2c3e50'
        }}>
          <strong>ℹ️ Informationen:</strong> Sie können Schichtpläne nur anzeigen. 
          Bearbeitungsrechte benötigen Admin- oder Instandhalter-Berechtigungen.
        </div>
      )}
    </div>
  );
};

export default ShiftPlanList;