import React, { useState, useEffect } from 'react';
import { employeeService } from '../../../services/employeeService';
import { shiftPlanService } from '../../../services/shiftPlanService';
import { Employee, EmployeeAvailability } from '../../../models/Employee';
import { ShiftPlan, TimeSlot, Shift } from '../../../models/ShiftPlan';

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
  const [error, setError] = useState('');

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
        setError('Daten konnten nicht geladen werden: ' + (err.message || 'Unbekannter Fehler'));
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
            invalidAvailabilities.forEach(invalid => {
              console.warn('   - Ungültiger Eintrag:', invalid);
            });
          }
          
          // Transformiere die Daten
          const transformedAvailabilities: Availability[] = planAvailabilities.map(avail => ({
            ...avail,
            isAvailable: avail.preferenceLevel !== 3
          }));
          
          setAvailabilities(transformedAvailabilities);

          // Debug: Zeige vorhandene Präferenzen
          if (planAvailabilities.length > 0) {
            console.log('🎯 VORHANDENE PRÄFERENZEN:');
            planAvailabilities.forEach(avail => {
              const shift = plan.shifts?.find(s => s.id === avail.shiftId);
              console.log(`   - Shift: ${avail.shiftId} (Day: ${shift?.dayOfWeek}), Level: ${avail.preferenceLevel}`);
            });
          }
      } catch (availError) {
        console.error('❌ FEHLER BEIM LADEN DER VERFÜGBARKEITEN:', availError);
        setAvailabilities([]);
      }

      } catch (err: any) {
        console.error('❌ FEHLER BEIM LADEN DES SCHICHTPLANS:', err);
        setError('Schichtplan konnte nicht geladen werden: ' + (err.message || 'Unbekannter Fehler'));
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
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

    // Validation: Check if shifts are correctly placed
    const validationErrors: string[] = [];
    
    // Check for missing time slots
    const usedTimeSlotIds = new Set(selectedPlan?.shifts?.map(s => s.timeSlotId) || []);
    const availableTimeSlotIds = new Set(selectedPlan?.timeSlots?.map(ts => ts.id) || []);
    
    usedTimeSlotIds.forEach(timeSlotId => {
      if (!availableTimeSlotIds.has(timeSlotId)) {
        validationErrors.push(`Zeitslot ${timeSlotId} wird verwendet, existiert aber nicht in timeSlots`);
      }
    });

    // Check for shifts with invalid day numbers
    selectedPlan?.shifts?.forEach(shift => {
      if (shift.dayOfWeek < 1 || shift.dayOfWeek > 7) {
        validationErrors.push(`Shift ${shift.id} hat ungültigen Wochentag: ${shift.dayOfWeek}`);
      }
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

        {/* Validation Warnings */}
        {validationErrors.length > 0 && (
          <div style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            padding: '15px',
            margin: '10px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>⚠️ Validierungswarnungen:</h4>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px' }}>
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

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
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                      ID: {timeSlot.id.substring(0, 8)}...
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

                    // Validation: Check if shift has correct timeSlotId and dayOfWeek
                    const isValidShift = shift.timeSlotId === timeSlot.id && shift.dayOfWeek === weekday.id;
                    
                    const currentLevel = getAvailabilityForShift(shift.id);
                    const levelConfig = availabilityLevels.find(l => l.level === currentLevel);
                    
                    return (
                      <td key={weekday.id} style={{
                        padding: '12px 16px',
                        border: '1px solid #dee2e6',
                        textAlign: 'center',
                        backgroundColor: !isValidShift ? '#fff3cd' : (levelConfig?.bgColor || 'white'),
                        position: 'relative'
                      }}>
                        {/* Validation indicator */}
                        {!isValidShift && (
                          <div style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            backgroundColor: '#f39c12',
                            color: 'white',
                            borderRadius: '50%',
                            width: '16px',
                            height: '16px',
                            fontSize: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title={`Shift Validierung: timeSlotId=${shift.timeSlotId}, dayOfWeek=${shift.dayOfWeek}`}
                          >
                            ⚠️
                          </div>
                        )}

                        <select
                          value={currentLevel}
                          onChange={(e) => {
                            const newLevel = parseInt(e.target.value) as AvailabilityLevel;
                            handleAvailabilityLevelChange(shift.id, newLevel);
                          }}
                          style={{
                            padding: '8px 12px',
                            border: `2px solid ${!isValidShift ? '#f39c12' : (levelConfig?.color || '#ddd')}`,
                            borderRadius: '6px',
                            backgroundColor: !isValidShift ? '#fff3cd' : (levelConfig?.bgColor || 'white'),
                            color: !isValidShift ? '#856404' : (levelConfig?.color || '#333'),
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

                        {/* Shift debug info */}
                        <div style={{ 
                          fontSize: '10px', 
                          color: '#666', 
                          marginTop: '4px',
                          textAlign: 'left',
                          fontFamily: 'monospace'
                        }}>
                          <div>Shift: {shift.id.substring(0, 6)}...</div>
                          <div>Day: {shift.dayOfWeek}</div>
                          {!isValidShift && (
                            <div style={{ color: '#e74c3c', fontWeight: 'bold' }}>
                              VALIDATION ERROR
                            </div>
                          )}
                        </div>
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
    try {
      setSaving(true);
      setError('');
      
      if (!selectedPlanId) {
        setError('Bitte wählen Sie einen Schichtplan aus');
        return;
      }

      // Filter availabilities to only include those with actual shifts AND valid shiftIds
      const validAvailabilities = availabilities.filter(avail => {
        // Check if this shiftId exists and is valid
        if (!avail.shiftId) {
          console.warn('⚠️ Überspringe ungültige Verfügbarkeit ohne Shift-ID:', avail);
          return false;
        }
        
        // Check if this shiftId exists in the current plan
        return selectedPlan?.shifts?.some(shift => shift.id === avail.shiftId);
      });

      console.log('💾 SPEICHERE VERFÜGBARKEITEN:', {
        total: availabilities.length,
        valid: validAvailabilities.length,
        invalid: availabilities.length - validAvailabilities.length
      });

      if (validAvailabilities.length === 0) {
        setError('Keine gültigen Verfügbarkeiten zum Speichern gefunden');
        return;
      }

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

      window.dispatchEvent(new CustomEvent('availabilitiesChanged'));
      
      onSave();
    } catch (err: any) {
      console.error('❌ FEHLER BEIM SPEICHERN:', err);
      setError(err.message || 'Fehler beim Speichern der Verfügbarkeiten');
    } finally {
      setSaving(false);
    }
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
      </div>

      {error && (
        <div style={{
          backgroundColor: '#fee',
          border: '1px solid #f5c6cb',
          color: '#721c24',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          <strong>Fehler:</strong> {error}
        </div>
      )}

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
                // Der useEffect wird automatisch ausgelöst
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
          disabled={saving}
          style={{
            padding: '12px 24px',
            backgroundColor: '#95a5a6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1
          }}
        >
          Abbrechen
        </button>
        
        <button
          onClick={handleSave}
          disabled={saving || shiftsCount === 0 || !selectedPlanId}
          style={{
            padding: '12px 24px',
            backgroundColor: saving ? '#bdc3c7' : (shiftsCount === 0 || !selectedPlanId ? '#95a5a6' : '#3498db'),
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: (saving || shiftsCount === 0 || !selectedPlanId) ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {saving ? '⏳ Wird gespeichert...' : 'Verfügbarkeiten speichern'}
        </button>
      </div>
    </div>
  );
};

export default AvailabilityManager;