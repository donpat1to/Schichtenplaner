// frontend/src/pages/Employees/components/AvailabilityManager.tsx
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
interface ExtendedTimeSlot extends TimeSlot {
  displayName?: string;
  source?: string;
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

  useEffect(() => {
    loadData();
  }, [employee.id]);

  useEffect(() => {
    if (selectedPlanId) {
      loadSelectedPlan();
    }
  }, [selectedPlanId]);

  const formatTime = (time: string): string => {
    if (!time) return '--:--';
    return time.substring(0, 5);
  };

  // Create a data structure that maps days to their actual time slots
  const getTimetableData = () => {
    if (!selectedPlan || !selectedPlan.shifts || !selectedPlan.timeSlots) {
      return { days: [], timeSlotsByDay: {} };
    }

    // Group shifts by day
    const shiftsByDay = selectedPlan.shifts.reduce((acc, shift) => {
      if (!acc[shift.dayOfWeek]) {
        acc[shift.dayOfWeek] = [];
      }
      acc[shift.dayOfWeek].push(shift);
      return acc;
    }, {} as Record<number, typeof selectedPlan.shifts>);

    // Get unique days that have shifts
    const days = Array.from(new Set(selectedPlan.shifts.map(shift => shift.dayOfWeek)))
      .sort()
      .map(dayId => {
        return daysOfWeek.find(day => day.id === dayId) || { id: dayId, name: `Tag ${dayId}` };
      });

    // For each day, get the time slots that actually have shifts
    const timeSlotsByDay: Record<number, ExtendedTimeSlot[]> = {};
    
    days.forEach(day => {
      const shiftsForDay = shiftsByDay[day.id] || [];
      const timeSlotIdsForDay = new Set(shiftsForDay.map(shift => shift.timeSlotId));
      
      timeSlotsByDay[day.id] = selectedPlan.timeSlots
        .filter(timeSlot => timeSlotIdsForDay.has(timeSlot.id))
        .map(timeSlot => ({
          ...timeSlot,
          displayName: `${timeSlot.name} (${formatTime(timeSlot.startTime)}-${formatTime(timeSlot.endTime)})`,
          source: `Plan: ${selectedPlan.name}`
        }))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    return { days, timeSlotsByDay };
  };

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔄 LADE DATEN FÜR MITARBEITER:', employee.id);
      
      // 1. Load availabilities
      let existingAvailabilities: Availability[] = [];
      try {
        const availabilitiesData = await employeeService.getAvailabilities(employee.id);
        existingAvailabilities = availabilitiesData.map(avail => ({
          ...avail,
          isAvailable: avail.preferenceLevel !== 3
        }));
        console.log('✅ VERFÜGBARKEITEN GELADEN:', existingAvailabilities.length);
      } catch (err) {
        console.log('⚠️ KEINE VERFÜGBARKEITEN GEFUNDEN ODER FEHLER:', err);
      }

      // 2. Load shift plans
      console.log('🔄 LADE SCHICHTPLÄNE...');
      const plans = await shiftPlanService.getShiftPlans();
      console.log('✅ SCHICHTPLÄNE GELADEN:', plans.length);

      setShiftPlans(plans);

      // 3. Select first plan with actual shifts if available
      if (plans.length > 0) {
        // Find a plan that actually has shifts and time slots
        const planWithShifts = plans.find(plan => 
          plan.shifts && plan.shifts.length > 0 && 
          plan.timeSlots && plan.timeSlots.length > 0
        ) || plans[0];
        
        setSelectedPlanId(planWithShifts.id);
        console.log('✅ SCHICHTPLAN AUSGEWÄHLT:', planWithShifts.name);
        
        // Load the selected plan to get its actual used time slots and days
        await loadSelectedPlan();
      }

      // 4. Set existing availabilities
      setAvailabilities(existingAvailabilities);

    } catch (err: any) {
      console.error('❌ FEHLER BEIM LADEN DER DATEN:', err);
      setError('Daten konnten nicht geladen werden: ' + (err.message || 'Unbekannter Fehler'));
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedPlan = async () => {
    try {
      console.log('🔄 LADE AUSGEWÄHLTEN SCHICHTPLAN:', selectedPlanId);
      const plan = await shiftPlanService.getShiftPlan(selectedPlanId);
      setSelectedPlan(plan);
      console.log('✅ SCHICHTPLAN GELADEN:', {
        name: plan.name,
        timeSlotsCount: plan.timeSlots?.length || 0,
        shiftsCount: plan.shifts?.length || 0,
        usedDays: Array.from(new Set(plan.shifts?.map(s => s.dayOfWeek) || [])).sort(),
        usedTimeSlots: Array.from(new Set(plan.shifts?.map(s => s.timeSlotId) || [])).length
      });
    } catch (err: any) {
      console.error('❌ FEHLER BEIM LADEN DES SCHICHTPLANS:', err);
      setError('Schichtplan konnte nicht geladen werden: ' + (err.message || 'Unbekannter Fehler'));
    }
  };

  const handleAvailabilityLevelChange = (dayId: number, timeSlotId: string, level: AvailabilityLevel) => {
    console.log(`🔄 ÄNDERE VERFÜGBARKEIT: Tag ${dayId}, Slot ${timeSlotId}, Level ${level}`);
    
    setAvailabilities(prev => {
      const existingIndex = prev.findIndex(avail => 
        avail.dayOfWeek === dayId && 
        avail.timeSlotId === timeSlotId
      );

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
        // Create new availability
        const newAvailability: Availability = {
          id: `temp-${dayId}-${timeSlotId}-${Date.now()}`,
          employeeId: employee.id,
          planId: selectedPlanId || '',
          dayOfWeek: dayId,
          timeSlotId: timeSlotId,
          preferenceLevel: level,
          isAvailable: level !== 3
        };
        return [...prev, newAvailability];
      }
    });
  };

  const getAvailabilityForDayAndSlot = (dayId: number, timeSlotId: string): AvailabilityLevel => {
    const availability = availabilities.find(avail => 
      avail.dayOfWeek === dayId && 
      avail.timeSlotId === timeSlotId
    );

    const result = availability?.preferenceLevel || 3;
    return result;
  };

  // Update the timetable rendering to use the new data structure
  const renderTimetable = () => {
    const { days, timeSlotsByDay } = getTimetableData();

    if (days.length === 0 || Object.keys(timeSlotsByDay).length === 0) {
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

    // Get all unique time slots across all days for row headers
    const allTimeSlotIds = new Set<string>();
    days.forEach(day => {
      timeSlotsByDay[day.id]?.forEach(timeSlot => {
        allTimeSlotIds.add(timeSlot.id);
      });
    });

    const allTimeSlots = Array.from(allTimeSlotIds)
      .map(id => selectedPlan?.timeSlots?.find(ts => ts.id === id))
      .filter(Boolean)
      .map(timeSlot => ({
        ...timeSlot!,
        displayName: `${timeSlot!.name} (${formatTime(timeSlot!.startTime)}-${formatTime(timeSlot!.endTime)})`,
        source: `Plan: ${selectedPlan!.name}`
      }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

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
                  minWidth: '100px'
                }}>
                  Schicht (Zeit)
                </th>
                {days.map(weekday => (
                  <th key={weekday.id} style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    border: '1px solid #dee2e6',
                    fontWeight: 'bold',
                    minWidth: '90px'
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
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                      {timeSlot.source}
                    </div>
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

                    const currentLevel = getAvailabilityForDayAndSlot(weekday.id, timeSlot.id);
                    const levelConfig = availabilityLevels.find(l => l.level === currentLevel);
                    
                    return (
                      <td key={weekday.id} style={{
                        padding: '12px 16px',
                        border: '1px solid #dee2e6',
                        textAlign: 'center',
                        backgroundColor: levelConfig?.bgColor
                      }}>
                        <select
                          value={currentLevel}
                          onChange={(e) => {
                            const newLevel = parseInt(e.target.value) as AvailabilityLevel;
                            handleAvailabilityLevelChange(weekday.id, timeSlot.id, newLevel);
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

      const { days, timeSlotsByDay } = getTimetableData();
      
      // Filter availabilities to only include those with actual shifts
      const validAvailabilities = availabilities.filter(avail => {
        const timeSlotsForDay = timeSlotsByDay[avail.dayOfWeek] || [];
        return timeSlotsForDay.some(slot => slot.id === avail.timeSlotId);
      });

      if (validAvailabilities.length === 0) {
        setError('Keine gültigen Verfügbarkeiten zum Speichern gefunden');
        return;
      }

      // Convert to the format expected by the API
      const requestData = {
        planId: selectedPlanId,
        availabilities: validAvailabilities.map(avail => ({
          planId: selectedPlanId,
          dayOfWeek: avail.dayOfWeek,
          timeSlotId: avail.timeSlotId,
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

  const { days, timeSlotsByDay } = getTimetableData();
  const allTimeSlotIds = new Set<string>();
  days.forEach(day => {
    timeSlotsByDay[day.id]?.forEach(timeSlot => {
      allTimeSlotIds.add(timeSlot.id);
    });
  });
  const timeSlotsCount = allTimeSlotIds.size;

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

      {/* Debug-Info */}
      <div style={{
        backgroundColor: timeSlotsCount === 0 ? '#f8d7da' : '#d1ecf1',
        border: `1px solid ${timeSlotsCount === 0 ? '#f5c6cb' : '#bee5eb'}`,
        borderRadius: '6px',
        padding: '15px',
        marginBottom: '20px'
      }}>
        <h4 style={{ 
          margin: '0 0 10px 0', 
          color: timeSlotsCount === 0 ? '#721c24' : '#0c5460' 
        }}>
          {timeSlotsCount === 0 ? '❌ PROBLEM: Keine Zeit-Slots gefunden' : '✅ Plan-Daten geladen'}
        </h4>
        <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
          <div><strong>Ausgewählter Plan:</strong> {selectedPlan?.name || 'Keiner'}</div>
          <div><strong>Verwendete Zeit-Slots:</strong> {timeSlotsCount}</div>
          <div><strong>Verwendete Tage:</strong> {days.length} ({days.map(d => d.name).join(', ')})</div>
          <div><strong>Gesamte Shifts im Plan:</strong> {selectedPlan?.shifts?.length || 0}</div>
        </div>
        
        {selectedPlan && selectedPlan.shifts && (
          <div style={{ marginTop: '10px' }}>
            <strong>Shifts im Plan:</strong>
            {selectedPlan.shifts.map((shift, index) => (
              <div key={index} style={{ fontSize: '11px', marginLeft: '10px' }}>
                • Tag {shift.dayOfWeek}: {shift.timeSlotId} ({shift.requiredEmployees} Personen)
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Employee Info */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#34495e' }}>
          {employee.name}
        </h3>
        <p style={{ margin: 0, color: '#7f8c8d' }}>
          Legen Sie die Verfügbarkeit für {employee.name} fest.
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
              onChange={(e) => setSelectedPlanId(e.target.value)}
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
                  {plan.name} {plan.timeSlots && `(${plan.timeSlots.length} Zeit-Slots)`}
                </option>
              ))}
            </select>
          </div>
          
          {selectedPlan && (
            <div style={{ fontSize: '14px', color: '#666' }}>
              <div><strong>Plan:</strong> {selectedPlan.name}</div>
              <div><strong>Zeit-Slots:</strong> {selectedPlan.timeSlots?.length || 0}</div>
              <div><strong>Status:</strong> {selectedPlan.status}</div>
            </div>
          )}
        </div>
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
          disabled={saving || timeSlotsCount === 0 || !selectedPlanId}
          style={{
            padding: '12px 24px',
            backgroundColor: saving ? '#bdc3c7' : (timeSlotsCount === 0 || !selectedPlanId ? '#95a5a6' : '#3498db'),
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: (saving || timeSlotsCount === 0 || !selectedPlanId) ? 'not-allowed' : 'pointer',
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