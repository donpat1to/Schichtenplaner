// frontend/src/hooks/useManualAssignmentValidation.ts
import { useMemo, useCallback } from 'react';
import { Shift, ShiftAssignment } from '../models/ShiftPlan';
import { Employee, EmployeeAvailability } from '../models/Employee';

export interface SchedulableEmployee {
  id: string;
  name: string;
  contractType: 'small' | 'large' | 'flexible';
  requiredShifts: number; // 1 for small, 2 for large
  assignedShifts: number;
  remainingShifts: number;
}

export interface DropTarget {
  shiftId: string;
  isValid: boolean;
  reason?: string;
}

interface UseManualAssignmentValidationProps {
  shifts: Shift[];
  employees: Employee[];
  availabilities: EmployeeAvailability[];
  assignments: ShiftAssignment[];
}

export function useManualAssignmentValidation({
  shifts,
  employees,
  availabilities,
  assignments,
}: UseManualAssignmentValidationProps) {

  // Get schedulable employees (personell, active, not trainee)
  const schedulableEmployees = useMemo<SchedulableEmployee[]>(() => {
    return employees
      .filter(emp =>
        emp.employeeType === 'personell' &&
        emp.isActive
      )
      .map(emp => {
        const requiredShifts = emp.contractType === 'small' ? 1 :
          emp.contractType === 'large' ? 2 : 2; // flexible defaults to 2
        const assignedShifts = assignments.filter(a => a.employeeId === emp.id).length;

        return {
          id: emp.id,
          name: `${emp.firstname || ''} ${emp.lastname || ''}`.trim() || emp.username,
          contractType: emp.contractType || 'small',
          requiredShifts,
          assignedShifts,
          remainingShifts: Math.max(0, requiredShifts - assignedShifts),
        };
      });
  }, [employees, assignments]);

  // Get managers (pre-assigned, excluded from constraints)
  const managers = useMemo(() => {
    return employees.filter(emp => emp.employeeType === 'manager' && emp.isActive);
  }, [employees]);

  // Check if employee is available for a shift (preference 1 or 2)
  const isEmployeeAvailable = useCallback((employeeId: string, shiftId: string): boolean => {
    const availability = availabilities.find(
      a => a.employeeId === employeeId && a.shiftId === shiftId
    );
    // Available if preference level is 1 or 2, unavailable if 3 or missing
    return availability ? availability.preferenceLevel <= 2 : false;
  }, [availabilities]);

  // Check if employee already has a shift on the same day
  const hasShiftOnSameDay = useCallback((employeeId: string, targetShiftId: string): boolean => {
    const targetShift = shifts.find(s => s.id === targetShiftId);
    if (!targetShift) return false;

    const employeeAssignedShiftIds = assignments
      .filter(a => a.employeeId === employeeId)
      .map(a => a.shiftId);

    return employeeAssignedShiftIds.some(assignedShiftId => {
      const assignedShift = shifts.find(s => s.id === assignedShiftId);
      return assignedShift && assignedShift.dayOfWeek === targetShift.dayOfWeek;
    });
  }, [shifts, assignments]);

  // Get current assignment count for a shift
  const getShiftAssignmentCount = useCallback((shiftId: string): number => {
    return assignments.filter(a => a.shiftId === shiftId && (employees.find(e => e.id == a.employeeId && e.employeeType === 'personell'))).length;
  }, [assignments]);

  // Check if shift has reached max capacity
  const isShiftFull = useCallback((shiftId: string): boolean => {
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return true;

    const currentCount = getShiftAssignmentCount(shiftId);
    return currentCount >= shift.maxEmployees;
  }, [shifts, getShiftAssignmentCount]);

  // Check if employee has remaining shifts to assign
  const hasRemainingShifts = useCallback((employeeId: string): boolean => {
    const emp = schedulableEmployees.find(e => e.id === employeeId);
    return emp ? emp.remainingShifts > 0 : false;
  }, [schedulableEmployees]);

  // Get valid drop targets for an employee
  const getValidDropTargets = useCallback((employeeId: string): Map<string, DropTarget> => {
    const targets = new Map<string, DropTarget>();

    if (!hasRemainingShifts(employeeId)) {
      // No valid targets if employee has no remaining shifts
      shifts.forEach(shift => {
        targets.set(shift.id, {
          shiftId: shift.id,
          isValid: false,
          reason: 'Mitarbeiter hat bereits alle Schichten zugeteilt'
        });
      });
      return targets;
    }

    shifts.forEach(shift => {
      let isValid = true;
      let reason: string | undefined;

      // Check availability (preference 1 or 2)
      if (!isEmployeeAvailable(employeeId, shift.id)) {
        isValid = false;
        reason = 'Mitarbeiter ist für diese Schicht nicht verfügbar';
      }
      // Check same-day constraint
      else if (hasShiftOnSameDay(employeeId, shift.id)) {
        isValid = false;
        reason = 'Mitarbeiter hat bereits eine Schicht an diesem Tag';
      }
      // Check shift capacity
      else if (isShiftFull(shift.id)) {
        isValid = false;
        reason = 'Schicht hat maximale Besetzung erreicht';
      }
      // Check if already assigned to this shift
      else if (assignments.some(a => a.employeeId === employeeId && a.shiftId === shift.id)) {
        isValid = false;
        reason = 'Mitarbeiter ist bereits dieser Schicht zugewiesen';
      }

      targets.set(shift.id, { shiftId: shift.id, isValid, reason });
    });

    return targets;
  }, [shifts, assignments, hasRemainingShifts, isEmployeeAvailable, hasShiftOnSameDay, isShiftFull]);

  // Check if a specific drop is valid
  const canDropOnShift = useCallback((employeeId: string, shiftId: string): { valid: boolean; reason?: string } => {
    // Check if employee has remaining shifts
    if (!hasRemainingShifts(employeeId)) {
      return { valid: false, reason: 'Mitarbeiter hat bereits alle Schichten zugeteilt' };
    }

    // Check if already assigned
    if (assignments.some(a => a.employeeId === employeeId && a.shiftId === shiftId)) {
      return { valid: false, reason: 'Mitarbeiter ist bereits dieser Schicht zugewiesen' };
    }

    // Check availability
    if (!isEmployeeAvailable(employeeId, shiftId)) {
      return { valid: false, reason: 'Mitarbeiter ist für diese Schicht nicht verfügbar (Präferenz 3 oder keine Angabe)' };
    }

    // Check same-day constraint
    if (hasShiftOnSameDay(employeeId, shiftId)) {
      return { valid: false, reason: 'Mitarbeiter hat bereits eine Schicht an diesem Tag' };
    }

    // Check shift capacity
    if (isShiftFull(shiftId)) {
      return { valid: false, reason: 'Schicht hat maximale Besetzung erreicht' };
    }

    return { valid: true };
  }, [hasRemainingShifts, assignments, isEmployeeAvailable, hasShiftOnSameDay, isShiftFull]);

  // Get shift staffing status
  const getShiftStatus = useCallback((shiftId: string): {
    current: number;
    min: number;
    max: number;
    isUnderStaffed: boolean;
    isOverStaffed: boolean;
    isFull: boolean;
  } => {
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) {
      return { current: 0, min: 0, max: 0, isUnderStaffed: false, isOverStaffed: false, isFull: true };
    }

    const current = getShiftAssignmentCount(shiftId);
    return {
      current,
      min: shift.minEmployees,
      max: shift.maxEmployees,
      isUnderStaffed: current < shift.minEmployees,
      isOverStaffed: current > shift.maxEmployees,
      isFull: current >= shift.maxEmployees,
    };
  }, [shifts, getShiftAssignmentCount]);

  // Validate entire schedule
  const validateSchedule = useCallback((): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Check each employee has exact required shifts
    schedulableEmployees.forEach(emp => {
      if (emp.assignedShifts !== emp.requiredShifts) {
        errors.push(`${emp.name}: ${emp.assignedShifts}/${emp.requiredShifts} Schichten zugewiesen`);
      }
    });

    // Check each shift meets minimum staffing
    shifts.forEach(shift => {
      const status = getShiftStatus(shift.id);
      if (status.isUnderStaffed) {
        errors.push(`Schicht ${shift.id}: Unterbesetzt (${status.current}/${status.min} min)`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [schedulableEmployees, shifts, getShiftStatus]);

  return {
    schedulableEmployees,
    managers,
    getValidDropTargets,
    canDropOnShift,
    getShiftStatus,
    validateSchedule,
    isEmployeeAvailable,
  };
}
