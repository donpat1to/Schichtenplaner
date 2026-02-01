// frontend/src/components/Calendar/Calendar.tsx
import React from 'react';
import { EmployeeWithPreferences, PlanWeek } from '../../models/WeeklyPlan';
import SwapableEmployeeBox from '../SwapMode/SwapableEmployeeBox';
import styles from './Calendar.module.css';

export interface CalendarProps {
    year: number;
    month: number; // 0-11 (0 = January)
    weeks: PlanWeek[];
    employees?: EmployeeWithPreferences[];
    onMonthChange: (year: number, month: number) => void;
    getDayInfo?: (date: Date) => {
        isInPlan: boolean;
        weekId?: string;
        isAssigned?: boolean;
        preferenceLevel?: 1 | 2 | 3;
    };
    onDayClick?: (date: Date, weekId?: string) => void;

    // Preference mode props
    mode?: 'view' | 'preferences';
    weekPreferences?: Record<string, 1 | 2 | 3>;
    onPreferenceChange?: (weekId: string) => void;
    disabled?: boolean;

    // Swap mode props
    swapModeActive?: boolean;
    sourceSelection?: { employeeId: string; weekId: string } | null;
    eligibleTargets?: Map<string, 'direct' | 'two-step'>;
    onEmployeeClick?: (employeeId: string, weekId: string) => void;

    // Layout props
    hideNavigation?: boolean;
}

