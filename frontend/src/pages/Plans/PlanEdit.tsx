// frontend/src/pages/Plans/PlanEdit.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { weeklyPlanService } from '../../services/weeklyPlanService';
import { shiftPlanService } from '../../services/shiftPlanService';
import {
    PlanWeek,
    UpdateWeeklyPlanRequest,
    WeeklyPlanWithDetails,
    formatWeekRange,
} from '../../models/WeeklyPlan';
import { ShiftPlan, Shift, TimeSlot } from '../../models/ShiftPlan';
import { useNotification } from '../../contexts/NotificationContext';
import { useBackendValidation } from '../../hooks/useBackendValidation';
import { useAuth } from '../../contexts/AuthContext';
import Calendar from '../../components/Calendar/Calendar';
import Timetable from '../../components/Timetable/Timetable';
import {
    ICONS,
    backTextButton,
    smallDeleteButton,
    addTextButton,
    cancelTextButton,
    addOutlineButton,
} from '../../utils/buttonStyles';

const DAYS_OF_WEEK = [
    { id: 1, name: 'Montag', shortName: 'Mo' },
    { id: 2, name: 'Dienstag', shortName: 'Di' },
    { id: 3, name: 'Mittwoch', shortName: 'Mi' },
    { id: 4, name: 'Donnerstag', shortName: 'Do' },
    { id: 5, name: 'Freitag', shortName: 'Fr' },
    { id: 6, name: 'Samstag', shortName: 'Sa' },
    { id: 7, name: 'Sonntag', shortName: 'So' },
];

// Type to distinguish between plan types
type PlanType = 'weekly' | 'shift';

interface WeekFormData {
    id: string;
    weekNumber: number;
    startDate: string;
    endDate: string;
    minEmployees: number;
    maxEmployees: number;
    isEditing?: boolean;
}

interface TimeSlotFormData {
    name: string;
    startTime: string;
    endTime: string;
    description: string;
}

