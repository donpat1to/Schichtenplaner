// frontend/src/pages/Plans/PlanList.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { shiftPlanService } from '../../services/shiftPlanService';
import { weeklyPlanService } from '../../services/weeklyPlanService';
import { ShiftPlan } from '../../models/ShiftPlan';
import { WeeklyPlanListItem } from '../../services/weeklyPlanService';
import { useNotification } from '../../contexts/NotificationContext';
import { useBackendValidation } from '../../hooks/useBackendValidation';
import { formatDate } from '../../utils/formatters';

type PlanType = 'shift' | 'weekly';

interface PlanItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
  createdByName?: string;
  type: PlanType;
  weekCount?: number; // Only for weekly plans
}

const PlanList: React.FC = () => {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const { showNotification, confirmDialog } = useNotification();
  const { executeWithValidation, isSubmitting } = useBackendValidation();

  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    await executeWithValidation(async () => {
      try {
        const [shiftPlansData, weeklyPlansData] = await Promise.all([
          shiftPlanService.getShiftPlans(),
          weeklyPlanService.getWeeklyPlans(),
        ]);

        const shiftPlans: PlanItem[] = shiftPlansData.map(plan => ({
          id: plan.id,
          name: plan.name,
          startDate: plan.startDate || '',
          endDate: plan.endDate || '',
          status: plan.status,
          createdAt: plan.createdAt || '',
          type: 'shift' as PlanType,
        }));

        const weeklyPlans: PlanItem[] = weeklyPlansData.map(plan => ({
          id: plan.id,
          name: plan.name,
          startDate: plan.startDate,
          endDate: plan.endDate,
          status: plan.status,
          createdAt: plan.createdAt || '',
          createdByName: plan.createdByName,
          type: 'weekly' as PlanType,
          weekCount: plan.weekCount,
        }));

        // Combine and sort by creation date (newest first)
        let allPlans = [...shiftPlans, ...weeklyPlans].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Users without admin/maintenance role can only see published plans
        if (!hasRole(['admin', 'maintenance'])) {
          allPlans = allPlans.filter(plan => plan.status === 'published');
        }

        setPlans(allPlans);
      } catch (error) {
        console.error('Error loading plans:', error);
      } finally {
        setIsLoading(false);
      }
    });
  };

  const handleDeletePlan = async (id: string, name: string, type: PlanType) => {
    const planTypeName = type === 'shift' ? 'Schichtplan' : 'Wochenplan';

    const confirmed = await confirmDialog({
      title: `${planTypeName} löschen`,
      message: `Möchten Sie den ${planTypeName} "${name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      type: 'warning'
    });

    if (!confirmed) return;

    await executeWithValidation(async () => {
      if (type === 'shift') {
        await shiftPlanService.deleteShiftPlan(id);
      } else {
        await weeklyPlanService.deleteWeeklyPlan(id);
      }

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: `Der ${planTypeName} wurde erfolgreich gelöscht.`
      });

      loadPlans();
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { text: 'Entwurf', color: '#f39c12', bgColor: '#fef5e7' },
      published: { text: 'Veröffentlicht', color: '#27ae60', bgColor: '#d5f4e6' },
      archived: { text: 'Archiviert', color: '#95a5a6', bgColor: '#f8f9fa' },
      template: { text: 'Vorlage', color: '#9b59b6', bgColor: '#f5eef8' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;

    return (
      <span
        style={{
          backgroundColor: config.bgColor,
          color: config.color,
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 'bold',
          display: 'inline-block'
        }}
      >
        {config.text}
      </span>
    );
  };

  const getTypeBadge = (type: PlanType) => {
    const typeConfig = {
      shift: { text: 'Schichtplan', color: '#51258f', bgColor: '#f0e6ff' },
      weekly: { text: 'Wochenplan', color: '#2980b9', bgColor: '#e8f4fd' }
    };

    const config = typeConfig[type];

    return (
      <span
        style={{
          backgroundColor: config.bgColor,
          color: config.color,
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 'bold',
          display: 'inline-block',
          marginRight: '8px'
        }}
      >
        {config.text}
      </span>
    );
  };

  const getPlanDetailsUrl = (plan: PlanItem) => {
    return plan.type === 'shift'
      ? `/plans/${plan.id}`
      : `/plans/${plan.id}`;
  };

  const getEditUrl = (plan: PlanItem) => {
    return plan.type === 'shift'
      ? `/plans/${plan.id}/edit`
      : `/plans/${plan.id}/edit`;
  };

  const canEditPlan = (plan: PlanItem) => {
    if (!hasRole(['admin', 'maintenance'])) return false;
    if (plan.status !== 'draft') return false;
    return true;
  };

  if (isLoading) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '40px',
        fontSize: '18px',
        color: '#666'
      }}>
        Lade Pläne...
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h1>Alle Pläne</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          {hasRole(['admin', 'maintenance']) && (
            <>
              <Link to="/plans/new" style={{ textDecoration: 'none' }}>
                <button style={{
                  padding: '10px 20px',
                  backgroundColor: '#51258f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>📅</span>
                  <span>Neuer Plan</span>
                </button>
              </Link>
            </>
          )}
        </div>
      </div>

      {plans.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '2px dashed #dee2e6'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📋</div>
          <h3>Keine Pläne vorhanden</h3>
          <p>Erstellen Sie Ihren ersten Plan zur Schicht- oder Wochenplanung!</p>
          {hasRole(['admin', 'maintenance']) && (
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '20px' }}>
              <Link to="/plans/new">
                <button style={{
                  padding: '10px 20px',
                  backgroundColor: '#51258f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}>
                  Plan erstellen
                </button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {plans.map(plan => (
            <div
              key={`${plan.type}-${plan.id}`}
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
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  {getTypeBadge(plan.type)}
                  <h3 style={{ margin: '0', color: '#2c3e50' }}>{plan.name}</h3>
                </div>
                <div style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
                  <p style={{ margin: '0' }}>
                    <strong>Zeitraum:</strong> {plan.startDate ? formatDate(plan.startDate) : 'Nicht festgelegt'} - {plan.endDate ? formatDate(plan.endDate) : 'Nicht festgelegt'}
                  </p>
                  <p style={{ margin: '5px 0 0 0' }}>
                    <strong>Status:</strong> {getStatusBadge(plan.status)}
                    {plan.type === 'weekly' && plan.weekCount && (
                      <span style={{ marginLeft: '15px' }}>
                        <strong>Wochen:</strong> {plan.weekCount}
                      </span>
                    )}
                  </p>
                </div>
                <div style={{ fontSize: '12px', color: '#95a5a6' }}>
                  {plan.createdAt && `Erstellt am: ${formatDate(plan.createdAt)}`}
                  {plan.createdByName && ` von ${plan.createdByName}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => navigate(getPlanDetailsUrl(plan))}
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
                    {canEditPlan(plan) && (
                      <button
                        onClick={() => navigate(getEditUrl(plan))}
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
                    )}
                    <button
                      onClick={() => handleDeletePlan(plan.id, plan.name, plan.type)}
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
      {!hasRole(['admin', 'maintenance']) && plans.length > 0 && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#e8f4fd',
          border: '1px solid #b6d7e8',
          borderRadius: '6px',
          fontSize: '14px',
          color: '#2c3e50'
        }}>
          <strong>ℹ️ Informationen:</strong> Sie können Pläne nur anzeigen.
          Bearbeitungsrechte benötigen Admin- oder Instandhalter-Berechtigungen.
          Schichtpläne können zudem nur im Entwurfsstatus bearbeitet werden.
        </div>
      )}
    </div>
  );
};

export default PlanList;