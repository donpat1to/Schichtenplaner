// frontend/src/pages/Employees/components/AvailabilityManager.tsx
import React, { useState, useEffect } from 'react';
import { Employee, Availability } from '../../../types/employee';
import { employeeService } from '../../../services/employeeService';
import { shiftPlanService, ShiftPlan, ShiftPlanShift } from '../../../services/shiftPlanService';

interface AvailabilityManagerProps {
  employee: Employee;
  onSave: () => void;
  onCancel: () => void;
}

// Verfügbarkeits-Level
export type AvailabilityLevel = 1 | 2 | 3; // 1: bevorzugt, 2: möglich, 3: nicht möglich

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
    { id: 0, name: 'Sonntag' }
  ];

  // Verfügbarkeits-Level mit Farben und Beschreibungen
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

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load availabilities
      try {
        const availData = await employeeService.getAvailabilities(employee.id);
        setAvailabilities(availData);
      } catch (err) {
        // Falls keine Verfügbarkeiten existieren, erstelle Standard-Einträge (Level 3: nicht möglich)
        const defaultAvailabilities: Availability[] = daysOfWeek.flatMap(day => [
          {
            id: `temp-${day.id}-morning`,
            employeeId: employee.id,
            dayOfWeek: day.id,
            startTime: '08:00',
            endTime: '12:00',
            isAvailable: false,
            availabilityLevel: 3 as AvailabilityLevel
          },
          {
            id: `temp-${day.id}-afternoon`,
            employeeId: employee.id,
            dayOfWeek: day.id,
            startTime: '12:00',
            endTime: '16:00',
            isAvailable: false,
            availabilityLevel: 3 as AvailabilityLevel
          },
          {
            id: `temp-${day.id}-evening`,
            employeeId: employee.id,
            dayOfWeek: day.id,
            startTime: '16:00',
            endTime: '20:00',
            isAvailable: false,
            availabilityLevel: 3 as AvailabilityLevel
          }
        ]);
        setAvailabilities(defaultAvailabilities);
      }

      // Load shift plans
      const plans = await shiftPlanService.getShiftPlans();
      setShiftPlans(plans);

      // Auto-select the first published plan or the first draft
      if (plans.length > 0) {
        const publishedPlan = plans.find(plan => plan.status === 'published');
        const firstPlan = publishedPlan || plans[0];
        setSelectedPlanId(firstPlan.id);
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError('Daten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedPlan = async () => {
    try {
      const plan = await shiftPlanService.getShiftPlan(selectedPlanId);
      setSelectedPlan(plan);
    } catch (err: any) {
      console.error('Error loading shift plan:', err);
      setError('Schichtplan konnte nicht geladen werden');
    }
  };

  const handleAvailabilityLevelChange = (dayId: number, timeSlot: string, level: AvailabilityLevel) => {
    setAvailabilities(prev =>
      prev.map(avail =>
        avail.dayOfWeek === dayId && getTimeSlotName(avail.startTime, avail.endTime) === timeSlot
          ? { 
              ...avail, 
              availabilityLevel: level,
              isAvailable: level !== 3
            }
          : avail
      )
    );
  };

  const getTimeSlotName = (startTime: string, endTime: string): string => {
    if (startTime === '08:00' && endTime === '12:00') return 'Vormittag';
    if (startTime === '12:00' && endTime === '16:00') return 'Nachmittag';
    if (startTime === '16:00' && endTime === '20:00') return 'Abend';
    return `${startTime}-${endTime}`;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      
      await employeeService.updateAvailabilities(employee.id, availabilities);
      onSave();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern der Verfügbarkeiten');
    } finally {
      setSaving(false);
    }
  };

  // Get availability level for a specific shift
  const getAvailabilityForShift = (shift: ShiftPlanShift): AvailabilityLevel => {
    const shiftDate = new Date(shift.date);
    const dayOfWeek = shiftDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Find matching availability for this day and time
    const matchingAvailabilities = availabilities.filter(avail => 
      avail.dayOfWeek === dayOfWeek &&
      avail.availabilityLevel !== 3 && // Nur Level 1 und 2 berücksichtigen
      isTimeOverlap(avail.startTime, avail.endTime, shift.startTime, shift.endTime)
    );
    
    if (matchingAvailabilities.length === 0) {
      return 3; // Nicht möglich, wenn keine Übereinstimmung
    }
    
    // Nehme das beste (niedrigste) Verfügbarkeits-Level
    const minLevel = Math.min(...matchingAvailabilities.map(avail => avail.availabilityLevel));
    return minLevel as AvailabilityLevel;
  };

  // Helper function to check time overlap
  const isTimeOverlap = (availStart: string, availEnd: string, shiftStart: string, shiftEnd: string): boolean => {
    const availStartMinutes = timeToMinutes(availStart);
    const availEndMinutes = timeToMinutes(availEnd);
    const shiftStartMinutes = timeToMinutes(shiftStart);
    const shiftEndMinutes = timeToMinutes(shiftEnd);
    
    return shiftStartMinutes < availEndMinutes && shiftEndMinutes > availStartMinutes;
  };

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Group shifts by weekday for timetable display
  const getTimetableData = () => {
    if (!selectedPlan) return { shiftsByDay: {}, weekdays: [] };

    const shiftsByDay: Record<number, ShiftPlanShift[]> = {};
    
    // Initialize empty arrays for each day
    daysOfWeek.forEach(day => {
      shiftsByDay[day.id] = [];
    });

    // Group shifts by weekday
    selectedPlan.shifts.forEach(shift => {
      const shiftDate = new Date(shift.date);
      const dayOfWeek = shiftDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      shiftsByDay[dayOfWeek].push(shift);
    });

    // Remove duplicate shifts (same name and time on same day)
    Object.keys(shiftsByDay).forEach(day => {
      const dayNum = parseInt(day);
      const uniqueShifts: ShiftPlanShift[] = [];
      const seen = new Set();
      
      shiftsByDay[dayNum].forEach(shift => {
        const key = `${shift.name}|${shift.startTime}|${shift.endTime}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueShifts.push(shift);
        }
      });
      
      shiftsByDay[dayNum] = uniqueShifts;
    });

    return {
      shiftsByDay,
      weekdays: daysOfWeek
    };
  };

  const timetableData = getTimetableData();

  // Get availability for a specific day and time slot
  const getAvailabilityForDayAndSlot = (dayId: number, timeSlot: string): AvailabilityLevel => {
    const availability = availabilities.find(avail => 
      avail.dayOfWeek === dayId && getTimeSlotName(avail.startTime, avail.endTime) === timeSlot
    );
    return availability?.availabilityLevel || 3;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>⏳ Lade Verfügbarkeiten...</div>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1200px',
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

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#34495e' }}>
          {employee.name}
        </h3>
        <p style={{ margin: 0, color: '#7f8c8d' }}>
          Legen Sie die Verfügbarkeit für {employee.name} fest (1: bevorzugt, 2: möglich, 3: nicht möglich).
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

      {/* Verfügbarkeits-Legende */}
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

      {/* Schichtplan Auswahl */}
      <div style={{
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>
          Verfügbarkeit für Schichtplan prüfen
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
                  {plan.name} ({plan.status === 'published' ? 'Veröffentlicht' : 'Entwurf'})
                </option>
              ))}
            </select>
          </div>
          
          {selectedPlan && (
            <div style={{ fontSize: '14px', color: '#666' }}>
              Zeitraum: {new Date(selectedPlan.startDate).toLocaleDateString('de-DE')} - {new Date(selectedPlan.endDate).toLocaleDateString('de-DE')}
            </div>
          )}
        </div>
      </div>

      {/* Verfügbarkeits-Timetable mit Dropdown-Menüs */}
      {selectedPlan && (
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
            Verfügbarkeit für: {selectedPlan.name}
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
                    minWidth: '150px'
                  }}>
                    Zeit
                  </th>
                  {timetableData.weekdays.map(weekday => (
                    <th key={weekday.id} style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      border: '1px solid #dee2e6',
                      fontWeight: 'bold',
                      minWidth: '150px'
                    }}>
                      {weekday.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['Vormittag', 'Nachmittag', 'Abend'].map((timeSlot, timeIndex) => (
                  <tr key={timeSlot} style={{
                    backgroundColor: timeIndex % 2 === 0 ? 'white' : '#f8f9fa'
                  }}>
                    <td style={{
                      padding: '12px 16px',
                      border: '1px solid #dee2e6',
                      fontWeight: '500',
                      backgroundColor: '#f8f9fa'
                    }}>
                      {timeSlot}
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        {timeSlot === 'Vormittag' ? '08:00-12:00' : 
                         timeSlot === 'Nachmittag' ? '12:00-16:00' : '16:00-20:00'}
                      </div>
                    </td>
                    {timetableData.weekdays.map(weekday => {
                      const currentLevel = getAvailabilityForDayAndSlot(weekday.id, timeSlot);
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
                            onChange={(e) => handleAvailabilityLevelChange(weekday.id, timeSlot, parseInt(e.target.value) as AvailabilityLevel)}
                            style={{
                              padding: '8px 12px',
                              border: `2px solid ${levelConfig?.color || '#ddd'}`,
                              borderRadius: '6px',
                              backgroundColor: levelConfig?.bgColor || 'white',
                              color: levelConfig?.color || '#333',
                              fontWeight: 'bold',
                              minWidth: '120px',
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
                          <div style={{ 
                            fontSize: '11px', 
                            color: levelConfig?.color,
                            marginTop: '4px',
                            fontWeight: 'bold'
                          }}>
                            {levelConfig?.description}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legende */}
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#e8f4fd',
            borderTop: '1px solid #b8d4f0',
            fontSize: '14px',
            color: '#2c3e50'
          }}>
            <strong>Legende:</strong> 
            {availabilityLevels.map(level => (
              <span key={level.level} style={{ marginLeft: '15px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: level.bgColor,
                    border: `1px solid ${level.color}`,
                    borderRadius: '2px'
                  }}
                />
                <strong style={{ color: level.color }}>{level.level}</strong>: {level.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Info Text */}
      <div style={{
        backgroundColor: '#e8f4fd',
        border: '1px solid #b6d7e8',
        borderRadius: '6px',
        padding: '15px',
        marginBottom: '20px'
      }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#2c3e50' }}>💡 Information</h4>
        <p style={{ margin: 0, color: '#546e7a', fontSize: '14px' }}>
          <strong>1: Bevorzugt</strong> - Ideale Zeit für diesen Mitarbeiter<br/>
          <strong>2: Möglich</strong> - Akzeptable Zeit, falls benötigt<br/>
          <strong>3: Nicht möglich</strong> - Mitarbeiter ist nicht verfügbar<br/>
          Das System priorisiert Mitarbeiter mit Level 1 für Schichtzuweisungen.
        </p>
      </div>

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
          disabled={saving}
          style={{
            padding: '12px 24px',
            backgroundColor: saving ? '#bdc3c7' : '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
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