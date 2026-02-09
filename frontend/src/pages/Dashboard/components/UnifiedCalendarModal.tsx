// frontend/src/pages/Dashboard/components/UnifiedCalendarModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { shiftPlanService } from '../../../services/shiftPlanService';
import { weeklyPlanService } from '../../../services/weeklyPlanService';
import { holidayService } from '../../../services/holidayService';
import { ShiftPlan, ShiftPlanWithData } from '../../../models/ShiftPlan';
import { WeeklyPlanWithDetails } from '../../../models/WeeklyPlan';
import { WeeklyPlanListItem } from '../../../services/weeklyPlanService';
import { ResolvedHoliday } from '../../../models/Holiday';
import DayAssignmentsPopup from './DayAssignmentsPopup';
import { CalendarDayAssignment } from '../Dashboard';

// Format date to YYYY-MM-DD in local timezone (avoids UTC conversion issues)
const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface UnifiedCalendarModalProps {
  shiftPlans: ShiftPlan[];
  weeklyPlans: WeeklyPlanListItem[];
  onClose: () => void;
}

const UnifiedCalendarModal: React.FC<UnifiedCalendarModalProps> = ({
  shiftPlans,
  weeklyPlans,
  onClose
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [calendarAssignments, setCalendarAssignments] = useState<CalendarDayAssignment[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<ResolvedHoliday[]>([]);

  useEffect(() => {
    loadCalendarData();
  }, [shiftPlans, weeklyPlans]);

  // Load holidays when month changes
  useEffect(() => {
    loadHolidays();
  }, [currentDate]);

  const loadHolidays = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      // Get holidays for the visible month range (including overflow days)
      const startDate = formatDateLocal(new Date(year, month - 1, 1));
      const endDate = formatDateLocal(new Date(year, month + 2, 0));
      const resolvedHolidays = await holidayService.getHolidaysInRange(startDate, endDate);
      setHolidays(resolvedHolidays);
    } catch (error) {
      console.error('Error loading holidays:', error);
    }
  };

  const loadCalendarData = async () => {
    setLoading(true);
    try {
      const assignments: CalendarDayAssignment[] = [];

      // Load shift plan details and assignments
      for (const plan of shiftPlans) {
        try {
          const planDetails = await shiftPlanService.getShiftPlan(plan.id) as ShiftPlanWithData;

          if (!planDetails.startDate || !planDetails.endDate) continue;

          const planStart = new Date(planDetails.startDate);
          const planEnd = new Date(planDetails.endDate);

          // For each shift with assignments
          for (const shift of planDetails.shifts || []) {
            for (const assignment of shift.assignments || []) {
              // Calculate all dates within the plan period for this dayOfWeek
              const dates = getRecurringDates(planStart, planEnd, shift.dayOfWeek);

              for (const date of dates) {
                assignments.push({
                  date: formatDateLocal(date),
                  employeeId: assignment.employeeId,
                  employeeName: '', // Will be populated if needed
                  planName: planDetails.name,
                  planType: 'shift',
                  timeSlotName: shift.timeSlot?.name,
                  startTime: shift.timeSlot?.startTime,
                  endTime: shift.timeSlot?.endTime
                });
              }
            }
          }
        } catch (err) {
          console.error(`Error loading shift plan ${plan.id}:`, err);
        }
      }

      // Load weekly plan details and assignments
      // WeeklyPlanWithDetails stores assignments on each employee's assignedWeeks array
      for (const plan of weeklyPlans) {
        try {
          const planDetails = await weeklyPlanService.getWeeklyPlan(plan.id);
          const planWorkDays = planDetails.workDays || [1, 2, 3, 4, 5];

          // Iterate through employees and their assigned weeks
          for (const employee of planDetails.employees || []) {
            const employeeName = `${employee.firstname} ${employee.lastname}`;

            for (const weekId of employee.assignedWeeks || []) {
              const week = planDetails.weeks?.find(w => w.id === weekId);
              if (!week) continue;

              // Add an entry for each day of the week (filtered by work days)
              const weekStart = new Date(week.startDate);
              const weekEnd = new Date(week.endDate);

              for (let date = new Date(weekStart); date <= weekEnd; date.setDate(date.getDate() + 1)) {
                // Convert JS day (0=Sunday) to our format (1=Monday, 7=Sunday)
                const jsDay = date.getDay();
                const dayOfWeek = jsDay === 0 ? 7 : jsDay;

                // Skip non-work days
                if (!planWorkDays.includes(dayOfWeek)) continue;

                assignments.push({
                  date: formatDateLocal(date),
                  employeeId: employee.id,
                  employeeName,
                  planName: planDetails.name,
                  planType: 'weekly'
                });
              }
            }
          }
        } catch (err) {
          console.error(`Error loading weekly plan ${plan.id}:`, err);
        }
      }

      setCalendarAssignments(assignments);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRecurringDates = (startDate: Date, endDate: Date, dayOfWeek: number): Date[] => {
    const dates: Date[] = [];
    const current = new Date(startDate);

    // Adjust to the target day of week (1=Monday, 7=Sunday)
    const targetDay = dayOfWeek === 7 ? 0 : dayOfWeek;
    const currentDay = current.getDay();
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget < 0) daysUntilTarget += 7;
    current.setDate(current.getDate() + daysUntilTarget);

    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 7);
    }

    return dates;
  };

  // Calendar computation
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Day of week for first day (0 = Sunday, 1 = Monday, etc.)
    // Adjust for German week (Monday = 0)
    let startDayOfWeek = firstDay.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Add days from previous month
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false });
    }

    // Add days of current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push({ date: new Date(year, month, day), isCurrentMonth: true });
    }

    // Add days from next month to complete the grid
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  }, [currentDate]);

  const getAssignmentsForDate = (date: Date): CalendarDayAssignment[] => {
    const dateStr = formatDateLocal(date);
    return calendarAssignments.filter(a => a.date === dateStr);
  };

  const hasAssignments = (date: Date): boolean => {
    return getAssignmentsForDate(date).length > 0;
  };

  const getHolidayForDate = (date: Date): ResolvedHoliday | undefined => {
    const dateStr = formatDateLocal(date);
    return holidays.find(h => h.date === dateStr);
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const handleDayClick = (date: Date) => {
    const dateStr = formatDateLocal(date);
    if (hasAssignments(date)) {
      setSelectedDate(dateStr);
    }
  };

  const formatMonthYear = (date: Date): string => {
    return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ margin: 0, color: '#2c3e50' }}>Kalender - Alle Zuweisungen</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666'
            }}
          >
            &#10005;
          </button>
        </div>

        {/* Month Navigation */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <button
            onClick={() => navigateMonth(-1)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f0f0f0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            &#8592;
          </button>
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c3e50' }}>
            {formatMonthYear(currentDate)}
          </span>
          <button
            onClick={() => navigateMonth(1)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f0f0f0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            &#8594;
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            Lade Kalenderdaten...
          </div>
        ) : (
          <>
            {/* Calendar Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '4px'
            }}>
              {/* Weekday Headers */}
              {weekDays.map(day => (
                <div
                  key={day}
                  style={{
                    textAlign: 'center',
                    padding: '8px',
                    fontWeight: 'bold',
                    color: '#666',
                    fontSize: '14px'
                  }}
                >
                  {day}
                </div>
              ))}

              {/* Calendar Days */}
              {calendarDays.map((dayInfo, index) => {
                const hasAssign = hasAssignments(dayInfo.date);
                const assignCount = getAssignmentsForDate(dayInfo.date).length;
                const today = isToday(dayInfo.date);
                const holiday = getHolidayForDate(dayInfo.date);

                // Determine background color with holiday priority
                let backgroundColor = dayInfo.isCurrentMonth ? '#fafafa' : '#f5f5f5';
                if (holiday) {
                  if (holiday.halfDay === 'morning') {
                    backgroundColor = 'linear-gradient(to bottom, #fff3cd 50%, #fafafa 50%)';
                  } else if (holiday.halfDay === 'afternoon') {
                    backgroundColor = 'linear-gradient(to bottom, #fafafa 50%, #fff3cd 50%)';
                  } else {
                    backgroundColor = '#fff3cd';
                  }
                } else if (today) {
                  backgroundColor = '#e8f4fd';
                } else if (hasAssign) {
                  backgroundColor = '#f0f7ff';
                }

                return (
                  <div
                    key={index}
                    onClick={() => handleDayClick(dayInfo.date)}
                    style={{
                      aspectRatio: '1',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '6px',
                      background: backgroundColor,
                      color: dayInfo.isCurrentMonth ? '#333' : '#999',
                      cursor: hasAssign ? 'pointer' : 'default',
                      border: today
                        ? '2px solid #3498db'
                        : holiday
                          ? '1px solid #ffc107'
                          : hasAssign
                            ? '1px solid #3498db'
                            : '1px solid transparent',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (hasAssign || holiday) {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    title={holiday ? holiday.name : undefined}
                  >
                    <span style={{
                      fontSize: '14px',
                      fontWeight: today ? 'bold' : 'normal'
                    }}>
                      {dayInfo.date.getDate()}
                    </span>

                    {/* Holiday indicator */}
                    {holiday && !hasAssign && (
                      <div style={{
                        position: 'absolute',
                        bottom: '2px',
                        left: '2px',
                        right: '2px',
                        fontSize: '7px',
                        color: '#856404',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textAlign: 'center'
                      }}>
                        {holiday.name}
                      </div>
                    )}

                    {/* Assignment indicator */}
                    {hasAssign && (
                      <div style={{
                        position: 'absolute',
                        bottom: '4px',
                        display: 'flex',
                        gap: '2px'
                      }}>
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: '#854eca'
                        }} />
                        {assignCount > 1 && (
                          <span style={{
                            fontSize: '9px',
                            color: '#854eca',
                            fontWeight: 'bold'
                          }}>
                            +{assignCount - 1}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{
              marginTop: '16px',
              display: 'flex',
              gap: '16px',
              justifyContent: 'center',
              flexWrap: 'wrap',
              fontSize: '12px',
              color: '#666'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#854eca'
                }} />
                <span>Zuweisungen</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  border: '2px solid #3498db',
                  backgroundColor: '#e8f4fd'
                }} />
                <span>Heute</span>
              </div>
              {holidays.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '2px',
                    border: '1px solid #ffc107',
                    backgroundColor: '#fff3cd'
                  }} />
                  <span>Feiertag</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Day Assignments Popup */}
        {selectedDate && (
          <DayAssignmentsPopup
            date={selectedDate}
            assignments={calendarAssignments.filter(a => a.date === selectedDate)}
            onClose={() => setSelectedDate(null)}
          />
        )}
      </div>
    </div>
  );
};

export default UnifiedCalendarModal;
