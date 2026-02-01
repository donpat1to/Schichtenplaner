// frontend/src/utils/weeklySwapConstraints.ts
import { EmployeeWithPreferences, PlanWeek } from '../models/WeeklyPlan';

export interface WeeklySwapConstraintContext {
  employees: EmployeeWithPreferences[];
  weeks: PlanWeek[];
}

export interface WeeklySwapStep {
  employeeA: string;
  weekA: string;
  employeeB: string;
  weekB: string;
}

/**
 * Check if employee is available for a week (preferenceLevel != 3)
 */
export function isEmployeeAvailableForWeek(
  empId: string,
  weekId: string,
  ctx: WeeklySwapConstraintContext
): boolean {
  const employee = ctx.employees.find(e => e.id === empId);
  if (!employee) return false;

  const preference = employee.preferences.find(p => p.weekId === weekId);
  // If no preference entry, assume available (preference 2)
  if (!preference) return true;
  return preference.preferenceLevel !== 3;
}

/**
 * Check if a week would have proper trainee supervision after a swap
 * (A trainee needs at least one experienced employee on the week)
 */
export function weekWouldHaveTraineeSupervision(
  weekId: string,
  addEmpId: string | null,
  removeEmpId: string | null,
  ctx: WeeklySwapConstraintContext
): boolean {
  // Get current assignments for the week
  const currentAssignedIds = ctx.employees
    .filter(e => e.assignedWeeks.includes(weekId))
    .map(e => e.id);

  // Apply the swap: remove old employee, add new employee
  let newEmpIds = [...currentAssignedIds];
  if (removeEmpId) {
    newEmpIds = newEmpIds.filter(id => id !== removeEmpId);
  }
  if (addEmpId && !newEmpIds.includes(addEmpId)) {
    newEmpIds.push(addEmpId);
  }

  // Get employee objects
  const weekEmployees = newEmpIds
    .map(id => ctx.employees.find(e => e.id === id))
    .filter((e): e is EmployeeWithPreferences => e !== undefined);

  // If no trainees on the week, supervision is not needed
  const hasTrainee = weekEmployees.some(e => e.isTrainee);
  if (!hasTrainee) return true;

  // If there are trainees, check for at least one experienced (non-trainee) employee
  const hasExperienced = weekEmployees.some(e => !e.isTrainee);
  return hasExperienced;
}

/**
 * Check if week respects min/max employee limits after swap
 */
export function weekRespectsEmployeeLimits(
  weekId: string,
  addEmpId: string | null,
  removeEmpId: string | null,
  ctx: WeeklySwapConstraintContext
): boolean {
  const week = ctx.weeks.find(w => w.id === weekId);
  if (!week) return false;

  // Get current assignment count for the week
  let count = ctx.employees.filter(e => e.assignedWeeks.includes(weekId)).length;

  // Adjust for the swap
  if (addEmpId) count++;
  if (removeEmpId) count--;

  return count >= week.minEmployees && count <= week.maxEmployees;
}

/**
 * Check if employee is a manager
 */
export function isManager(employee: EmployeeWithPreferences): boolean {
  return employee.employeeType === 'manager';
}

/**
 * Check if employee is eligible for scheduling (employeeType === 'personell')
 */
export function isEligibleForScheduling(employee: EmployeeWithPreferences): boolean {
  return employee.employeeType === 'personell';
}

/**
 * Validate a direct swap between two employees on two weeks
 */
