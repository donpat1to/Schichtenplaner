// frontend/src/pages/WeeklyPlans/WeeklyPlanEdit.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { weeklyPlanService } from '../../services/weeklyPlanService';
import {
    WeeklyPlan,
    PlanWeek,
    UpdateWeeklyPlanRequest,
    UpdateWeekRequest,
    WeeklyPlanWithDetails,
    getWeekDateRange,
    formatWeekRange,
    PreferenceLevelLabels,
    PreferenceLevelColors
} from '../../models/WeeklyPlan';
import { useNotification } from '../../contexts/NotificationContext';
import { useBackendValidation } from '../../hooks/useBackendValidation';
import Calendar from '../../components/Calendar/Calendar';
import {
    ICONS,
    smallDeleteButton,
    addTextButton,
    cancelTextButton,
    addOutlineButton,
    BUTTON_COLORS,
    saveTextButton,
} from '../../utils/buttonStyles';

interface WeekFormData {
    id: string;
    weekNumber: number;
    startDate: string;
    endDate: string;
    minEmployees: number;
    maxEmployees: number;
    isEditing?: boolean;
}

const WeeklyPlanEdit: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { showNotification, confirmDialog } = useNotification();
    const { executeWithValidation, isSubmitting } = useBackendValidation();

    const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanWithDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
    const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
    const [showWeekForm, setShowWeekForm] = useState(false);
    const [selectedWeek, setSelectedWeek] = useState<PlanWeek | null>(null);
    const [weekFormData, setWeekFormData] = useState<WeekFormData | null>(null);

    // Plan basic info form state
    const [planInfo, setPlanInfo] = useState({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        status: 'draft' as 'draft' | 'published' | 'archived',
    });

    useEffect(() => {
        loadWeeklyPlan();
    }, [id]);

    useEffect(() => {
        if (weeklyPlan) {
            // Set plan basic info
            setPlanInfo({
                name: weeklyPlan.name || '',
                description: weeklyPlan.description || '',
                startDate: weeklyPlan.startDate || '',
                endDate: weeklyPlan.endDate || '',
                status: weeklyPlan.status || 'draft',
            });

            // Set calendar to plan's start date if available
            if (weeklyPlan.startDate) {
                const startDate = new Date(weeklyPlan.startDate);
                setCalendarYear(startDate.getFullYear());
                setCalendarMonth(startDate.getMonth());
            }
        }
    }, [weeklyPlan]);

    const loadWeeklyPlan = async () => {
        if (!id) return;

        await executeWithValidation(async () => {
            try {
                const plan = await weeklyPlanService.getWeeklyPlan(id);
                setWeeklyPlan(plan);
            } catch (error) {
                console.error('Error loading weekly plan:', error);
                showNotification({
                    type: 'error',
                    title: 'Fehler',
                    message: 'Wochenplan konnte nicht geladen werden.'
                });
                navigate('/weekly-plans');
            } finally {
                setLoading(false);
            }
        });
    };

    // Update weekly plan basic information
    const handleUpdatePlan = async () => {
        if (!id || !planInfo.name.trim()) {
            showNotification({
                type: 'error',
                title: 'Fehlende Angaben',
                message: 'Bitte geben Sie einen Namen für den Wochenplan ein.'
            });
            return;
        }

        await executeWithValidation(async () => {
            const updateData: UpdateWeeklyPlanRequest = {
                name: planInfo.name,
                description: planInfo.description || undefined,
                startDate: planInfo.startDate || undefined,
                endDate: planInfo.endDate || undefined,
                status: planInfo.status,
            };

            await weeklyPlanService.updateWeeklyPlan(id, updateData);

            showNotification({
                type: 'success',
                title: 'Erfolg',
                message: 'Wochenplan wurde aktualisiert.'
            });

            await loadWeeklyPlan();
        });
    };

    // Add a new week
    const handleAddWeek = () => {
        setSelectedWeek(null);
        setWeekFormData({
            id: '',
            weekNumber: weeklyPlan?.weeks?.length ? weeklyPlan.weeks.length + 1 : 1,
            startDate: '',
            endDate: '',
            minEmployees: 1,
            maxEmployees: 3,
            isEditing: true,
        });
        setShowWeekForm(true);
    };

    // Edit an existing week
    const handleEditWeek = (week: PlanWeek) => {
        setSelectedWeek(week);
        setWeekFormData({
            id: week.id,
            weekNumber: week.weekNumber,
            startDate: week.startDate,
            endDate: week.endDate,
            minEmployees: week.minEmployees,
            maxEmployees: week.maxEmployees,
            isEditing: true,
        });
        setShowWeekForm(true);
    };

    // Save week (create or update)
    const handleSaveWeek = async () => {
        if (!id || !weekFormData) return;

        if (!weekFormData.startDate || !weekFormData.endDate) {
            showNotification({
                type: 'error',
                title: 'Fehlende Angaben',
                message: 'Bitte geben Sie Start- und Enddatum ein.'
            });
            return;
        }

        if (weekFormData.minEmployees < 0 || weekFormData.maxEmployees < weekFormData.minEmployees) {
            showNotification({
                type: 'error',
                title: 'Ungültige Angaben',
                message: 'Mindestanzahl muss größer oder gleich 0 sein und Höchstanzahl muss größer oder gleich Mindestanzahl sein.'
            });
            return;
        }

        await executeWithValidation(async () => {
            const weekData: UpdateWeekRequest = {
                minEmployees: weekFormData.minEmployees,
                maxEmployees: weekFormData.maxEmployees,
            };

            if (selectedWeek) {
                // Update existing week
                await weeklyPlanService.updateWeek(id, weekFormData.id, weekData);
                showNotification({
                    type: 'success',
                    title: 'Erfolg',
                    message: 'Woche wurde aktualisiert.'
                });
            }

            setShowWeekForm(false);
            setSelectedWeek(null);
            setWeekFormData(null);
            await loadWeeklyPlan();
        });
    };

    // Calendar day info handler
    const getCalendarDayInfo = (date: Date) => {
        if (!weeklyPlan?.weeks) return { isInPlan: false };

        const dateStr = date.toISOString().split('T')[0];

        // Check if date is within any week
        const week = weeklyPlan.weeks.find(w => {
            const start = new Date(w.startDate);
            const end = new Date(w.endDate);
            return date >= start && date <= end;
        });

        if (week) {
            // Check if there are assignments for this week
            const isAssigned = weeklyPlan.assignments?.some(a => a.weekId === week.id) || false;

            // Get employee preferences for this week (simplified - you might want to aggregate)
            // For now, just show if the week exists
            return {
                isInPlan: true,
                weekId: week.id,
                isAssigned,
                weekNumber: week.weekNumber,
            };
        }

        return { isInPlan: false };
    };

    // Handle calendar day click
    const handleCalendarDayClick = (date: Date, weekId?: string) => {
        if (weekId && weeklyPlan) {
            const week = weeklyPlan.weeks?.find(w => w.id === weekId);
            if (week) {
                handleEditWeek(week);
            }
        }
    };

    // Handle calendar month change
    const handleCalendarMonthChange = (year: number, month: number) => {
        setCalendarYear(year);
        setCalendarMonth(month);
    };

    // Calculate plan statistics
    const planStatistics = useMemo(() => {
        if (!weeklyPlan) return null;

        const totalWeeks = weeklyPlan.weeks?.length || 0;
        const totalAssigned = weeklyPlan.assignments?.length || 0;
        const totalRequired = weeklyPlan.requirements?.reduce((sum, req) => sum + req.requiredWeeks, 0) || 0;
        const employeesCount = new Set(weeklyPlan.requirements?.map(r => r.employeeId)).size;
        const employeesWithPrefs = new Set(weeklyPlan.preferences?.map(p => p.employeeId)).size;

        return {
            totalWeeks,
            totalAssigned,
            totalRequired,
            coverageRate: totalWeeks > 0 ? (totalAssigned / (totalWeeks * 3)) * 100 : 0, // Assuming 3 employees per week as default
            employeesCount,
            employeesWithPrefs,
        };
    }, [weeklyPlan]);

    if (loading) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '40px',
                fontSize: '18px',
                color: '#666'
            }}>
                Lade Wochenplan...
            </div>
        );
    }

    if (!weeklyPlan) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '40px',
                fontSize: '18px',
                color: '#e74c3c'
            }}>
                Wochenplan nicht gefunden
            </div>
        );
    }

    const hasWeeks = weeklyPlan.weeks && weeklyPlan.weeks.length > 0;

    return (
        <div style={{ padding: '20px' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '30px'
            }}>
                <h1 style={{ margin: 0 }}>{weeklyPlan.name} bearbeiten</h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => navigate('/weekly-plans')}
                        disabled={isSubmitting}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#95a5a6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            opacity: isSubmitting ? 0.6 : 1
                        }}
                    >
                        Zurück
                    </button>
                </div>
            </div>

            {/* Statistics Bar */}
            {planStatistics && (
                <div style={{
                    display: 'flex',
                    gap: '20px',
                    marginBottom: '20px',
                    padding: '16px',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3498db' }}>
                            {planStatistics.totalWeeks}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>Wochen</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2ecc71' }}>
                            {planStatistics.totalAssigned}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>Zuweisungen</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e74c3c' }}>
                            {planStatistics.totalRequired}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>Benötigte Wochen</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9b59b6' }}>
                            {planStatistics.employeesCount}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>Mitarbeiter</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: planStatistics.coverageRate > 80 ? '#2ecc71' : planStatistics.coverageRate > 50 ? '#f39c12' : '#e74c3c' }}>
                            {planStatistics.coverageRate.toFixed(1)}%
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>Abdeckung</div>
                    </div>
                </div>
            )}

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
                            placeholder="Name des Wochenplans"
                            disabled={isSubmitting}
                        />
                    </div>

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
                        onClick={handleUpdatePlan}
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
                        weeks={weeklyPlan.weeks || []}
                        onMonthChange={handleCalendarMonthChange}
                        getDayInfo={getCalendarDayInfo}
                        onDayClick={handleCalendarDayClick}
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
                    <h2 style={{ margin: 0, color: '#2c3e50' }}>Wochen ({weeklyPlan.weeks?.length || 0})</h2>
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
                        <button
                            onClick={handleAddWeek}
                            disabled={isSubmitting}
                            style={{
                                ...addTextButton(isSubmitting),
                                padding: '12px 24px',
                                fontSize: '16px',
                            }}
                        >
                            {ICONS.add} Erste Woche hinzufügen
                        </button>
                    </div>
                ) : (
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
                                {weeklyPlan.weeks?.map((week, index) => {
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
                                                padding: '12px 16px',
                                                border: '1px solid #dee2e6',
                                                textAlign: 'center'
                                            }}>
                                                {week.minEmployees}
                                            </td>
                                            <td style={{
                                                padding: '12px 16px',
                                                border: '1px solid #dee2e6',
                                                textAlign: 'center'
                                            }}>
                                                {week.maxEmployees}
                                            </td>

                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Week Form Modal */}
            {showWeekForm && weekFormData && (
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
                            {selectedWeek ? 'Woche bearbeiten' : 'Neue Woche hinzufügen'}
                        </h2>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                Wochennummer
                            </label>
                            <input
                                type="number"
                                value={weekFormData.weekNumber}
                                onChange={(e) => setWeekFormData({ ...weekFormData, weekNumber: parseInt(e.target.value) })}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                    fontSize: '14px'
                                }}
                                min="1"
                                disabled={isSubmitting}
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                Startdatum *
                            </label>
                            <input
                                type="date"
                                value={weekFormData.startDate}
                                onChange={(e) => setWeekFormData({ ...weekFormData, startDate: e.target.value })}
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

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                Enddatum *
                            </label>
                            <input
                                type="date"
                                value={weekFormData.endDate}
                                onChange={(e) => setWeekFormData({ ...weekFormData, endDate: e.target.value })}
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

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                    Mindestanzahl
                                </label>
                                <input
                                    type="number"
                                    value={weekFormData.minEmployees}
                                    onChange={(e) => setWeekFormData({ ...weekFormData, minEmployees: parseInt(e.target.value) })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '4px',
                                        border: '1px solid #ddd',
                                        fontSize: '14px'
                                    }}
                                    min="0"
                                    disabled={isSubmitting}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                    Höchstanzahl
                                </label>
                                <input
                                    type="number"
                                    value={weekFormData.maxEmployees}
                                    onChange={(e) => setWeekFormData({ ...weekFormData, maxEmployees: parseInt(e.target.value) })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '4px',
                                        border: '1px solid #ddd',
                                        fontSize: '14px'
                                    }}
                                    min={weekFormData.minEmployees}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={handleSaveWeek}
                                disabled={isSubmitting}
                                style={{
                                    ...saveTextButton(isSubmitting),
                                    padding: '10px 20px',
                                }}
                            >
                                {isSubmitting ? 'Speichern...' : selectedWeek ? 'Aktualisieren' : 'Hinzufügen'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowWeekForm(false);
                                    setSelectedWeek(null);
                                    setWeekFormData(null);
                                }}
                                disabled={isSubmitting}
                                style={{
                                    ...cancelTextButton(isSubmitting),
                                    padding: '10px 20px',
                                }}
                            >
                                Abbrechen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WeeklyPlanEdit;