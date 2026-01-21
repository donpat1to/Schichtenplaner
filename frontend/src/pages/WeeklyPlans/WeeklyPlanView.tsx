// frontend/src/pages/WeeklyPlans/WeeklyPlanView.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useBackendValidation } from '../../hooks/useBackendValidation';
import { weeklyPlanService, GenerateResult } from '../../services/weeklyPlanService';
import Calendar from '../../components/Calendar/Calendar';
import { format } from 'date-fns';
import {
  WeeklyPlanWithDetails,
  EmployeeWithPreferences,
  PlanWeek,
  getPreferenceLevelColor,
  formatWeekRange,
  getCalendarWeekNumber,
} from '../../models/WeeklyPlan';
import styles from './WeeklyPlanView.module.css';

const WeeklyPlanView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const { showNotification, confirmDialog } = useNotification();
  const { executeWithValidation, isSubmitting } = useBackendValidation();

  const [plan, setPlan] = useState<WeeklyPlanWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [editingPreferences, setEditingPreferences] = useState(false);
  const [preferencesMap, setPreferencesMap] = useState<Record<string, 1 | 2 | 3>>({});
  const [requiredWeeks, setRequiredWeeks] = useState(0);
  const [solverResult, setSolverResult] = useState<GenerateResult | null>(null);
  const [showSolverResult, setShowSolverResult] = useState(false);

  const isAdmin = hasRole(['admin', 'maintenance']);

  const loadPlan = useCallback(async () => {
    if (!id) return;

    await executeWithValidation(async () => {
      try {
        const data = await weeklyPlanService.getWeeklyPlan(id);
        setPlan(data);
      } catch (error) {
        console.error('Error loading plan:', error);
        showNotification({
          type: 'error',
          title: 'Fehler',
          message: 'Wochenplan konnte nicht geladen werden'
        });
      } finally {
        setLoading(false);
      }
    });
  }, [id, executeWithValidation, showNotification]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  // Initialize preferences when editing
  const startEditingPreferences = (employeeId: string) => {
    if (!plan) return;

    const employee = plan.employees?.find(e => e.id === employeeId);
    if (!employee) return;

    const prefs: Record<string, 1 | 2 | 3> = {};
    employee.preferences.forEach(p => {
      prefs[p.weekId] = p.preferenceLevel;
    });

    setPreferencesMap(prefs);
    setRequiredWeeks(employee.requiredWeeks);
    setSelectedEmployee(employeeId);
    setEditingPreferences(true);
  };

  const cancelEditingPreferences = () => {
    setEditingPreferences(false);
    setSelectedEmployee(null);
    setPreferencesMap({});
    setRequiredWeeks(0);
  };

  const togglePreference = (weekId: string) => {
    setPreferencesMap(prev => {
      const current = prev[weekId];
      // Cycle: undefined -> 1 (preferred) -> 2 (available) -> 3 (unavailable) -> remove
      if (current === undefined) {
        return { ...prev, [weekId]: 1 };
      } else if (current === 1) {
        return { ...prev, [weekId]: 2 };
      } else if (current === 2) {
        return { ...prev, [weekId]: 3 };
      } else {
        // current === 3, remove it
        const { [weekId]: _, ...rest } = prev;
        return rest;
      }
    });
  };

  const savePreferences = async () => {
    if (!id || !selectedEmployee) return;

    const preferences = Object.entries(preferencesMap).map(([weekId, level]) => ({
      weekId,
      preferenceLevel: level,
    }));

    await executeWithValidation(async () => {
      if (selectedEmployee === user?.id) {
        await weeklyPlanService.saveMyPreferences(id, {
          preferences,
          requiredWeeks,
        });
      } else {
        await weeklyPlanService.saveEmployeePreferences(id, selectedEmployee, {
          preferences,
          requiredWeeks,
        });
      }

      showNotification({
        type: 'success',
        title: 'Gespeichert',
        message: 'Präferenzen wurden gespeichert'
      });

      cancelEditingPreferences();
      loadPlan();
    });
  };

  // State for current calendar view
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    // Start with the first month of the plan
    if (id) {
      const today = new Date();
      return new Date(today.getFullYear(), today.getMonth(), 1);
    }
    return new Date();
  });

  // Function to get day info for calendar
  const getDayInfoForEmployee = useCallback((employeeId: string, date: Date) => {
    if (!plan) return { isInPlan: false };

    // Check if date is within any plan week
    const week = plan.weeks.find(w => {
      const weekStart = new Date(w.startDate);
      const weekEnd = new Date(w.endDate);
      return date >= weekStart && date <= weekEnd;
    });

    if (!week) return { isInPlan: false };

    const employee = plan.employees?.find(e => e.id === employeeId);
    if (!employee) return { isInPlan: true, weekId: week.id };

    const pref = employee.preferences.find(p => p.weekId === week.id);
    const isAssigned = employee.assignedWeeks.includes(week.id);

    return {
      isInPlan: true,
      weekId: week.id,
      isAssigned,
      preferenceLevel: pref?.preferenceLevel,
    };
  }, [plan]);

  // Function to handle month change
  const handleMonthChange = (year: number, month: number) => {
    setCurrentMonth(new Date(year, month, 1));
  };

  // Function to handle day click (for editing preferences)
  const handleDayClick = (employeeId: string) => (date: Date, weekId?: string) => {
    if (!editingPreferences || selectedEmployee !== employeeId || !weekId) return;

    // Find the week that contains this date
    if (!plan) return;

    const week = plan.weeks.find(w => w.id === weekId);
    if (!week) return;

    togglePreference(weekId);
  };

  const handleGenerateAssignments = async () => {
    if (!id) return;

    const confirmed = await confirmDialog({
      title: 'Zuweisungen generieren',
      message: 'Der Solver wird die optimale Zuweisung basierend auf den Mitarbeiterpräferenzen berechnen. Bestehende Zuweisungen werden überschrieben.',
      confirmText: 'Generieren',
      cancelText: 'Abbrechen',
      type: 'info'
    });

    if (!confirmed) return;

    await executeWithValidation(async () => {
      const result = await weeklyPlanService.generateAssignments(id);
      setSolverResult(result);
      setShowSolverResult(true);

      if (result.success) {
        showNotification({
          type: 'success',
          title: 'Zuweisungen generiert',
          message: `${result.assignments.length} Zuweisungen in ${result.processingTime}ms erstellt`
        });
      } else {
        showNotification({
          type: 'warning',
          title: 'Solver-Problem',
          message: result.violations.length > 0 ? result.violations[0] : 'Keine optimale Lösung gefunden'
        });
      }

      loadPlan();
    });
  };

  const handleClearAssignments = async () => {
    if (!id) return;

    const confirmed = await confirmDialog({
      title: 'Zuweisungen löschen',
      message: 'Alle Zuweisungen für diesen Plan werden gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      type: 'warning'
    });

    if (!confirmed) return;

    await executeWithValidation(async () => {
      await weeklyPlanService.clearAssignments(id);
      showNotification({
        type: 'success',
        title: 'Gelöscht',
        message: 'Alle Zuweisungen wurden gelöscht'
      });
      loadPlan();
    });
  };

  const handlePublish = async () => {
    if (!id) return;

    const confirmed = await confirmDialog({
      title: 'Plan veröffentlichen',
      message: 'Der Plan wird veröffentlicht und die Zuweisungen sind für alle Mitarbeiter sichtbar.',
      confirmText: 'Veröffentlichen',
      cancelText: 'Abbrechen',
      type: 'info'
    });

    if (!confirmed) return;

    await executeWithValidation(async () => {
      await weeklyPlanService.publishPlan(id);
      showNotification({
        type: 'success',
        title: 'Veröffentlicht',
        message: 'Der Wochenplan wurde erfolgreich veröffentlicht'
      });
      loadPlan();
    });
  };

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (!id || !plan) return;

    await executeWithValidation(async () => {
      const blob = format === 'excel'
        ? await weeklyPlanService.exportToExcel(id)
        : await weeklyPlanService.exportToPDF(id);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Wochenplan_${plan.name}_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showNotification({
        type: 'success',
        title: 'Export erfolgreich',
        message: `${format.toUpperCase()}-Datei wurde heruntergeladen`
      });
    });
  };

  const getPreferenceDisplay = (level: 1 | 2 | 3 | undefined) => {
    if (!level) return { text: '-', color: '#e0e0e0', bg: '#f8f8f8' };
    const displays = {
      1: { text: 'Bevorzugt', color: '#22c55e', bg: '#dcfce7' },
      2: { text: 'Verfügbar', color: '#eab308', bg: '#fef9c3' },
      3: { text: 'Nicht verf.', color: '#ef4444', bg: '#fee2e2' },
    };
    return displays[level];
  };

  const getStatusBadge = (status: string) => {
    const config = {
      draft: { text: 'Entwurf', color: '#f39c12', bgColor: '#fef5e7' },
      published: { text: 'Veröffentlicht', color: '#27ae60', bgColor: '#d5f4e6' },
      archived: { text: 'Archiviert', color: '#95a5a6', bgColor: '#f8f9fa' }
    };
    const statusConfig = config[status as keyof typeof config] || config.draft;
    return (
      <span style={{
        backgroundColor: statusConfig.bgColor,
        color: statusConfig.color,
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '13px',
        fontWeight: 'bold',
      }}>
        {statusConfig.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Lade Wochenplan...</div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Wochenplan nicht gefunden</h2>
          <button onClick={() => navigate('/weekly-plans')} className={styles.backButton}>
            Zurück zur Übersicht
          </button>
        </div>
      </div>
    );
  }

  const hasAssignments = plan.employees?.some(e => e.assignedWeeks.length > 0) || false;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>{plan.name}</h1>
          <div className={styles.headerMeta}>
            {getStatusBadge(plan.status)}
            <span className={styles.metaText}>
              {formatWeekRange(plan.startDate, plan.endDate)} | {plan.weeks.length} Wochen
            </span>
          </div>
          {plan.description && (
            <p className={styles.description}>{plan.description}</p>
          )}
        </div>
        <div className={styles.headerActions}>
          <button onClick={() => navigate('/weekly-plans')} className={styles.backButton}>
            Zurück
          </button>
        </div>
      </div>

      {/* Admin Actions */}
      {isAdmin && plan.status === 'draft' && (
        <div className={styles.actionBar}>
          <button
            onClick={handleGenerateAssignments}
            disabled={isSubmitting}
            className={styles.primaryButton}
          >
            Zuweisungen generieren
          </button>
          {hasAssignments && (
            <>
              <button
                onClick={handleClearAssignments}
                disabled={isSubmitting}
                className={styles.dangerButton}
              >
                Zuweisungen löschen
              </button>
              <button
                onClick={handlePublish}
                disabled={isSubmitting}
                className={styles.successButton}
              >
                Veröffentlichen
              </button>
            </>
          )}
        </div>
      )}

      {/* Export Actions (only for published plans) */}
      {plan.status === 'published' && isAdmin && (
        <div className={styles.actionBar}>
          <button onClick={() => handleExport('excel')} disabled={isSubmitting} className={styles.secondaryButton}>
            Excel Export
          </button>
          <button onClick={() => handleExport('pdf')} disabled={isSubmitting} className={styles.secondaryButton}>
            PDF Export
          </button>
        </div>
      )}

      {/* Solver Result */}
      {showSolverResult && solverResult && (
        <div className={styles.solverResult}>
          <div className={styles.solverHeader}>
            <h3>{solverResult.success ? 'Solver erfolgreich' : 'Solver-Problem'}</h3>
            <button onClick={() => setShowSolverResult(false)} className={styles.closeButton}>
              Schließen
            </button>
          </div>
          <div className={styles.solverReport}>
            {solverResult.resolutionReport.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
          {solverResult.violations.length > 0 && (
            <div className={styles.violations}>
              <strong>Probleme:</strong>
              <ul>
                {solverResult.violations.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Assignment Calendar */}
      <div className={styles.calendarContainer}>
        <h2>Kalenderansicht</h2>
        <div className={styles.calendarGrid}>
          <Calendar
            year={currentMonth.getFullYear()}
            month={currentMonth.getMonth()}
            weeks={plan.weeks}
            onMonthChange={handleMonthChange}
          />
        </div>
      </div>

      {/* Info for non-admin users */}
      {!isAdmin && plan.status === 'draft' && (
        <div className={styles.infoBox}>
          <strong>Hinweis:</strong> Klicken Sie auf "Präferenzen" neben Ihrem Namen, um Ihre Verfügbarkeit einzutragen.
          Wählen Sie für jede Woche: 1 (Bevorzugt), 2 (Verfügbar) oder 3 (Nicht verfügbar).
        </div>
      )}
    </div>
  );
};

export default WeeklyPlanView;
