// frontend/src/pages/Plans/PlanView.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensors,
  useSensor
} from '@dnd-kit/core';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useBackendValidation } from '../../hooks/useBackendValidation';
import { useWeeklySwapValidation, WeeklySwapTarget } from '../../hooks/useWeeklySwapValidation';
import { useSwapValidation, SwapTarget } from '../../hooks/useSwapValidation';
import { useManualAssignmentValidation, SchedulableEmployee } from '../../hooks/useManualAssignmentValidation';
import { shiftPlanService } from '../../services/shiftPlanService';
import { weeklyPlanService } from '../../services/weeklyPlanService';
import { employeeService } from '../../services/employeeService';
import { ShiftPlanWithData, ShiftAssignment } from '../../models/ShiftPlan';
import { WeeklyPlanWithDetails, formatWeekRange, EmployeeWithPreferences } from '../../models/WeeklyPlan';
import { WeeklySwapStep } from '../../utils/weeklySwapConstraints';
import { SwapStep } from '../../utils/swapConstraints';
import { Employee, EmployeeAvailability } from '../../models/Employee';
import { formatDate } from '../../utils/formatters';
import { saveAs } from 'file-saver';
import { backTextButton } from '@/utils/buttonStyles';
import Timetable from '../../components/Timetable/Timetable';
import Calendar from '../../components/Calendar/Calendar';
import TwoStepConfirmModal from '../../components/SwapMode/TwoStepConfirmModal';
import WeeklyTwoStepConfirmModal from '../../components/SwapMode/WeeklyTwoStepConfirmModal';
import DraggableEmployeeBox, { DragData } from '../../components/SwapMode/DraggableEmployeeBox';
import { EmployeeTokenPool } from '../../components/ManualAssignment';
import { DropTarget } from '../../hooks/useManualAssignmentValidation';
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
  const [shiftPlan, setShiftPlan] = useState<ShiftPlanWithData | null>(null);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanWithDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Shift plan specific state
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

  // Shift swap mode state (drag-and-drop, inline)
  const [shiftSwapModeActive, setShiftSwapModeActive] = useState(false);
  const [localShiftAssignments, setLocalShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [shiftSourceSelection, setShiftSourceSelection] = useState<{ employeeId: string; shiftId: string } | null>(null);
  const [shiftActiveDrag, setShiftActiveDrag] = useState<DragData | null>(null);
  const [shiftTwoStepModal, setShiftTwoStepModal] = useState<{
    visible: boolean;
    swapPath: SwapStep[];
    targetEmpId: string;
    targetShiftId: string;
  } | null>(null);
  const [isSavingShiftSwap, setIsSavingShiftSwap] = useState(false);

  // Manual assignment mode state
  const [manualAssignmentModeActive, setManualAssignmentModeActive] = useState(false);
  const [manualAssignments, setManualAssignments] = useState<ShiftAssignment[]>([]);
  const [draggedEmployeeId, setDraggedEmployeeId] = useState<string | null>(null);
  const [isSavingManualAssignment, setIsSavingManualAssignment] = useState(false);

  // Weekly swap mode state (inline)
  const [weeklySwapModeActive, setWeeklySwapModeActive] = useState(false);
  const [localWeeklyEmployees, setLocalWeeklyEmployees] = useState<EmployeeWithPreferences[]>([]);
  const [sourceSelection, setSourceSelection] = useState<{ employeeId: string; weekId: string } | null>(null);
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [twoStepModal, setTwoStepModal] = useState<{
    visible: boolean;
    swapPath: WeeklySwapStep[];
    targetEmpId: string;
    targetWeekId: string;
  } | null>(null);
  const [isSavingSwap, setIsSavingSwap] = useState(false);

  const isAdmin = hasRole(['admin', 'maintenance']);

  // DnD sensors for swap mode
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    })
  );

  // Use swap validation hook (only when weeklyPlan exists)
  const {
    getEligibleWeeklySwapTargets,
    isEmployeeManager
  } = useWeeklySwapValidation(
    weeklyPlan?.weeks || [],
    localWeeklyEmployees
  );

  // Use swap validation hook for shift plans
  const {
    getEligibleSwapTargets,
    isEmployeeManager: isShiftEmployeeManager
  } = useSwapValidation(
    shiftPlan?.shifts || [],
    employees,
    availabilities,
    localShiftAssignments
  );

  // Use manual assignment validation hook
  const {
    schedulableEmployees,
    managers,
    getValidDropTargets,
    canDropOnShift,
    getShiftStatus,
    validateSchedule,
  } = useManualAssignmentValidation({
    shifts: shiftPlan?.shifts || [],
    employees,
    availabilities,
    assignments: manualAssignments,
  });

  // Get eligible targets when source is selected (shift swap)
  const shiftEligibleTargets = useMemo<Map<string, SwapTarget>>(() => {
    if (!shiftSourceSelection) return new Map();
    return getEligibleSwapTargets(shiftSourceSelection.employeeId, shiftSourceSelection.shiftId);
  }, [shiftSourceSelection, getEligibleSwapTargets]);

  // Convert shiftEligibleTargets map to the format expected by Timetable
  const shiftEligibilityMap = useMemo<Map<string, 'direct' | 'two-step'>>(() => {
    const map = new Map<string, 'direct' | 'two-step'>();
    shiftEligibleTargets.forEach((target, key) => {
      if (target.eligibility) {
        map.set(key, target.eligibility);
      }
    });
    return map;
  }, [shiftEligibleTargets]);

  // Get eligible targets when source is selected (weekly swap)
  const eligibleTargets = useMemo<Map<string, WeeklySwapTarget>>(() => {
    if (!sourceSelection) return new Map();
    return getEligibleWeeklySwapTargets(sourceSelection.employeeId, sourceSelection.weekId);
  }, [sourceSelection, getEligibleWeeklySwapTargets]);

  // Convert eligibleTargets map to the format expected by Calendar
  const eligibilityMap = useMemo<Map<string, 'direct' | 'two-step'>>(() => {
    const map = new Map<string, 'direct' | 'two-step'>();
    eligibleTargets.forEach((target, key) => {
      if (target.eligibility) {
        map.set(key, target.eligibility);
      }
    });
    return map;
  }, [eligibleTargets]);

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
  }, [id]);

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

    await executeWithValidation(async () => {
      setIsGenerating(true);
      const result = await shiftPlanService.generateAssignments(id);
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

    await executeWithValidation(async () => {
      setIsPublishing(true);
      await shiftPlanService.publishPlan(id);
      showNotification({
        type: 'success',
        title: 'Veröffentlicht',
        message: 'Der Wochenplan wurde erfolgreich veröffentlicht'
      });
      await loadPlanData();
      setIsPublishing(false);
    });
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

  // Shift swap mode handlers (inline, drag-and-drop)
  const handleOpenShiftSwapMode = useCallback(() => {
    if (shiftPlan) {
      // Initialize local assignments from current shift plan data
      const currentAssignments = shiftPlan.shifts.flatMap(shift => shift.assignments);
      setLocalShiftAssignments(currentAssignments);
      setShiftSwapModeActive(true);
    }
  }, [shiftPlan]);

  const handleCancelShiftSwapMode = useCallback(() => {
    setShiftSwapModeActive(false);
    setLocalShiftAssignments([]);
    setShiftSourceSelection(null);
    setShiftActiveDrag(null);
    setShiftTwoStepModal(null);
  }, []);

  // Execute a single shift swap - updates localShiftAssignments
  const executeShiftSwap = useCallback((
    empAId: string,
    shiftAId: string,
    empBId: string,
    shiftBId: string
  ): ShiftAssignment[] => {
    return localShiftAssignments.map(a => {
      if (a.shiftId === shiftAId && a.employeeId === empAId) {
        return { ...a, employeeId: empBId };
      }
      if (a.shiftId === shiftBId && a.employeeId === empBId) {
        return { ...a, employeeId: empAId };
      }
      return a;
    });
  }, [localShiftAssignments]);

  // Handle shift drag start
  const handleShiftDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragData;
    if (!data) return;

    // Don't allow managers to be dragged
    if (isShiftEmployeeManager(data.employeeId)) return;

    setShiftSourceSelection({
      employeeId: data.employeeId,
      shiftId: data.contextId
    });
    setShiftActiveDrag(data);
  }, [isShiftEmployeeManager]);

  // Handle shift drag end
  const handleShiftDragEnd = useCallback((event: DragEndEvent) => {
    const { over } = event;

    if (!shiftSourceSelection || !shiftActiveDrag) {
      setShiftSourceSelection(null);
      setShiftActiveDrag(null);
      return;
    }

    // Check if dropped over a valid target
    if (over) {
      const overId = over.id.toString();
      // Split by :: separator (used to avoid conflicts with UUIDs)
      const parts = overId.split('::');
      const targetEmpId = parts[0];
      const targetShiftId = parts[1];

      if (targetEmpId && targetShiftId) {
        // Key format must match shiftEligibleTargets which uses employeeId-shiftId
        const key = `${targetEmpId}-${targetShiftId}`;
        const target = shiftEligibleTargets.get(key);

        if (target) {
          if (target.eligibility === 'direct') {
            // Execute direct swap immediately
            const newAssignments = executeShiftSwap(
              shiftSourceSelection.employeeId,
              shiftSourceSelection.shiftId,
              targetEmpId,
              targetShiftId
            );
            setLocalShiftAssignments(newAssignments);
          } else if (target.eligibility === 'two-step' && target.twoStepPath) {
            // Show confirmation modal
            setShiftTwoStepModal({
              visible: true,
              swapPath: target.twoStepPath,
              targetEmpId,
              targetShiftId
            });
          }
        }
      }
    }

    // Reset drag state (unless modal is shown)
    if (!shiftTwoStepModal) {
      setShiftSourceSelection(null);
    }
    setShiftActiveDrag(null);
  }, [shiftSourceSelection, shiftActiveDrag, shiftEligibleTargets, executeShiftSwap, shiftTwoStepModal]);

  // Handle shift drag cancel
  const handleShiftDragCancel = useCallback(() => {
    setShiftSourceSelection(null);
    setShiftActiveDrag(null);
  }, []);

  // Handle shift two-step swap confirmation
  const handleShiftTwoStepConfirm = useCallback(() => {
    if (!shiftTwoStepModal || !shiftTwoStepModal.swapPath) return;

    let currentAssignments = [...localShiftAssignments];

    // Execute each step in sequence
    for (const step of shiftTwoStepModal.swapPath) {
      currentAssignments = currentAssignments.map(a => {
        if (a.shiftId === step.shiftA && a.employeeId === step.employeeA) {
          return { ...a, employeeId: step.employeeB };
        }
        if (a.shiftId === step.shiftB && a.employeeId === step.employeeB) {
          return { ...a, employeeId: step.employeeA };
        }
        return a;
      });
    }

    setLocalShiftAssignments(currentAssignments);
    setShiftSourceSelection(null);
    setShiftTwoStepModal(null);
  }, [shiftTwoStepModal, localShiftAssignments]);

  // Handle save shift swap changes
  const handleSaveShiftSwap = useCallback(async () => {
    if (!id) return;

    setIsSavingShiftSwap(true);
    try {
      const assignmentsRequest = {
        assignments: localShiftAssignments.map(a => ({
          shiftId: a.shiftId,
          employeeId: a.employeeId
        }))
      };
      await shiftPlanService.createAssignments(id, assignmentsRequest);
      await loadPlanData();
      showNotification({
        type: 'success',
        title: 'Gespeichert',
        message: 'Zuweisungen wurden erfolgreich gespeichert'
      });

      // Reset swap mode
      setShiftSwapModeActive(false);
      setLocalShiftAssignments([]);
      setShiftSourceSelection(null);
      setShiftActiveDrag(null);
      setShiftTwoStepModal(null);
    } catch (error) {
      console.error('Error saving shift assignments:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Zuweisungen konnten nicht gespeichert werden'
      });
    } finally {
      setIsSavingShiftSwap(false);
    }
  }, [id, localShiftAssignments, loadPlanData, showNotification]);

  // Manual assignment mode handlers
  const handleOpenManualAssignmentMode = useCallback(() => {
    if (!shiftPlan) return;

    // Initialize with empty assignments
    const initialAssignments: ShiftAssignment[] = [];

    // Pre-assign managers based on their availability (preference level 1)
    const managerEmployees = employees.filter(emp => emp.employeeType === 'manager' && emp.isActive);

    managerEmployees.forEach(manager => {
      // Find availabilities where this manager has preference level 1
      const managerAvailabilities = availabilities.filter(
        a => a.employeeId === manager.id && a.preferenceLevel === 1
      );

      managerAvailabilities.forEach(avail => {
        // Create assignment for each available shift
        initialAssignments.push({
          id: `temp-${Date.now()}-${Math.random()}`,
          planId: shiftPlan.id,
          shiftId: avail.shiftId,
          employeeId: manager.id,
          assignedAt: new Date().toISOString(),
          assignedBy: user?.id || ''
        });
      });
    });

    setManualAssignments(initialAssignments);
    setManualAssignmentModeActive(true);
  }, [shiftPlan, employees, availabilities, user]);

  const handleCancelManualAssignmentMode = useCallback(() => {
    setManualAssignmentModeActive(false);
    setManualAssignments([]);
    setDraggedEmployeeId(null);
  }, []);

  // Handle manual assignment drag start
  const handleManualDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragData;
    if (!data || data.type !== 'employee-token') return;

    setDraggedEmployeeId(data.employeeId);
  }, []);

  // Handle manual assignment drag end
  const handleManualDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !draggedEmployeeId) {
      setDraggedEmployeeId(null);
      return;
    }

    const overId = over.id.toString();

    // Check if dropped on a shift cell (format: shift-drop::shiftId)
    if (overId.startsWith('shift-drop::')) {
      const shiftId = overId.replace('shift-drop::', '');
      const employeeId = draggedEmployeeId;

      // Validate the drop
      const validation = canDropOnShift(employeeId, shiftId);

      if (validation.valid) {
        // Add the assignment
        const newAssignment: ShiftAssignment = {
          id: `temp-${Date.now()}-${Math.random()}`,
          planId: shiftPlan?.id || '',
          shiftId,
          employeeId,
          assignedAt: new Date().toISOString(),
          assignedBy: user?.id || ''
        };
        setManualAssignments(prev => [...prev, newAssignment]);
      } else {
        showNotification({
          type: 'warning',
          title: 'Zuweisung nicht möglich',
          message: validation.reason || 'Ungültige Zuweisung'
        });
      }
    }

    setDraggedEmployeeId(null);
  }, [draggedEmployeeId, shiftPlan?.id, user?.id, canDropOnShift, showNotification]);

  // Handle manual assignment drag cancel
  const handleManualDragCancel = useCallback(() => {
    setDraggedEmployeeId(null);
  }, []);

  // Handle remove assignment
  const handleRemoveManualAssignment = useCallback((shiftId: string, employeeId: string) => {
    // Check if this is a manager assignment (cannot be removed)
    const employee = employees.find(e => e.id === employeeId);
    if (employee?.employeeType === 'manager') {
      showNotification({
        type: 'warning',
        title: 'Nicht möglich',
        message: 'Manager-Zuweisungen können nicht entfernt werden'
      });
      return;
    }

    setManualAssignments(prev =>
      prev.filter(a => !(a.shiftId === shiftId && a.employeeId === employeeId))
    );
  }, [employees, showNotification]);

  // Handle save manual assignments
  const handleSaveManualAssignments = useCallback(async () => {
    if (!id || !shiftPlan) return;

    // Validate the schedule
    const validation = validateSchedule();

    if (!validation.isValid) {
      const confirmed = await confirmDialog({
        title: 'Unvollständige Zuweisungen',
        message: `Es gibt noch Probleme mit den Zuweisungen:\n\n${validation.errors.slice(0, 5).join('\n')}${validation.errors.length > 5 ? `\n...und ${validation.errors.length - 5} weitere` : ''}\n\nTrotzdem speichern?`,
        confirmText: 'Trotzdem speichern',
        cancelText: 'Abbrechen',
        type: 'warning'
      });

      if (!confirmed) return;
    }

    setIsSavingManualAssignment(true);
    try {
      const assignmentsRequest = {
        assignments: manualAssignments.map(a => ({
          shiftId: a.shiftId,
          employeeId: a.employeeId
        }))
      };
      await shiftPlanService.createAssignments(id, assignmentsRequest);
      await loadPlanData();

      showNotification({
        type: 'success',
        title: 'Gespeichert',
        message: `${manualAssignments.length} Zuweisungen wurden erfolgreich gespeichert`
      });

      // Reset manual assignment mode
      setManualAssignmentModeActive(false);
      setManualAssignments([]);
      setDraggedEmployeeId(null);
    } catch (error) {
      console.error('Error saving manual assignments:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Zuweisungen konnten nicht gespeichert werden'
      });
    } finally {
      setIsSavingManualAssignment(false);
    }
  }, [id, shiftPlan, manualAssignments, validateSchedule, confirmDialog, loadPlanData, showNotification]);

  // Weekly swap mode handlers - inline mode
  const handleOpenWeeklySwapMode = useCallback(() => {
    if (weeklyPlan?.employees) {
      setLocalWeeklyEmployees([...weeklyPlan.employees]);
      setWeeklySwapModeActive(true);
    }
  }, [weeklyPlan?.employees]);

  const handleCancelWeeklySwapMode = useCallback(() => {
    setWeeklySwapModeActive(false);
    setLocalWeeklyEmployees([]);
    setSourceSelection(null);
    setActiveDrag(null);
    setTwoStepModal(null);
  }, []);

  // Execute a single swap - updates localWeeklyEmployees
  const executeSwap = useCallback((
    empAId: string,
    weekAId: string,
    empBId: string,
    weekBId: string
  ): EmployeeWithPreferences[] => {
    return localWeeklyEmployees.map(emp => {
      if (emp.id === empAId) {
        return {
          ...emp,
          assignedWeeks: emp.assignedWeeks
            .filter(w => w !== weekAId)
            .concat(weekBId)
        };
      }
      if (emp.id === empBId) {
        return {
          ...emp,
          assignedWeeks: emp.assignedWeeks
            .filter(w => w !== weekBId)
            .concat(weekAId)
        };
      }
      return emp;
    });
  }, [localWeeklyEmployees]);

  // Handle drag start (weekly)
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragData;
    if (!data) return;

    // Don't allow managers to be dragged
    if (isEmployeeManager(data.employeeId)) return;

    setSourceSelection({
      employeeId: data.employeeId,
      weekId: data.contextId
    });
    setActiveDrag(data);
  }, [isEmployeeManager]);

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { over } = event;

    if (!sourceSelection || !activeDrag) {
      setSourceSelection(null);
      setActiveDrag(null);
      return;
    }

    // Check if dropped over a valid target
    if (over) {
      const overId = over.id.toString();

      // Check if it's a direct drop on an employee box (uses :: separator)
      if (!overId.startsWith('week-')) {
        const parts = overId.split('::');
        const targetEmpId = parts[0];
        const targetWeekId = parts[1];

        if (targetEmpId && targetWeekId) {
          // Key format must match eligibleTargets which uses employeeId-weekId
          const key = `${targetEmpId}-${targetWeekId}`;
          const target = eligibleTargets.get(key);

          if (target) {
            if (target.eligibility === 'direct') {
              // Execute direct swap immediately
              const newEmployees = executeSwap(
                sourceSelection.employeeId,
                sourceSelection.weekId,
                targetEmpId,
                targetWeekId
              );
              setLocalWeeklyEmployees(newEmployees);
            } else if (target.eligibility === 'two-step' && target.twoStepPath) {
              // Show confirmation modal
              setTwoStepModal({
                visible: true,
                swapPath: target.twoStepPath,
                targetEmpId,
                targetWeekId
              });
            }
          }
        }
      }
    }

    // Reset drag state (unless modal is shown)
    if (!twoStepModal) {
      setSourceSelection(null);
    }
    setActiveDrag(null);
  }, [sourceSelection, activeDrag, eligibleTargets, executeSwap, twoStepModal]);

  // Handle drag cancel
  const handleDragCancel = useCallback(() => {
    setSourceSelection(null);
    setActiveDrag(null);
  }, []);

  // Handle two-step swap confirmation
  const handleTwoStepConfirm = useCallback(() => {
    if (!twoStepModal || !twoStepModal.swapPath) return;

    let currentEmployees = [...localWeeklyEmployees];

    // Execute each step in sequence
    for (const step of twoStepModal.swapPath) {
      currentEmployees = currentEmployees.map(emp => {
        if (emp.id === step.employeeA) {
          return {
            ...emp,
            assignedWeeks: emp.assignedWeeks
              .filter(w => w !== step.weekA)
              .concat(step.weekB)
          };
        }
        if (emp.id === step.employeeB) {
          return {
            ...emp,
            assignedWeeks: emp.assignedWeeks
              .filter(w => w !== step.weekB)
              .concat(step.weekA)
          };
        }
        return emp;
      });
    }

    setLocalWeeklyEmployees(currentEmployees);
    setSourceSelection(null);
    setTwoStepModal(null);
  }, [twoStepModal, localWeeklyEmployees]);

  // Handle save weekly swap changes
  const handleSaveWeeklySwap = useCallback(async () => {
    if (!id) return;

    setIsSavingSwap(true);
    try {
      // Convert localWeeklyEmployees to assignment format
      const assignments: { weekId: string; employeeId: string }[] = [];
      for (const emp of localWeeklyEmployees) {
        for (const weekId of emp.assignedWeeks) {
          assignments.push({ weekId, employeeId: emp.id });
        }
      }

      await weeklyPlanService.createAssignments(id, { assignments });
      await loadPlanData();
      showNotification({
        type: 'success',
        title: 'Gespeichert',
        message: 'Zuweisungen wurden erfolgreich gespeichert'
      });

      // Reset swap mode
      setWeeklySwapModeActive(false);
      setLocalWeeklyEmployees([]);
      setSourceSelection(null);
      setActiveDrag(null);
      setTwoStepModal(null);
    } catch (error) {
      console.error('Error saving weekly assignments:', error);
      showNotification({
        type: 'error',
        title: 'Fehler',
        message: 'Zuweisungen konnten nicht gespeichert werden'
      });
    } finally {
      setIsSavingSwap(false);
    }
  }, [id, localWeeklyEmployees, loadPlanData, showNotification]);

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
    : shiftPlan?.shifts.some(s => s.assignments.length > 0);

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
                {/* Shift plan: Generate assignments / Manual assignment buttons */}
                {planType === 'shift' && !hasAssignments && !manualAssignmentModeActive && (
                  <div className={styles.buttonGroup}>
                    <button
                      onClick={handleGenerateShiftAssignments}
                      disabled={!availabilityStatus.canPublish || isGenerating}
                      className={`${styles.primaryButton} ${!availabilityStatus.canPublish ? styles.disabledButton : ''}`}
                    >
                      {isGenerating ? 'Berechne...' : 'Zuweisungen generieren'}
                    </button>
                    <button
                      onClick={handleOpenManualAssignmentMode}
                      disabled={!availabilityStatus.canPublish}
                      className={`${styles.secondaryButton} ${!availabilityStatus.canPublish ? styles.disabledButton : ''}`}
                    >
                      Manuelle Zuweisung
                    </button>
                  </div>
                )}

                {/* Manual assignment mode active */}
                {planType === 'shift' && manualAssignmentModeActive && (
                  <div className={styles.buttonGroup}>
                    <button
                      onClick={handleSaveManualAssignments}
                      disabled={isSavingManualAssignment}
                      className={styles.successButton}
                    >
                      {isSavingManualAssignment ? 'Speichert...' : 'Zuweisungen speichern'}
                    </button>
                    <button
                      onClick={handleCancelManualAssignmentMode}
                      disabled={isSavingManualAssignment}
                      className={styles.secondaryButton}
                    >
                      Abbrechen
                    </button>
                  </div>
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
                {planType === 'shift' && !shiftSwapModeActive && (
                  <button
                    onClick={handleOpenShiftSwapMode}
                    className={styles.secondaryButton}
                  >
                    Manuelle Änderungen
                  </button>
                )}
                {planType === 'shift' && shiftSwapModeActive && (
                  <>
                    <button
                      onClick={handleSaveShiftSwap}
                      disabled={isSavingShiftSwap}
                      className={styles.successButton}
                    >
                      {isSavingShiftSwap ? 'Speichert...' : 'Manuelle Änderungen speichern'}
                    </button>
                    <button
                      onClick={handleCancelShiftSwapMode}
                      disabled={isSavingShiftSwap}
                      className={styles.secondaryButton}
                    >
                      Abbrechen
                    </button>
                  </>
                )}
                {planType === 'weekly' && !weeklySwapModeActive && (
                  <button
                    onClick={handleOpenWeeklySwapMode}
                    className={styles.secondaryButton}
                  >
                    Manuelle Änderungen
                  </button>
                )}
                {planType === 'weekly' && weeklySwapModeActive && (
                  <>
                    <button
                      onClick={handleSaveWeeklySwap}
                      disabled={isSavingSwap}
                      className={styles.successButton}
                    >
                      {isSavingSwap ? 'Speichert...' : 'Manuelle Änderung speichern'}
                    </button>
                    <button
                      onClick={handleCancelWeeklySwapMode}
                      disabled={isSavingSwap}
                      className={styles.secondaryButton}
                    >
                      Abbrechen
                    </button>
                  </>
                )}
                {!weeklySwapModeActive && !shiftSwapModeActive && (
                  <button
                    onClick={planType === 'shift' ? handlePublishShiftPlan : handlePublishWeeklyPlan}
                    disabled={isPublishing || (planType === 'weekly' && isSubmitting)}
                    className={styles.successButton}
                  >
                    {isPublishing ? 'Veröffentliche...' : `${planType === 'shift' ? 'Schichtplan' : 'Wochenplan'} veröffentlichen`}
                  </button>
                )}
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
            {/* Manual assignment mode */}
            {manualAssignmentModeActive ? (
              <DndContext
                sensors={sensors}
                onDragStart={handleManualDragStart}
                onDragEnd={handleManualDragEnd}
                onDragCancel={handleManualDragCancel}
              >
                <EmployeeTokenPool
                  employees={schedulableEmployees}
                  draggedEmployeeId={draggedEmployeeId}
                />
                <Timetable
                  mode="view"
                  shifts={shiftPlan.shifts || []}
                  timeSlots={shiftPlan.timeSlots || []}
                  days={days}
                  shiftAssignments={manualAssignments}
                  employees={employees}
                  shiftPlanStatus={shiftPlan.status}
                  headerTitle="Schichtplan - Manuelle Zuweisung"
                  showLegend={false}
                  manualAssignmentMode={true}
                  draggedEmployeeId={draggedEmployeeId}
                  validDropTargets={draggedEmployeeId ? getValidDropTargets(draggedEmployeeId) : undefined}
                  onRemoveAssignment={handleRemoveManualAssignment}
                />
                <DragOverlay>
                  {draggedEmployeeId ? (() => {
                    const emp = schedulableEmployees.find(e => e.id === draggedEmployeeId);
                    if (!emp) return null;
                    const [firstname, ...lastnameParts] = emp.name.split(' ');
                    return (
                      <DraggableEmployeeBox
                        employee={{
                          id: emp.id,
                          firstname,
                          lastname: lastnameParts.join(' ') || null,
                          employeeType: null,
                          isTrainee: null
                        }}
                        contextId="overlay"
                        isSource={false}
                        eligibility={null}
                        isOverlay={false}
                      />
                    );
                  })() : null}
                </DragOverlay>
              </DndContext>
            ) : shiftSwapModeActive ? (
              <DndContext
                sensors={sensors}
                onDragStart={handleShiftDragStart}
                onDragEnd={handleShiftDragEnd}
                onDragCancel={handleShiftDragCancel}
              >
                <Timetable
                  mode="view"
                  shifts={shiftPlan.shifts || []}
                  timeSlots={shiftPlan.timeSlots || []}
                  days={days}
                  shiftAssignments={localShiftAssignments}
                  employees={employees}
                  shiftPlanStatus={shiftPlan.status}
                  headerTitle="Schichtplan - Bearbeitungsmodus"
                  showLegend={false}
                  swapModeActive={true}
                  sourceSelection={shiftSourceSelection}
                  eligibleTargets={shiftEligibilityMap}
                />
              </DndContext>
            ) : (
              <Timetable
                mode="view"
                shifts={shiftPlan.shifts || []}
                timeSlots={shiftPlan.timeSlots || []}
                days={days}
                shiftAssignments={shiftPlan.shifts.flatMap(shift => shift.assignments)}
                employees={employees}
                shiftPlanStatus={shiftPlan.status}
                headerTitle="Schichtplan"
                showLegend={false}
              />
            )}
          </div>
        )}

        {/* Calendar for weekly plans */}
        {planType === 'weekly' && weeklyPlan && (
          <div className={styles.calendarContainer}>
            <h2>Kalenderansicht{weeklySwapModeActive && ' - Bearbeitungsmodus'}</h2>
            {weeklySwapModeActive ? (
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <Calendar
                  year={currentMonth.getFullYear()}
                  month={currentMonth.getMonth()}
                  weeks={weeklyPlan.weeks}
                  employees={localWeeklyEmployees}
                  onMonthChange={handleMonthChange}
                  swapModeActive={true}
                  sourceSelection={sourceSelection}
                  eligibleTargets={eligibilityMap}
                />
              </DndContext>
            ) : (
              <Calendar
                year={currentMonth.getFullYear()}
                month={currentMonth.getMonth()}
                weeks={weeklyPlan.weeks}
                employees={weeklyPlan.employees}
                onMonthChange={handleMonthChange}
              />
            )}
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

      {/* Two-Step Confirm Modal (for shift inline swap mode) */}
      {shiftTwoStepModal && shiftTwoStepModal.visible && shiftPlan && (
        <TwoStepConfirmModal
          swapPath={shiftTwoStepModal.swapPath}
          employees={employees}
          shifts={shiftPlan.shifts}
          onConfirm={handleShiftTwoStepConfirm}
          onCancel={() => {
            setShiftTwoStepModal(null);
            setShiftSourceSelection(null);
          }}
        />
      )}

      {/* Two-Step Confirm Modal (for weekly inline swap mode) */}
      {twoStepModal && twoStepModal.visible && weeklyPlan && (
        <WeeklyTwoStepConfirmModal
          swapPath={twoStepModal.swapPath}
          employees={localWeeklyEmployees}
          weeks={weeklyPlan.weeks}
          onConfirm={handleTwoStepConfirm}
          onCancel={() => {
            setTwoStepModal(null);
            setSourceSelection(null);
          }}
        />
      )}
    </div>
  );
};

export default PlanView;