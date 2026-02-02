// frontend/src/components/SwapMode/WeeklySwapModeOverlay.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { EmployeeWithPreferences, PlanWeek } from '../../models/WeeklyPlan';
import { useWeeklySwapValidation, WeeklySwapTarget } from '../../hooks/useWeeklySwapValidation';
import { WeeklySwapStep } from '../../utils/weeklySwapConstraints';
import Calendar from '../Calendar/Calendar';
import WeeklySelectionPanel from './WeeklySelectionPanel';
import WeeklyTwoStepConfirmModal from './WeeklyTwoStepConfirmModal';
import styles from './WeeklySwapModeOverlay.module.css';

interface SourceSelection {
  employeeId: string;
  weekId: string;
}

interface WeeklySwapModeOverlayProps {
  weeks: PlanWeek[];
  employees: EmployeeWithPreferences[];
  onClose: () => void;
  onSwapComplete: (newAssignments: { weekId: string; employeeId: string }[]) => Promise<void>;
}

const WeeklySwapModeOverlay: React.FC<WeeklySwapModeOverlayProps> = ({
  weeks,
  employees,
  onClose,
  onSwapComplete
}) => {
  // Local assignments state - track as modified employee data
  const [localEmployees, setLocalEmployees] = useState<EmployeeWithPreferences[]>(employees);

  // Source selection state
  const [sourceSelection, setSourceSelection] = useState<SourceSelection | null>(null);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // Two-step confirmation modal state
  const [twoStepModal, setTwoStepModal] = useState<{
    visible: boolean;
    swapPath: WeeklySwapStep[];
    targetEmpId: string;
    targetWeekId: string;
  } | null>(null);

  // Use swap validation hook
  const {
    getEligibleWeeklySwapTargets,
    isEmployeeManager
  } = useWeeklySwapValidation(weeks, localEmployees);

  // Get eligible targets when source is selected
  const eligibleTargets = useMemo<Map<string, WeeklySwapTarget>>(() => {
    if (!sourceSelection) return new Map();
    return getEligibleWeeklySwapTargets(sourceSelection.employeeId, sourceSelection.weekId);
  }, [sourceSelection, getEligibleWeeklySwapTargets]);

  // Get source employee and week info
  const sourceEmployee = useMemo(() => {
    if (!sourceSelection) return null;
    return localEmployees.find(e => e.id === sourceSelection.employeeId) || null;
  }, [sourceSelection, localEmployees]);

  const sourceWeek = useMemo(() => {
    if (!sourceSelection) return null;
    return weeks.find(w => w.id === sourceSelection.weekId) || null;
  }, [sourceSelection, weeks]);

  // Execute a single swap - updates localEmployees
  const executeSwap = useCallback((
    empAId: string,
    weekAId: string,
    empBId: string,
    weekBId: string
  ): EmployeeWithPreferences[] => {
    return localEmployees.map(emp => {
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
  }, [localEmployees]);

  // Handle employee click
  const handleEmployeeClick = useCallback((employeeId: string, weekId: string) => {
    // If clicking a manager, ignore
    if (isEmployeeManager(employeeId)) return;

    // If no source selected, select this as source
    if (!sourceSelection) {
      setSourceSelection({ employeeId, weekId });
      return;
    }

    // If clicking the source again, deselect
    if (sourceSelection.employeeId === employeeId && sourceSelection.weekId === weekId) {
      setSourceSelection(null);
      return;
    }

    // Check eligibility
    const key = `${employeeId}-${weekId}`;
    const target = eligibleTargets.get(key);

    if (!target) {
      // Not eligible, ignore
      return;
    }

    if (target.eligibility === 'direct') {
      // Execute direct swap immediately
      const newEmployees = executeSwap(
        sourceSelection.employeeId,
        sourceSelection.weekId,
        employeeId,
        weekId
      );
      setLocalEmployees(newEmployees);
      setSourceSelection(null);
    } else if (target.eligibility === 'two-step' && target.twoStepPath) {
      // Show confirmation modal
      setTwoStepModal({
        visible: true,
        swapPath: target.twoStepPath,
        targetEmpId: employeeId,
        targetWeekId: weekId
      });
    }
  }, [sourceSelection, eligibleTargets, isEmployeeManager, executeSwap]);

  // Handle two-step swap confirmation
  const handleTwoStepConfirm = useCallback(() => {
    if (!twoStepModal || !twoStepModal.swapPath) return;

    let currentEmployees = [...localEmployees];

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

    setLocalEmployees(currentEmployees);
    setSourceSelection(null);
    setTwoStepModal(null);
  }, [twoStepModal, localEmployees]);

  // Handle cancel selection
  const handleCancelSelection = useCallback(() => {
    setSourceSelection(null);
  }, []);

  // Handle close overlay - convert local state to assignment format and save
  const handleClose = useCallback(async () => {
    setIsSaving(true);
    try {
      // Convert localEmployees to assignment format
      const assignments: { weekId: string; employeeId: string }[] = [];
      for (const emp of localEmployees) {
        for (const weekId of emp.assignedWeeks) {
          assignments.push({ weekId, employeeId: emp.id });
        }
      }

      // Pass the modified assignments back and wait for save
      await onSwapComplete(assignments);
      onClose();
    } finally {
      setIsSaving(false);
    }
  }, [localEmployees, onSwapComplete, onClose]);

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

  // Calculate all months that the plan spans
  const monthsToRender = useMemo(() => {
    if (weeks.length === 0) return [];

    // Sort weeks by start date
    const sortedWeeks = [...weeks].sort((a, b) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    const firstDate = new Date(sortedWeeks[0].startDate);
    const lastDate = new Date(sortedWeeks[sortedWeeks.length - 1].endDate);

    const months: { year: number; month: number }[] = [];
    const current = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);

    while (current <= lastDate) {
      months.push({ year: current.getFullYear(), month: current.getMonth() });
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }, [weeks]);

  // Dummy handler for onMonthChange (not used since navigation is hidden)
  const handleMonthChange = useCallback(() => { }, []);

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <h2 className={styles.title}>Manuelle Zuweisung</h2>
        <button
          className={styles.closeButton}
          onClick={handleClose}
          disabled={isSaving}
        >
          {isSaving ? 'Speichert...' : 'Beenden'}
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.calendarsContainer}>
          <Calendar
            year={0}
            month={0}
            weeks={weeks}
            employees={localEmployees}
            onMonthChange={handleMonthChange}
            hideNavigation={true}
            swapModeActive={true}
            sourceSelection={sourceSelection}
            eligibleTargets={eligibilityMap}
            onEmployeeClick={handleEmployeeClick}
          />
        </div>
      </div>

      {sourceSelection && sourceEmployee && sourceWeek && (
        <WeeklySelectionPanel
          employee={sourceEmployee}
          week={sourceWeek}
          onCancel={handleCancelSelection}
        />
      )}

      {twoStepModal && twoStepModal.visible && (
        <WeeklyTwoStepConfirmModal
          swapPath={twoStepModal.swapPath}
          employees={localEmployees}
          weeks={weeks}
          onConfirm={handleTwoStepConfirm}
          onCancel={() => setTwoStepModal(null)}
        />
      )}
    </div>
  );
};

export default WeeklySwapModeOverlay;