const Calendar: React.FC<CalendarProps> = ({
    year,
    month,
    weeks,
    employees = [],
    onMonthChange,
    getDayInfo,
    onDayClick,
    mode = 'view',
    weekPreferences = {},
    onPreferenceChange,
    disabled = false,
    swapModeActive = false,
    sourceSelection = null,
    eligibleTargets = new Map(),
    onEmployeeClick,
    hideNavigation = false,
}) => {
    const monthNames = [
        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];

    const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    // Get first day of month and last day of month
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Get the Monday of the week containing the 1st of the month
    const firstDayOfCalendar = new Date(firstDayOfMonth);
    const dayOfWeek = firstDayOfMonth.getDay();
    // Adjust for Monday-first week (0 = Sunday, 1 = Monday, ... 6 = Saturday)
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    firstDayOfCalendar.setDate(firstDayOfCalendar.getDate() - diffToMonday);

    // Get the Sunday of the week containing the last day of the month
    const lastDayOfCalendar = new Date(lastDayOfMonth);
    const lastDayOfWeek = lastDayOfMonth.getDay();
    const diffToSunday = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
    lastDayOfCalendar.setDate(lastDayOfCalendar.getDate() + diffToSunday);

    // Generate calendar grid
    const generateCalendarGrid = () => {
        const grid: Array<Array<{
            date: Date;
            isCurrentMonth: boolean;
            dayInfo?: ReturnType<NonNullable<typeof getDayInfo>>;
        }>> = [];

        let currentDate = new Date(firstDayOfCalendar);

        while (currentDate <= lastDayOfCalendar) {
            const week: Array<{
                date: Date;
                isCurrentMonth: boolean;
                dayInfo?: ReturnType<NonNullable<typeof getDayInfo>>;
            }> = [];

            for (let i = 0; i < 7; i++) {
                const date = new Date(currentDate);
                const isCurrentMonth = date.getMonth() === month;

                const dayInfo = getDayInfo ? getDayInfo(date) : undefined;

                week.push({
                    date,
                    isCurrentMonth,
                    dayInfo,
                });

                currentDate.setDate(currentDate.getDate() + 1);
            }

            grid.push(week);
        }

        return grid;
    };

    const handlePrevMonth = () => {
        const newDate = new Date(year, month - 1, 1);
        onMonthChange(newDate.getFullYear(), newDate.getMonth());
    };

    const handleNextMonth = () => {
        const newDate = new Date(year, month + 1, 1);
        onMonthChange(newDate.getFullYear(), newDate.getMonth());
    };

    const handleToday = () => {
        const today = new Date();
        onMonthChange(today.getFullYear(), today.getMonth());
    };

    const getWeekNumber = (date: Date) => {
        const target = new Date(date.valueOf());
        const dayNr = (date.getDay() + 6) % 7;
        target.setDate(target.getDate() - dayNr + 3);
        const firstThursday = target.valueOf();
        target.setMonth(0, 1);
        if (target.getDay() !== 4) {
            target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
        }
        return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    };

    // Get plan week for a calendar week
    const getPlanWeekForDate = (date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        return weeks.find(w => {
            const start = new Date(w.startDate);
            const end = new Date(w.endDate);
            const checkDate = new Date(dateStr);
            return checkDate >= start && checkDate <= end;
        });
    };

    // Get employees assigned to a specific week
    const getAssignedEmployeesForWeek = (weekId: string) => {
        return employees.filter(emp => emp.assignedWeeks.includes(weekId));
    };

    // Get preference display info
    const getPreferenceDisplay = (level: 1 | 2 | 3 | undefined) => {
        if (!level) return { text: 'Keine Angabe', color: '#999', bg: '#f8f8f8', borderColor: '#e0e0e0' };
        const displays = {
            1: { text: '1: Bevorzugt', color: '#22c55e', bg: '#dcfce7', borderColor: '#22c55e' },
            2: { text: '2: Verfügbar', color: '#eab308', bg: '#fef9c3', borderColor: '#eab308' },
            3: { text: '3: Nicht verfügbar', color: '#ef4444', bg: '#fee2e2', borderColor: '#ef4444' },
        };
        return displays[level];
    };

    // Render employee boxes for a week (view mode or swap mode)
    const renderEmployeeBoxes = (weekId: string) => {
        const assignedEmployees = getAssignedEmployeesForWeek(weekId);

        if (assignedEmployees.length === 0) {
            return null;
        }

        // If swap mode is active, use SwapableEmployeeBox
        if (swapModeActive) {
            return assignedEmployees.map(employee => {
                const key = `${employee.id}-${weekId}`;
                const isSource = sourceSelection?.employeeId === employee.id &&
                    sourceSelection?.weekId === weekId;
                const eligibility = !isSource ? eligibleTargets.get(key) || null : null;

                return (
                    <SwapableEmployeeBox
                        key={key}
                        employee={employee}
                        contextId={weekId}
                        isSource={isSource}
                        eligibility={eligibility}
                        onSelect={onEmployeeClick}
                    />
                );
            });
        }

        // Standard view mode
        return assignedEmployees.map(employee => {
            // Determine background color based on employee role
            let backgroundColor = '#642ab5'; // Default: non-trainee personnel (purple)

            if (employee.isTrainee) {
                backgroundColor = '#cda8f0'; // Trainee (light purple)
            } else if (employee.employeeType === 'manager') {
                backgroundColor = '#CC0000'; // Manager (red)
            }

            return (
                <div
                    key={employee.id}
                    className={styles.employeeBox}
                    style={{ backgroundColor }}
                    title={`${employee.firstname} ${employee.lastname}${employee.isTrainee ? ' (Trainee)' : ''}`}
                >
                    {employee.firstname} {employee.lastname}
                </div>
            );
        });
    };

    // Render preference toggle for a week (preferences mode)
    const renderPreferenceToggle = (weekId: string) => {
        const pref = weekPreferences[weekId];
        const prefDisplay = getPreferenceDisplay(pref);

        return (
            <div
                className={`${styles.preferenceToggle} ${disabled ? styles.disabled : ''}`}
                style={{
                    backgroundColor: prefDisplay.bg,
                    borderColor: prefDisplay.borderColor,
                    color: prefDisplay.color,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                }}
                onClick={() => !disabled && onPreferenceChange?.(weekId)}
                title={disabled ? 'Bearbeitung nicht erlaubt' : 'Klicken zum Ändern'}
            >
                <span className={styles.preferenceText}>{prefDisplay.text}</span>
                {!disabled && <span className={styles.preferenceHint}>Klicken zum Ändern</span>}
            </div>
        );
    };

    const calendarGrid = generateCalendarGrid();

    return (
        <div className={styles.calendar}>
            {!hideNavigation && (
                <div className={styles.calendarHeader}>
                    <button onClick={handlePrevMonth} className={styles.navButton}>
                        &lt;
                    </button>

                    <div className={styles.monthYear}>
                        <span className={styles.monthName}>{monthNames[month]}</span>
                        <span className={styles.year}>{year}</span>
                        <button onClick={handleToday} className={styles.todayButton}>
                            Heute
                        </button>
                    </div>

                    <button onClick={handleNextMonth} className={styles.navButton}>
                        &gt;
                    </button>
                </div>
            )}

            <div className={styles.calendarGrid}>
                {/* Day names header */}
                <div className={styles.headerRow}>
                    <div className={styles.weekNumberHeader}>KW</div>
                    {dayNames.map((day, index) => (
                        <div key={index} className={styles.dayName}>
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar weeks */}
                {calendarGrid.map((week, weekIndex) => {
                    const weekNumber = getWeekNumber(week[0].date);
                    const planWeek = getPlanWeekForDate(week[0].date);

                    return (
                        <div key={weekIndex} className={styles.weekContainer}>
                            {/* KW column spanning both rows */}
                            <div className={styles.weekNumberCell}>
                                <span className={styles.weekNumberText}>{weekNumber}</span>
                            </div>

                            {/* Content area with days and employees/preferences */}
                            <div className={styles.weekContent}>
                                {/* Upper row: Day cells */}
                                <div className={styles.daysRow}>
                                    {week.map((day, dayIndex) => {
                                        const dayClass = [
                                            styles.day,
                                            !day.isCurrentMonth ? styles.adjacentMonth : '',
                                            day.dayInfo?.isInPlan ? styles.inPlan : '',
                                            day.dayInfo?.isAssigned ? styles.assigned : '',
                                        ].filter(Boolean).join(' ');

                                        const getPreferenceStyle = () => {
                                            if (!day.dayInfo?.preferenceLevel) return {};

                                            const colors = {
                                                1: { bg: '#dcfce7', color: '#22c55e' },
                                                2: { bg: '#fef9c3', color: '#eab308' },
                                                3: { bg: '#fee2e2', color: '#ef4444' },
                                            };

                                            return {
                                                backgroundColor: colors[day.dayInfo.preferenceLevel].bg,
                                                color: colors[day.dayInfo.preferenceLevel].color,
                                            };
                                        };

                                        return (
                                            <div
                                                key={dayIndex}
                                                className={dayClass}
                                                style={getPreferenceStyle()}
                                                onClick={() => onDayClick?.(day.date, day.dayInfo?.weekId)}
                                                title={
                                                    day.dayInfo?.preferenceLevel
                                                        ? `Präferenz: ${day.dayInfo.preferenceLevel === 1 ? 'Bevorzugt' :
                                                            day.dayInfo.preferenceLevel === 2 ? 'Verfügbar' : 'Nicht verfügbar'
                                                        }`
                                                        : undefined
                                                }
                                            >
                                                <div className={styles.dayNumber}>{day.date.getDate()}</div>

                                                {day.dayInfo?.isAssigned && (
                                                    <div className={styles.assignedMarker}>✓</div>
                                                )}

                                                {day.dayInfo?.preferenceLevel && (
                                                    <div className={styles.preferenceIndicator}>
                                                        {day.dayInfo.preferenceLevel}
                                                    </div>
                                                )}

                                                {!day.isCurrentMonth && (
                                                    <div className={styles.monthIndicator}>
                                                        {day.date.getMonth() + 1}/{day.date.getFullYear()}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Lower row: Employee boxes (view mode) or Preference toggle (preferences mode) */}
                                <div className={styles.employeesRow}>
                                    {planWeek && (
                                        mode === 'preferences' ? (
                                            renderPreferenceToggle(planWeek.id)
                                        ) : (
                                            <div className={styles.employeeBoxContainer}>
                                                {renderEmployeeBoxes(planWeek.id)}
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legend - different based on mode */}
            <div className={styles.legend}>
                {mode === 'preferences' ? (
                    // Preferences mode legend
                    <>
                        <div className={styles.legendItem}>
                            <div className={`${styles.legendColor} ${styles.pref1}`}></div>
                            <span>1 = Bevorzugt</span>
                        </div>
                        <div className={styles.legendItem}>
                            <div className={`${styles.legendColor} ${styles.pref2}`}></div>
                            <span>2 = Verfügbar</span>
                        </div>
                        <div className={styles.legendItem}>
                            <div className={`${styles.legendColor} ${styles.pref3}`}></div>
                            <span>3 = Nicht verfügbar</span>
                        </div>
                        <div className={styles.legendItem}>
                            <div className={`${styles.legendColor} ${styles.assigned}`}></div>
                            <span>Zugewiesen</span>
                        </div>
                    </>
                ) : (
                    // View mode legend
                    <>
                        <div className={styles.legendItem}>
                            <div className={styles.employeeBoxLegend} style={{ backgroundColor: '#642ab5' }}></div>
                            <span>Mitarbeiter</span>
                        </div>
                        <div className={styles.legendItem}>
                            <div className={styles.employeeBoxLegend} style={{ backgroundColor: '#cda8f0' }}></div>
                            <span>Trainee</span>
                        </div>
                        <div className={styles.legendItem}>
                            <div className={styles.employeeBoxLegend} style={{ backgroundColor: '#CC0000' }}></div>
                            <span>Manager</span>
                        </div>
                    </>
                )}
                <div className={styles.legendItem}>
                    <div className={styles.adjacentMonthDay}>31</div>
                    <span>Außerhalb des Monats</span>
                </div>
            </div>
        </div>
    );
};

export default Calendar;