export function validateWeeklyDirectSwap(
  empAId: string,
  weekAId: string,
  empBId: string,
  weekBId: string,
  ctx: WeeklySwapConstraintContext
): { valid: boolean; reason?: string } {
  const empA = ctx.employees.find(e => e.id === empAId);
  const empB = ctx.employees.find(e => e.id === empBId);

  if (!empA || !empB) {
    return { valid: false, reason: 'Employee not found' };
  }

  // Neither can be a manager
  if (isManager(empA)) {
    return { valid: false, reason: 'Manager können nicht getauscht werden' };
  }
  if (isManager(empB)) {
    return { valid: false, reason: 'Manager können nicht getauscht werden' };
  }

  // A must be available for B's week
  if (!isEmployeeAvailableForWeek(empAId, weekBId, ctx)) {
    return { valid: false, reason: `${empA.firstname} ist nicht verfügbar für diese Woche` };
  }

  // B must be available for A's week
  if (!isEmployeeAvailableForWeek(empBId, weekAId, ctx)) {
    return { valid: false, reason: `${empB.firstname} ist nicht verfügbar für diese Woche` };
  }

  // Both resulting weeks must maintain trainee supervision
  // Week A after swap: remove A, add B
  if (!weekWouldHaveTraineeSupervision(weekAId, empBId, empAId, ctx)) {
    return { valid: false, reason: 'Azubi-Betreuung wäre nach dem Tausch nicht gewährleistet' };
  }

  // Week B after swap: remove B, add A
  if (!weekWouldHaveTraineeSupervision(weekBId, empAId, empBId, ctx)) {
    return { valid: false, reason: 'Azubi-Betreuung wäre nach dem Tausch nicht gewährleistet' };
  }

  // For a direct swap, employee counts stay the same, so limits are maintained
  // But we still check for safety
  if (!weekRespectsEmployeeLimits(weekAId, empBId, empAId, ctx)) {
    return { valid: false, reason: 'Mitarbeiterlimit für Woche A würde verletzt' };
  }

  if (!weekRespectsEmployeeLimits(weekBId, empAId, empBId, ctx)) {
    return { valid: false, reason: 'Mitarbeiterlimit für Woche B würde verletzt' };
  }

  return { valid: true };
}

/**
 * Find a two-step swap path using BFS
 * Returns array of two swap steps if found, null otherwise
 */
export function findWeeklyTwoStepSwapPath(
  sourceEmpId: string,
  sourceWeekId: string,
  targetEmpId: string,
  targetWeekId: string,
  ctx: WeeklySwapConstraintContext
): WeeklySwapStep[] | null {
  // Get all employees that could be intermediates
  const potentialIntermediates = ctx.employees.filter(e =>
    e.id !== sourceEmpId &&
    e.id !== targetEmpId &&
    isEligibleForScheduling(e) &&
    !isManager(e)
  );

  // Get all weeks where these intermediates are currently assigned
  for (const intermediate of potentialIntermediates) {
    for (const intermediateWeekId of intermediate.assignedWeeks) {
      // Try: source <-> intermediate, then source <-> target
      // Step 1: Can source swap with intermediate?
      const step1 = validateWeeklyDirectSwap(
        sourceEmpId,
        sourceWeekId,
        intermediate.id,
        intermediateWeekId,
        ctx
      );

      if (!step1.valid) continue;

      // Create a modified context simulating the first swap
      const modifiedEmployees = ctx.employees.map(e => {
        if (e.id === sourceEmpId) {
          return {
            ...e,
            assignedWeeks: e.assignedWeeks
              .filter(w => w !== sourceWeekId)
              .concat(intermediateWeekId)
          };
        }
        if (e.id === intermediate.id) {
          return {
            ...e,
            assignedWeeks: e.assignedWeeks
              .filter(w => w !== intermediateWeekId)
              .concat(sourceWeekId)
          };
        }
        return e;
      });

      const modifiedCtx: WeeklySwapConstraintContext = {
        ...ctx,
        employees: modifiedEmployees
      };

      // Step 2: After first swap, can source (now on intermediate's week) swap with target?
      const step2 = validateWeeklyDirectSwap(
        sourceEmpId,
        intermediateWeekId,
        targetEmpId,
        targetWeekId,
        modifiedCtx
      );

      if (step2.valid) {
        return [
          {
            employeeA: sourceEmpId,
            weekA: sourceWeekId,
            employeeB: intermediate.id,
            weekB: intermediateWeekId
          },
          {
            employeeA: sourceEmpId,
            weekA: intermediateWeekId,
            employeeB: targetEmpId,
            weekB: targetWeekId
          }
        ];
      }
    }
  }

  return null;
}

/**
 * Get all employees assigned to a specific week
 */
export function getWeekEmployees(weekId: string, ctx: WeeklySwapConstraintContext): EmployeeWithPreferences[] {
  return ctx.employees.filter(e => e.assignedWeeks.includes(weekId));
}
