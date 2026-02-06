// frontend/src/hooks/useManualWeekAssignmentValidation.ts
import { useMemo, useCallback } from 'react';
import { PlanWeek, EmployeeWithPreferences } from '../models/WeeklyPlan';

export interface SchedulableWeeklyEmployee {
  id: string;
  name: string;
  employeeType: string;
  isTrainee: boolean;
  requiredWeeks: number;
  assignedWeeks: number;
  remainingWeeks: number;
  preferences: { weekId: string; preferenceLevel: 1 | 2 | 3 }[];
}

export interface WeekDropTarget {
  weekId: string;
  isValid: boolean;
  reason?: string;
}

interface WeeklyAssignment {
  weekId: string;
  employeeId: string;
}

interface UseManualWeekAssignmentValidationProps {
  weeks: PlanWeek[];
  employees: EmployeeWithPreferences[];
  assignments: WeeklyAssignment[];
}

export function useManualWeekAssignmentValidation({
  weeks,
  employees,
  assignments,
}: UseManualWeekAssignmentValidationProps) {

  // Get schedulable employees (personell, active, not trainee)
  const schedulableEmployees = useMemo<SchedulableWeeklyEmployee[]>(() => {
    return employees
      .filter(emp =>
        emp.employeeType === 'personell'
      )
      .map(emp => {
        const assignedWeeksCount = assignments.filter(a => a.employeeId === emp.id).length;

        return {
          id: emp.id,
          name: `${emp.firstname || ''} ${emp.lastname || ''}`.trim(),
          employeeType: emp.employeeType,
          isTrainee: emp.isTrainee,
          requiredWeeks: emp.requiredWeeks,
          assignedWeeks: assignedWeeksCount,
          remainingWeeks: Math.max(0, emp.requiredWeeks - assignedWeeksCount),
          preferences: emp.preferences,
        };
      });
  }, [employees, assignments]);

  // Get managers (pre-assigned, excluded from constraints)
  const managers = useMemo(() => {
    return employees.filter(emp => emp.employeeType === 'manager');
  }, [employees]);

  // Check if employee is available for a week (preference 1 or 2)
  const isEmployeeAvailable = useCallback((employeeId: string, weekId: string): boolean => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return false;

    const preference = employee.preferences.find(p => p.weekId === weekId);
    // Available if preference level is 1 or 2, unavailable if 3 or missing
    return preference ? preference.preferenceLevel <= 2 : false;
  }, [employees]);

  // Check if employee has remaining weeks to assign
  const hasRemainingWeeks = useCallback((employeeId: string): boolean => {
    const emp = schedulableEmployees.find(e => e.id === employeeId);
    return emp ? emp.remainingWeeks > 0 : false;
  }, [schedulableEmployees]);

  // Get current assignment count for a week
  const getWeekAssignmentCount = useCallback((weekId: string): number => {
    return assignments.filter(a => {
      const emp = employees.find(e => e.id === a.employeeId);
      return a.weekId === weekId && emp && emp.employeeType === 'personell';
    }).length;
  }, [assignments, employees]);

  // Check if week has reached max capacity
  const isWeekFull = useCallback((weekId: string): boolean => {
    const week = weeks.find(w => w.id === weekId);
    if (!week) return true;

    const currentCount = getWeekAssignmentCount(weekId);
    return currentCount >= week.maxEmployees;
  }, [weeks, getWeekAssignmentCount]);

  // Check if employee is already assigned to a week
  const isAlreadyAssigned = useCallback((employeeId: string, weekId: string): boolean => {
    return assignments.some(a => a.employeeId === employeeId && a.weekId === weekId);
  }, [assignments]);

  // Get valid drop targets for an employee
  const getValidDropTargets = useCallback((employeeId: string): Map<string, WeekDropTarget> => {
    const targets = new Map<string, WeekDropTarget>();

    if (!hasRemainingWeeks(employeeId)) {
      // No valid targets if employee has no remaining weeks
      weeks.forEach(week => {
        targets.set(week.id, {
          weekId: week.id,
          isValid: false,
          reason: 'Mitarbeiter hat bereits alle Wochen zugeteilt'
        });
      });
      return targets;
    }

    weeks.forEach(week => {
      let isValid = true;
      let reason: string | undefined;

      // Check if already assigned to this week
      if (isAlreadyAssigned(employeeId, week.id)) {
        isValid = false;
        reason = 'Mitarbeiter ist bereits dieser Woche zugewiesen';
      }
      // Check availability (preference 1 or 2)
      else if (!isEmployeeAvailable(employeeId, week.id)) {
        isValid = false;
        reason = 'Mitarbeiter ist für diese Woche nicht verfügbar';
      }
      // Check week capacity
      else if (isWeekFull(week.id)) {
        isValid = false;
        reason = 'Woche hat maximale Besetzung erreicht';
      }

      targets.set(week.id, { weekId: week.id, isValid, reason });
    });

    return targets;
  }, [weeks, hasRemainingWeeks, isAlreadyAssigned, isEmployeeAvailable, isWeekFull]);

  // Check if a specific drop is valid
  const canDropOnWeek = useCallback((employeeId: string, weekId: string): { valid: boolean; reason?: string } => {
    // Check if employee has remaining weeks
    if (!hasRemainingWeeks(employeeId)) {
      return { valid: false, reason: 'Mitarbeiter hat bereits alle Wochen zugeteilt' };
    }

    // Check if already assigned
    if (isAlreadyAssigned(employeeId, weekId)) {
      return { valid: false, reason: 'Mitarbeiter ist bereits dieser Woche zugewiesen' };
    }

    // Check availability
    if (!isEmployeeAvailable(employeeId, weekId)) {
      return { valid: false, reason: 'Mitarbeiter ist für diese Woche nicht verfügbar (Präferenz 3)' };
    }

    // Check week capacity
    if (isWeekFull(weekId)) {
      return { valid: false, reason: 'Woche hat maximale Besetzung erreicht' };
    }

    return { valid: true };
  }, [hasRemainingWeeks, isAlreadyAssigned, isEmployeeAvailable, isWeekFull]);

  // Get week staffing status
  const getWeekStatus = useCallback((weekId: string): {
    current: number;
    min: number;
    max: number;
    isUnderStaffed: boolean;
    isOverStaffed: boolean;
    isFull: boolean;
  } => {
    const week = weeks.find(w => w.id === weekId);
    if (!week) {
      return { current: 0, min: 0, max: 0, isUnderStaffed: false, isOverStaffed: false, isFull: true };
    }

    const current = getWeekAssignmentCount(weekId);
    return {
      current,
      min: week.minEmployees,
      max: week.maxEmployees,
      isUnderStaffed: current < week.minEmployees,
      isOverStaffed: current > week.maxEmployees,
      isFull: current >= week.maxEmployees,
    };
  }, [weeks, getWeekAssignmentCount]);

  // Validate entire schedule
  const validateSchedule = useCallback((): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Check each employee has exact required weeks
    schedulableEmployees.forEach(emp => {
      if (emp.assignedWeeks !== emp.requiredWeeks) {
        errors.push(`${emp.name}: ${emp.assignedWeeks}/${emp.requiredWeeks} Wochen zugewiesen`);
      }
    });

    // Check each week meets minimum staffing
    weeks.forEach(week => {
      const status = getWeekStatus(week.id);
      if (status.isUnderStaffed) {
        errors.push(`Woche ${week.weekNumber}: Unterbesetzt (${status.current}/${status.min} min)`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [schedulableEmployees, weeks, getWeekStatus]);

  return {
    schedulableEmployees,
    managers,
    getValidDropTargets,
    canDropOnWeek,
    getWeekStatus,
    validateSchedule,
    isEmployeeAvailable,
  };
}
