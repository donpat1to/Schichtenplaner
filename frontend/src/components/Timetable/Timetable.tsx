// frontend/src/components/Timetable/Timetable.tsx
import React, { useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Shift, TimeSlot, ShiftAssignment } from '../../models/ShiftPlan';
import { Employee } from '../../models/Employee';
import { AssignmentResult } from '../../models/scheduling';
import { DropTarget } from '../../hooks/useManualAssignmentValidation';
import TimeSlotEditor from './TimeSlotEditor';
import ShiftCell from './ShiftCell';
import AddDayButton from './AddDayButton';
import DraggableEmployeeBox from '../SwapMode/DraggableEmployeeBox';
import { formatTime } from '../../utils/formatters';
import { ICONS, BUTTON_COLORS, smallDeleteButton } from '../../utils/buttonStyles';
import styles from './Timetable.module.css';

export interface DayInfo {
    id: number;
    name: string;
    shortName?: string;
}

export interface TimetableProps {
    // Core data
    mode: 'view' | 'edit';
    shifts: Shift[];
    timeSlots: TimeSlot[];
    days: DayInfo[];
    shiftAssignments?: ShiftAssignment[];
    assignmentResult?: AssignmentResult | null;
    employees?: Employee[];
    shiftPlanStatus?: string;

    // Callbacks for edit mode
    onAddDay?: (dayOfWeek: number) => void;
    onRemoveDay?: (dayOfWeek: number) => void;
    onAddTimeSlot?: (name: string, startTime: string, endTime: string, description?: string) => void;
    onUpdateTimeSlot?: (slot: TimeSlot, name: string, startTime: string, endTime: string, description?: string) => void;
    onDeleteTimeSlot?: (slotId: string) => void;
    onAddShift?: (dayOfWeek: number, timeSlotId: string, requiredEmployees: number, color: string) => void;
    onUpdateShift?: (shift: Shift, requiredEmployees: number, color: string) => void;
    onDeleteShift?: (shiftId: string) => void;

    // Helper functions
    showValidationWarnings?: boolean;
    disabled?: boolean;

    // UI customization
    headerTitle?: string;
    showLegend?: boolean;
    compactMode?: boolean;

    // Swap mode props (drag-and-drop based)
    swapModeActive?: boolean;
    sourceSelection?: { employeeId: string; shiftId: string } | null;
    eligibleTargets?: Map<string, 'direct' | 'two-step'>;

    // Manual assignment mode props
    manualAssignmentMode?: boolean;
    draggedEmployeeId?: string | null;
    validDropTargets?: Map<string, DropTarget>;
    onRemoveAssignment?: (shiftId: string, employeeId: string) => void;
}

const DEFAULT_DAYS: DayInfo[] = [
    { id: 1, name: 'Montag', shortName: 'Mo' },
    { id: 2, name: 'Dienstag', shortName: 'Di' },
    { id: 3, name: 'Mittwoch', shortName: 'Mi' },
    { id: 4, name: 'Donnerstag', shortName: 'Do' },
    { id: 5, name: 'Freitag', shortName: 'Fr' },
    { id: 6, name: 'Samstag', shortName: 'Sa' },
    { id: 7, name: 'Sonntag', shortName: 'So' },
];

