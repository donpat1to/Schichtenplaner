// frontend/src/components/SwapMode/SwapModeOverlay.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { Employee, EmployeeAvailability } from '../../models/Employee';
import { ShiftWithData, ShiftAssignment, TimeSlot } from '../../models/ShiftPlan';
import { useSwapValidation, SwapTarget } from '../../hooks/useSwapValidation';
import { SwapStep } from '../../utils/swapConstraints';
import Timetable, { DayInfo } from '../Timetable/Timetable';
import SelectionPanel from './SelectionPanel';
import TwoStepConfirmModal from './TwoStepConfirmModal';
import styles from './SwapModeOverlay.module.css';

interface SourceSelection {
  employeeId: string;
  shiftId: string;
}

interface SwapModeOverlayProps {
  shifts: ShiftWithData[];
  timeSlots: TimeSlot[];
  days: DayInfo[];
  employees: Employee[];
  availabilities: EmployeeAvailability[];
  assignments: ShiftAssignment[];
  onClose: () => void;
  onSwapComplete: (newAssignments: ShiftAssignment[]) => void;
}

const SwapModeOverlay: React.FC<SwapModeOverlayProps> = ({
  shifts,
  timeSlots,
  days,
  employees,
  availabilities,
  assignments,
  onClose,
  onSwapComplete
}) => {
  // Local assignments state for tracking swaps
  const [localAssignments, setLocalAssignments] = useState<ShiftAssignment[]>(assignments);

  // Source selection state
  const [sourceSelection, setSourceSelection] = useState<SourceSelection | null>(null);

  // Two-step confirmation modal state
  const [twoStepModal, setTwoStepModal] = useState<{
    visible: boolean;
    swapPath: SwapStep[];
    targetEmpId: string;
    targetShiftId: string;
  } | null>(null);

  // Use swap validation hook
  const {
    getEligibleSwapTargets,
    isEmployeeManager
  } = useSwapValidation(shifts, employees, availabilities, localAssignments);

  // Get eligible targets when source is selected
  const eligibleTargets = useMemo<Map<string, SwapTarget>>(() => {
    if (!sourceSelection) return new Map();
    return getEligibleSwapTargets(sourceSelection.employeeId, sourceSelection.shiftId);
  }, [sourceSelection, getEligibleSwapTargets]);

  // Get source employee and shift info
  const sourceEmployee = useMemo(() => {
    if (!sourceSelection) return null;
    return employees.find(e => e.id === sourceSelection.employeeId) || null;
  }, [sourceSelection, employees]);

  const sourceShift = useMemo(() => {
    if (!sourceSelection) return null;
    return shifts.find(s => s.id === sourceSelection.shiftId) || null;
  }, [sourceSelection, shifts]);

  const sourceTimeSlot = useMemo(() => {
    if (!sourceShift) return null;
    return timeSlots.find(ts => ts.id === sourceShift.timeSlotId) || null;
  }, [sourceShift, timeSlots]);

  // Execute a single swap
  const executeSwap = useCallback((
    empAId: string,
    shiftAId: string,
    empBId: string,
    shiftBId: string
  ): ShiftAssignment[] => {
    return localAssignments.map(a => {
      if (a.shiftId === shiftAId && a.employeeId === empAId) {
        return { ...a, employeeId: empBId };
      }
      if (a.shiftId === shiftBId && a.employeeId === empBId) {
        return { ...a, employeeId: empAId };
      }
      return a;
    });
  }, [localAssignments]);

  // Handle employee click
  const handleEmployeeClick = useCallback((employeeId: string, shiftId: string) => {
    // If clicking a manager, ignore
    if (isEmployeeManager(employeeId)) return;

    // If no source selected, select this as source
    if (!sourceSelection) {
      setSourceSelection({ employeeId, shiftId });
      return;
    }

    // If clicking the source again, deselect
    if (sourceSelection.employeeId === employeeId && sourceSelection.shiftId === shiftId) {
      setSourceSelection(null);
      return;
    }

    // Check eligibility
    const key = `${employeeId}-${shiftId}`;
    const target = eligibleTargets.get(key);

    if (!target) {
      // Not eligible, ignore or show message
      return;
    }

    if (target.eligibility === 'direct') {
      // Execute direct swap immediately
      const newAssignments = executeSwap(
        sourceSelection.employeeId,
        sourceSelection.shiftId,
        employeeId,
        shiftId
      );
      setLocalAssignments(newAssignments);
      setSourceSelection(null);
    } else if (target.eligibility === 'two-step' && target.twoStepPath) {
      // Show confirmation modal
      setTwoStepModal({
        visible: true,
        swapPath: target.twoStepPath,
        targetEmpId: employeeId,
        targetShiftId: shiftId
      });
    }
  }, [sourceSelection, eligibleTargets, isEmployeeManager, executeSwap]);

  // Handle two-step swap confirmation
  const handleTwoStepConfirm = useCallback(() => {
    if (!twoStepModal || !twoStepModal.swapPath) return;

    let currentAssignments = [...localAssignments];

    // Execute each step in sequence
    for (const step of twoStepModal.swapPath) {
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

    setLocalAssignments(currentAssignments);
    setSourceSelection(null);
    setTwoStepModal(null);
  }, [twoStepModal, localAssignments]);

  // Handle cancel selection
  const handleCancelSelection = useCallback(() => {
    setSourceSelection(null);
  }, []);

  // Handle close overlay
  const handleClose = useCallback(() => {
    // Pass the modified assignments back
    onSwapComplete(localAssignments);
    onClose();
  }, [localAssignments, onSwapComplete, onClose]);

  // Convert eligibleTargets map to the format expected by Timetable
  const eligibilityMap = useMemo<Map<string, 'direct' | 'two-step'>>(() => {
    const map = new Map<string, 'direct' | 'two-step'>();
    eligibleTargets.forEach((target, key) => {
      if (target.eligibility) {
        map.set(key, target.eligibility);
      }
    });
    return map;
  }, [eligibleTargets]);

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <h2 className={styles.title}>Manuelle Zuweisung</h2>
        <button className={styles.closeButton} onClick={handleClose}>
          Beenden
        </button>
      </div>

      <div className={styles.content}>
        <Timetable
          mode="view"
          shifts={shifts}
          timeSlots={timeSlots}
          days={days}
          shiftAssignments={localAssignments}
          employees={employees}
          shiftPlanStatus="draft"
          headerTitle="Schichtplan - Bearbeitungsmodus"
          showLegend={false}
          swapModeActive={true}
          sourceSelection={sourceSelection}
          eligibleTargets={eligibilityMap}
          onEmployeeClick={handleEmployeeClick}
        />
      </div>

      {sourceSelection && sourceEmployee && sourceShift && (
        <SelectionPanel
          employee={sourceEmployee}
          shiftId={sourceSelection.shiftId}
          timeSlot={sourceTimeSlot}
          dayOfWeek={sourceShift.dayOfWeek}
          onCancel={handleCancelSelection}
        />
      )}

      {twoStepModal && twoStepModal.visible && (
        <TwoStepConfirmModal
          swapPath={twoStepModal.swapPath}
          employees={employees}
          shifts={shifts}
          onConfirm={handleTwoStepConfirm}
          onCancel={() => setTwoStepModal(null)}
        />
      )}
    </div>
  );
};

export default SwapModeOverlay;
