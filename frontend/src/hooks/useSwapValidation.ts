// frontend/src/hooks/useSwapValidation.ts
import { useMemo, useCallback } from 'react';
import { Employee, EmployeeAvailability } from '../models/Employee';
import { ShiftWithData, ShiftAssignment } from '../models/ShiftPlan';
import {
  SwapConstraintContext,
  SwapStep,
  validateDirectSwap,
  findTwoStepSwapPath,
  isManager,
  isEligibleForScheduling
} from '../utils/swapConstraints';

export type SwapEligibility = 'direct' | 'two-step' | null;

export interface SwapTarget {
  employeeId: string;
  shiftId: string;
  eligibility: SwapEligibility;
  twoStepPath?: SwapStep[];
}

export interface UseSwapValidationResult {
  canEmployeeWorkShift: (empId: string, shiftId: string) => boolean;
  getEligibleSwapTargets: (
    sourceEmpId: string,
    sourceShiftId: string
  ) => Map<string, SwapTarget>;
  validateDirectSwapResult: (
    empAId: string,
    shiftAId: string,
    empBId: string,
    shiftBId: string
  ) => { valid: boolean; reason?: string };
  findTwoStepPath: (
    sourceEmpId: string,
    sourceShiftId: string,
    targetEmpId: string,
    targetShiftId: string
  ) => SwapStep[] | null;
  isEmployeeManager: (empId: string) => boolean;
}

export function useSwapValidation(
  shifts: ShiftWithData[],
  employees: Employee[],
  availabilities: EmployeeAvailability[],
  assignments: ShiftAssignment[]
): UseSwapValidationResult {
  // Memoize the constraint context
  const ctx = useMemo<SwapConstraintContext>(() => ({
    employees,
    shifts,
    availabilities,
    assignments
  }), [employees, shifts, availabilities, assignments]);

  // Check if employee can work a specific shift
  const canEmployeeWorkShift = useCallback((empId: string, shiftId: string): boolean => {
    const availability = ctx.availabilities.find(
      a => a.employeeId === empId && a.shiftId === shiftId
    );
    if (!availability) return true;
    return availability.preferenceLevel !== 3;
  }, [ctx]);

  // Check if employee is a manager
  const isEmployeeManager = useCallback((empId: string): boolean => {
    const employee = ctx.employees.find(e => e.id === empId);
    if (!employee) return false;
    return isManager(employee);
  }, [ctx]);

  // Validate a direct swap
  const validateDirectSwapResult = useCallback((
    empAId: string,
    shiftAId: string,
    empBId: string,
    shiftBId: string
  ): { valid: boolean; reason?: string } => {
    return validateDirectSwap(empAId, shiftAId, empBId, shiftBId, ctx);
  }, [ctx]);

  // Find two-step swap path
  const findTwoStepPath = useCallback((
    sourceEmpId: string,
    sourceShiftId: string,
    targetEmpId: string,
    targetShiftId: string
  ): SwapStep[] | null => {
    return findTwoStepSwapPath(sourceEmpId, sourceShiftId, targetEmpId, targetShiftId, ctx);
  }, [ctx]);

  // Get all eligible swap targets for a source employee/shift
  const getEligibleSwapTargets = useCallback((
    sourceEmpId: string,
    sourceShiftId: string
  ): Map<string, SwapTarget> => {
    const targets = new Map<string, SwapTarget>();

    // Get all assigned employees across all shifts
    const allAssignments = ctx.assignments;

    for (const assignment of allAssignments) {
      // Skip the source assignment
      if (assignment.employeeId === sourceEmpId && assignment.shiftId === sourceShiftId) {
        continue;
      }

      const targetEmpId = assignment.employeeId;
      const targetShiftId = assignment.shiftId;

      // Get the employee
      const targetEmployee = ctx.employees.find(e => e.id === targetEmpId);
      if (!targetEmployee) continue;

      // Skip managers
      if (isManager(targetEmployee)) {
        continue;
      }

      // Skip non-eligible employees
      if (!isEligibleForScheduling(targetEmployee)) {
        continue;
      }

      const key = `${targetEmpId}-${targetShiftId}`;

      // Check for direct swap
      const directResult = validateDirectSwap(
        sourceEmpId,
        sourceShiftId,
        targetEmpId,
        targetShiftId,
        ctx
      );

      if (directResult.valid) {
        targets.set(key, {
          employeeId: targetEmpId,
          shiftId: targetShiftId,
          eligibility: 'direct'
        });
        continue;
      }

      // Check for two-step swap (more expensive, do this second)
      const twoStepPath = findTwoStepSwapPath(
        sourceEmpId,
        sourceShiftId,
        targetEmpId,
        targetShiftId,
        ctx
      );

      if (twoStepPath) {
        targets.set(key, {
          employeeId: targetEmpId,
          shiftId: targetShiftId,
          eligibility: 'two-step',
          twoStepPath
        });
      }
    }

    return targets;
  }, [ctx]);

  return {
    canEmployeeWorkShift,
    getEligibleSwapTargets,
    validateDirectSwapResult,
    findTwoStepPath,
    isEmployeeManager
  };
}