const Timetable: React.FC<TimetableProps> = ({
    mode = 'view',
    shifts = [],
    timeSlots = [],
    days = [],
    shiftAssignments = [],
    assignmentResult = null,
    employees = [],
    shiftPlanStatus = 'draft',
    onAddDay,
    onRemoveDay,
    onAddTimeSlot,
    onUpdateTimeSlot,
    onDeleteTimeSlot,
    onAddShift,
    onUpdateShift,
    onDeleteShift,
    showValidationWarnings = true,
    disabled = false,
    headerTitle = 'Schichtplan',
    showLegend = true,
    compactMode = false,
    swapModeActive = false,
    sourceSelection = null,
    eligibleTargets = new Map(),
    manualAssignmentMode = false,
    draggedEmployeeId = null,
    validDropTargets,
    onRemoveAssignment,
}) => {
    const [showAddTimeSlot, setShowAddTimeSlot] = useState(false);
    const [newTimeSlot, setNewTimeSlot] = useState({
        name: '',
        startTime: '08:00',
        endTime: '12:00',
        description: '',
    });

    // Get active days based on shifts
    const activeDays = useMemo(() => {
        if (mode === 'edit' && days.length > 0) {
            const daysWithShifts = new Set(shifts.map(s => s.dayOfWeek));
            return Array.from(daysWithShifts).sort((a, b) => a - b);
        }
        return days.map(d => d.id);
    }, [shifts, days, mode]);

    // Sort time slots by start time
    const sortedTimeSlots = useMemo(() => {
        const timeToMinutes = (timeStr: string): number => {
            if (!timeStr) return 0;
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };

        return [...timeSlots].sort((a, b) => {
            const minutesA = timeToMinutes(a.startTime);
            const minutesB = timeToMinutes(b.startTime);
            return minutesA - minutesB;
        });
    }, [timeSlots]);

    // Get shift for a specific cell
    const getShift = (timeSlotId: string, dayOfWeek: number): Shift | null => {
        return shifts.find(
            s => s.timeSlotId === timeSlotId && s.dayOfWeek === dayOfWeek
        ) || null;
    };

    // Count shifts for a time slot
    const getShiftsCountForSlot = (slotId: string): number => {
        return shifts.filter(s => s.timeSlotId === slotId).length;
    };

    // Get day name by ID
    const getDayName = (dayId: number): string => {
        const day = DEFAULT_DAYS.find(d => d.id === dayId) ||
            days.find(d => d.id === dayId);
        return day?.name || `Tag ${dayId}`;
    };

    // Get assignments for a specific shift (NEW: based on shift_id)
    const getAssignmentsForShift = (shiftId: string): string[] => {
        if (!shiftId) return [];

        // Get actual assignments from shiftAssignments
        const assignments = shiftAssignments
            .filter(sa => sa.shiftId === shiftId && sa.employeeId)
            .map(sa => sa.employeeId!);

        // If we have assignment result, use it (for preview/planning)
        if (assignmentResult && assignmentResult.assignments[shiftId]) {
            return assignmentResult.assignments[shiftId];
        }

        return assignments;
    };

    // Get assigned employees for a specific day and time slot (NEW)
    const getAssignedEmployees = (dayOfWeek: number, timeSlotId: string): string[] => {
        // Find the shift for this day and time slot
        const shift = shifts.find(s =>
            s.dayOfWeek === dayOfWeek &&
            s.timeSlotId === timeSlotId
        );

        if (!shift) return [];

        return getAssignmentsForShift(shift.id);
    };

    // Function to calculate dynamic row height based on content
    const calculateRowHeight = (timeSlotId: string): string => {
        if (mode === 'view' && (shiftPlanStatus === 'published' || shiftAssignments.length > 0)) {
            // Find the maximum number of employees in this time slot across all days
            let maxEmployees = 0;

            activeDays.forEach(dayId => {
                const assignedEmployees = getAssignedEmployees(dayId, timeSlotId);
                const employeeCount = assignedEmployees.length;
                if (employeeCount > maxEmployees) {
                    maxEmployees = employeeCount;
                }
            });

            // Calculate height: base height + (employee count * employee row height)
            const baseHeight = 60; // Base height in pixels
            const employeeRowHeight = 25; // Height per employee row
            const calculatedHeight = baseHeight + (maxEmployees * employeeRowHeight);

            // Ensure minimum and maximum heights
            return `${Math.max(60, Math.min(calculatedHeight, 200))}px`;
        }

        // For edit mode or draft status, use fixed height
        return 'auto';
    };

    // Validation function
    const validateTimetableStructure = () => {
        const validationErrors: string[] = [];

        // Check for missing time slots
        const usedTimeSlotIds = new Set(shifts.map(s => s.timeSlotId));
        const availableTimeSlotIds = new Set(timeSlots.map(ts => ts.id));

        usedTimeSlotIds.forEach(timeSlotId => {
            if (!availableTimeSlotIds.has(timeSlotId)) {
                validationErrors.push(`Zeitslot ${timeSlotId} wird verwendet, existiert aber nicht in timeSlots`);
            }
        });

        // Check for shifts with invalid day numbers
        shifts.forEach(shift => {
            if (shift.dayOfWeek < 1 || shift.dayOfWeek > 7) {
                validationErrors.push(`Shift ${shift.id} hat ungültigen Wochentag: ${shift.dayOfWeek}`);
            }

            // Check if shift timeSlotId exists in timeSlots
            const timeSlotExists = timeSlots.some(ts => ts.id === shift.timeSlotId);
            if (!timeSlotExists) {
                validationErrors.push(`Shift ${shift.id} verweist auf nicht existierenden Zeitslot: ${shift.timeSlotId}`);
            }
        });

        // Check for shift assignments consistency (NEW)
        shiftAssignments.forEach(assignment => {
            const shiftExists = shifts.some(s => s.id === assignment.shiftId);
            if (!shiftExists) {
                validationErrors.push(`Shift Assignment ${assignment.id} verweist auf nicht existierenden Shift: ${assignment.shiftId}`);
            }

            if (assignment.employeeId) {
                const employeeExists = employees.some(e => e.id === assignment.employeeId);
                if (!employeeExists) {
                    validationErrors.push(`Shift Assignment ${assignment.id} verweist auf nicht existierenden Employee: ${assignment.employeeId}`);
                }
            }
        });

        return {
            isValid: validationErrors.length === 0,
            errors: validationErrors
        };
    };

    // Handle add time slot
    const handleAddTimeSlot = () => {
        if (onAddTimeSlot && newTimeSlot.name && newTimeSlot.startTime && newTimeSlot.endTime) {
            onAddTimeSlot(
                newTimeSlot.name,
                newTimeSlot.startTime,
                newTimeSlot.endTime,
                newTimeSlot.description || undefined
            );
            setNewTimeSlot({ name: '', startTime: '08:00', endTime: '12:00', description: '' });
            setShowAddTimeSlot(false);
        }
    };

    // Render employee boxes for view mode
    const renderEmployeeBoxes = (employeeIds: string[], shiftId: string) => {
        return employeeIds.map(empId => {
            const employee = employees.find(emp => emp.id === empId);
            if (!employee) return null;

            // In swap mode, use DraggableEmployeeBox (drag-and-drop)
            if (swapModeActive) {
                const isSource = sourceSelection?.employeeId === empId && sourceSelection?.shiftId === shiftId;
                const key = `${empId}-${shiftId}`;
                const eligibility = eligibleTargets.get(key) || null;

                return (
                    <DraggableEmployeeBox
                        key={`${empId}-${shiftId}`}
                        employee={employee}
                        contextId={shiftId}
                        isSource={isSource}
                        eligibility={eligibility}
                    />
                );
            }

            // Determine background color based on employee role
            let backgroundColor = '#642ab5'; // Default: non-trainee personnel (purple)
            const isManager = employee.employeeType === 'manager';

            if (employee.isTrainee) {
                backgroundColor = '#cda8f0'; // Trainee
            } else if (isManager) {
                backgroundColor = '#CC0000'; // Manager
            }

            // In manual assignment mode, show remove button for non-managers
            if (manualAssignmentMode && onRemoveAssignment) {
                return (
                    <div
                        key={empId}
                        className={`${styles.employeeBox} ${styles.employeeBoxWithRemove}`}
                        style={{ backgroundColor }}
                        title={`${employee.firstname} ${employee.lastname}${isManager ? ' (Manager - kann nicht entfernt werden)' : ''}`}
                    >
                        <span className={styles.employeeName}>
                            {employee.firstname} {employee.lastname}
                        </span>
                        {!isManager && (
                            <button
                                className={styles.removeAssignmentButton}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveAssignment(shiftId, empId);
                                }}
                                title="Zuweisung entfernen"
                            >
                                {ICONS.delete}
                            </button>
                        )}
                    </div>
                );
            }

            return (
                <div
                    key={empId}
                    className={styles.employeeBox}
                    style={{ backgroundColor }}
                    title={`${employee.firstname} ${employee.lastname}${employee.isTrainee ? ' (Trainee)' : ''}`}
                >
                    {employee.firstname} {employee.lastname}
                </div>
            );
        }).filter(Boolean);
    };

    // Droppable zone component for manual assignment mode
    const DroppableShiftZone: React.FC<{
        shiftId: string;
        children: React.ReactNode;
        isValidTarget: boolean;
        invalidReason?: string;
        currentCount: number;
        maxCount: number;
    }> = ({ shiftId, children, isValidTarget, invalidReason, currentCount, maxCount }) => {
        const { setNodeRef, isOver } = useDroppable({
            id: `shift-drop::${shiftId}`,
        });

        const isDragging = !!draggedEmployeeId;
        const showDropFeedback = isDragging;

        let borderStyle = '2px dashed #dee2e6';
        let backgroundColor = 'transparent';

        if (showDropFeedback) {
            if (isValidTarget) {
                borderStyle = '2px dashed #27ae60';
                backgroundColor = isOver ? 'rgba(39, 174, 96, 0.15)' : 'rgba(39, 174, 96, 0.05)';
            } else {
                borderStyle = '2px dashed #e74c3c';
                backgroundColor = 'rgba(231, 76, 60, 0.05)';
            }
        }

        return (
            <div
                ref={setNodeRef}
                className={styles.droppableZone}
                style={{ border: borderStyle, backgroundColor }}
                title={!isValidTarget && invalidReason ? invalidReason : `${currentCount}/${maxCount} zugewiesen`}
            >
                {children}
                {showDropFeedback && (
                    <div className={styles.dropIndicator}>
                        <span className={styles.staffingCount}>{currentCount}/{maxCount}</span>
                    </div>
                )}
            </div>
        );
    };

    // Render cell content based on mode
    const renderCellContent = (timeSlotId: string, dayId: number) => {
        const shift = getShift(timeSlotId, dayId);

        if (mode === 'edit') {
            return null; // ShiftCell component will handle rendering
        }

        // Manual assignment mode - show droppable zones
        if (manualAssignmentMode && shift) {
            const assignedEmployees = getAssignmentsForShift(shift.id);
            const dropTarget = validDropTargets?.get(shift.id);
            const isValidTarget = dropTarget?.isValid ?? false;
            const invalidReason = dropTarget?.reason;

            return (
                <DroppableShiftZone
                    shiftId={shift.id}
                    isValidTarget={isValidTarget}
                    invalidReason={invalidReason}
                    currentCount={assignedEmployees.length}
                    maxCount={shift.maxEmployees}
                >
                    {assignedEmployees.length > 0 ? (
                        <div className={styles.employeeContainer}>
                            {renderEmployeeBoxes(assignedEmployees, shift.id)}
                        </div>
                    ) : (
                        <div className={styles.emptyShiftSlot}>
                            <span className={styles.dropHint}>Mitarbeiter hierher ziehen</span>
                            <span className={styles.shiftRequirement}>
                                Benötigt: {shift.minEmployees}-{shift.maxEmployees}
                            </span>
                        </div>
                    )}
                </DroppableShiftZone>
            );
        }

        // View mode - show assignments when available
        if (shiftPlanStatus === 'published' || assignmentResult || swapModeActive || shiftAssignments.length > 0) {
            // Get assigned employees for this shift
            const assignedEmployees = shift ? getAssignmentsForShift(shift.id) : [];

            if (assignedEmployees.length > 0) {
                return (
                    <div className={styles.employeeContainer}>
                        {renderEmployeeBoxes(assignedEmployees, shift?.id || '')}
                    </div>
                );
            }
        }

        // Fallback: Show required employees count
        if (shift) {
            return (
                <div className={styles.shiftInfo}>
                    <div className={styles.requiredCount} style={{ backgroundColor: shift.color || '#27ae60' }}>
                        {shift.requiredEmployees}
                    </div>
                    <div className={styles.requiredLabel}>Mitarbeiter</div>
                </div>
            );
        }

        return (
            <div className={styles.noShift}>
                {mode === 'view' ? 'Keine Schicht' : ''}
            </div>
        );
    };

    // Validation warnings
    const validation = showValidationWarnings ? validateTimetableStructure() : { isValid: true, errors: [] };

    // Check if timetable has data
    const hasTimeSlots = timeSlots.length > 0;
    const hasActiveDays = activeDays.length > 0;
    const hasData = hasTimeSlots && hasActiveDays;

    if (!hasData && mode === 'view') {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📅</div>
                <h4>Keine Shifts im Plan definiert</h4>
                <p>Der Schichtplan hat keine Shifts definiert oder keine Zeit-Slots konfiguriert.</p>
            </div>
        );
    }

    return (
        <div className={styles.timetableContainer}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerContent}>
                    {headerTitle}
                    {hasData && (
                        <div className={styles.headerSubtitle}>
                            {sortedTimeSlots.length} Zeitslots • {activeDays.length} Tage
                        </div>
                    )}
                </div>
            </div>

            {/* Validation Warnings */}
            {!validation.isValid && showValidationWarnings && (
                <div className={styles.validationWarning}>
                    <h4>⚠️ Validierungswarnungen:</h4>
                    <ul>
                        {validation.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Timetable Grid */}
            {hasData ? (
                <div className={styles.tableWrapper}>
                    <table className={styles.timetable}>
                        <thead>
                            <tr>
                                <th className={`${styles.timeSlotHeader} ${styles.stickyLeft}`}>
                                    Schicht (Zeit)
                                </th>
                                {activeDays.map(dayId => (
                                    <th key={dayId} className={styles.dayHeader}>
                                        <div className={styles.dayHeaderContent}>
                                            <span>{getDayName(dayId)}</span>
                                            {mode === 'edit' && onRemoveDay && (
                                                <button
                                                    onClick={() => onRemoveDay(dayId)}
                                                    disabled={disabled}
                                                    className={styles.removeDayButton}
                                                    title="Tag entfernen"
                                                >
                                                    {ICONS.delete}
                                                </button>
                                            )}
                                        </div>
                                    </th>
                                ))}
                                {mode === 'edit' && onAddDay && (
                                    <th className={styles.addDayHeader}>
                                        <AddDayButton
                                            activeDays={activeDays}
                                            onAddDay={onAddDay}
                                            disabled={disabled}
                                        />
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedTimeSlots.map((slot, index) => {
                                const rowHeight = calculateRowHeight(slot.id);

                                return (
                                    <tr key={slot.id} className={index % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                                        {/* Time Slot Column */}
                                        <td
                                            className={`${styles.timeSlotCell} ${styles.stickyLeft}`}
                                            style={{ height: rowHeight }}
                                        >
                                            {mode === 'edit' && onUpdateTimeSlot && onDeleteTimeSlot ? (
                                                <TimeSlotEditor
                                                    slot={slot}
                                                    onUpdate={onUpdateTimeSlot}
                                                    onDelete={onDeleteTimeSlot}
                                                    shiftsCount={getShiftsCountForSlot(slot.id)}
                                                    disabled={disabled}
                                                />
                                            ) : (
                                                <div className={styles.timeSlotInfo}>
                                                    <div className={styles.timeSlotName}>{slot.name}</div>
                                                    <div className={styles.timeSlotTime}>
                                                        {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                                    </div>
                                                </div>
                                            )}
                                        </td>

                                        {/* Day Columns */}
                                        {activeDays.map(dayId => (
                                            <td
                                                key={`${slot.id}-${dayId}`}
                                                className={styles.cell}
                                                style={{ height: rowHeight }}
                                            >
                                                {mode === 'edit' && onAddShift && onUpdateShift && onDeleteShift ? (
                                                    <ShiftCell
                                                        shift={getShift(slot.id, dayId)}
                                                        dayOfWeek={dayId}
                                                        timeSlotId={slot.id}
                                                        onAdd={onAddShift}
                                                        onEdit={onUpdateShift}
                                                        onDelete={onDeleteShift}
                                                        disabled={disabled}
                                                    />
                                                ) : (
                                                    <div className={styles.cellContent}>
                                                        {renderCellContent(slot.id, dayId)}
                                                    </div>
                                                )}
                                            </td>
                                        ))}

                                        {/* Delete Time Slot Column (Edit mode only) */}
                                        {mode === 'edit' && onDeleteTimeSlot && (
                                            <td className={styles.deleteSlotCell}>
                                                <button
                                                    onClick={() => onDeleteTimeSlot(slot.id)}
                                                    disabled={disabled}
                                                    className={styles.deleteSlotButton}
                                                    title="Zeit-Slot löschen"
                                                >
                                                    {ICONS.delete}
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}

                            {/* Add Time Slot Row (Edit mode only) */}
                            {mode === 'edit' && onAddTimeSlot && (
                                <tr className={styles.addTimeSlotRow}>
                                    <td colSpan={activeDays.length + (onAddDay ? 2 : 1)} className={styles.addTimeSlotCell}>
                                        {showAddTimeSlot ? (
                                            <div className={styles.addTimeSlotForm}>
                                                <div className={styles.formField}>
                                                    <label>Name *</label>
                                                    <input
                                                        type="text"
                                                        value={newTimeSlot.name}
                                                        onChange={(e) => setNewTimeSlot({ ...newTimeSlot, name: e.target.value })}
                                                        placeholder="z.B. Vormittag"
                                                        disabled={disabled}
                                                    />
                                                </div>
                                                <div className={styles.formField}>
                                                    <label>Startzeit *</label>
                                                    <input
                                                        type="time"
                                                        value={newTimeSlot.startTime}
                                                        onChange={(e) => setNewTimeSlot({ ...newTimeSlot, startTime: e.target.value })}
                                                        disabled={disabled}
                                                    />
                                                </div>
                                                <div className={styles.formField}>
                                                    <label>Endzeit *</label>
                                                    <input
                                                        type="time"
                                                        value={newTimeSlot.endTime}
                                                        onChange={(e) => setNewTimeSlot({ ...newTimeSlot, endTime: e.target.value })}
                                                        disabled={disabled}
                                                    />
                                                </div>
                                                <div className={styles.formField}>
                                                    <label>Beschreibung</label>
                                                    <input
                                                        type="text"
                                                        value={newTimeSlot.description}
                                                        onChange={(e) => setNewTimeSlot({ ...newTimeSlot, description: e.target.value })}
                                                        placeholder="Optional"
                                                        disabled={disabled}
                                                    />
                                                </div>
                                                <button
                                                    onClick={handleAddTimeSlot}
                                                    disabled={disabled || !newTimeSlot.name}
                                                    className={styles.addButton}
                                                >
                                                    {ICONS.add} Hinzufügen
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowAddTimeSlot(false);
                                                        setNewTimeSlot({ name: '', startTime: '08:00', endTime: '12:00', description: '' });
                                                    }}
                                                    disabled={disabled}
                                                    className={styles.cancelButton}
                                                >
                                                    Abbrechen
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setShowAddTimeSlot(true)}
                                                disabled={disabled}
                                                className={styles.addTimeSlotButton}
                                            >
                                                {ICONS.add} Neuer Zeit-Slot hinzufügen
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : mode === 'edit' ? (
                <div className={styles.emptyEditor}>
                    <div className={styles.emptyIcon}>📋</div>
                    <h3>Keine Schichten vorhanden</h3>
                    <p>
                        Fügen Sie zunächst einen Zeit-Slot hinzu und wählen Sie dann die Tage aus,
                        an denen Schichten stattfinden sollen.
                    </p>
                    <button
                        onClick={() => setShowAddTimeSlot(true)}
                        className={styles.addFirstTimeSlotButton}
                        disabled={disabled}
                    >
                        {ICONS.add} Zeit-Slot hinzufügen
                    </button>
                </div>
            ) : null}

            {/* Legend */}
            {showLegend && mode === 'edit' && (
                <div className={styles.legend}>
                    <h4>Legende</h4>
                    <div className={styles.legendItems}>
                        <div className={styles.legendItem}>
                            <div className={styles.legendIcon} style={{
                                backgroundColor: '#d5f4e6',
                                border: `2px solid ${BUTTON_COLORS.add}`
                            }} />
                            <span>Aktive Schicht (klicken zum Bearbeiten)</span>
                        </div>
                        <div className={styles.legendItem}>
                            <div className={styles.legendIcon} style={{
                                backgroundColor: '#f8f9fa',
                                border: '2px dashed #dee2e6'
                            }} />
                            <span>Leere Zelle (klicken zum Hinzufügen)</span>
                        </div>
                        <div className={styles.legendItem}>
                            <span className={styles.legendEditIcon}>{ICONS.edit}</span>
                            <span>Zeit-Slot bearbeiten</span>
                        </div>
                        <div className={styles.legendItem}>
                            <span className={styles.legendDeleteIcon}>{ICONS.delete}</span>
                            <span>Löschen</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Timetable;