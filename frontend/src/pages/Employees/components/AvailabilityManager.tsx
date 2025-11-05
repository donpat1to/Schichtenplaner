import React, { useState, useEffect } from 'react';
import { employeeService } from '../../../services/employeeService';
import { shiftPlanService } from '../../../services/shiftPlanService';
import { Employee, EmployeeAvailability } from '../../../models/Employee';
import { ShiftPlan, TimeSlot, Shift } from '../../../models/ShiftPlan';
import { useNotification } from '../../../contexts/NotificationContext';
import { useBackendValidation } from '../../../hooks/useBackendValidation';

interface AvailabilityManagerProps {
  employee: Employee;
  onSave: () => void;
  onCancel: () => void;
}

// Local interface extensions
interface ExtendedShift extends Shift {
  timeSlotName?: string;
  startTime?: string;
  endTime?: string;
  displayName?: string;
}

interface Availability extends EmployeeAvailability {
  isAvailable?: boolean;
}

// Verfügbarkeits-Level
export type AvailabilityLevel = 1 | 2 | 3;

const AvailabilityManager: React.FC<AvailabilityManagerProps> = ({
  employee,
  onSave,
  onCancel
}) => {
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [shiftPlans, setShiftPlans] = useState<ShiftPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<ShiftPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showNotification } = useNotification();
  const { executeWithValidation, isSubmitting } = useBackendValidation();

  const daysOfWeek = [
    { id: 1, name: 'Montag' },
    { id: 2, name: 'Dienstag' },
    { id: 3, name: 'Mittwoch' },
    { id: 4, name: 'Donnerstag' },
    { id: 5, name: 'Freitag' },
    { id: 6, name: 'Samstag' },
    { id: 7, name: 'Sonntag' }
  ];

  const availabilityLevels = [
    { level: 1 as AvailabilityLevel, label: 'Bevorzugt', color: '#27ae60', bgColor: '#d5f4e6', description: 'Ideale Zeit' },
    { level: 2 as AvailabilityLevel, label: 'Möglich', color: '#f39c12', bgColor: '#fef5e7', description: 'Akzeptable Zeit' },
    { level: 3 as AvailabilityLevel, label: 'Nicht möglich', color: '#e74c3c', bgColor: '#fadbd8', description: 'Nicht verfügbar' }
  ];

  // Lade initial die Schichtpläne
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        console.log('🔄 LADE INITIALDATEN FÜR MITARBEITER:', employee.id);
        
        // 1. Lade alle Schichtpläne
        const plans = await shiftPlanService.getShiftPlans();
        console.log('✅ SCHICHTPLÄNE GELADEN:', plans.length);
        setShiftPlans(plans);

        // 2. Wähle ersten verfügbaren Plan aus
        if (plans.length > 0) {
          const planWithShifts = plans.find(plan => 
            plan.shifts && plan.shifts.length > 0 && 
            plan.timeSlots && plan.timeSlots.length > 0
          ) || plans[0];
          
          console.log('✅ ERSTER PLAN AUSGEWÄHLT:', planWithShifts.name);
          setSelectedPlanId(planWithShifts.id);
        } else {
          setLoading(false);
        }

      } catch (err: any) {
        console.error('❌ FEHLER BEIM LADEN DER INITIALDATEN:', err);
        showNotification({
          type: 'error',
          title: 'Fehler beim Laden',
          message: 'Daten konnten nicht geladen werden: ' + (err.message || 'Unbekannter Fehler')
        });
        setLoading(false);
      }
    };

    loadInitialData();
  }, [employee.id]);

  // Lade Plan-Details und Verfügbarkeiten wenn selectedPlanId sich ändert
  useEffect(() => {
    const loadPlanData = async () => {
      if (!selectedPlanId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('🔄 LADE PLAN-DATEN FÜR:', selectedPlanId);
        
        // 1. Lade Schichtplan Details
        const plan = await shiftPlanService.getShiftPlan(selectedPlanId);
        setSelectedPlan(plan);
        console.log('✅ SCHICHTPLAN DETAILS GELADEN:', {
          name: plan.name,
          timeSlotsCount: plan.timeSlots?.length || 0,
          shiftsCount: plan.shifts?.length || 0,
          usedDays: Array.from(new Set(plan.shifts?.map(s => s.dayOfWeek) || [])).sort()
        });

        // 2. Lade Verfügbarkeiten für DIESEN Mitarbeiter und DIESEN Plan
        console.log('🔄 LADE VERFÜGBARKEITEN FÜR:', {
          employeeId: employee.id,
          planId: selectedPlanId
        });

        try {
          const allAvailabilities = await employeeService.getAvailabilities(employee.id);
          console.log('📋 ALLE VERFÜGBARKEITEN DES MITARBEITERS:', allAvailabilities.length);
          
          // Filtere nach dem aktuellen Plan UND stelle sicher, dass shiftId vorhanden ist
          const planAvailabilities = allAvailabilities.filter(
            avail => avail.planId === selectedPlanId && avail.shiftId
          );
          
          console.log('✅ VERFÜGBARKEITEN FÜR DIESEN PLAN (MIT SHIFT-ID):', planAvailabilities.length);
          
          // Debug: Zeige auch ungültige Einträge
          const invalidAvailabilities = allAvailabilities.filter(
            avail => avail.planId === selectedPlanId && !avail.shiftId
          );
          if (invalidAvailabilities.length > 0) {
            console.warn('⚠️ UNGÜLTIGE VERFÜGBARKEITEN (OHNE SHIFT-ID):', invalidAvailabilities.length);
          }
          
          // Transformiere die Daten
          const transformedAvailabilities: Availability[] = planAvailabilities.map(avail => ({
            ...avail,
            isAvailable: avail.preferenceLevel !== 3
          }));
          
          setAvailabilities(transformedAvailabilities);

          // Debug: Zeige vorhandene Präferenzen
          if (planAvailabilities.length > 0) {
            console.log('🎯 VORHANDENE PRÄFERENZEN:', planAvailabilities.length);
          }
        } catch (availError) {
          console.error('❌ FEHLER BEIM LADEN DER VERFÜGBARKEITEN:', availError);
          setAvailabilities([]);
        }

      } catch (err: any) {
        console.error('❌ FEHLER BEIM LADEN DES SCHICHTPLANS:', err);
        showNotification({
          type: 'error',
          title: 'Fehler beim Laden',
          message: 'Schichtplan konnte nicht geladen werden: ' + (err.message || 'Unbekannter Fehler')
        });
      } finally {
        setLoading(false);
      }
    };

    loadPlanData();
  }, [selectedPlanId, employee.id]);

  const formatTime = (time: string): string => {
    if (!time) return '--:--';
    return time.substring(0, 5);
  };

  // Create a data structure that maps days to their shifts with time slot info
  const getTimetableData = () => {
    if (!selectedPlan || !selectedPlan.shifts || !selectedPlan.timeSlots) {
      return { days: [], shiftsByDay: {} };
    }

    // Create a map for quick time slot lookups
    const timeSlotMap = new Map(selectedPlan.timeSlots.map(ts => [ts.id, ts]));

    // Group shifts by day and enhance with time slot info
    const shiftsByDay = selectedPlan.shifts.reduce((acc, shift) => {
      if (!acc[shift.dayOfWeek]) {
        acc[shift.dayOfWeek] = [];
      }
      
      const timeSlot = timeSlotMap.get(shift.timeSlotId);
      const enhancedShift: ExtendedShift = {
        ...shift,
        timeSlotName: timeSlot?.name,
        startTime: timeSlot?.startTime,
        endTime: timeSlot?.endTime,
        displayName: timeSlot ? `${timeSlot.name} (${formatTime(timeSlot.startTime)}-${formatTime(timeSlot.endTime)})` : shift.id
      };
      
      acc[shift.dayOfWeek].push(enhancedShift);
      return acc;
    }, {} as Record<number, ExtendedShift[]>);

    // Sort shifts within each day by start time
    Object.keys(shiftsByDay).forEach(day => {
      shiftsByDay[parseInt(day)].sort((a, b) => {
        const timeA = a.startTime || '';
        const timeB = b.startTime || '';
        return timeA.localeCompare(timeB);
      });
    });

    // Get unique days that have shifts
    const days = Array.from(new Set(selectedPlan.shifts.map(shift => shift.dayOfWeek)))
      .sort()
      .map(dayId => {
        return daysOfWeek.find(day => day.id === dayId) || { id: dayId, name: `Tag ${dayId}` };
      });

    return { days, shiftsByDay };
  };

  const handleAvailabilityLevelChange = (shiftId: string, level: AvailabilityLevel) => {
    if (!shiftId) {
      console.error('❌ Versuch, Verfügbarkeit ohne Shift-ID zu ändern');
      return;
    }
    
    console.log(`🔄 ÄNDERE VERFÜGBARKEIT: Shift ${shiftId}, Level ${level}`);
    
    setAvailabilities(prev => {
      const existingIndex = prev.findIndex(avail => avail.shiftId === shiftId);

      if (existingIndex >= 0) {
        // Update existing availability
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          preferenceLevel: level,
          isAvailable: level !== 3
        };
        return updated;
      } else {
        // Create new availability using shiftId directly
        const newAvailability: Availability = {
          id: `temp-${shiftId}-${Date.now()}`,
          employeeId: employee.id,
          planId: selectedPlanId,
          shiftId: shiftId,
          preferenceLevel: level,
          isAvailable: level !== 3
        };
        return [...prev, newAvailability];
      }
    });
  };

  const getAvailabilityForShift = (shiftId: string): AvailabilityLevel => {
    const availability = availabilities.find(avail => avail.shiftId === shiftId);
    return availability?.preferenceLevel || 3;
  };

  // Update the timetable rendering to use shifts directly
  const renderTimetable = () => {
    const { days, shiftsByDay } = getTimetableData();

    if (days.length === 0 || Object.keys(shiftsByDay).length === 0) {
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
          <h4>Keine Shifts im ausgewählten Plan</h4>
          <p>Der ausgewählte Schichtplan hat keine Shifts definiert.</p>
        </div>
      );
    }

    // Create a map for quick time slot lookups
    const timeSlotMap = new Map(selectedPlan?.timeSlots?.map(ts => [ts.id, ts]) || []);

    // Get all unique time slots (rows) by collecting from all shifts
    const allTimeSlots = new Map();
    days.forEach(day => {
      shiftsByDay[day.id]?.forEach(shift => {
        const timeSlot = timeSlotMap.get(shift.timeSlotId);
        if (timeSlot && !allTimeSlots.has(timeSlot.id)) {
          allTimeSlots.set(timeSlot.id, {
            ...timeSlot,
            shiftsByDay: {} // Initialize empty object to store shifts by day
          });
        }
      });
    });

    // Populate shifts for each time slot by day
    days.forEach(day => {
      shiftsByDay[day.id]?.forEach(shift => {
        const timeSlot = allTimeSlots.get(shift.timeSlotId);
        if (timeSlot) {
          timeSlot.shiftsByDay[day.id] = shift;
        }
      });
    });

    // Convert to array and sort by start time
    const sortedTimeSlots = Array.from(allTimeSlots.values()).sort((a, b) => {
      // Convert time strings to minutes for proper numeric comparison
      const timeToMinutes = (timeStr: string) => {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };

      const minutesA = timeToMinutes(a.startTime);
      const minutesB = timeToMinutes(b.startTime);
      
      return minutesA - minutesB; // Ascending order (earliest first)
    });

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
          Verfügbarkeit definieren
          <div style={{ fontSize: '14px', fontWeight: 'normal', marginTop: '5px' }}>
            {sortedTimeSlots.length} Zeitslots • {days.length} Tage • Zeitbasierte Darstellung
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
                  minWidth: '120px'
                }}>
                  Zeitslot
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
              {sortedTimeSlots.map((timeSlot, timeSlotIndex) => (
                <tr key={timeSlot.id} style={{
                  backgroundColor: timeSlotIndex % 2 === 0 ? 'white' : '#f8f9fa'
                }}>
                  <td style={{
                    padding: '12px 16px',
                    border: '1px solid #dee2e6',
                    fontWeight: '500',
                    backgroundColor: '#f8f9fa',
                    position: 'sticky',
                    left: 0
                  }}>
                    <div style={{ fontWeight: 'bold' }}>
                      {timeSlot.name}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      {formatTime(timeSlot.startTime)} - {formatTime(timeSlot.endTime)}
                    </div>
                  </td>
                  {days.map(weekday => {
                    const shift = timeSlot.shiftsByDay[weekday.id];
                    
                    if (!shift) {
                      return (
                        <td key={weekday.id} style={{
                          padding: '12px 16px',
                          border: '1px solid #dee2e6',
                          textAlign: 'center',
                          backgroundColor: '#f8f9fa',
                          color: '#ccc',
                          fontStyle: 'italic'
                        }}>
                          Kein Shift
                        </td>
                      );
                    }

                    const currentLevel = getAvailabilityForShift(shift.id);
                    const levelConfig = availabilityLevels.find(l => l.level === currentLevel);
                    
                    return (
                      <td key={weekday.id} style={{
                        padding: '12px 16px',
                        border: '1px solid #dee2e6',
                        textAlign: 'center',
                        backgroundColor: levelConfig?.bgColor || 'white'
                      }}>
                        <select
                          value={currentLevel}
                          onChange={(e) => {
                            const newLevel = parseInt(e.target.value) as AvailabilityLevel;
                            handleAvailabilityLevelChange(shift.id, newLevel);
                          }}
                          style={{
                            padding: '8px 12px',
                            border: `2px solid ${levelConfig?.color || '#ddd'}`,
                            borderRadius: '6px',
                            backgroundColor: levelConfig?.bgColor || 'white',
                            color: levelConfig?.color || '#333',
                            fontWeight: 'bold',
                            minWidth: '140px',
                            cursor: 'pointer',
                            textAlign: 'center'
                          }}
                        >
                          {availabilityLevels.map(level => (
                            <option 
                              key={level.level} 
                              value={level.level}
                              style={{
                                backgroundColor: level.bgColor,
                                color: level.color,
                                fontWeight: 'bold'
                              }}
                            >
                              {level.level}: {level.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Statistics */}
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '15px',
          borderTop: '1px solid #dee2e6',
          fontSize: '12px',
          color: '#666'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>Aktive Verfügbarkeiten:</strong> {availabilities.filter(a => a.preferenceLevel !== 3).length}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleSave = async () => {
    if (!selectedPlanId) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Bitte wählen Sie einen Schichtplan aus'
      });
      return;
    }

    // Basic frontend validation: Check if we have any availabilities to save
    const validAvailabilities = availabilities.filter(avail => {
      return avail.shiftId && selectedPlan?.shifts?.some(shift => shift.id === avail.shiftId);
    });

    if (validAvailabilities.length === 0) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Keine gültigen Verfügbarkeiten zum Speichern gefunden'
      });
      return;
    }

    // Complex validation (contract type rules) is now handled by backend
    // We only do basic required field validation in frontend

    await executeWithValidation(async () => {
      setSaving(true);
      
      // Convert to the format expected by the API - using shiftId directly
      const requestData = {
        planId: selectedPlanId,
        availabilities: validAvailabilities.map(avail => ({
          planId: selectedPlanId,
          shiftId: avail.shiftId,
          preferenceLevel: avail.preferenceLevel,
          notes: avail.notes
        }))
      };
      
      await employeeService.updateAvailabilities(employee.id, requestData);
      console.log('✅ VERFÜGBARKEITEN ERFOLGREICH GESPEICHERT');

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Verfügbarkeiten wurden erfolgreich gespeichert'
      });

      window.dispatchEvent(new CustomEvent('availabilitiesChanged'));
      
      onSave();
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>⏳ Lade Verfügbarkeiten...</div>
      </div>
    );
  }

  const { days, shiftsByDay } = getTimetableData();
  const allShiftIds = new Set<string>();
  days.forEach(day => {
    shiftsByDay[day.id]?.forEach(shift => {
      allShiftIds.add(shift.id);
    });
  });
  const shiftsCount = allShiftIds.size;

  // Get full name for display
  const employeeFullName = `${employee.firstname} ${employee.lastname}`;

  // Available shifts count for display only (not for validation)
  const availableShiftsCount = availabilities.filter(avail => 
    avail.preferenceLevel === 1 || avail.preferenceLevel === 2
  ).length;

  return (
    <div style={{
      maxWidth: '1900px',
      margin: '0 auto',
      backgroundColor: 'white',
      padding: '30px',
      borderRadius: '8px',
      border: '1px solid #e0e0e0',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ 
        margin: '0 0 25px 0', 
        color: '#2c3e50',
        borderBottom: '2px solid #f0f0f0',
        paddingBottom: '15px'
      }}>
        📅 Verfügbarkeit verwalten
      </h2>

      {/* Employee Info */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#34495e' }}>
          {employeeFullName}
        </h3>
        <p style={{ margin: 0, color: '#7f8c8d' }}>
          <strong>Email:</strong> {employee.email}
        </p>
        {employee.contractType && (
          <p style={{ margin: '5px 0 0 0', color: employee.contractType === 'small' ? '#f39c12' : '#27ae60' }}>
            <strong>Vertrag:</strong> 
            {employee.contractType === 'small' ? ' Kleiner Vertrag' : 
            employee.contractType === 'large' ? ' Großer Vertrag' : 
            ' Flexibler Vertrag'}
            {/* Note: Contract validation is now handled by backend */}
          </p>
        )}
      </div>

      {/* Availability Legend */}
      <div style={{
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>
          Verfügbarkeits-Level
        </h4>
        
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {availabilityLevels.map(level => (
            <div key={level.level} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: level.bgColor,
                  border: `2px solid ${level.color}`,
                  borderRadius: '4px'
                }}
              />
              <div>
                <div style={{ fontWeight: 'bold', color: level.color }}>
                  {level.level}: {level.label}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {level.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shift Plan Selection */}
      <div style={{
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>
          Verfügbarkeit für Schichtplan
        </h4>
        
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2c3e50' }}>
              Schichtplan auswählen:
            </label>
            <select
              value={selectedPlanId}
              onChange={(e) => {
                const newPlanId = e.target.value;
                console.log('🔄 PLAN WECHSELN ZU:', newPlanId);
                setSelectedPlanId(newPlanId);
              }}
              style={{
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                minWidth: '250px'
              }}
            >
              <option value="">Bitte auswählen...</option>
              {shiftPlans.map(plan => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} {plan.shifts && `(${plan.shifts.length} Shifts)`}
                </option>
              ))}
            </select>
          </div>
          
          {selectedPlan && (
            <div style={{ fontSize: '14px', color: '#666' }}>
              <div><strong>Plan:</strong> {selectedPlan.name}</div>
              <div><strong>Shifts:</strong> {selectedPlan.shifts?.length || 0}</div>
              <div><strong>Zeitslots:</strong> {selectedPlan.timeSlots?.length || 0}</div>
              <div><strong>Status:</strong> {selectedPlan.status}</div>
            </div>
          )}
        </div>

        {/* Debug Info für Plan Loading */}
        {!selectedPlanId && shiftPlans.length > 0 && (
          <div style={{
            marginTop: '10px',
            padding: '10px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            ⚠️ Bitte wählen Sie einen Schichtplan aus
          </div>
        )}
      </div>

      {/* Availability Timetable */}
      {renderTimetable()}

      {/* Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '15px', 
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          style={{
            padding: '12px 24px',
            backgroundColor: '#95a5a6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.6 : 1
          }}
        >
          Abbrechen
        </button>
        
        <button
          onClick={handleSave}
          disabled={isSubmitting || shiftsCount === 0 || !selectedPlanId}
          style={{
            padding: '12px 24px',
            backgroundColor: isSubmitting ? '#bdc3c7' : (shiftsCount === 0 || !selectedPlanId ? '#95a5a6' : '#3498db'),
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: (isSubmitting || shiftsCount === 0 || !selectedPlanId) ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {isSubmitting ? '⏳ Wird gespeichert...' : `Verfügbarkeiten speichern (${availableShiftsCount})`}
        </button>
      </div>
    </div>
  );
};

export default AvailabilityManager;