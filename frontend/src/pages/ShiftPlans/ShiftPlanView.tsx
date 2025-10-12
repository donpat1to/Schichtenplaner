// frontend/src/pages/ShiftPlans/ShiftPlanView.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { shiftPlanService } from '../../services/shiftPlanService';
import { getTimeSlotById } from '../../models/helpers/shiftPlanHelpers';
import { ShiftPlan, TimeSlot } from '../../models/ShiftPlan';
import { useNotification } from '../../contexts/NotificationContext';
import { formatDate, formatTime } from '../../utils/foramatters';

const ShiftPlanView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { showNotification } = useNotification();
  const [shiftPlan, setShiftPlan] = useState<ShiftPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShiftPlan();
  }, [id]);

  const weekdays = [
    { id: 1, name: 'Mo' },
    { id: 2, name: 'Di' },
    { id: 3, name: 'Mi' },
    { id: 4, name: 'Do' },
    { id: 5, name: 'Fr' },
    { id: 6, name: 'Sa' },
    { id: 7, name: 'So' }
  ];

  const loadShiftPlan = async () => {
    if (!id) return;
    try {
      const plan = await shiftPlanService.getShiftPlan(id);
      setShiftPlan(plan);
    } catch (error) {
      console.error('Error loading shift plan:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Der Schichtplan konnte nicht geladen werden.'
      });
      navigate('/shift-plans');
    } finally {
      setLoading(false);
    }
  };

  // Simplified timetable data generation
  const getTimetableData = () => {
    if (!shiftPlan) return { shifts: [], weekdays: [] };

    // Use timeSlots directly since shifts reference them
    const timetableShifts = shiftPlan.timeSlots.map(timeSlot => {
      const weekdayData: Record<number, string> = {};
      
      weekdays.forEach(weekday => {
        const shiftsOnDay = shiftPlan.shifts.filter(shift => 
          shift.dayOfWeek === weekday.id && 
          shift.timeSlotId === timeSlot.id
        );

        if (shiftsOnDay.length === 0) {
          weekdayData[weekday.id] = '';
        } else {
          const totalRequired = shiftsOnDay.reduce((sum, shift) => 
            sum + shift.requiredEmployees, 0);
          // For now, show required count since we don't have assigned employees in Shift
          weekdayData[weekday.id] = `0/${totalRequired}`;
        }
      });

      return {
        ...timeSlot,
        displayName: `${timeSlot.name} (${formatTime(timeSlot.startTime)}–${formatTime(timeSlot.endTime)})`,
        weekdayData
      };
    });

    return { shifts: timetableShifts, weekdays };
  };

  if (loading) return <div>Lade Schichtplan...</div>;
  if (!shiftPlan) return <div>Schichtplan nicht gefunden</div>;

  const timetableData = getTimetableData();
  return (
    <div style={{ padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px' 
      }}>
        <div>
          <h1>{shiftPlan.name}</h1>
          <p style={{ color: '#666', marginTop: '5px' }}>
            Zeitraum: {formatDate(shiftPlan.startDate)} - {formatDate(shiftPlan.endDate)}
          </p>
          <p style={{ color: '#666', marginTop: '5px' }}>
            Status: <span style={{
              color: shiftPlan.status === 'published' ? '#2ecc71' : '#f1c40f',
              fontWeight: 'bold'
            }}>
              {shiftPlan.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}
            </span>
          </p>
        </div>
        <div>
          {hasRole(['admin', 'instandhalter']) && (
            <button
              onClick={() => navigate(`/shift-plans/${id}/edit`)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f1c40f',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Bearbeiten
            </button>
          )}
          <button
            onClick={() => navigate('/shift-plans')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Zurück
          </button>
        </div>
      </div>

      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <div>Zeitraum: {formatDate(shiftPlan.startDate)} - {formatDate(shiftPlan.endDate)}</div>
          <div>Status: <span style={{
            color: shiftPlan.status === 'published' ? '#2ecc71' : '#f1c40f',
            fontWeight: 'bold'
          }}>
            {shiftPlan.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}
          </span></div>
        </div>

        {/* Timetable */}
        <div style={{ marginTop: '30px' }}>
          <h3>Schichtplan</h3>
          
          {timetableData.shifts.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#666',
              fontStyle: 'italic'
            }}>
              Keine Schichten für diesen Zeitraum konfiguriert
            </div>
          ) : (
            <div style={{
              overflowX: 'auto',
              marginTop: '20px'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                backgroundColor: 'white'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      border: '1px solid #dee2e6',
                      fontWeight: 'bold',
                      minWidth: '200px'
                    }}>
                      Schicht (Zeit)
                    </th>
                    {timetableData.weekdays.map(weekday => (
                      <th key={weekday.id} style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        border: '1px solid #dee2e6',
                        fontWeight: 'bold',
                        minWidth: '80px'
                      }}>
                        {weekday.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timetableData.shifts.map((shift, index) => (
                    <tr key={index} style={{
                      backgroundColor: index % 2 === 0 ? 'white' : '#f8f9fa'
                    }}>
                      <td style={{
                        padding: '12px 16px',
                        border: '1px solid #dee2e6',
                        fontWeight: '500'
                      }}>
                        {shift.displayName}
                      </td>
                      {timetableData.weekdays.map(weekday => (
                        <td key={weekday.id} style={{
                          padding: '12px 16px',
                          border: '1px solid #dee2e6',
                          textAlign: 'center',
                          color: shift.weekdayData[weekday.id] ? '#2c3e50' : '#bdc3c7'
                        }}>
                          {shift.weekdayData[weekday.id] || '–'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}
        {timetableData.shifts.length > 0 && (
          <div style={{
            marginTop: '20px',
            padding: '12px 16px',
            backgroundColor: '#e8f4fd',
            borderRadius: '4px',
            border: '1px solid #b8d4f0',
            fontSize: '14px'
          }}>
            <strong>Legende:</strong> Angezeigt wird "zugewiesene/benötigte Mitarbeiter" pro Schicht und Wochentag
          </div>
        )}
      </div>
    </div>
  );
};

export default ShiftPlanView;