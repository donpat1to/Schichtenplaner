import React, { useState, useEffect } from 'react';
import { EmployeeService, employeeService } from '../../../services/employeeService';
import { shiftPlanService } from '../../../services/shiftPlanService';
import { weeklyPlanService } from '../../../services/weeklyPlanService';
import { Employee, EmployeeAvailability } from '../../../models/Employee';
import { ShiftPlan, TimeSlot, Shift } from '../../../models/ShiftPlan';
import { WeeklyPlanWithDetails, PlanWeek, formatWeekRange, getCalendarWeekNumber } from '../../../models/WeeklyPlan';
import { useNotification } from '../../../contexts/NotificationContext';
import { useBackendValidation } from '../../../hooks/useBackendValidation';
import { useAuth } from '../../../contexts/AuthContext';
import Calendar from '../../../components/Calendar/Calendar';

interface AvailabilityManagerProps {
  employee: Employee;
  onSave: () => void;
  onCancel: () => void;
}

// Plan type selector
type PlanType = 'shift' | 'weekly';

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
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole(['admin', 'maintenance']);
  const isOwnProfile = user?.id === employee.id;

  // Plan type state
  const [planType, setPlanType] = useState<PlanType>('shift');

  // Shift plan state
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [shiftPlans, setShiftPlans] = useState<ShiftPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<ShiftPlan | null>(null);

  // Weekly plan state
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlanWithDetails[]>([]);
  const [selectedWeeklyPlanId, setSelectedWeeklyPlanId] = useState<string>('');
  const [selectedWeeklyPlan, setSelectedWeeklyPlan] = useState<WeeklyPlanWithDetails | null>(null);
  const [weeklyPreferencesMap, setWeeklyPreferencesMap] = useState<Record<string, 1 | 2 | 3>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showNotification } = useNotification();
  const { executeWithValidation, isSubmitting } = useBackendValidation();

  const [largeContractMinimumWeeks, setLargeContractMinimumWeeks] = useState(0);
  const [smallContractMinimumWeeks, setSmallContractMinimumWeeks] = useState(0);
  const [largeContractMaximumWeeks, setLargeContractMaximumWeeks] = useState(0);
  const [smallContractMaximumWeeks, setSmallContractMaximumWeeks] = useState(0);
  const [requiredWeeks, setRequiredWeeks] = useState(0);
  const [requiredWeeksChanged, setRequiredWeeksChanged] = useState(false);

  // Calendar month state for weekly plan view
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());

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

  // Check permission - can edit if admin or own profile
  const canEdit = isAdmin || isOwnProfile;

  // Load initial data based on plan type
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);

        if (planType === 'shift') {
          // Load shift plans
          const plans = await shiftPlanService.getShiftPlans();
          setShiftPlans(plans);

          if (plans.length > 0) {
            const planWithShifts = plans.find(plan =>
              plan.shifts && plan.shifts.length > 0 &&
              plan.timeSlots && plan.timeSlots.length > 0
            ) || plans[0];
            setSelectedPlanId(planWithShifts.id);
          } else {
            setLoading(false);
          }
        } else {
          // Load weekly plans
          const plans = await weeklyPlanService.getWeeklyPlans();
          // Filter only draft plans for preference editing
          const draftPlans = plans.filter(p => p.status === 'draft');
          setWeeklyPlans(draftPlans as any);

          if (draftPlans.length > 0) {
            setSelectedWeeklyPlanId(draftPlans[0].id);
          } else {
            setLoading(false);
          }
        }

      } catch (err: any) {
        console.error('Error loading initial data:', err);
        showNotification({
          type: 'error',
          title: 'Fehler beim Laden',
          message: 'Daten konnten nicht geladen werden: ' + (err.message || 'Unbekannter Fehler')
        });
        setLoading(false);
      }
    };

    loadInitialData();
  }, [employee.id, planType]);

  // Load shift plan details when selected
  useEffect(() => {
    if (planType !== 'shift' || !selectedPlanId) {
      if (planType === 'shift') setLoading(false);
      return;
    }

    const loadPlanData = async () => {
      try {
        setLoading(true);

        const plan = await shiftPlanService.getShiftPlan(selectedPlanId);
        setSelectedPlan(plan);

        try {
          const allAvailabilities = await employeeService.getAvailabilities(employee.id);
          const planAvailabilities = allAvailabilities.filter(
            avail => avail.planId === selectedPlanId && avail.shiftId
          );

          const transformedAvailabilities: Availability[] = planAvailabilities.map(avail => ({
            ...avail,
            isAvailable: avail.preferenceLevel !== 3
          }));

          setAvailabilities(transformedAvailabilities);
        } catch (availError) {
          console.error('Error loading availabilities:', availError);
          setAvailabilities([]);
        }

      } catch (err: any) {
        console.error('Error loading shift plan:', err);
        showNotification({
          type: 'error',
          title: 'Fehler beim Laden',
          message: 'Schichtplan konnte nicht geladen werden'
        });
      } finally {
        setLoading(false);
      }
    };

    loadPlanData();
  }, [selectedPlanId, employee.id, planType]);

  // Load weekly plan details when selected
  useEffect(() => {
    if (planType !== 'weekly' || !selectedWeeklyPlanId) {
      if (planType === 'weekly') setLoading(false);
      return;
    }

    const loadWeeklyPlanData = async () => {
      try {
        setLoading(true);

        const plan = await weeklyPlanService.getWeeklyPlan(selectedWeeklyPlanId);
        setSelectedWeeklyPlan(plan);

        // Find this employee's preferences
        const employeeData = plan.employees?.find(e => e.id === employee.id);
        if (employeeData) {
          const prefs: Record<string, 1 | 2 | 3> = {};
          employeeData.preferences.forEach(p => {
            prefs[p.weekId] = p.preferenceLevel;
          });
          setWeeklyPreferencesMap(prefs);

          // Only load requiredWeeks from backend if not changed by user
          if (!requiredWeeksChanged && employeeData.requiredWeeks !== undefined) {
            setRequiredWeeks(employeeData.requiredWeeks);
          }
        } else {
          setWeeklyPreferencesMap({});
          // Reset requiredWeeksChanged flag if no employee data found
          setRequiredWeeksChanged(false);
        }

        // Calculate contract weeks recommendations
        const weeksCount = plan.weeks.length;
        const assignmentsPerWeekNeeded = plan.weeks[0].minEmployees;
        const assignmentsPerWeekMax = plan.weeks[0].maxEmployees;
        const weeksNeeded = assignmentsPerWeekNeeded * weeksCount;
        const weeksMax = assignmentsPerWeekMax * weeksCount;

        const employees = await employeeService.getEmployees(false);
        const employeeSmallContractCount = employees.filter(e => e.employeeType === 'personell' && e.contractType === 'small').length;
        const employeeLargeContractCount = employees.filter(e => e.employeeType === 'personell' && e.contractType === 'large').length;

        const workloadUnitsAvailable = employeeSmallContractCount + employeeLargeContractCount * 2;
        const weeksPerWorkloadUnitMin = weeksNeeded / workloadUnitsAvailable;
        const weeksPerWorkloadUnitMax = weeksMax / workloadUnitsAvailable;

        setLargeContractMinimumWeeks(Math.ceil(2 * weeksPerWorkloadUnitMin));
        setSmallContractMinimumWeeks(Math.ceil(weeksPerWorkloadUnitMin));
        setLargeContractMaximumWeeks(Math.ceil(2 * weeksPerWorkloadUnitMax));
        setSmallContractMaximumWeeks(Math.ceil(weeksPerWorkloadUnitMax));

      } catch (err: any) {
        console.error('Error loading weekly plan:', err);
        showNotification({
          type: 'error',
          title: 'Fehler beim Laden',
          message: 'Wochenplan konnte nicht geladen werden'
        });
      } finally {
        setLoading(false);
      }
    };

    loadWeeklyPlanData();
  }, [selectedWeeklyPlanId, employee.id, planType]);

  const formatTime = (time: string): string => {
    if (!time) return '--:--';
    return time.substring(0, 5);
  };

  // Shift plan timetable data
  const getTimetableData = () => {
    if (!selectedPlan || !selectedPlan.shifts || !selectedPlan.timeSlots) {
      return { days: [], shiftsByDay: {} };
    }

    const timeSlotMap = new Map(selectedPlan.timeSlots.map(ts => [ts.id, ts]));

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

    Object.keys(shiftsByDay).forEach(day => {
      shiftsByDay[parseInt(day)].sort((a, b) => {
        const timeA = a.startTime || '';
        const timeB = b.startTime || '';
        return timeA.localeCompare(timeB);
      });
    });

    const days = Array.from(new Set(selectedPlan.shifts.map(shift => shift.dayOfWeek)))
      .sort()
      .map(dayId => {
        return daysOfWeek.find(day => day.id === dayId) || { id: dayId, name: `Tag ${dayId}` };
      });

    return { days, shiftsByDay };
  };

  const handleAvailabilityLevelChange = (shiftId: string, level: AvailabilityLevel) => {
    if (!shiftId || !canEdit) return;

    setAvailabilities(prev => {
      const existingIndex = prev.findIndex(avail => avail.shiftId === shiftId);

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          preferenceLevel: level,
          isAvailable: level !== 3
        };
        return updated;
      } else {
        const newAvailability: Availability = {
          id: `temp-${shiftId}-${Date.now()}`,
          employeeId: employee.id,
          planId: selectedPlanId,
          shiftId: shiftId,
          contractType: employee.contractType,
          preferenceLevel: level,
          isAvailable: level !== 3
        };
        return [...prev, newAvailability];
      }
    });
  };

  const handleWeeklyPreferenceChange = (weekId: string, level: AvailabilityLevel | 0) => {
    if (!canEdit) return;

    setWeeklyPreferencesMap(prev => {
      if (level === 0) {
        const { [weekId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [weekId]: level as 1 | 2 | 3 };
    });
  };

  const handleRequiredWeeksChange = (value: number) => {
    setRequiredWeeks(value);
    setRequiredWeeksChanged(true);
  };

  // Unified preference cycling: undefined/3 -> 1 -> 2 -> 3 -> 1
  const getNextPreferenceLevel = (current: AvailabilityLevel | undefined): AvailabilityLevel => {
    if (current === undefined || current === 3) return 1;
    return (current + 1) as AvailabilityLevel;
  };

  const toggleWeeklyPreference = (weekId: string) => {
    if (!canEdit) return;

    setWeeklyPreferencesMap(prev => {
      const current = prev[weekId];
      const nextLevel = getNextPreferenceLevel(current);
      return { ...prev, [weekId]: nextLevel };
    });
  };

  const toggleShiftPreference = (shiftId: string) => {
    if (!canEdit) return;

    setAvailabilities(prev => {
      const existingIndex = prev.findIndex(avail => avail.shiftId === shiftId);

      if (existingIndex >= 0) {
        const nextLevel = getNextPreferenceLevel(prev[existingIndex].preferenceLevel);
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          preferenceLevel: nextLevel,
          isAvailable: nextLevel !== 3
        };
        return updated;
      } else {
        // No existing preference, start with level 1 (Bevorzugt)
        return [...prev, {
          id: `temp-${shiftId}-${Date.now()}`,
          employeeId: employee.id,
          planId: selectedPlanId,
          shiftId: shiftId,
          contractType: employee.contractType,
          preferenceLevel: 1 as AvailabilityLevel,
          isAvailable: true
        }];
      }
    });
  };

  // Handle calendar month change
  const handleMonthChange = (year: number, month: number) => {
    setCurrentMonth(new Date(year, month, 1));
  };

  // Set initial month to the start of the selected weekly plan
  useEffect(() => {
    if (selectedWeeklyPlan?.weeks && selectedWeeklyPlan.weeks.length > 0) {
      const firstWeekStart = new Date(selectedWeeklyPlan.weeks[0].startDate);
      setCurrentMonth(new Date(firstWeekStart.getFullYear(), firstWeekStart.getMonth(), 1));
    }
  }, [selectedWeeklyPlan]);

  const getAvailabilityForShift = (shiftId: string): AvailabilityLevel => {
    const availability = availabilities.find(avail => avail.shiftId === shiftId);
    return availability?.preferenceLevel || 3;
  };

  // Render shift plan timetable
  const renderShiftTimetable = () => {
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

    const timeSlotMap = new Map(selectedPlan?.timeSlots?.map(ts => [ts.id, ts]) || []);

    const allTimeSlots = new Map();
    days.forEach(day => {
      shiftsByDay[day.id]?.forEach(shift => {
        const timeSlot = timeSlotMap.get(shift.timeSlotId);
        if (timeSlot && !allTimeSlots.has(timeSlot.id)) {
          allTimeSlots.set(timeSlot.id, {
            ...timeSlot,
            shiftsByDay: {}
          });
        }
      });
    });

    days.forEach(day => {
      shiftsByDay[day.id]?.forEach(shift => {
        const timeSlot = allTimeSlots.get(shift.timeSlotId);
        if (timeSlot) {
          timeSlot.shiftsByDay[day.id] = shift;
        }
      });
    });

    const sortedTimeSlots = Array.from(allTimeSlots.values()).sort((a, b) => {
      const timeToMinutes = (timeStr: string) => {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
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
          Wochenpräferenzen
          <div style={{ fontSize: '14px', fontWeight: 'normal', marginTop: '5px' }}>
            {sortedTimeSlots.length} Zeitslots • {days.length} Tage
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
                    <div style={{ fontWeight: 'bold' }}>{timeSlot.name}</div>
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
                        <div
                          onClick={() => toggleShiftPreference(shift.id)}
                          style={{
                            padding: '8px 12px',
                            border: `2px solid ${levelConfig?.color || '#ddd'}`,
                            borderRadius: '6px',
                            backgroundColor: levelConfig?.bgColor || 'white',
                            color: levelConfig?.color || '#333',
                            fontWeight: 'bold',
                            minWidth: '140px',
                            cursor: canEdit ? 'pointer' : 'not-allowed',
                            textAlign: 'center',
                            opacity: canEdit ? 1 : 0.7,
                            userSelect: 'none',
                            transition: 'all 0.2s ease'
                          }}
                          title={canEdit ? 'Klicken zum Ändern' : 'Bearbeitung nicht erlaubt'}
                        >
                          <div>{levelConfig?.level}: {levelConfig?.label}</div>
                          {canEdit && (
                            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>
                              Klicken zum Ändern
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
      </div>
    );
  };

  // Render weekly plan preferences
  const renderWeeklyPreferences = () => {
    if (!selectedWeeklyPlan || !selectedWeeklyPlan.weeks || selectedWeeklyPlan.weeks.length === 0) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          color: '#6c757d',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📆</div>
          <h4>Keine Wochen im ausgewählten Plan</h4>
          <p>Der ausgewählte Wochenplan hat keine Wochen definiert.</p>
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
          Wochenpräferenzen
          <div style={{ fontSize: '14px', fontWeight: 'normal', marginTop: '5px' }}>
            {selectedWeeklyPlan.weeks.length} Wochen • Klicken Sie auf die Präferenzzeile um die Präferenz zu ändern
          </div>
        </div>

        {/* Required weeks input */}
        <div style={{
          padding: '15px 20px',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <label style={{ fontWeight: 'bold', color: '#2c3e50' }}>
            Gewünschte Anzahl Wochen:
          </label>
          <input
            type="number"
            min="0"
            max={selectedWeeklyPlan.weeks.length}
            value={requiredWeeks}
            onChange={(e) => handleRequiredWeeksChange(parseInt(e.target.value) || 0)}
            onKeyDown={(e) => e.preventDefault()}
            disabled={!canEdit}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              width: '80px',
              textAlign: 'center',
              fontSize: '16px',
              opacity: canEdit ? 1 : 0.7
            }}
          />
          <span style={{ color: '#666', fontSize: '14px' }}>
            von {selectedWeeklyPlan.weeks.length} verfügbar
          </span>
        </div>

        {/* Calendar view for weekly preferences */}
        <div style={{ padding: '20px' }}>
          <Calendar
            year={currentMonth.getFullYear()}
            month={currentMonth.getMonth()}
            weeks={selectedWeeklyPlan.weeks}
            onMonthChange={handleMonthChange}
            mode="preferences"
            weekPreferences={weeklyPreferencesMap}
            onPreferenceChange={toggleWeeklyPreference}
            disabled={!canEdit}
          />
        </div>

        {/* Summary */}
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '15px 20px',
          borderTop: '1px solid #dee2e6',
          fontSize: '13px',
          color: '#666'
        }}>
          <strong>Zusammenfassung:</strong>{' '}
          {Object.values(weeklyPreferencesMap).filter(v => v === 1).length} bevorzugt,{' '}
          {Object.values(weeklyPreferencesMap).filter(v => v === 2).length} verfügbar,{' '}
          {Object.values(weeklyPreferencesMap).filter(v => v === 3).length} nicht verfügbar
        </div>
      </div>
    );
  };

  const handleSave = async () => {
    if (planType === 'shift') {
      await handleSaveShiftAvailabilities();
    } else {
      await handleSaveWeeklyPreferences();
    }
  };

  const handleSaveShiftAvailabilities = async () => {
    if (!selectedPlanId) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Bitte wählen Sie einen Schichtplan aus'
      });
      return;
    }

    if (!user) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Benutzer nicht gefunden'
      });
      return;
    }

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

    if (isOwnProfile) {
      if (user.contractType === 'large') {
        if (validAvailabilities.filter(avail => avail.preferenceLevel === 1 || avail.preferenceLevel === 2).length < 3) {
          showNotification({
            type: 'error',
            title: 'Fehler',
            message: 'Bitte wählen Sie mindestens 3 verfügbare Schichten aus, da Sie einen großen Vertrag haben'
          });
          return;
        }
      }

      if (user.contractType === 'small') {
        if (validAvailabilities.filter(avail => avail.preferenceLevel === 1 || avail.preferenceLevel === 2).length < 2) {
          showNotification({
            type: 'error',
            title: 'Fehler',
            message: 'Bitte wählen Sie mindestens 2 verfügbare Schichten aus, da Sie einen kleinen Vertrag haben'
          });
          return;
        }
      }
    } else if (isAdmin) {
      if (employee.contractType === 'large') {
        if (validAvailabilities.filter(avail => avail.preferenceLevel === 1 || avail.preferenceLevel === 2).length < 3) {
          showNotification({
            type: 'error',
            title: 'Fehler',
            message: 'Bitte wählen Sie mindestens 3 verfügbare Schichten aus, da der Mitarbeiter einen großen Vertrag hat'
          });
          return;
        }
      }

      if (employee.contractType === 'small') {
        if (validAvailabilities.filter(avail => avail.preferenceLevel === 1 || avail.preferenceLevel === 2).length < 2) {
          showNotification({
            type: 'error',
            title: 'Fehler',
            message: 'Bitte wählen Sie mindestens 2 verfügbare Schichten aus, da der Mitarbeiter einen kleinen Vertrag hat'
          });
          return;
        }
      }
    }



    await executeWithValidation(async () => {
      setSaving(true);

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

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Verfügbarkeiten wurden erfolgreich gespeichert'
      });

      window.dispatchEvent(new CustomEvent('availabilitiesChanged'));
      onSave();
    });
  };

  const handleSaveWeeklyPreferences = async () => {
    if (!selectedWeeklyPlan) {
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Bitte wählen Sie einen Wochenplan aus'
      });
      return;
    }

    // Für alle Wochen im Plan sicherstellen, dass wir einen Wert haben
    const preferences = selectedWeeklyPlan.weeks.map(week => {
      const level = weeklyPreferencesMap[week.id];
      return {
        weekId: week.id,
        preferenceLevel: level,
      };
    });

    await executeWithValidation(async () => {
      setSaving(true);

      if (isOwnProfile) {
        // Save own preferences
        await weeklyPlanService.saveMyPreferences(selectedWeeklyPlanId, {
          preferences,
          requiredWeeks,
        });
      } else if (isAdmin) {
        // Admin saving for another employee
        await weeklyPlanService.saveEmployeePreferences(selectedWeeklyPlanId, employee.id, {
          preferences,
          requiredWeeks,
        });
      }

      showNotification({
        type: 'success',
        title: 'Erfolg',
        message: 'Wochenpräferenzen wurden erfolgreich gespeichert'
      });

      window.dispatchEvent(new CustomEvent('weeklyPreferencesChanged'));
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

  const employeeFullName = `${employee.firstname} ${employee.lastname}`;

  const availableShiftsCount = availabilities.filter(avail =>
    avail.preferenceLevel === 1 || avail.preferenceLevel === 2
  ).length;

  return (
    <div style={{
      position: 'relative',
      maxWidth: '100 %',
      margin: '0 auto',
      backgroundColor: 'white',
      padding: '20px',
      borderRadius: '8px',
      border: '1px solid #e0e0e0',
      boxShadow: '0 8px 15px rgba(0,0,0,0.05)'
    }}>
      <h2 style={{
        margin: '0 0 25px 0',
        color: '#2c3e50',
        borderBottom: '2px solid #f0f0f0',
        paddingBottom: '15px'
      }}>
        📅 Verfügbarkeit verwalten
      </h2>

      {/* Permission notice */}
      {!canEdit && (
        <div style={{
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '6px',
          color: '#856404'
        }}>
          <strong>Hinweis:</strong> Sie können die Verfügbarkeiten dieses Mitarbeiters nur anzeigen, aber nicht bearbeiten.
        </div>
      )}

      {/* Employee Info */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#34495e' }}>
          {employeeFullName}
          {isOwnProfile && <span style={{ fontSize: '14px', color: '#27ae60', marginLeft: '10px' }}>(Eigenes Profil)</span>}
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
          </p>
        )}
      </div>

      {/* Plan Type Selector & Plan Selection */}
      <div style={{
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        {/* Plan Type Selector */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>
            Plantyp auswählen
          </h4>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setPlanType('shift')}
              style={{
                padding: '12px 24px',
                border: planType === 'shift' ? '2px solid #51258f' : '2px solid #ddd',
                borderRadius: '8px',
                backgroundColor: planType === 'shift' ? '#f5f0ff' : 'white',
                color: planType === 'shift' ? '#51258f' : '#666',
                fontWeight: planType === 'shift' ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              📋 Schichtpläne
            </button>
            <button
              onClick={() => setPlanType('weekly')}
              style={{
                padding: '12px 24px',
                border: planType === 'weekly' ? '2px solid #51258f' : '2px solid #ddd',
                borderRadius: '8px',
                backgroundColor: planType === 'weekly' ? '#f5f0ff' : 'white',
                color: planType === 'weekly' ? '#51258f' : '#666',
                fontWeight: planType === 'weekly' ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              📆 Wochenpläne
            </button>
          </div>
        </div>

        {/* Plan Selection */}
        {planType === 'shift' ? (
          <div>
            <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>
              Schichtplan auswählen
            </h4>

            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
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
                    {plan.name} {plan.shifts && `(${plan.shifts.length} Shifts)`}
                  </option>
                ))}
              </select>

              {selectedPlan && (
                <div style={{ fontSize: '14px', color: '#666' }}>
                  <strong>Status:</strong> {selectedPlan.status}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>
              Wochenplan auswählen
            </h4>

            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={selectedWeeklyPlanId}
                onChange={(e) => setSelectedWeeklyPlanId(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  minWidth: '250px'
                }}
              >
                <option value="">Bitte auswählen...</option>
                {weeklyPlans.map(plan => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} {plan.weeks && `(${plan.weeks.length} Wochen)`}
                  </option>
                ))}
              </select>

              {selectedWeeklyPlan && (
                <div style={{ fontSize: '14px', color: '#666' }}>
                  <strong>Status:</strong> {selectedWeeklyPlan.status}
                </div>
              )}
            </div>

            {weeklyPlans.length === 0 && (
              <div style={{
                marginTop: '10px',
                padding: '10px',
                backgroundColor: '#e8f4fd',
                border: '1px solid #b6d7e8',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                ℹ️ Nur Wochenpläne im Entwurfsstatus können bearbeitet werden.
              </div>
            )}
          </div>
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
        {planType === 'weekly' && (
          <>
            <div style={{ marginTop: '10px' }}>
              Basierend auf aktueller Mitarbeiterverteilung werden für den Solver des Plans empfohlen:
            </div>
            <div style={{ marginTop: '5px' }}>
              • <strong>Große Verträge:</strong> Mindestens {largeContractMinimumWeeks} Wochen, Maxmial {largeContractMaximumWeeks}
            </div>
            <div>
              • <strong>Kleine Verträge:</strong> Mindestens {smallContractMinimumWeeks} Wochen, Maximal {smallContractMaximumWeeks}
            </div>
          </>
        )}
      </div>

      {/* Render appropriate timetable/preferences */}
      {planType === 'shift' ? renderShiftTimetable() : renderWeeklyPreferences()}

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

        {canEdit && (
          <button
            onClick={handleSave}
            disabled={
              isSubmitting ||
              (planType === 'shift' ? (shiftsCount === 0 || !selectedPlanId) : !selectedWeeklyPlanId)
            }
            style={{
              padding: '12px 24px',
              backgroundColor: isSubmitting ? '#bdc3c7' :
                (planType === 'shift'
                  ? (shiftsCount === 0 || !selectedPlanId ? '#95a5a6' : '#3498db')
                  : (!selectedWeeklyPlanId ? '#95a5a6' : '#51258f')),
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (isSubmitting || (planType === 'shift' ? (shiftsCount === 0 || !selectedPlanId) : !selectedWeeklyPlanId)) ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {isSubmitting ? '⏳ Wird gespeichert...' :
              planType === 'shift'
                ? `Verfügbarkeiten speichern (${availableShiftsCount})`
                : `Präferenzen speichern`
            }
          </button>
        )}
      </div>
    </div>
  );
};

export default AvailabilityManager;
