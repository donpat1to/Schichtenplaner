// frontend/src/hooks/useWeeklySwapValidation.ts
import { useMemo, useCallback } from 'react';
import { EmployeeWithPreferences, PlanWeek } from '../models/WeeklyPlan';
import {
  WeeklySwapConstraintContext,
  WeeklySwapStep,
  validateWeeklyDirectSwap,
  findWeeklyTwoStepSwapPath,
  isManager,
  isEligibleForScheduling
} from '../utils/weeklySwapConstraints';

export type WeeklySwapEligibility = 'direct' | 'two-step' | null;

export interface WeeklySwapTarget {
  employeeId: string;
  weekId: string;
  eligibility: WeeklySwapEligibility;
  twoStepPath?: WeeklySwapStep[];
}

export interface UseWeeklySwapValidationResult {
  getEligibleWeeklySwapTargets: (
    sourceEmpId: string,
    sourceWeekId: string
  ) => Map<string, WeeklySwapTarget>;
  validateWeeklyDirectSwap: (
    empAId: string,
    weekAId: string,
    empBId: string,
    weekBId: string
  ) => { valid: boolean; reason?: string };
  isEmployeeManager: (empId: string) => boolean;
}

export function useWeeklySwapValidation(
  weeks: PlanWeek[],
  employees: EmployeeWithPreferences[]
): UseWeeklySwapValidationResult {
  // Memoize the constraint context
  const ctx = useMemo<WeeklySwapConstraintContext>(() => ({
    employees,
    weeks
  }), [employees, weeks]);

  // Check if employee is a manager
  const isEmployeeManager = useCallback((empId: string): boolean => {
    const employee = ctx.employees.find(e => e.id === empId);
    if (!employee) return false;
    return isManager(employee);
  }, [ctx]);

  // Validate a direct swap
  const validateDirectSwapResult = useCallback((
    empAId: string,
    weekAId: string,
    empBId: string,
    weekBId: string
  ): { valid: boolean; reason?: string } => {
    return validateWeeklyDirectSwap(empAId, weekAId, empBId, weekBId, ctx);
  }, [ctx]);

  // Get all eligible swap targets for a source employee/week
  const getEligibleWeeklySwapTargets = useCallback((
    sourceEmpId: string,
    sourceWeekId: string
  ): Map<string, WeeklySwapTarget> => {
    const targets = new Map<string, WeeklySwapTarget>();

    // Iterate through all employees and their assigned weeks
    for (const employee of ctx.employees) {
      // Skip the source employee's assignment on the same week
      if (employee.id === sourceEmpId) continue;

      // Skip managers
      if (isManager(employee)) continue;

      // Skip non-eligible employees
      if (!isEligibleForScheduling(employee)) continue;

      // Check each week the employee is assigned to
      for (const weekId of employee.assignedWeeks) {
        // Skip if it's the same week and same employee
        if (employee.id === sourceEmpId && weekId === sourceWeekId) continue;

        const key = `${employee.id}-${weekId}`;

        // Check for direct swap
        const directResult = validateWeeklyDirectSwap(
          sourceEmpId,
          sourceWeekId,
          employee.id,
          weekId,
          ctx
        );

        if (directResult.valid) {
          targets.set(key, {
            employeeId: employee.id,
            weekId,
            eligibility: 'direct'
          });
          continue;
        }

        // Check for two-step swap (more expensive, do this second)
        const twoStepPath = findWeeklyTwoStepSwapPath(
          sourceEmpId,
          sourceWeekId,
          employee.id,
          weekId,
          ctx
        );

        if (twoStepPath) {
          targets.set(key, {
            employeeId: employee.id,
            weekId,
            eligibility: 'two-step',
            twoStepPath
          });
        }
      }
    }

    return targets;
  }, [ctx]);

  return {
    getEligibleWeeklySwapTargets,
    validateWeeklyDirectSwap: validateDirectSwapResult,
    isEmployeeManager
  };
}