const PlanEdit: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { showNotification, confirmDialog } = useNotification();
    const { executeWithValidation, isSubmitting } = useBackendValidation();
    const { hasRole } = useAuth();
    const isAdmin = hasRole(['admin', 'maintenance']);

    const [planType, setPlanType] = useState<PlanType>('weekly');
    const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanWithDetails | null>(null);
    const [shiftPlan, setShiftPlan] = useState<ShiftPlan | null>(null);
    const [loading, setLoading] = useState(true);
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
    const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
    const [activeDays, setActiveDays] = useState<number[]>([]);
    const [showTimetableEditor, setShowTimetableEditor] = useState(false);

    // Plan basic info form state
    const [planInfo, setPlanInfo] = useState({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        status: 'draft' as 'draft' | 'published' | 'archived',
    });

    // Week form state (for weekly plans)
    const [showWeekForm, setShowWeekForm] = useState(false);
    const [selectedWeek, setSelectedWeek] = useState<PlanWeek | null>(null);
    const [weekFormData, setWeekFormData] = useState<WeekFormData | null>(null);

    // Time slot form state (for shift plans)
    const [showTimeSlotForm, setShowTimeSlotForm] = useState(false);
    const [timeSlotFormData, setTimeSlotFormData] = useState<TimeSlotFormData>({
        name: '',
        startTime: '08:00',
        endTime: '12:00',
        description: '',
    });

    useEffect(() => {
        determinePlanType();
    }, [id]);

    useEffect(() => {
        if (weeklyPlan) {
            setPlanInfo({
                name: weeklyPlan.name || '',
                description: weeklyPlan.description || '',
                startDate: weeklyPlan.startDate || '',
                endDate: weeklyPlan.endDate || '',
                status: weeklyPlan.status || 'draft',
            });

            if (weeklyPlan.startDate) {
                const startDate = new Date(weeklyPlan.startDate);
                setCalendarYear(startDate.getFullYear());
                setCalendarMonth(startDate.getMonth());
            }
        }

        if (shiftPlan) {
            setPlanInfo({
                name: shiftPlan.name || '',
                description: shiftPlan.description || '',
                startDate: shiftPlan.startDate || '',
                endDate: shiftPlan.endDate || '',
                status: 'draft', // Shift plans don't have status by default
            });

            const daysWithShifts = new Set(shiftPlan.shifts.map(s => s.dayOfWeek));
            setActiveDays(Array.from(daysWithShifts).sort((a, b) => a - b));
        }
    }, [weeklyPlan, shiftPlan]);

    const determinePlanType = async () => {
        if (!id) return;

        try {
            // Try to load as weekly plan first
            const plan = await weeklyPlanService.getWeeklyPlan(id);
            setWeeklyPlan(plan);
            setPlanType('weekly');
        } catch (error) {
            // If not a weekly plan, try as shift plan
            try {
                const plan = await shiftPlanService.getShiftPlan(id);
                setShiftPlan(plan);
                setPlanType('shift');
            } catch (err) {
                showNotification({
                    type: 'error',
                    title: 'Fehler',
                    message: 'Plan konnte nicht geladen werden.'
                });
                navigate('/plans');
            }
        } finally {
            setLoading(false);
        }
    };

    const updatePlan = async () => {
        if (!id || !planInfo.name.trim()) {
            showNotification({
                type: 'error',
                title: 'Fehlende Angaben',
                message: 'Bitte geben Sie einen Namen für den Plan ein.'
            });
            return;
        }

        await executeWithValidation(async () => {
            if (planType === 'weekly') {
                const updateData: UpdateWeeklyPlanRequest = {
                    name: planInfo.name,
                    description: planInfo.description || undefined,
                    startDate: planInfo.startDate || undefined,
                    endDate: planInfo.endDate || undefined,
                    status: planInfo.status,
                };
                await weeklyPlanService.updateWeeklyPlan(id, updateData);
            } else {
                await shiftPlanService.updateShiftPlan(id, {
                    name: planInfo.name,
                    description: planInfo.description || undefined,
                    startDate: planInfo.startDate || undefined,
                    endDate: planInfo.endDate || undefined,
                });
            }

            showNotification({
                type: 'success',
                title: 'Erfolg',
                message: 'Plan wurde aktualisiert.'
            });

            await determinePlanType();
        });
    };

    const handleCalendarMonthChange = (year: number, month: number) => {
        setCalendarYear(year);
        setCalendarMonth(month);
    };

    const getShift = (timeSlotId: string, dayOfWeek: number): Shift | null => {
        if (!shiftPlan) return null;
        return shiftPlan.shifts.find(
            s => s.timeSlotId === timeSlotId && s.dayOfWeek === dayOfWeek
        ) || null;
    };

    const getShiftsCountForSlot = (slotId: string): number => {
        if (!shiftPlan) return 0;
        return shiftPlan.shifts.filter(s => s.timeSlotId === slotId).length;
    };

    const sortedTimeSlots = useMemo(() => {
        if (!shiftPlan) return [];

        const timeToMinutes = (timeStr: string): number => {
            if (!timeStr) return 0;
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };

        return [...shiftPlan.timeSlots].sort((a, b) => {
            const minutesA = timeToMinutes(a.startTime);
            const minutesB = timeToMinutes(b.startTime);
            return minutesA - minutesB;
        });
    }, [shiftPlan]);

    const addDay = (dayOfWeek: number) => {
        if (!activeDays.includes(dayOfWeek)) {
            setActiveDays([...activeDays, dayOfWeek].sort((a, b) => a - b));
        }
    };

    const removeDay = async (dayOfWeek: number) => {
        if (!shiftPlan || !id) return;

        const shiftsForDay = shiftPlan.shifts.filter(s => s.dayOfWeek === dayOfWeek);

        if (shiftsForDay.length > 0) {
            const confirmed = await confirmDialog({
                title: 'Tag entfernen',
                message: `Dieser Tag enthält ${shiftsForDay.length} Schicht(en). Alle Schichten für diesen Tag werden gelöscht. Fortfahren?`,
                confirmText: 'Löschen',
                cancelText: 'Abbrechen',
                type: 'warning'
            });

            if (!confirmed) return;

            await executeWithValidation(async () => {
                for (const shift of shiftsForDay) {
                    await shiftPlanService.deleteShift(id, shift.id);
                }
                await determinePlanType();
                showNotification({
                    type: 'success',
                    title: 'Erfolg',
                    message: `Alle Schichten für diesen Tag wurden gelöscht.`
                });
            });
        }

        setActiveDays(activeDays.filter(d => d !== dayOfWeek));
    };

    const addTimeSlot = async () => {
        if (!id || !timeSlotFormData.name || !timeSlotFormData.startTime || !timeSlotFormData.endTime) {
            showNotification({
                type: 'error',
                title: 'Fehlende Angaben',
                message: 'Bitte füllen Sie alle Pflichtfelder aus.'
            });
            return;
        }

        await executeWithValidation(async () => {
            await shiftPlanService.addTimeSlot(id, {
                name: timeSlotFormData.name,
                startTime: timeSlotFormData.startTime,
                endTime: timeSlotFormData.endTime,
                description: timeSlotFormData.description || undefined,
            });

            showNotification({
                type: 'success',
                title: 'Erfolg',
                message: 'Zeit-Slot wurde hinzugefügt.'
            });

            setTimeSlotFormData({ name: '', startTime: '08:00', endTime: '12:00', description: '' });
            setShowTimeSlotForm(false);
            await determinePlanType();
        });
    };

    const updateTimeSlot = async (
        slot: TimeSlot,
        name: string,
        startTime: string,
        endTime: string,
        description?: string
    ) => {
        if (!id) return;

        await executeWithValidation(async () => {
            await shiftPlanService.updateTimeSlot(id, slot.id, {
                name,
                startTime,
                endTime,
                description,
            });

            showNotification({
                type: 'success',
                title: 'Erfolg',
                message: 'Zeit-Slot wurde aktualisiert.'
            });

            await determinePlanType();
        });
    };

    const deleteTimeSlot = async (slotId: string) => {
        if (!id || !shiftPlan) return;

        const shiftsCount = getShiftsCountForSlot(slotId);

        const confirmed = await confirmDialog({
            title: 'Zeit-Slot löschen',
            message: shiftsCount > 0
                ? `Dieser Zeit-Slot enthält ${shiftsCount} Schicht(en). Alle zugehörigen Schichten werden ebenfalls gelöscht. Fortfahren?`
                : 'Möchten Sie diesen Zeit-Slot wirklich löschen?',
            confirmText: 'Löschen',
            cancelText: 'Abbrechen',
            type: 'warning'
        });

        if (!confirmed) return;

        await executeWithValidation(async () => {
            await shiftPlanService.deleteTimeSlot(id, slotId);

            showNotification({
                type: 'success',
                title: 'Erfolg',
                message: 'Zeit-Slot wurde gelöscht.'
            });

            await determinePlanType();
        });
    };

    const addShift = async (
        dayOfWeek: number,
        timeSlotId: string,
        minEmployees: number,
        maxEmployees: number,
        color: string
    ) => {
        if (!id) return;

        await executeWithValidation(async () => {
            await shiftPlanService.addShift(id, {
                dayOfWeek,
                timeSlotId,
                minEmployees,
                maxEmployees,
                color,
            });

            showNotification({
                type: 'success',
                title: 'Erfolg',
                message: 'Schicht wurde hinzugefügt.'
            });

            await determinePlanType();
        });
    };

    const updateShift = async (
        shift: Shift,
        minEmployees: number,
        maxEmployees: number,
        color: string
    ) => {
        if (!id) return;

        await executeWithValidation(async () => {
            await shiftPlanService.updateShift(id, shift.id, {
                minEmployees,
                maxEmployees,
                color,
            });

            showNotification({
                type: 'success',
                title: 'Erfolg',
                message: 'Schicht wurde aktualisiert.'
            });

            await determinePlanType();
        });
    };

    const deleteShift = async (shiftId: string) => {
        if (!id) return;

        const confirmed = await confirmDialog({
            title: 'Schicht löschen',
            message: 'Möchten Sie diese Schicht wirklich löschen?',
            confirmText: 'Löschen',
            cancelText: 'Abbrechen',
            type: 'warning'
        });

        if (!confirmed) return;

        await executeWithValidation(async () => {
            await shiftPlanService.deleteShift(id, shiftId);

            showNotification({
                type: 'success',
                title: 'Erfolg',
                message: 'Schicht wurde gelöscht.'
            });

            await determinePlanType();
        });
    };

    const updateWeekConstraints = async (weekId: string, minEmployees: number, maxEmployees: number) => {
        if (!id || !isAdmin) return;

        await executeWithValidation(async () => {
            await weeklyPlanService.updateWeek(id, weekId, {
                minEmployees,
                maxEmployees,
            });

            showNotification({
                type: 'success',
                title: 'Erfolg',
                message: 'Wocheneinstellungen wurden aktualisiert.'
            });

            await determinePlanType();
        });
    };

    if (loading) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '40px',
                fontSize: '18px',
                color: '#666'
            }}>
                Lade Plan...
            </div>
        );
    }

    if (!weeklyPlan && !shiftPlan) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '40px',
                fontSize: '18px',
                color: '#e74c3c'
            }}>
                Plan nicht gefunden
            </div>
        );
    }

    const plan = planType === 'weekly' ? weeklyPlan : shiftPlan;
    const hasWeeks = weeklyPlan?.weeks && weeklyPlan.weeks.length > 0 || false;
    const hasTimeSlots = shiftPlan?.timeSlots && shiftPlan?.timeSlots.length > 0 || false;
    const hasActiveDays = activeDays.length > 0;

    return (
        <div style={{ padding: '20px' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '30px'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h1 style={{ margin: 0 }}>{plan?.name} bearbeiten</h1>
                        <span style={{
                            padding: '4px 8px',
                            backgroundColor: planType === 'weekly' ? '#3498db' : '#2ecc71',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                        }}>
                            {planType === 'weekly' ? 'Wochenplan' : 'Schichtplan'}
                        </span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '14px' }}>
                        {planType === 'weekly' ? 'Wochenbasierte Personalplanung' : 'Tages- und schichtbasierte Planung'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {planType === 'shift' && (
                        <button
                            onClick={() => setShowTimetableEditor(!showTimetableEditor)}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: showTimetableEditor ? '#3498db' : '#2ecc71',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                opacity: isSubmitting ? 0.6 : 1
                            }}
                            disabled={isSubmitting}
                        >
                            {showTimetableEditor ? 'Tabellen-Editor ausblenden' : 'Tabellen-Editor anzeigen'}
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/plans')}
                        disabled={isSubmitting}
                        style={backTextButton(false)}
                    >
                        Zurück
                    </button>
                </div>
            </div>

            {/* Basic Information Form */}
            <div style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '24px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                marginBottom: '20px'
            }}>
                <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#2c3e50' }}>
                    Grundinformationen
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                            Name *
                        </label>
                        <input
                            type="text"
                            value={planInfo.name}
                            onChange={(e) => setPlanInfo({ ...planInfo, name: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                fontSize: '14px'
                            }}
                            placeholder={`Name des ${planType === 'weekly' ? 'Wochenplans' : 'Schichtplans'}`}
                            disabled={isSubmitting}
                        />
                    </div>

                    {planType === 'weekly' && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                Status
                            </label>
                            <select
                                value={planInfo.status}
                                onChange={(e) => setPlanInfo({ ...planInfo, status: e.target.value as 'draft' | 'published' | 'archived' })}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                    fontSize: '14px',
                                    backgroundColor: 'white'
                                }}
                                disabled={isSubmitting}
                            >
                                <option value="draft">Entwurf</option>
                                <option value="published">Veröffentlicht</option>
                                <option value="archived">Archiviert</option>
                            </select>
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                            Beschreibung
                        </label>
                        <textarea
                            value={planInfo.description}
                            onChange={(e) => setPlanInfo({ ...planInfo, description: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                fontSize: '14px',
                                minHeight: '80px',
                                resize: 'vertical'
                            }}
                            placeholder="Beschreibung (optional)"
                            disabled={isSubmitting}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                            Planungszeitraum
                        </label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="date"
                                value={planInfo.startDate}
                                onChange={(e) => setPlanInfo({ ...planInfo, startDate: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                    fontSize: '14px'
                                }}
                                disabled={isSubmitting}
                            />
                            <span style={{ alignSelf: 'center' }}>bis</span>
                            <input
                                type="date"
                                value={planInfo.endDate}
                                onChange={(e) => setPlanInfo({ ...planInfo, endDate: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                    fontSize: '14px'
                                }}
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '20px' }}>
                    <button
                        onClick={updatePlan}
                        disabled={isSubmitting || !planInfo.name.trim()}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: !planInfo.name.trim() ? '#bdc3c7' : '#3498db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: !planInfo.name.trim() || isSubmitting ? 'not-allowed' : 'pointer',
                            fontWeight: '500',
                            fontSize: '14px'
                        }}
                    >
                        {isSubmitting ? 'Speichern...' : 'Grundinformationen speichern'}
                    </button>
                </div>
            </div>

            {/* Weekly Plan Specific Content */}
            {planType === 'weekly' && (
                <>
                    {/* Calendar View */}
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        padding: '24px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        marginBottom: '20px'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px'
                        }}>
                            <h2 style={{ margin: 0, color: '#2c3e50' }}>Kalenderansicht</h2>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <Calendar
                                year={calendarYear}
                                month={calendarMonth}
                                weeks={weeklyPlan?.weeks || []}
                                onMonthChange={handleCalendarMonthChange}
                                style='monthly'
                            />
                        </div>
                    </div>

                    {/* Weeks List */}
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        padding: '24px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        marginBottom: '20px'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '20px'
                        }}>
                            <h2 style={{ margin: 0, color: '#2c3e50' }}>
                                Wochen ({weeklyPlan?.weeks?.length || 0})
                            </h2>
                        </div>

                        {!hasWeeks ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '40px',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '8px',
                                border: '2px dashed #dee2e6'
                            }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>
                                    📅
                                </div>
                                <h3 style={{ color: '#2c3e50', marginBottom: '8px' }}>
                                    Keine Wochen vorhanden
                                </h3>
                                <p style={{ color: '#666', marginBottom: '24px' }}>
                                    Fügen Sie Wochen hinzu, um mit der Planung zu beginnen.
                                </p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    backgroundColor: 'white',
                                    border: '1px solid #dee2e6'
                                }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f8f9fa' }}>
                                            <th style={{
                                                padding: '12px 16px',
                                                textAlign: 'left',
                                                border: '1px solid #dee2e6',
                                                fontWeight: 'bold',
                                                minWidth: '80px'
                                            }}>
                                                KW
                                            </th>
                                            <th style={{
                                                padding: '12px 16px',
                                                textAlign: 'left',
                                                border: '1px solid #dee2e6',
                                                fontWeight: 'bold',
                                                minWidth: '180px'
                                            }}>
                                                Zeitraum
                                            </th>
                                            <th style={{
                                                padding: '12px 16px',
                                                textAlign: 'left',
                                                border: '1px solid #dee2e6',
                                                fontWeight: 'bold',
                                                minWidth: '120px'
                                            }}>
                                                Mindestanzahl
                                            </th>
                                            <th style={{
                                                padding: '12px 16px',
                                                textAlign: 'left',
                                                border: '1px solid #dee2e6',
                                                fontWeight: 'bold',
                                                minWidth: '120px'
                                            }}>
                                                Höchstanzahl
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {weeklyPlan?.weeks?.map((week, index) => {
                                            const assignmentsCount = weeklyPlan.assignments?.filter(a => a.weekId === week.id).length || 0;
                                            const isUnderstaffed = assignmentsCount < week.minEmployees;
                                            const isOverstaffed = assignmentsCount > week.maxEmployees;

                                            return (
                                                <tr key={week.id} style={{
                                                    backgroundColor: index % 2 === 0 ? 'white' : '#f8f9fa'
                                                }}>
                                                    <td style={{
                                                        padding: '12px 16px',
                                                        border: '1px solid #dee2e6',
                                                        fontWeight: 'bold',
                                                        textAlign: 'center'
                                                    }}>
                                                        {week.weekNumber}
                                                    </td>
                                                    <td style={{
                                                        padding: '12px 16px',
                                                        border: '1px solid #dee2e6'
                                                    }}>
                                                        {formatWeekRange(week.startDate, week.endDate)}
                                                    </td>
                                                    <td style={{
                                                        padding: '8px 12px',
                                                        border: '1px solid #dee2e6',
                                                        textAlign: 'center'
                                                    }}>
                                                        {isAdmin ? (
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max={week.maxEmployees}
                                                                defaultValue={week.minEmployees}
                                                                onKeyDown={(e) => e.preventDefault()}
                                                                onChange={(e) => {
                                                                    const newMin = parseInt(e.target.value) || 2;
                                                                    if (newMin !== week.minEmployees) {
                                                                        updateWeekConstraints(week.id, newMin, week.maxEmployees);
                                                                    }
                                                                }}
                                                                disabled={isSubmitting}
                                                                style={{
                                                                    width: '60px',
                                                                    padding: '6px 8px',
                                                                    borderRadius: '4px',
                                                                    border: '1px solid #ddd',
                                                                    fontSize: '14px',
                                                                    textAlign: 'center'
                                                                }}
                                                            />
                                                        ) : (
                                                            week.minEmployees
                                                        )}
                                                    </td>
                                                    <td style={{
                                                        padding: '8px 12px',
                                                        border: '1px solid #dee2e6',
                                                        textAlign: 'center',
                                                    }}>
                                                        {isAdmin ? (
                                                            <input
                                                                type="number"
                                                                min={week.minEmployees}
                                                                max="10"
                                                                value={week.maxEmployees}
                                                                onKeyDown={(e) => e.preventDefault()}
                                                                onChange={(e) => {
                                                                    const newMax = parseInt(e.target.value) || week.minEmployees;
                                                                    if (newMax >= week.minEmployees) {
                                                                        updateWeekConstraints(week.id, week.minEmployees, newMax);
                                                                    }
                                                                }}
                                                                disabled={isSubmitting}
                                                                style={{
                                                                    width: '60px',
                                                                    padding: '6px 8px',
                                                                    borderRadius: '4px',
                                                                    border: '1px solid #ddd',
                                                                    fontSize: '14px',
                                                                    textAlign: 'center'
                                                                }}
                                                            />
                                                        ) : (
                                                            week.maxEmployees
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Shift Plan Specific Content */}
            {planType === 'shift' && showTimetableEditor && (
                <>
                    {/* Empty State */}
                    {!hasTimeSlots && !hasActiveDays && (
                        <div style={{
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            padding: '60px 40px',
                            textAlign: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            marginBottom: '20px',
                        }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>
                                📋
                            </div>
                            <h2 style={{ color: '#2c3e50', marginBottom: '8px' }}>
                                Keine Schichten vorhanden
                            </h2>
                            <p style={{ color: '#666', marginBottom: '24px' }}>
                                Fügen Sie zunächst einen Zeit-Slot hinzu und wählen Sie dann die Tage aus,
                                an denen Schichten stattfinden sollen.
                            </p>
                            <button
                                onClick={() => setShowTimeSlotForm(true)}
                                style={{
                                    ...addTextButton(false),
                                    padding: '12px 24px',
                                    fontSize: '16px',
                                }}
                            >
                                {ICONS.add} Zeit-Slot hinzufügen
                            </button>
                        </div>
                    )}

                    {/* Timetable Editor */}
                    {showTimetableEditor && (
                        <Timetable
                            mode="edit"
                            shifts={shiftPlan?.shifts || []}
                            timeSlots={sortedTimeSlots}
                            days={DAYS_OF_WEEK}
                            onAddDay={addDay}
                            onRemoveDay={removeDay}
                            onAddTimeSlot={addTimeSlot}
                            onUpdateTimeSlot={updateTimeSlot}
                            onDeleteTimeSlot={deleteTimeSlot}
                            onAddShift={addShift}
                            onUpdateShift={updateShift}
                            onDeleteShift={deleteShift}
                            disabled={isSubmitting}
                            headerTitle="Schichtplan bearbeiten"
                            showLegend={true}
                        />
                    )}
                </>
            )}

            {/* Time Slot Form Modal */}
            {showTimeSlotForm && (
                <div style={{
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
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        padding: '30px',
                        width: '90%',
                        maxWidth: '500px',
                        maxHeight: '90vh',
                        overflowY: 'auto'
                    }}>
                        <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#2c3e50' }}>
                            Neuer Zeit-Slot
                        </h2>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                Name *
                            </label>
                            <input
                                type="text"
                                value={timeSlotFormData.name}
                                onChange={(e) => setTimeSlotFormData({ ...timeSlotFormData, name: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                    fontSize: '14px'
                                }}
                                placeholder="z.B. Frühschicht, Spätschicht"
                                disabled={isSubmitting}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                    Startzeit *
                                </label>
                                <input
                                    type="time"
                                    value={timeSlotFormData.startTime}
                                    onChange={(e) => setTimeSlotFormData({ ...timeSlotFormData, startTime: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '4px',
                                        border: '1px solid #ddd',
                                        fontSize: '14px'
                                    }}
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                    Endzeit *
                                </label>
                                <input
                                    type="time"
                                    value={timeSlotFormData.endTime}
                                    onChange={(e) => setTimeSlotFormData({ ...timeSlotFormData, endTime: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '4px',
                                        border: '1px solid #ddd',
                                        fontSize: '14px'
                                    }}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                Beschreibung
                            </label>
                            <textarea
                                value={timeSlotFormData.description}
                                onChange={(e) => setTimeSlotFormData({ ...timeSlotFormData, description: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                    fontSize: '14px',
                                    minHeight: '60px',
                                    resize: 'vertical'
                                }}
                                placeholder="Beschreibung (optional)"
                                disabled={isSubmitting}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                            <button
                                onClick={() => setShowTimeSlotForm(false)}
                                style={cancelTextButton(false)}
                                disabled={isSubmitting}
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={addTimeSlot}
                                disabled={isSubmitting || !timeSlotFormData.name.trim() || !timeSlotFormData.startTime || !timeSlotFormData.endTime}
                                style={{
                                    ...addTextButton(false),
                                    opacity: (!timeSlotFormData.name.trim() || !timeSlotFormData.startTime || !timeSlotFormData.endTime || isSubmitting) ? 0.6 : 1,
                                    cursor: (!timeSlotFormData.name.trim() || !timeSlotFormData.startTime || !timeSlotFormData.endTime || isSubmitting) ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {isSubmitting ? 'Hinzufügen...' : 'Hinzufügen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlanEdit;