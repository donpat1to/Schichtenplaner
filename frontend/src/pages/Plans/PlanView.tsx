// frontend/src/pages/Plans/PlanView.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useBackendValidation } from '../../hooks/useBackendValidation';
import { shiftPlanService } from '../../services/shiftPlanService';
import { weeklyPlanService } from '../../services/weeklyPlanService';
import { employeeService } from '../../services/employeeService';
import { ShiftPlan, ScheduledShift } from '../../models/ShiftPlan';
import { WeeklyPlanWithDetails, formatWeekRange } from '../../models/WeeklyPlan';
import { Employee, EmployeeAvailability } from '../../models/Employee';
import { formatDate } from '../../utils/formatters';
import { saveAs } from 'file-saver';
import { backTextButton } from '@/utils/buttonStyles';
import Timetable from '../../components/Timetable/Timetable';
import Calendar from '../../components/Calendar/Calendar';
import styles from './PlanView.module.css';

// Remove the local GenerateResult interface since it's now imported from shiftPlanService
// Note: The GenerateResult interface should be exported from shiftPlanService

type PlanType = 'shift' | 'weekly';

const WEEKDAYS = [
  { id: 1, name: 'Montag' },
  { id: 2, name: 'Dienstag' },
  { id: 3, name: 'Mittwoch' },
  { id: 4, name: 'Donnerstag' },
  { id: 5, name: 'Freitag' },
  { id: 6, name: 'Samstag' },
  { id: 7, name: 'Sonntag' }
];

const PlanView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();
  const { showNotification, confirmDialog } = useNotification();
  const { executeWithValidation, isSubmitting } = useBackendValidation();

  // Plan state - unified for both types
  const [planType, setPlanType] = useState<PlanType | null>(null);
  const [shiftPlan, setShiftPlan] = useState<ShiftPlan | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanWithDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Shift plan specific state - REMOVED scheduledShifts as it's no longer needed
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availabilities, setAvailabilities] = useState<EmployeeAvailability[]>([]);
  const [solverResult, setSolverResult] = useState<any>(null); // Changed from assignmentResult to solverResult for consistency
  const [employeesWithAvailability, setEmployeesWithAvailability] = useState<{ id: string; name: string }[]>([]);

  // Weekly plan specific state
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());

  // Unified solver result display state (for both plan types)
  const [showSolverResult, setShowSolverResult] = useState(false);

  // Shared action states
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | null>(null);
  const [dropdownWidth, setDropdownWidth] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAdmin = hasRole(['admin', 'maintenance']);

  // Get unified plan data
  const plan = planType === 'shift' ? shiftPlan : weeklyPlan;
  const planName = plan?.name || '';
  const planStatus = plan?.status || 'draft';
  const planDescription = plan?.description || '';

  // Load plan data
  const loadPlanData = useCallback(async () => {
    if (!id) return;

    setLoading(true);

    try {
      // Try to load as shift plan first
      try {
        const shiftData = await shiftPlanService.getShiftPlan(id);
        setPlanType('shift');
        setShiftPlan(shiftData);

        // Load employees for availability check
        const employeesData = await employeeService.getEmployees();
        const activeEmployees = employeesData.filter(emp => emp.isActive);
        setEmployees(activeEmployees);

        // Load availabilities for each employee
        const availabilityPromises = activeEmployees.map(emp =>
          employeeService.getAvailabilities(emp.id)
        );
        const allAvailabilities = await Promise.all(availabilityPromises);
        const planAvailabilities = allAvailabilities.flat().filter(
          availability => availability?.planId === id
        );
        setAvailabilities(planAvailabilities);

        // Set availability status
        updateAvailabilityStatus(activeEmployees, planAvailabilities);

        setLoading(false);
        return;
      } catch {
        // Not a shift plan, try weekly plan
      }

      // Try to load as weekly plan
      const weeklyData = await weeklyPlanService.getWeeklyPlan(id);
      setPlanType('weekly');
      setWeeklyPlan(weeklyData);
    } catch (error) {
      console.error('Error loading plan:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Plan konnte nicht geladen werden'
      });
    } finally {
      setLoading(false);
    }
  }, [id, showNotification]);

  useEffect(() => {
    loadPlanData();
  }, [loadPlanData]);

  // Update dropdown width for export button animation
  useEffect(() => {
    if (dropdownRef.current) {
      setDropdownWidth(dropdownRef.current.offsetWidth / 40);
    }
  }, [exportFormat]);

  // Update availability status map
  const updateAvailabilityStatus = (emps: Employee[], avails: EmployeeAvailability[]) => {
    const employeesWithAvails = emps.filter(emp =>
      avails.some(avail => avail.employeeId === emp.id)
    ).map(emp => ({
      id: emp.id,
      name: `${emp.firstname} ${emp.lastname}`
    }));
    setEmployeesWithAvailability(employeesWithAvails);
  };

  // Get availability/preference status for both plan types
  const getAvailabilityStatus = () => {
    if (planType === 'shift') {
      const totalEmployees = employees.length;
      const completedCount = employeesWithAvailability.length;

      return {
        completed: completedCount,
        total: totalEmployees,
        percentage: totalEmployees > 0 ? Math.round((completedCount / totalEmployees) * 100) : 0,
        canPublish: completedCount === totalEmployees && totalEmployees > 0
      };
    } else if (planType === 'weekly' && weeklyPlan?.employees) {
      const totalEmployees = weeklyPlan.employees.length;
      const completedCount = weeklyPlan.employees.filter(emp => emp.preferences.length > 0).length;

      return {
        completed: completedCount,
        total: totalEmployees,
        percentage: totalEmployees > 0 ? Math.round((completedCount / totalEmployees) * 100) : 0,
        canPublish: completedCount === totalEmployees && totalEmployees > 0
      };
    }

    return {
      completed: 0,
      total: 0,
      percentage: 0,
      canPublish: false
    };
  };

  // Get unified solver result data for display
  const getUnifiedSolverResult = () => {
    if (planType === 'shift' && solverResult) {
      return {
        success: solverResult.success,
        resolutionReport: solverResult.resolutionReport || [],
        violations: solverResult.violations || []
      };
    } else if (planType === 'weekly' && solverResult) {
      return {
        success: solverResult.success,
        resolutionReport: solverResult.resolutionReport || [],
        violations: solverResult.violations || []
      };
    }
    return null;
  };

  // Handle generate assignments for shift plans (using new backend route)
  const handleGenerateShiftAssignments = async () => {
    if (!id || !shiftPlan) return;

    const confirmed = await confirmDialog({
      title: 'Zuweisungen generieren',
      message: 'Der Solver wird die optimale Zuweisung basierend auf den Mitarbeiterverfügbarkeiten berechnen.',
      confirmText: 'Generieren',
      cancelText: 'Abbrechen',
      type: 'info'
    });

    if (!confirmed) return;

    try {
      setIsGenerating(true);
      const result = await shiftPlanService.generateAssignments(id);
      setSolverResult(result);
      setShowSolverResult(true);

      if (result.success) {
        showNotification({
          type: 'success',
          title: 'Zuweisungen generiert',
          message: 'Zuweisungen wurden erfolgreich generiert'
        });
        // Reload plan to get updated assignments
        await loadPlanData();
      } else {
        showNotification({
          type: 'warning',
          title: 'Solver-Problem',
          message: result.violations?.length > 0 ? result.violations[0] : 'Keine optimale Lösung gefunden'
        });
      }
    } catch (error: any) {
      console.error('Error generating assignments:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: error.message || 'Fehler beim Generieren der Zuweisungen'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle generate assignments (weekly plans)
  const handleGenerateWeeklyAssignments = async () => {
    if (!id || !weeklyPlan) return;

    const confirmed = await confirmDialog({
      title: 'Zuweisungen generieren',
      message: 'Der Solver wird die optimale Zuweisung basierend auf den Mitarbeiterpräferenzen berechnen. Bestehende Zuweisungen werden überschrieben.',
      confirmText: 'Generieren',
      cancelText: 'Abbrechen',
      type: 'info'
    });

    if (!confirmed) return;

    await executeWithValidation(async () => {
      setIsGenerating(true);
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

      await loadPlanData();
      setIsGenerating(false);
    });
  };

  // Handle publish for shift plans (using new backend route)
  const handlePublishShiftPlan = async () => {
    if (!id) return;

    const confirmed = await confirmDialog({
      title: 'Plan veröffentlichen',
      message: 'Der Plan wird veröffentlicht und die Zuweisungen sind für alle Mitarbeiter sichtbar.',
      confirmText: 'Veröffentlichen',
      cancelText: 'Abbrechen',
      type: 'info'
    });

    if (!confirmed) return;

    try {
      setIsPublishing(true);
      await shiftPlanService.publishPlan(id);
      showNotification({
        type: 'success',
        title: 'Veröffentlicht',
        message: 'Der Schichtplan wurde erfolgreich veröffentlicht'
      });
      await loadPlanData();
    } catch (error: any) {
      console.error('Error publishing shift plan:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: error.message || 'Fehler beim Veröffentlichen des Plans'
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle publish (weekly plans)
  const handlePublishWeeklyPlan = async () => {
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
      setIsPublishing(true);
      await weeklyPlanService.publishPlan(id);
      showNotification({
        type: 'success',
        title: 'Veröffentlicht',
        message: 'Der Wochenplan wurde erfolgreich veröffentlicht'
      });
      await loadPlanData();
      setIsPublishing(false);
    });
  };

  // Handle clear assignments for shift plans
  const handleClearShiftAssignments = async () => {
    if (!id || !shiftPlan) return;

    const confirmed = await confirmDialog({
      title: 'Zuweisungen löschen',
      message: 'Alle Zuweisungen für diesen Schichtplan werden gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      type: 'warning'
    });

    if (!confirmed) return;

    try {
      setIsClearing(true);
      await shiftPlanService.clearAssignments(id);

      // Reset to draft status if published
      if (shiftPlan.status === 'published') {
        await shiftPlanService.updateShiftPlan(id, { status: 'draft' });
      }

      // Clear solver result
      setSolverResult(null);
      setShowSolverResult(false);

      await loadPlanData();

      showNotification({
        type: 'success',
        title: 'Zuweisungen gelöscht',
        message: 'Alle Zuweisungen wurden erfolgreich gelöscht.'
      });
    } catch (error: any) {
      console.error('Error clearing assignments:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: error.message || 'Löschen der Zuweisungen fehlgeschlagen'
      });
    } finally {
      setIsClearing(false);
    }
  };

  // Handle clear assignments for weekly plans
  const handleClearWeeklyAssignments = async () => {
    if (!id || !weeklyPlan) return;

    const confirmed = await confirmDialog({
      title: 'Zuweisungen löschen',
      message: 'Alle Zuweisungen für diesen Wochenplan werden gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      type: 'warning'
    });

    if (!confirmed) return;

    try {
      setIsClearing(true);
      await weeklyPlanService.clearAssignments(id);

      // Reset to draft status if published
      if (weeklyPlan.status !== 'draft') {
        await weeklyPlanService.updateWeeklyPlan(id, { status: 'draft' });
      }

      await loadPlanData();

      showNotification({
        type: 'success',
        title: 'Zuweisungen gelöscht',
        message: 'Alle Zuweisungen wurden erfolgreich gelöscht.'
      });
    } catch (error: any) {
      console.error('Error clearing assignments:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: error.message || 'Löschen der Zuweisungen fehlgeschlagen'
      });
    } finally {
      setIsClearing(false);
    }
  };

  // Handle export
  const handleExport = async () => {
    if (!id || !plan || !exportFormat) return;

    try {
      setIsExporting(true);

      let blob: Blob;
      const fileExtension = exportFormat === 'excel' ? 'xlsx' : 'pdf';
      const planTypeLabel = planType === 'shift' ? 'Schichtplan' : 'Wochenplan';

      if (planType === 'shift') {
        blob = exportFormat === 'excel'
          ? await shiftPlanService.exportToExcel(id)
          : await shiftPlanService.exportToPDF(id);
      } else {
        blob = exportFormat === 'excel'
          ? await weeklyPlanService.exportToExcel(id)
          : await weeklyPlanService.exportToPDF(id);
      }

      const filename = `${planTypeLabel}_${planName}_${new Date().toISOString().split('T')[0]}.${fileExtension}`;
      saveAs(blob, filename);

      showNotification({
        type: 'success',
        title: 'Export erfolgreich',
        message: `Der ${planTypeLabel} wurde als ${exportFormat === 'excel' ? 'Excel' : 'PDF'} exportiert.`
      });
    } catch (error: any) {
      console.error(`Error exporting to ${exportFormat}:`, error);
      showNotification({
        type: 'error',
        title: 'Export fehlgeschlagen',
        message: error.message || 'Der Export konnte nicht durchgeführt werden.'
      });
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  };

  // Handle month change for weekly plan calendar
  const handleMonthChange = (year: number, month: number) => {
    setCurrentMonth(new Date(year, month, 1));
  };

  // Render status badge
  const renderStatusBadge = (status: string) => {
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

  // Render date range
  const renderDateRange = () => {
    if (planType === 'shift' && shiftPlan?.startDate && shiftPlan?.endDate) {
      return `Zeitraum: ${formatDate(shiftPlan.startDate)} - ${formatDate(shiftPlan.endDate)}`;
    }
    if (planType === 'weekly' && weeklyPlan) {
      return `${formatWeekRange(weeklyPlan.startDate, weeklyPlan.endDate)} | ${weeklyPlan.weeks.length} Wochen`;
    }
    return '';
  };

  // Check if shift plan has assignments
  const shiftPlanHasAssignments = () => {
    if (!shiftPlan?.shifts) return false;
    // Check if any shift has assignments (assuming shift.assignments exists)
    return shiftPlan.shifts.some(shift =>
      shiftPlan.shiftAssignments && shiftPlan.shiftAssignments.length > 0
    );
  };

  // Get timetable data for shift plans
  const getTimetableData = () => {
    if (!shiftPlan?.shifts || !shiftPlan?.timeSlots) {
      return { days: [], allTimeSlots: [] };
    }

    const timeSlotMap = new Map(shiftPlan.timeSlots.map(ts => [ts.id, ts]));

    const days = Array.from(new Set(shiftPlan.shifts.map(shift => shift.dayOfWeek)))
      .sort()
      .map(dayId => WEEKDAYS.find(day => day.id === dayId) || { id: dayId, name: `Tag ${dayId}` });

    const allTimeSlotsMap = new Map();
    days.forEach(day => {
      const dayShifts = shiftPlan.shifts.filter(s => s.dayOfWeek === day.id);
      dayShifts.forEach(shift => {
        const timeSlot = timeSlotMap.get(shift.timeSlotId);
        if (timeSlot && !allTimeSlotsMap.has(timeSlot.id)) {
          allTimeSlotsMap.set(timeSlot.id, { ...timeSlot });
        }
      });
    });

    const allTimeSlots = Array.from(allTimeSlotsMap.values()).sort((a, b) => {
      const timeToMinutes = (timeStr: string) => {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });

    return { days, allTimeSlots };
  };

  // Loading state
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Lade Plan...</div>
      </div>
    );
  }

  // Plan not found
  if (!plan || !planType) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Plan nicht gefunden</h2>
          <button onClick={() => navigate('/plans')} style={backTextButton(false)}>
            Zurück zur Übersicht
          </button>
        </div>
      </div>
    );
  }

  const { days, allTimeSlots } = getTimetableData();
  const availabilityStatus = getAvailabilityStatus();
  const hasAssignments = planType === 'weekly'
    ? weeklyPlan?.employees?.some(e => e.assignedWeeks.length > 0)
    : shiftPlanHasAssignments();

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>{planName}</h1>
          <div className={styles.headerMeta}>
            {renderStatusBadge(planStatus)}
            <span className={styles.metaText}>{renderDateRange()}</span>
          </div>
          {planDescription && (
            <p className={styles.description}>{planDescription}</p>
          )}
        </div>
        <div className={styles.headerActions}>
          <button onClick={() => navigate('/plans')} style={backTextButton(false)}>
            Zurück
          </button>
        </div>
      </div>

      {/* Solver Result - for both plan types */}
      {showSolverResult && getUnifiedSolverResult() && (
        <div className={styles.solverResult}>
          <div className={styles.solverHeader}>
            <h3>{getUnifiedSolverResult()?.success ? 'Solver erfolgreich' : 'Solver-Problem'}</h3>
            <button onClick={() => setShowSolverResult(false)} className={styles.closeButton}>
              Schließen
            </button>
          </div>
          {getUnifiedSolverResult()?.resolutionReport && getUnifiedSolverResult()!.resolutionReport.length > 0 && (
            <div className={styles.solverReport}>
              {getUnifiedSolverResult()!.resolutionReport.map((line: string, i: number) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
          {getUnifiedSolverResult()?.violations && getUnifiedSolverResult()!.violations.length > 0 && (
            <div className={styles.violations}>
              <strong>Probleme:</strong>
              <ul>
                {getUnifiedSolverResult()!.violations.map((v: string, i: number) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Availability Status - for both plan types in draft status */}
      {planStatus === 'draft' && (
        <div className={styles.availabilityStatus}>
          <h3>Veröffentlichungsvoraussetzungen</h3>
          <div className={styles.availabilityContent}>
            <div>
              <div className={styles.availabilityCount}>
                {availabilityStatus.completed} / {availabilityStatus.total} Mitarbeiter
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${availabilityStatus.percentage}%`,
                    backgroundColor: availabilityStatus.percentage === 100 ? '#2ecc71' : '#f1c40f'
                  }}
                />
              </div>
            </div>

            {isAdmin && (
              <div>
                {/* Shift plan: Generate assignments button */}
                {planType === 'shift' && !hasAssignments && (
                  <button
                    onClick={handleGenerateShiftAssignments}
                    disabled={!availabilityStatus.canPublish || isGenerating}
                    className={`${styles.primaryButton} ${!availabilityStatus.canPublish ? styles.disabledButton : ''}`}
                  >
                    {isGenerating ? 'Berechne...' : 'Zuweisungen generieren'}
                  </button>
                )}

                {/* Weekly plan: Generate assignments button */}
                {planType === 'weekly' && !hasAssignments && (
                  <button
                    onClick={handleGenerateWeeklyAssignments}
                    disabled={!availabilityStatus.canPublish || isGenerating}
                    className={`${styles.primaryButton} ${!availabilityStatus.canPublish ? styles.disabledButton : ''}`}
                  >
                    {isGenerating ? 'Berechne...' : 'Zuweisungen generieren'}
                  </button>
                )}

                {!availabilityStatus.canPublish && (
                  <div className={styles.availabilityHint}>
                    {availabilityStatus.percentage === 100
                      ? 'Bereit zur Berechnung'
                      : `${availabilityStatus.total - availabilityStatus.completed} Mitarbeiter müssen noch ${planType === 'shift' ? 'Verfügbarkeit' : 'Präferenzen'} eintragen`}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Publish buttons for both plan types when assignments exist */}
          {hasAssignments && (
            <div className={styles.assignmentResult}>
              <div className={styles.successBox}>
                <h5>Bereit zur Veröffentlichung</h5>
                <p>Zuweisungen wurden generiert. Der {planType === 'shift' ? 'Schichtplan' : 'Wochenplan'} kann veröffentlicht werden.</p>
              </div>
              <div className={styles.assignmentActions}>
                <button
                  onClick={planType === 'shift' ? handlePublishShiftPlan : handlePublishWeeklyPlan}
                  disabled={isPublishing || (planType === 'weekly' && isSubmitting)}
                  className={styles.successButton}
                >
                  {isPublishing ? 'Veröffentliche...' : `${planType === 'shift' ? 'Schichtplan' : 'Wochenplan'} veröffentlichen`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Admin Action Buttons - only for published plans */}
        {isAdmin && planStatus === 'published' && (
          <div className={styles.actionBar}>
            <button
              onClick={planType === 'shift' ? handleClearShiftAssignments : handleClearWeeklyAssignments}
              disabled={isClearing || (planType === 'weekly' && isSubmitting)}
              className={styles.dangerButton}
            >
              {isClearing ? 'Lösche Zuweisungen...' : 'Zuweisungen entfernen'}
            </button>

            {/* Export Dropdown */}
            <div
              ref={dropdownRef}
              style={{
                transform: exportFormat ? `translateX(-${dropdownWidth}px)` : 'translateX(0)',
                transition: 'transform 0.05s ease-in-out',
                position: 'relative'
              }}
            >
              <select
                value={exportFormat || ''}
                onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'excel' | null)}
                className={styles.exportSelect}
              >
                <option value="">Export</option>
                <option value="pdf">PDF</option>
                <option value="excel">Excel</option>
              </select>
            </div>

            {exportFormat && (
              <button
                onClick={handleExport}
                disabled={isExporting}
                className={styles.exportButton}
                style={{ opacity: isExporting ? 0.7 : 1 }}
              >
                {isExporting ? 'Exportiert...' : 'Export'}
              </button>
            )}
          </div>
        )}

        {/* Timetable for shift plans */}
        {planType === 'shift' && shiftPlan && (
          <div className={styles.timetableContainer}>
            <Timetable
              mode="view"
              shifts={shiftPlan.shifts || []}
              timeSlots={shiftPlan.timeSlots || []}
              days={days}
              shiftAssignments={shiftPlan.shiftAssignments || []}
              employees={employees}
              shiftPlanStatus={shiftPlan.status}
              headerTitle="Schichtplan"
              showLegend={false}
            />
          </div>
        )}

        {/* Calendar for weekly plans */}
        {planType === 'weekly' && weeklyPlan && (
          <div className={styles.calendarContainer}>
            <h2>Kalenderansicht</h2>
            <Calendar
              year={currentMonth.getFullYear()}
              month={currentMonth.getMonth()}
              weeks={weeklyPlan.weeks}
              employees={weeklyPlan.employees}
              onMonthChange={handleMonthChange}
            />
          </div>
        )}

        {/* Summary/Legend */}
        {planType === 'shift' && days.length > 0 && (
          <div className={styles.legend}>
            <strong>Legende:</strong> {
              planStatus === 'published'
                ? 'Angezeigt werden die aktuell zugewiesenen Mitarbeiter'
                : solverResult
                  ? 'Angezeigt werden die vorgeschlagenen Mitarbeiter für eine exemplarische Woche'
                  : 'Angezeigt wird "zugewiesene/benötigte Mitarbeiter" pro Schicht und Wochentag'
            }
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanView;