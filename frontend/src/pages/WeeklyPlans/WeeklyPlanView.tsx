// frontend/src/pages/WeeklyPlans/WeeklyPlanView.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react'; // Added useRef
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
import {
  ICONS,
  backTextButton,
} from '../../utils/buttonStyles';
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


  // NEW: Export state
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState<'excel' | 'pdf' | null>(null);
  const [dropdownWidth, setDropdownWidth] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAdmin = hasRole(['admin', 'maintenance']);

  // NEW: Export dropdown width effect
  useEffect(() => {
    if (dropdownRef.current) {
      setDropdownWidth(dropdownRef.current.offsetWidth / 40);
    }
  }, [exportType]);

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

  // NEW: Export function similar to ShiftPlanView
  const handleExport = async () => {
    if (!id || !plan || !exportType) return;

    try {
      setExporting(true);

      let blob: Blob;
      if (exportType === 'excel') {
        blob = await weeklyPlanService.exportToExcel(id);
      } else {
        blob = await weeklyPlanService.exportToPDF(id);
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `Wochenplan_${plan.name}_${new Date().toISOString().split('T')[0]}.${exportType === 'excel' ? 'xlsx' : 'pdf'}`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showNotification({
        type: 'success',
        title: 'Export erfolgreich',
        message: `${exportType === 'excel' ? 'Excel' : 'PDF'}-Datei wurde heruntergeladen`
      });

    } catch (error: any) {
      console.error(`Error exporting to ${exportType}:`, error);

      let message = 'Export fehlgeschlagen';
      if (error.message) {
        message = error.message;
      }

      showNotification({
        type: 'error',
        title: 'Export fehlgeschlagen',
        message: `Der ${exportType === 'excel' ? 'Excel' : 'PDF'}-Export konnte nicht durchgeführt werden: ${message}`
      });
    } finally {
      setExporting(false);
      setExportType(null);
    }
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

  // Clear assignments function similar to ShiftPlanView
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
      try {
        console.log('🔄 STARTING COMPLETE ASSIGNMENT CLEARING PROCESS');

        // Use the service method to clear assignments
        await weeklyPlanService.clearAssignments(id);

        console.log('✅ All assignments cleared');

        // Update plan status to draft
        if (plan?.status !== 'draft') {
          await weeklyPlanService.updateWeeklyPlan(id, {
            status: 'draft'
          });
          console.log('📝 Plan status set to draft');
        }

        // Force complete data refresh
        await loadPlan();

        console.log('🎯 ASSIGNMENT CLEARING COMPLETE');

        showNotification({
          type: 'success',
          title: 'Zuweisungen gelöscht',
          message: 'Alle Zuweisungen wurden erfolgreich gelöscht.'
        });

      } catch (error) {
        console.error('❌ Error clearing assignments:', error);
        showNotification({
          type: 'error',
          title: 'Fehler',
          message: `Löschen der Zuweisungen fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
        });
      }
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
          <button onClick={() => navigate('/plans')} style={backTextButton(false)}>
            Zurück zur Übersicht
          </button>
        </div>
      </div>
    );
  }

  const hasAssignments = plan.employees?.some(e => e.assignedWeeks.length > 0);

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
          <button onClick={() => navigate('/plans')} style={backTextButton(false)}>
            Zurück
          </button>
        </div>
      </div>

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

      {/* Main Content */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {/* Admin Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            marginTop: '20px',
            gap: '5px'
          }}
        >
          {hasRole(['admin', 'maintenance']) && plan.status !== 'archived' && !hasAssignments && (
            <button
              onClick={handleGenerateAssignments}
              disabled={isSubmitting}
              className={styles.primaryButton}
            >
              Zuweisungen generieren
            </button>
          )}

          {hasRole(['admin', 'maintenance']) && hasAssignments && plan.status === 'draft' && (
            <button
              onClick={handlePublish}
              disabled={isSubmitting}
              className={styles.successButton}
            >
              Veröffentlichen
            </button>
          )}

          {hasRole(['admin', 'maintenance']) && hasAssignments && plan.status === 'published' && (

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={handleClearAssignments}
                disabled={isSubmitting}
                className={styles.dangerButton}
              >
                Zuweisungen löschen
              </button>

              <div
                ref={dropdownRef}
                style={{
                  transform: exportType
                    ? `translateX(-${dropdownWidth}px)`
                    : 'translateX(0)',
                  transition: 'transform 0.05s ease-in-out',
                  position: 'relative',
                }}
              >
                <select
                  value={exportType || ''}
                  onChange={(e) =>
                    setExportType(e.target.value as 'pdf' | 'excel' | null)
                  }
                  style={{
                    padding: '10px',
                    backgroundColor: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    minWidth: '100px',
                  }}
                >
                  <option value="">Export</option>
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                </select>
              </div>

              {exportType && (
                <button
                  onClick={handleExport}
                  disabled={exporting || isSubmitting}
                  className={styles.secondaryButton}
                  style={{
                    opacity: exporting ? 0.7 : 1,
                    transition: 'opacity 0.05s ease',
                    minWidth: '100px',
                  }}
                >
                  {exporting ? '🔄 Exportiert...' : 'Export'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Assignment Calendar */}
        <div style={{
          marginTop: '20px',
          fontSize: '14px'
        }}>
          <h2>Kalenderansicht</h2>
          <Calendar
            year={currentMonth.getFullYear()}
            month={currentMonth.getMonth()}
            weeks={plan.weeks}
            onMonthChange={handleMonthChange}
          />
        </div>
      </div>
    </div >
  );
};

export default WeeklyPlanView;