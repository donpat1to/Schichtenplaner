// frontend/src/pages/ShiftPlans/ShiftPlanView.tsx (updated)
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { shiftPlanService } from '../../services/shiftPlanService';
import { employeeService } from '../../services/employeeService';
import { ShiftAssignmentService, AssignmentResult } from '../../services/shiftAssignmentService';
import { ShiftPlan, TimeSlot } from '../../models/ShiftPlan';
import { Employee, EmployeeAvailability } from '../../models/Employee';
import { useNotification } from '../../contexts/NotificationContext';
import { formatDate, formatTime } from '../../utils/foramatters';

const weekdays = [
    { id: 1, name: 'Mo' },
    { id: 2, name: 'Di' },
    { id: 3, name: 'Mi' },
    { id: 4, name: 'Do' },
    { id: 5, name: 'Fr' },
    { id: 6, name: 'Sa' },
    { id: 7, name: 'So' }
  ];

const ShiftPlanView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();
  const { showNotification } = useNotification();
  
  const [shiftPlan, setShiftPlan] = useState<ShiftPlan | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availabilities, setAvailabilities] = useState<EmployeeAvailability[]>([]);
  const [assignmentResult, setAssignmentResult] = useState<AssignmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [showAssignmentPreview, setShowAssignmentPreview] = useState(false);

  useEffect(() => {
    loadShiftPlanData();
  }, [id]);

  const loadShiftPlanData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const [plan, employeesData] = await Promise.all([
        shiftPlanService.getShiftPlan(id),
        employeeService.getEmployees()
      ]);

      setShiftPlan(plan);
      setEmployees(employeesData.filter(emp => emp.isActive));

      // Load availabilities for all employees
      const availabilityPromises = employeesData
        .filter(emp => emp.isActive)
        .map(emp => employeeService.getAvailabilities(emp.id));
      
      const allAvailabilities = await Promise.all(availabilityPromises);
      const flattenedAvailabilities = allAvailabilities.flat();
      
      // Filter availabilities to only include those for the current shift plan
      const planAvailabilities = flattenedAvailabilities.filter(
        availability => availability.planId === id
      );
      
      setAvailabilities(planAvailabilities);

    } catch (error) {
      console.error('Error loading shift plan data:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Daten konnten nicht geladen werden.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewAssignment = async () => {
    if (!shiftPlan) return;

    try {
      setPublishing(true);
      const result = await ShiftAssignmentService.assignShifts(
        shiftPlan,
        employees,
        availabilities,
        {
          enforceExperiencedWithChef: true,
          enforceNoTraineeAlone: true,
          maxRepairAttempts: 50
        }
      );

      setAssignmentResult(result);
      setShowAssignmentPreview(true);

      if (!result.success) {
        showNotification({
          type: 'warning',
          title: 'Warnung',
          message: `Automatische Zuordnung hat ${result.violations.length} Probleme gefunden.`
        });
      }

    } catch (error) {
      console.error('Error during assignment:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Automatische Zuordnung fehlgeschlagen.'
      });
    } finally {
      setPublishing(false);
    }
  };

  const handlePublish = async () => {
    if (!shiftPlan || !assignmentResult) return;

    try {
      setPublishing(true);
      
      console.log('🔄 Starting to publish assignments...');
      
      // Debug: Check if scheduled shifts exist
      if (!shiftPlan.scheduledShifts || shiftPlan.scheduledShifts.length === 0) {
        throw new Error('No scheduled shifts found in the plan');
      }

      // Update scheduled shifts with assignments
      const updatePromises = shiftPlan.scheduledShifts.map(async (scheduledShift) => {
        const assignedEmployees = assignmentResult.assignments[scheduledShift.id] || [];
        
        console.log(`📝 Updating shift ${scheduledShift.id} with`, assignedEmployees.length, 'employees');
        
        try {
          // First, verify the shift exists
          await shiftPlanService.getScheduledShift(scheduledShift.id);
          
          // Then update it
          await shiftPlanService.updateScheduledShift(scheduledShift.id, {
            assignedEmployees
          });
          
          console.log(`✅ Successfully updated shift ${scheduledShift.id}`);
        } catch (error) {
          console.error(`❌ Failed to update shift ${scheduledShift.id}:`, error);
          throw error; // Re-throw to stop the process
        }
      });

      await Promise.all(updatePromises);

      // Update plan status to published
      console.log('🔄 Updating plan status to published...');
      await shiftPlanService.updateShiftPlan(shiftPlan.id, {
        status: 'published'
      });

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Schichtplan wurde erfolgreich veröffentlicht!'
      });

      // Reload the plan to reflect changes
      loadShiftPlanData();
      setShowAssignmentPreview(false);

    } catch (error) {
      console.error('❌ Error publishing shift plan:', error);

      let message = 'Unbekannter Fehler';
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === 'string') {
        message = error;
      }

      showNotification({
        type: 'error',
        title: 'Fehler',
        message: `Schichtplan konnte nicht veröffentlicht werden: ${message}`
      });
    } finally {
      setPublishing(false);
    }
  };

  const canPublish = () => {
    if (!shiftPlan || shiftPlan.status === 'published') return false;
    
    // Check if all active employees have set their availabilities
    const employeesWithoutAvailabilities = employees.filter(emp => {
      const empAvailabilities = availabilities.filter(avail => avail.employeeId === emp.id);
      return empAvailabilities.length === 0;
    });

    return employeesWithoutAvailabilities.length === 0;
  };

  const getAvailabilityStatus = () => {
    const totalEmployees = employees.length;
    const employeesWithAvailabilities = new Set(
      availabilities.map(avail => avail.employeeId)
    ).size;

    return {
      completed: employeesWithAvailabilities,
      total: totalEmployees,
      percentage: Math.round((employeesWithAvailabilities / totalEmployees) * 100)
    };
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

  const debugApiEndpoints = async () => {
    if (!shiftPlan) return;
    
    console.log('🔍 Testing API endpoints for plan:', shiftPlan.id);
    
    try {
      // Test the scheduled shifts endpoint
      const shifts = await shiftPlanService.getScheduledShiftsForPlan(shiftPlan.id);
      console.log('✅ GET /api/scheduled-shifts/plan/:planId works:', shifts.length, 'shifts found');
      
      if (shifts.length > 0) {
        const firstShift = shifts[0];
        console.log('🔍 First shift:', firstShift);
        
        // Test updating the first shift
        try {
          await shiftPlanService.updateScheduledShift(firstShift.id, {
            assignedEmployees: ['test-employee']
          });
          console.log('✅ PUT /api/scheduled-shifts/:id works');
        } catch (updateError) {
          console.error('❌ PUT /api/scheduled-shifts/:id failed:', updateError);
        }
      }
    } catch (error) {
      console.error('❌ GET /api/scheduled-shifts/plan/:planId failed:', error);
    }
  };


  return (
    <div style={{ padding: '20px' }}>
      {/* Existing header code... */}

      {/* Availability Status */}
      {shiftPlan?.status === 'draft' && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3>Veröffentlichungsvoraussetzungen</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
            <div>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                Verfügbarkeitseinträge:
              </div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                {getAvailabilityStatus().completed} / {getAvailabilityStatus().total} Mitarbeiter
              </div>
              <div style={{ 
                width: '200px', 
                height: '8px', 
                backgroundColor: '#e0e0e0', 
                borderRadius: '4px',
                marginTop: '5px',
                overflow: 'hidden'
              }}>
                <div 
                  style={{
                    width: `${getAvailabilityStatus().percentage}%`,
                    height: '100%',
                    backgroundColor: getAvailabilityStatus().percentage === 100 ? '#2ecc71' : '#f1c40f',
                    transition: 'all 0.3s ease'
                  }}
                />
              </div>
            </div>
            
            {hasRole(['admin', 'instandhalter']) && (
              <div>
                <button
                  onClick={handlePreviewAssignment}
                  disabled={!canPublish() || publishing}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: canPublish() ? '#2ecc71' : '#95a5a6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: canPublish() ? 'pointer' : 'not-allowed',
                    fontWeight: 'bold'
                  }}
                >
                  {publishing ? 'Berechne...' : 'Automatisch zuweisen & Veröffentlichen'}
                </button>
                
                {!canPublish() && (
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    {getAvailabilityStatus().percentage === 100 
                      ? 'Bereit zur Veröffentlichung' 
                      : `${getAvailabilityStatus().total - getAvailabilityStatus().completed} Mitarbeiter müssen noch Verfügbarkeit eintragen`}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assignment Preview Modal */}
      {showAssignmentPreview && assignmentResult && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '30px',
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h2>Wochenmuster-Zuordnung</h2>
            
            {/* Show weekly pattern info */}
            {assignmentResult.pattern && (
              <div style={{
                backgroundColor: '#e8f4fd',
                border: '1px solid #b8d4f0',
                borderRadius: '4px',
                padding: '15px',
                marginBottom: '20px'
              }}>
                <h4 style={{ color: '#2c3e50', marginTop: 0 }}>Wochenmuster erstellt</h4>
                <p style={{ margin: 0, color: '#2c3e50' }}>
                  Der Algorithmus hat ein Muster für <strong>{assignmentResult.pattern.weekShifts.length} Schichten</strong> in der ersten Woche erstellt 
                  und dieses für alle {Math.ceil(Object.keys(assignmentResult.assignments).length / assignmentResult.pattern.weekShifts.length)} Wochen im Plan wiederholt.
                </p>
                <div style={{ marginTop: '10px', fontSize: '14px' }}>
                  <strong>Wochenmuster-Statistik:</strong>
                  <div>- Schichten pro Woche: {assignmentResult.pattern.weekShifts.length}</div>
                  <div>- Zuweisungen pro Woche: {Object.values(assignmentResult.pattern.assignments).flat().length}</div>
                  <div>- Gesamtzuweisungen: {Object.values(assignmentResult.assignments).flat().length}</div>
                </div>
              </div>
            )}
            
            {assignmentResult.violations.length > 0 && (
              <div style={{
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '4px',
                padding: '15px',
                marginBottom: '20px'
              }}>
                <h4 style={{ color: '#856404', marginTop: 0 }}>Warnungen:</h4>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {assignmentResult.violations.map((violation, index) => (
                    <li key={index} style={{ color: '#856404', marginBottom: '5px' }}>
                      {violation}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <h4>Zusammenfassung:</h4>
              <p>
                {assignmentResult.success 
                  ? '✅ Alle Schichten können zugeordnet werden!' 
                  : '⚠️ Es gibt Probleme bei der Zuordnung die manuell behoben werden müssen.'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAssignmentPreview(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Abbrechen
              </button>
              
              <button
                onClick={handlePublish}
                disabled={publishing || !assignmentResult.success}
                style={{
                  padding: '8px 16px',
                  backgroundColor: assignmentResult.success ? '#2ecc71' : '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: assignmentResult.success ? 'pointer' : 'not-allowed'
                }}
              >
                {publishing ? 'Veröffentliche...' : 'Veröffentlichen'}
              </button>

              <button
                onClick={debugApiEndpoints}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f39c12',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginRight: '10px'
                }}
              >
                Test API Endpoints
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
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