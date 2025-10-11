// frontend/src/pages/Employees/components/AvailabilityManager.tsx - KORRIGIERT
import React, { useState, useEffect } from 'react';
import { Employee, Availability } from '../../../../../backend/src/models/employee';
import { employeeService } from '../../../services/employeeService';
import { shiftPlanService } from '../../../services/shiftPlanService';
import { ShiftPlan, TimeSlot } from '../../../../../backend/src/models/shiftPlan';
import { shiftTemplateService } from '../../../services/shiftTemplateService';
import { time } from 'console';

interface AvailabilityManagerProps {
  employee: Employee;
  onSave: () => void;
  onCancel: () => void;
}

// Verfügbarkeits-Level
export type AvailabilityLevel = 1 | 2 | 3;

// Interface für Zeit-Slots
interface TimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  displayName: string;
  source: string;
}

const AvailabilityManager: React.FC<AvailabilityManagerProps> = ({
  employee,
  onSave,
  onCancel
}) => {
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [shiftPlans, setShiftPlans] = useState<ShiftPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<ShiftPlan | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
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

  // NEU: Hole Zeit-Slots aus Schichtvorlagen als Hauptquelle
  const loadTimeSlotsFromTemplates = async (): Promise<TimeSlot[]> => {
    try {
      console.log('🔄 LADE ZEIT-SLOTS AUS SCHICHTVORLAGEN...');
      const shiftPlan = await shiftPlanService.getShiftPlans();
      console.log('✅ SCHICHTVORLAGEN GELADEN:', shiftPlan);

      const allTimeSlots = new Map<string, TimeSlot>();

      shiftPlan.forEach(plan => {
        console.log(`📋 VORLAGE: ${plan.name}`, plan);

        // Extrahiere Zeit-Slots aus den Schicht-Zeitbereichen
        if (plan.shifts && plan.shifts.length > 0) {
          plan.shifts.forEach(shift => {
            const key = `${shift.timeSlot.startTime}-${shift.timeSlot.endTime}`;
            if (!allTimeSlots.has(key)) {
              allTimeSlots.set(key, {
                id: shift.id || `slot-${shift.timeSlot.startTime.replace(/:/g, '')}-${shift.timeSlot.endTime.replace(/:/g, '')}`,
                name: shift.timeSlot.name || 'Schicht',
                startTime: shift.timeSlot.startTime,
                endTime: shift.timeSlot.endTime,
                displayName: `${shift.timeSlot.name || 'Schicht'} (${formatTime(shift.timeSlot.startTime)}-${formatTime(shift.timeSlot.endTime)})`,
                source: `Vorlage: ${plan.name}`
              });
            }
          });
        }
      });

      const result = Array.from(allTimeSlots.values()).sort((a, b) => 
        a.startTime.localeCompare(b.startTime)
      );

      console.log('✅ ZEIT-SLOTS AUS VORLAGEN:', result);
      return result;
    } catch (error) {
      console.error('❌ FEHLER BEIM LADEN DER VORLAGEN:', error);
      return getDefaultTimeSlots();
    }
  };

  // NEU: Alternative Methode - Extrahiere aus Schichtplänen
  const extractTimeSlotsFromPlans = (plans: ShiftPlan[]): TimeSlot[] => {
    console.log('🔄 EXTRAHIERE ZEIT-SLOTS AUS SCHICHTPLÄNEN:', plans);
    
    const allTimeSlots = new Map<string, TimeSlot>();
    
    plans.forEach(plan => {
      console.log(`📋 ANALYSIERE PLAN: ${plan.name}`, {
        id: plan.id,
        shifts: plan.shifts
      });

      // Prüfe ob Schichten existieren und ein Array sind
      if (plan.shifts && Array.isArray(plan.shifts)) {
        plan.shifts.forEach(shift => {
          console.log(`   🔍 SCHICHT:`, shift);

          if (shift.timeSlot.startTime && shift.timeSlot.endTime) {
            const key = `${shift.timeSlot.startTime}-${shift.timeSlot.endTime}`;
            if (!allTimeSlots.has(key)) {
              allTimeSlots.set(key, {
                id: `slot-${shift.timeSlot.startTime.replace(/:/g, '')}-${shift.timeSlot.endTime.replace(/:/g, '')}`,
                name: shift.timeSlot.name || 'Schicht',
                startTime: shift.timeSlot.startTime,
                endTime: shift.timeSlot.endTime,
                displayName: `${shift.timeSlot.name || 'Schicht'} (${formatTime(shift.timeSlot.startTime)}-${formatTime(shift.timeSlot.endTime)})`,
                source: `Plan: ${plan.name}`
              });
            }
          }
        });
      } else {
        console.log(`   ❌ KEINE SCHICHTEN IN PLAN ${plan.name} oder keine Array-Struktur`);
      }
    });

    const result = Array.from(allTimeSlots.values()).sort((a, b) => 
      a.startTime.localeCompare(b.startTime)
    );

    console.log('✅ ZEIT-SLOTS AUS PLÄNEN:', result);
    return result;
  };

  const getDefaultTimeSlots = (): TimeSlot[] => {
    console.log('⚠️ VERWENDE STANDARD-ZEIT-SLOTS');
    return [
      {
        id: 'slot-0800-1200',
        name: 'Vormittag',
        startTime: '08:00',
        endTime: '12:00',
        displayName: 'Vormittag (08:00-12:00)',
        source: 'Standard'
      },
      {
        id: 'slot-1200-1600',
        name: 'Nachmittag',
        startTime: '12:00',
        endTime: '16:00',
        displayName: 'Nachmittag (12:00-16:00)',
        source: 'Standard'
      },
      {
        id: 'slot-1600-2000',
        name: 'Abend',
        startTime: '16:00',
        endTime: '20:00',
        displayName: 'Abend (16:00-20:00)',
        source: 'Standard'
      }
    ];
  };

  const formatTime = (time: string): string => {
    return time.substring(0, 5);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔄 LADE DATEN FÜR MITARBEITER:', employee.id);
      
      // 1. Lade Verfügbarkeiten
      let existingAvailabilities: Availability[] = [];
      try {
        existingAvailabilities = await employeeService.getAvailabilities(employee.id);
        console.log('✅ VERFÜGBARKEITEN GELADEN:', existingAvailabilities.length);
      } catch (err) {
        console.log('⚠️ KEINE VERFÜGBARKEITEN GEFUNDEN');
      }

      // 2. Lade Schichtpläne
      console.log('🔄 LADE SCHICHTPLÄNE...');
      const plans = await shiftPlanService.getShiftPlans();
      console.log('✅ SCHICHTPLÄNE GELADEN:', plans.length, plans);

      // 3. VERSUCH 1: Lade Zeit-Slots aus Schichtvorlagen (bessere Quelle)
      let extractedTimeSlots = await loadTimeSlotsFromTemplates();
      
      // VERSUCH 2: Falls keine Zeit-Slots aus Vorlagen, versuche es mit Schichtplänen
      if (extractedTimeSlots.length === 0) {
        console.log('⚠️ KEINE ZEIT-SLOTS AUS VORLAGEN, VERSUCHE SCHICHTPLÄNE...');
        extractedTimeSlots = extractTimeSlotsFromPlans(plans);
      }

      // VERSUCH 3: Falls immer noch keine, verwende Standard-Slots
      if (extractedTimeSlots.length === 0) {
        console.log('⚠️ KEINE ZEIT-SLOTS GEFUNDEN, VERWENDE STANDARD-SLOTS');
        extractedTimeSlots = getDefaultTimeSlots();
      }

      setTimeSlots(extractedTimeSlots);
      setShiftPlans(plans);

      // 4. Erstelle Standard-Verfügbarkeiten falls nötig
      if (existingAvailabilities.length === 0) {
        const defaultAvailabilities: Availability[] = daysOfWeek.flatMap(day =>
          extractedTimeSlots.map(slot => ({
            id: `temp-${day.id}-${slot.id}`,
            employeeId: employee.id,
            dayOfWeek: day.id,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isAvailable: false,
            availabilityLevel: 3 as AvailabilityLevel
          }))
        );
        setAvailabilities(defaultAvailabilities);
        console.log('✅ STANDARD-VERFÜGBARKEITEN ERSTELLT:', defaultAvailabilities.length);
      } else {
        setAvailabilities(existingAvailabilities);
      }

      // 5. Wähle ersten Plan aus
      if (plans.length > 0) {
        const publishedPlan = plans.find(plan => plan.status === 'published');
        const firstPlan = publishedPlan || plans[0];
        setSelectedPlanId(firstPlan.id);
        console.log('✅ SCHICHTPLAN AUSGEWÄHLT:', firstPlan.name);
      }
    } catch (err: any) {
      console.error('❌ FEHLER BEIM LADEN DER DATEN:', err);
      setError('Daten konnten nicht geladen werden');
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
        shiftsCount: plan.shifts?.length || 0,
        shifts: plan.shifts
      });
    } catch (err: any) {
      console.error('❌ FEHLER BEIM LADEN DES SCHICHTPLANS:', err);
      setError('Schichtplan konnte nicht geladen werden');
    }
  };

  const handleAvailabilityLevelChange = (dayId: number, timeSlotId: string, level: AvailabilityLevel) => {
    console.log(`🔄 ÄNDERE VERFÜGBARKEIT: Tag ${dayId}, Slot ${timeSlotId}, Level ${level}`);
    
    setAvailabilities(prev => {
      const timeSlot = timeSlots.find(s => s.id === timeSlotId);
      if (!timeSlot) {
        console.log('❌ ZEIT-SLOT NICHT GEFUNDEN:', timeSlotId);
        return prev;
      }

      const existingIndex = prev.findIndex(avail => 
        avail.dayOfWeek === dayId && 
        avail.startTime === timeSlot.startTime && 
        avail.endTime === timeSlot.endTime
      );

      console.log(`🔍 EXISTIERENDE VERFÜGBARKEIT GEFUNDEN AN INDEX:`, existingIndex);

      if (existingIndex >= 0) {
        // Update existing availability
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          availabilityLevel: level,
          isAvailable: level !== 3
        };
        console.log('✅ VERFÜGBARKEIT AKTUALISIERT:', updated[existingIndex]);
        return updated;
      } else {
        // Create new availability
        const newAvailability: Availability = {
          id: `temp-${dayId}-${timeSlotId}-${Date.now()}`,
          employeeId: employee.id,
          dayOfWeek: dayId,
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
          isAvailable: level !== 3,
          availabilityLevel: level
        };
        console.log('🆕 NEUE VERFÜGBARKEIT ERSTELLT:', newAvailability);
        return [...prev, newAvailability];
      }
    });
  };

  const getAvailabilityForDayAndSlot = (dayId: number, timeSlotId: string): AvailabilityLevel => {
    const timeSlot = timeSlots.find(s => s.id === timeSlotId);
    if (!timeSlot) {
      console.log('❌ ZEIT-SLOT NICHT GEFUNDEN FÜR ABFRAGE:', timeSlotId);
      return 3;
    }

    const availability = availabilities.find(avail => 
      avail.dayOfWeek === dayId && 
      avail.startTime === timeSlot.startTime && 
      avail.endTime === timeSlot.endTime
    );

    const result = availability?.availabilityLevel || 3;
    console.log(`🔍 ABFRAGE VERFÜGBARKEIT: Tag ${dayId}, Slot ${timeSlotId} = Level ${result}`);
    
    return result;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      
      await employeeService.updateAvailabilities(employee.id, availabilities);
      console.log('✅ VERFÜGBARKEITEN ERFOLGREICH GESPEICHERT');
      
      onSave();
    } catch (err: any) {
      console.error('❌ FEHLER BEIM SPEICHERN:', err);
      setError(err.message || 'Fehler beim Speichern der Verfügbarkeiten');
    } finally {
      setSaving(false);
    }
  };

  const getTimeSlotsForTimetable = (): TimeSlot[] => {
    return timeSlots;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>⏳ Lade Verfügbarkeiten...</div>
      </div>
    );
  }

  const timetableTimeSlots = getTimeSlotsForTimetable();

  return (
    <div style={{
      maxWidth: '1400px',
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
        backgroundColor: timeSlots.length === 0 ? '#f8d7da' : '#d1ecf1',
        border: `1px solid ${timeSlots.length === 0 ? '#f5c6cb' : '#bee5eb'}`,
        borderRadius: '6px',
        padding: '15px',
        marginBottom: '20px'
      }}>
        <h4 style={{ 
          margin: '0 0 10px 0', 
          color: timeSlots.length === 0 ? '#721c24' : '#0c5460' 
        }}>
          {timeSlots.length === 0 ? '❌ PROBLEM: Keine Zeit-Slots gefunden' : '✅ Zeit-Slots geladen'}
        </h4>
        <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
          <div><strong>Zeit-Slots gefunden:</strong> {timeSlots.length}</div>
          <div><strong>Quelle:</strong> {timeSlots[0]?.source || 'Unbekannt'}</div>
          <div><strong>Schichtpläne:</strong> {shiftPlans.length}</div>
        </div>
        
        {timeSlots.length > 0 && (
          <div style={{ marginTop: '10px' }}>
            <strong>Gefundene Zeit-Slots:</strong>
            {timeSlots.map(slot => (
              <div key={slot.id} style={{ fontSize: '11px', marginLeft: '10px' }}>
                • {slot.displayName}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rest der Komponente... */}
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
                  {plan.name} ({plan.shifts?.length || 0} Schichten)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Verfügbarkeits-Timetable */}
      {timetableTimeSlots.length > 0 ? (
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
              {timetableTimeSlots.length} Schichttypen verfügbar
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
                  {daysOfWeek.map(weekday => (
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
                {timetableTimeSlots.map((timeSlot, timeIndex) => (
                  <tr key={`timeSlot-${timeSlot.id}-timeIndex-${timeIndex}`} style={{
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
                    {daysOfWeek.map(weekday => {
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
      ) : (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          color: '#6c757d',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
          <h4>Keine Schichttypen konfiguriert</h4>
          <p>Es wurden keine Zeit-Slots in den Schichtvorlagen oder -plänen gefunden.</p>
          <p style={{ fontSize: '14px', marginTop: '10px' }}>
            Bitte erstellen Sie zuerst Schichtvorlagen mit Zeit-Slots.
          </p>
        </div>
      )}

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
          disabled={saving || timeSlots.length === 0}
          style={{
            padding: '12px 24px',
            backgroundColor: saving ? '#bdc3c7' : (timeSlots.length === 0 ? '#95a5a6' : '#3498db'),
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: (saving || timeSlots.length === 0) ? 'not-allowed' : 'pointer',
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