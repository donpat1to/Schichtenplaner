// frontend/src/pages/ShiftPlans/ShiftPlanView.tsx - UPDATED
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { shiftPlanService } from '../../services/shiftPlanService';
import { employeeService } from '../../services/employeeService';
import { shiftAssignmentService, ShiftAssignmentService } from '../../services/shiftAssignmentService';
import { AssignmentResult } from '../../services/scheduling';
import { ShiftPlan, TimeSlot } from '../../models/ShiftPlan';
import { Employee, EmployeeAvailability } from '../../models/Employee';
import { useNotification } from '../../contexts/NotificationContext';
import { formatDate, formatTime } from '../../utils/foramatters';

// Local interface extensions (same as AvailabilityManager)
interface ExtendedTimeSlot extends TimeSlot {
  displayName?: string;
}

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
  const [reverting, setReverting] = useState(false);
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

  // Extract plan-specific shifts using the same logic as AvailabilityManager
  const getTimetableData = () => {
    if (!shiftPlan || !shiftPlan.shifts || !shiftPlan.timeSlots) {
      return { days: [], timeSlotsByDay: {}, allTimeSlots: [] };
    }

    // Group shifts by day
    const shiftsByDay = shiftPlan.shifts.reduce((acc, shift) => {
      if (!acc[shift.dayOfWeek]) {
        acc[shift.dayOfWeek] = [];
      }
      acc[shift.dayOfWeek].push(shift);
      return acc;
    }, {} as Record<number, typeof shiftPlan.shifts>);

    // Get unique days that have shifts
    const days = Array.from(new Set(shiftPlan.shifts.map(shift => shift.dayOfWeek)))
      .sort()
      .map(dayId => {
        return weekdays.find(day => day.id === dayId) || { id: dayId, name: `Tag ${dayId}` };
      });

    // For each day, get the time slots that actually have shifts
    const timeSlotsByDay: Record<number, ExtendedTimeSlot[]> = {};
    
    days.forEach(day => {
      const shiftsForDay = shiftsByDay[day.id] || [];
      const timeSlotIdsForDay = new Set(shiftsForDay.map(shift => shift.timeSlotId));
      
      timeSlotsByDay[day.id] = shiftPlan.timeSlots
        .filter(timeSlot => timeSlotIdsForDay.has(timeSlot.id))
        .map(timeSlot => ({
          ...timeSlot,
          displayName: `${timeSlot.name} (${formatTime(timeSlot.startTime)}-${formatTime(timeSlot.endTime)})`
        }))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    // Get all unique time slots across all days for row headers
    const allTimeSlotIds = new Set<string>();
    days.forEach(day => {
      timeSlotsByDay[day.id]?.forEach(timeSlot => {
        allTimeSlotIds.add(timeSlot.id);
      });
    });

    const allTimeSlots = Array.from(allTimeSlotIds)
      .map(timeSlotId => shiftPlan.timeSlots.find(ts => ts.id === timeSlotId))
      .filter(Boolean)
      .map(timeSlot => ({
        ...timeSlot!,
        displayName: `${timeSlot!.name} (${formatTime(timeSlot!.startTime)}-${formatTime(timeSlot!.endTime)})`
      }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    return { days, timeSlotsByDay, allTimeSlots };
  };

  const getDayOfWeek = (dateString: string): number => {
    const date = new Date(dateString);
    return date.getDay() === 0 ? 7 : date.getDay();
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

      // Zeige Reparatur-Bericht in der Konsole
      if (result.resolutionReport) {
        console.log('🔧 Reparatur-Bericht:');
        result.resolutionReport.forEach(line => console.log(line));
      }

      // Verwende allProblemsResolved für die Erfolgsmeldung
      if (result.allProblemsResolved) {
        showNotification({
          type: 'success',
          title: 'Erfolg', 
          message: 'Alle kritischen Probleme wurden behoben! Der Schichtplan kann veröffentlicht werden.'
        });
      } else {
        const criticalCount = result.violations.filter(v => v.includes('❌ KRITISCH:')).length;
        const warningCount = result.violations.filter(v => v.includes('⚠️')).length;
        
        showNotification({
          type: warningCount > 0 ? 'warning' : 'error',
          title: criticalCount > 0 ? 'Kritische Probleme' : 'Warnungen',
          message: criticalCount > 0 
            ? `${criticalCount} kritische Probleme müssen behoben werden`
            : `${warningCount} Warnungen - Plan kann trotzdem veröffentlicht werden`
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
          await shiftAssignmentService.getScheduledShift(scheduledShift.id);
          
          // Then update it
          await shiftAssignmentService.updateScheduledShift(scheduledShift.id, {
            assignedEmployees
          });
          
          console.log(`✅ Successfully updated shift ${scheduledShift.id}`);
        } catch (error) {
          console.error(`❌ Failed to update shift ${scheduledShift.id}:`, error);
          throw error;
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

  const handleRevertToDraft = async () => {
    if (!shiftPlan || !id) return;

    if (!window.confirm('Möchten Sie diesen Schichtplan wirklich zurück in den Entwurfsstatus setzen? Alle Zuweisungen werden entfernt.')) {
      return;
    }

    try {
      setReverting(true);
      
      const updatedPlan = await shiftPlanService.revertToDraft(id);
      setShiftPlan(updatedPlan);
      setAssignmentResult(null);

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Schichtplan wurde erfolgreich zurück in den Entwurfsstatus gesetzt.'
      });

    } catch (error) {
      console.error('Error reverting plan to draft:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Schichtplan konnte nicht zurückgesetzt werden.'
      });
    } finally {
      setReverting(false);
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

  // Render timetable using the same structure as AvailabilityManager
  const renderTimetable = () => {
    const { days, allTimeSlots, timeSlotsByDay } = getTimetableData();

    if (days.length === 0 || allTimeSlots.length === 0) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          color: '#6c757d',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📅</div>
          <h4>Keine Shifts im Plan definiert</h4>
          <p>Der Schichtplan hat keine Shifts definiert oder keine Zeit-Slots konfiguriert.</p>
        </div>
      );
    }

    return (
      <div style={{
        marginBottom: '30px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <div style={{
          backgroundColor: '#2c3e50',
          color: 'white',
          padding: '15px 20px',
          fontWeight: 'bold'
        }}>
          Schichtplan
          <div style={{ fontSize: '14px', fontWeight: 'normal', marginTop: '5px' }}>
            {allTimeSlots.length} Schichttypen • {days.length} Tage • Nur tatsächlich im Plan verwendete Schichten
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
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
                {days.map(weekday => (
                  <th key={weekday.id} style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    border: '1px solid #dee2e6',
                    fontWeight: 'bold',
                    minWidth: '120px'
                  }}>
                    {weekday.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allTimeSlots.map((timeSlot, timeIndex) => (
                <tr key={timeSlot.id} style={{
                  backgroundColor: timeIndex % 2 === 0 ? 'white' : '#f8f9fa'
                }}>
                  <td style={{
                    padding: '12px 16px',
                    border: '1px solid #dee2e6',
                    fontWeight: '500',
                    backgroundColor: '#f8f9fa'
                  }}>
                    {timeSlot.displayName}
                  </td>
                  {days.map(weekday => {
                    // Check if this time slot exists for this day
                    const timeSlotForDay = timeSlotsByDay[weekday.id]?.find(ts => ts.id === timeSlot.id);
                    
                    if (!timeSlotForDay) {
                      return (
                        <td key={weekday.id} style={{
                          padding: '12px 16px',
                          border: '1px solid #dee2e6',
                          textAlign: 'center',
                          backgroundColor: '#f8f9fa',
                          color: '#ccc',
                          fontStyle: 'italic'
                        }}>
                          -
                        </td>
                      );
                    }

                    // Get assigned employees for this shift
                    let assignedEmployees: string[] = [];
                    let displayText = '';
                    
                    if (shiftPlan?.status === 'published' && shiftPlan.scheduledShifts) {
                      // For published plans, use actual assignments from scheduled shifts
                      const scheduledShift = shiftPlan.scheduledShifts.find(scheduled => {
                        const scheduledDayOfWeek = getDayOfWeek(scheduled.date);
                        return scheduledDayOfWeek === weekday.id && 
                               scheduled.timeSlotId === timeSlot.id;
                      });
                      
                      if (scheduledShift) {
                        assignedEmployees = scheduledShift.assignedEmployees || [];
                        displayText = assignedEmployees.map(empId => {
                          const employee = employees.find(emp => emp.id === empId);
                          return employee ? employee.name : 'Unbekannt';
                        }).join(', ');
                      }
                    } else if (assignmentResult) {
                      // For draft with preview, use assignment result
                      const scheduledShift = shiftPlan?.scheduledShifts?.find(scheduled => {
                        const scheduledDayOfWeek = getDayOfWeek(scheduled.date);
                        return scheduledDayOfWeek === weekday.id && 
                               scheduled.timeSlotId === timeSlot.id;
                      });
                      
                      if (scheduledShift && assignmentResult.assignments[scheduledShift.id]) {
                        assignedEmployees = assignmentResult.assignments[scheduledShift.id];
                        displayText = assignedEmployees.map(empId => {
                          const employee = employees.find(emp => emp.id === empId);
                          return employee ? employee.name : 'Unbekannt';
                        }).join(', ');
                      }
                    }

                    // If no assignments yet, show required count
                    if (!displayText) {
                      const shiftsForSlot = shiftPlan?.shifts?.filter(shift => 
                        shift.dayOfWeek === weekday.id && 
                        shift.timeSlotId === timeSlot.id
                      ) || [];
                      
                      const totalRequired = shiftsForSlot.reduce((sum, shift) => 
                        sum + shift.requiredEmployees, 0);
                      
                      displayText = `0/${totalRequired}`;
                    }

                    return (
                      <td key={weekday.id} style={{
                        padding: '12px 16px',
                        border: '1px solid #dee2e6',
                        textAlign: 'center',
                        backgroundColor: assignedEmployees.length > 0 ? '#e8f5e8' : 'transparent',
                        color: assignedEmployees.length > 0 ? '#2c3e50' : '#666',
                        fontSize: assignedEmployees.length > 0 ? '14px' : 'inherit'
                      }}>
                        {displayText}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) return <div>Lade Schichtplan...</div>;
  if (!shiftPlan) return <div>Schichtplan nicht gefunden</div>;

  const availabilityStatus = getAvailabilityStatus();
  const { days, allTimeSlots } = getTimetableData();

  return (
    <div style={{ padding: '20px' }}>
      {/* Header with Plan Information and Actions */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '20px'
      }}>
        <div>
          <h1>{shiftPlan.name}</h1>
          <p style={{ color: '#666', margin: 0 }}>
            {shiftPlan.startDate && shiftPlan.endDate && 
              `Zeitraum: ${formatDate(shiftPlan.startDate)} - ${formatDate(shiftPlan.endDate)}`
            }
          </p>
          <div style={{ 
            display: 'inline-block',
            padding: '4px 12px',
            backgroundColor: shiftPlan.status === 'published' ? '#2ecc71' : '#f1c40f',
            color: 'white',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: 'bold',
            marginTop: '5px'
          }}>
            {shiftPlan.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {shiftPlan.status === 'published' && hasRole(['admin', 'instandhalter']) && (
            <button
              onClick={handleRevertToDraft}
              disabled={reverting}
              style={{
                padding: '10px 20px',
                backgroundColor: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {reverting ? 'Zurücksetzen...' : 'Zu Entwurf zurücksetzen'}
            </button>
          )}
          <button
            onClick={() => navigate('/shift-plans')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Zurück zur Übersicht
          </button>
        </div>
      </div>

      {/* Availability Status - only show for drafts */}
      {shiftPlan.status === 'draft' && (
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
                {availabilityStatus.completed} / {availabilityStatus.total} Mitarbeiter
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
                    width: `${availabilityStatus.percentage}%`,
                    height: '100%',
                    backgroundColor: availabilityStatus.percentage === 100 ? '#2ecc71' : '#f1c40f',
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
                    {availabilityStatus.percentage === 100 
                      ? 'Bereit zur Veröffentlichung' 
                      : `${availabilityStatus.total - availabilityStatus.completed} Mitarbeiter müssen noch Verfügbarkeit eintragen`}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Plan Structure Info */}
          <div style={{
            backgroundColor: '#e8f4fd',
            border: '1px solid #b8d4f0',
            borderRadius: '4px',
            padding: '12px 16px',
            fontSize: '14px'
          }}>
            <strong>Plan-Struktur:</strong> {allTimeSlots.length} Schichttypen an {days.length} Tagen
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
          
          {/* Reparatur-Bericht anzeigen */}
          {assignmentResult.resolutionReport && (
            <div style={{
              backgroundColor: '#e8f4fd',
              border: '1px solid #b8d4f0',
              borderRadius: '4px',
              padding: '15px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              <h4 style={{ color: '#2c3e50', marginTop: 0 }}>Reparatur-Bericht</h4>
              <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                {assignmentResult.resolutionReport.map((line, index) => (
                  <div key={index} style={{ 
                    color: line.includes('✅') ? '#2ecc71' : line.includes('❌') ? '#e74c3c' : '#2c3e50',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    marginBottom: '2px'
                  }}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
            
            {assignmentResult && (
              <div style={{ marginBottom: '20px' }}>
                <h4>Zusammenfassung:</h4>
                {assignmentResult.allProblemsResolved ? (
                  <p style={{ color: '#2ecc71', fontWeight: 'bold' }}>
                    ✅ Alle kritischen Probleme behoben! Der Plan kann veröffentlicht werden.
                  </p>
                ) : (
                  <div>
                    <p style={{ color: '#e74c3c', fontWeight: 'bold' }}>
                      ❌ Es gibt kritische Probleme die behoben werden müssen:
                    </p>
                    <ul>
                      {assignmentResult.violations
                        .filter(v => v.includes('❌ KRITISCH:'))
                        .map((violation, index) => (
                          <li key={index} style={{ color: '#e74c3c', fontSize: '14px' }}>
                            {violation.replace('❌ KRITISCH: ', '')}
                          </li>
                        ))}
                    </ul>
                    {assignmentResult.violations.some(v => v.includes('⚠️')) && (
                      <div style={{ marginTop: '10px' }}>
                        <p style={{ color: '#f39c12', fontWeight: 'bold' }}>
                          ⚠️ Warnungen (beeinflussen nicht die Veröffentlichung):
                        </p>
                        <ul>
                          {assignmentResult.violations
                            .filter(v => v.includes('⚠️'))
                            .map((warning, index) => (
                              <li key={index} style={{ color: '#f39c12', fontSize: '14px' }}>
                                {warning.replace('⚠️ WARNHINWEIS: ', '')}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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
                disabled={publishing || !assignmentResult.allProblemsResolved}
                style={{
                  padding: '8px 16px',
                  backgroundColor: assignmentResult.allProblemsResolved ? '#2ecc71' : '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: assignmentResult.allProblemsResolved ? 'pointer' : 'not-allowed'
                }}
              >
                {publishing ? 'Veröffentliche...' : 'Veröffentlichen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timetable */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3>
          Schichtplan 
          {shiftPlan.status === 'published' && ' (Aktuelle Zuweisungen)'}
          {assignmentResult && shiftPlan.status === 'draft' && ' (Exemplarische Woche)'}
        </h3>
        
        {renderTimetable()}

        {/* Summary */}
        {days.length > 0 && (
          <div style={{
            marginTop: '20px',
            padding: '12px 16px',
            backgroundColor: shiftPlan.status === 'published' ? '#d4edda' : '#e8f4fd',
            borderRadius: '4px',
            border: shiftPlan.status === 'published' ? '1px solid #c3e6cb' : '1px solid #b8d4f0',
            fontSize: '14px'
          }}>
            <strong>Legende:</strong> {
              shiftPlan.status === 'published' 
                ? 'Angezeigt werden die aktuell zugewiesenen Mitarbeiter'
                : assignmentResult
                ? 'Angezeigt werden die vorgeschlagenen Mitarbeiter für eine exemplarische Woche'
                : 'Angezeigt wird "zugewiesene/benötigte Mitarbeiter" pro Schicht und Wochentag'
            }
          </div>
        )}
      </div>
    </div>
  );
};

export default ShiftPlanView;