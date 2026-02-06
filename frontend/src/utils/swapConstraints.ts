// frontend/src/utils/swapConstraints.ts
import { Employee, EmployeeAvailability } from '../models/Employee';
import { ShiftWithData, ShiftAssignment } from '../models/ShiftPlan';

export interface SwapConstraintContext {
  employees: Employee[];
  shifts: ShiftWithData[];
  availabilities: EmployeeAvailability[];
  assignments: ShiftAssignment[];
}

export interface SwapStep {
  employeeA: string;
  shiftA: string;
  employeeB: string;
  shiftB: string;
}

/**
 * Check if employee is available for a shift (preferenceLevel != 3)
 */
export function isEmployeeAvailable(
  empId: string,
  shiftId: string,
  ctx: SwapConstraintContext
): boolean {
  const availability = ctx.availabilities.find(
    a => a.employeeId === empId && a.shiftId === shiftId
  );
  // If no availability entry, assume available (preference 2)
  if (!availability) return true;
  return availability.preferenceLevel !== 3;
}

/**
 * Check if employee has no other shift on the same day (excluding a specific shift)
 */
export function hasNoOtherShiftOnDay(
  empId: string,
  targetShiftId: string,
  excludeShiftId: string | null,
  ctx: SwapConstraintContext
): boolean {
  const targetShift = ctx.shifts.find(s => s.id === targetShiftId);
  if (!targetShift) return false;

  const targetDay = targetShift.dayOfWeek;

  // Find all shifts on the same day
  const sameDayShifts = ctx.shifts.filter(s => s.dayOfWeek === targetDay);

  // Check if employee is assigned to any of these shifts (excluding the one being swapped from)
  for (const shift of sameDayShifts) {
    if (shift.id === excludeShiftId || shift.id === targetShiftId) continue;

    const isAssigned = ctx.assignments.some(
      a => a.shiftId === shift.id && a.employeeId === empId
    );
    if (isAssigned) return false;
  }

  return true;
}

/**
 * Check if a shift would have proper trainee supervision after a swap
 * (A trainee needs at least one experienced employee on the shift)
 */
export function wouldHaveTraineeSupervision(
  shiftId: string,
  addEmpId: string | null,
  removeEmpId: string | null,
  ctx: SwapConstraintContext
): boolean {
  const shift = ctx.shifts.find(s => s.id === shiftId);
  if (!shift) return false;

  // Get current assignments for the shift
  const currentAssignments = ctx.assignments.filter(a => a.shiftId === shiftId);
  const currentEmpIds = currentAssignments.map(a => a.employeeId);

  // Apply the swap: remove old employee, add new employee
  let newEmpIds = [...currentEmpIds];
  if (removeEmpId) {
    newEmpIds = newEmpIds.filter(id => id !== removeEmpId);
  }
  if (addEmpId && !newEmpIds.includes(addEmpId)) {
    newEmpIds.push(addEmpId);
  }

  // Get employee objects
  const shiftEmployees = newEmpIds
    .map(id => ctx.employees.find(e => e.id === id))
    .filter((e): e is Employee => e !== undefined);

  // If no trainees on the shift, supervision is not needed
  // A trainee is: employeeType === 'personell' AND isTrainee === true
  const hasTrainee = shiftEmployees.some(
    e => e.employeeType === 'personell' && e.isTrainee
  );
  if (!hasTrainee) return true;

  // If there are trainees, check for at least one experienced (non-trainee) personell employee
  // An experienced employee is: employeeType === 'personell' AND isTrainee === false
  const hasExperienced = shiftEmployees.some(
    e => e.employeeType === 'personell' && !e.isTrainee
  );
  return hasExperienced;
}

/**
 * Check if employee can work alone or would have coworkers on the shift
 */
export function canEmployeeWorkAlone(
  empId: string,
  shiftId: string,
  addEmpId: string | null,
  removeEmpId: string | null,
  ctx: SwapConstraintContext
): boolean {
  const employee = ctx.employees.find(e => e.id === empId);
  if (!employee) return false;

  // If employee can work alone, no problem
  if (employee.canWorkAlone) return true;

  // Count coworkers after the swap
  const currentAssignments = ctx.assignments.filter(a => a.shiftId === shiftId);
  let coworkerCount = currentAssignments.filter(a => a.employeeId !== empId).length;

  // Adjust for the swap
  if (removeEmpId && removeEmpId !== empId) coworkerCount--;
  if (addEmpId && addEmpId !== empId) coworkerCount++;

  // Employee needs at least one coworker if they can't work alone
  return coworkerCount >= 1;
}

/**
 * Check if adding a shift would exceed contract limits
 */
export function wouldNotExceedContractShifts(
  empId: string,
  addShiftId: string | null,
  removeShiftId: string | null,
  ctx: SwapConstraintContext
): boolean {
  const employee = ctx.employees.find(e => e.id === empId);
  if (!employee) return false;

  // Count current assignments
  let assignmentCount = ctx.assignments.filter(a => a.employeeId === empId).length;

  // Adjust for the swap
  if (addShiftId) assignmentCount++;
  if (removeShiftId) assignmentCount--;

  // Contract limits (per week)
  const contractLimits: Record<string, number> = {
    small: 3,
    large: 5,
    flexible: 7 // No real limit
  };

  const limit = contractLimits[employee.contractType || 'flexible'] || 7;
  return assignmentCount <= limit;
}

/**
 * Check if employee is eligible for scheduling (isActive && employeeType === 'personell')
 */
export function isEligibleForScheduling(employee: Employee): boolean {
  return employee.isActive && employee.employeeType === 'personell';
}

/**
 * Check if employee is a manager
 */
export function isManager(employee: Employee): boolean {
  return employee.employeeType === 'manager';
}

/**
 * Validate a direct swap between two employees on two shifts
 */
export function validateDirectSwap(
  empAId: string,
  shiftAId: string,
  empBId: string,
  shiftBId: string,
  ctx: SwapConstraintContext
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

  // A must not already be assigned to B's shift (swap would be pointless)
  const aAlreadyHasShiftB = ctx.assignments.some(
    a => a.shiftId === shiftBId && a.employeeId === empAId
  );
  if (aAlreadyHasShiftB) {
    return { valid: false, reason: `${empA.firstname} ist bereits dieser Schicht zugewiesen` };
  }

  // B must not already be assigned to A's shift (swap would be pointless)
  const bAlreadyHasShiftA = ctx.assignments.some(
    a => a.shiftId === shiftAId && a.employeeId === empBId
  );
  if (bAlreadyHasShiftA) {
    return { valid: false, reason: `${empB.firstname} ist bereits dieser Schicht zugewiesen` };
  }

  // A must be available for B's shift
  if (!isEmployeeAvailable(empAId, shiftBId, ctx)) {
    return { valid: false, reason: `${empA.firstname} ist nicht verfügbar für diese Schicht` };
  }

  // B must be available for A's shift
  if (!isEmployeeAvailable(empBId, shiftAId, ctx)) {
    return { valid: false, reason: `${empB.firstname} ist nicht verfügbar für diese Schicht` };
  }

  // A must not have another shift on B's day (excluding A's current shift)
  if (!hasNoOtherShiftOnDay(empAId, shiftBId, shiftAId, ctx)) {
    return { valid: false, reason: `${empA.firstname} hat bereits eine andere Schicht an diesem Tag` };
  }

  // B must not have another shift on A's day (excluding B's current shift)
  if (!hasNoOtherShiftOnDay(empBId, shiftAId, shiftBId, ctx)) {
    return { valid: false, reason: `${empB.firstname} hat bereits eine andere Schicht an diesem Tag` };
  }

  // Both resulting shifts must maintain trainee supervision
  // Shift A after swap: remove A, add B
  if (!wouldHaveTraineeSupervision(shiftAId, empBId, empAId, ctx)) {
    return { valid: false, reason: 'Neuling-Betreuung wäre nach dem Tausch nicht gewährleistet' };
  }

  // Shift B after swap: remove B, add A
  if (!wouldHaveTraineeSupervision(shiftBId, empAId, empBId, ctx)) {
    return { valid: false, reason: 'Neuling-Betreuung wäre nach dem Tausch nicht gewährleistet' };
  }

  // Both employees must be able to work on their new shifts (alone or with coworkers)
  if (!canEmployeeWorkAlone(empAId, shiftBId, empAId, empBId, ctx)) {
    return { valid: false, reason: `${empA.firstname} kann nicht alleine arbeiten` };
  }

  if (!canEmployeeWorkAlone(empBId, shiftAId, empBId, empAId, ctx)) {
    return { valid: false, reason: `${empB.firstname} kann nicht alleine arbeiten` };
  }

  // Contract limits
  // For a direct swap, the number of shifts stays the same, so this is mainly a sanity check
  if (!wouldNotExceedContractShifts(empAId, shiftBId, shiftAId, ctx)) {
    return { valid: false, reason: `${empA.firstname} würde Vertragslimit überschreiten` };
  }

  if (!wouldNotExceedContractShifts(empBId, shiftAId, shiftBId, ctx)) {
    return { valid: false, reason: `${empB.firstname} würde Vertragslimit überschreiten` };
  }

  return { valid: true };
}

/**
 * Find a two-step swap path using BFS
 * Returns array of two swap steps if found, null otherwise
 */
export function findTwoStepSwapPath(
  sourceEmpId: string,
  sourceShiftId: string,
  targetEmpId: string,
  targetShiftId: string,
  ctx: SwapConstraintContext
): SwapStep[] | null {
  // Get all employees that could be intermediates
  const potentialIntermediates = ctx.employees.filter(e =>
    e.id !== sourceEmpId &&
    e.id !== targetEmpId &&
    isEligibleForScheduling(e) &&
    !isManager(e)
  );

  const directTest = validateDirectSwap(sourceEmpId, sourceShiftId, targetEmpId, targetShiftId, ctx);
  if (directTest.valid === false) {
    return null
  }

  // Get all shifts where these intermediates are currently assigned
  for (const intermediate of potentialIntermediates) {
    const intermediateAssignments = ctx.assignments.filter(
      a => a.employeeId === intermediate.id
    );

    for (const assignment of intermediateAssignments) {
      const intermediateShiftId = assignment.shiftId;

      // Try: source <-> intermediate, then source <-> target
      // Step 1: Can source swap with intermediate?
      const step1 = validateDirectSwap(
        sourceEmpId,
        sourceShiftId,
        intermediate.id,
        intermediateShiftId,
        ctx
      );

      if (!step1.valid) continue;

      // Create a modified context simulating the first swap
      const modifiedAssignments = ctx.assignments.map(a => {
        if (a.shiftId === sourceShiftId && a.employeeId === sourceEmpId) {
          return { ...a, employeeId: intermediate.id };
        }
        if (a.shiftId === intermediateShiftId && a.employeeId === intermediate.id) {
          return { ...a, employeeId: sourceEmpId };
        }
        return a;
      });

      const modifiedCtx: SwapConstraintContext = {
        ...ctx,
        assignments: modifiedAssignments
      };

      // Step 2: After first swap, can source (now on intermediate's shift) swap with target?
      const step2 = validateDirectSwap(
        sourceEmpId,
        intermediateShiftId,
        targetEmpId,
        targetShiftId,
        modifiedCtx
      );

      if (step2.valid) {
        return [
          {
            employeeA: sourceEmpId,
            shiftA: sourceShiftId,
            employeeB: intermediate.id,
            shiftB: intermediateShiftId
          },
          {
            employeeA: sourceEmpId,
            shiftA: intermediateShiftId,
            employeeB: targetEmpId,
            shiftB: targetShiftId
          }
        ];
      }
    }
  }

  return null;
}

/**
 * Get all employees assigned to a specific shift
 */
export function getShiftEmployees(shiftId: string, ctx: SwapConstraintContext): Employee[] {
  const assignedIds = ctx.assignments
    .filter(a => a.shiftId === shiftId)
    .map(a => a.employeeId);

  return ctx.employees.filter(e => assignedIds.includes(e.id));
}

/**
 * Find replacement candidates for an employee being removed from a shift
 * Returns employees sorted by preference (level 1 first, then level 2)
 */
export function findReplacementCandidates(
  shiftId: string,
  excludeEmployeeId: string,
  ctx: SwapConstraintContext
): { employee: Employee; preferenceLevel: number }[] {
  const shift = ctx.shifts.find(s => s.id === shiftId);
  if (!shift) return [];

  const candidates: { employee: Employee; preferenceLevel: number }[] = [];

  for (const emp of ctx.employees) {
    // Skip the employee being replaced
    if (emp.id === excludeEmployeeId) continue;

    // Skip non-personnel and managers
    if (!isEligibleForScheduling(emp) || isManager(emp)) continue;

    // Check if available for this shift
    if (!isEmployeeAvailable(emp.id, shiftId, ctx)) continue;

    // Check if already assigned to this shift
    const alreadyAssigned = ctx.assignments.some(
      a => a.shiftId === shiftId && a.employeeId === emp.id
    );
    if (alreadyAssigned) continue;

    // Check if has another shift on the same day
    if (!hasNoOtherShiftOnDay(emp.id, shiftId, null, ctx)) continue;

    // Check contract limits
    if (!wouldNotExceedContractShifts(emp.id, shiftId, null, ctx)) continue;

    // Check trainee supervision would be maintained
    if (!wouldHaveTraineeSupervision(shiftId, emp.id, excludeEmployeeId, ctx)) continue;

    // Check if can work alone or with coworkers
    if (!canEmployeeWorkAlone(emp.id, shiftId, emp.id, excludeEmployeeId, ctx)) continue;

    // Get preference level
    const availability = ctx.availabilities.find(
      a => a.employeeId === emp.id && a.shiftId === shiftId
    );
    const preferenceLevel = availability?.preferenceLevel || 2;

    candidates.push({ employee: emp, preferenceLevel });
  }

  // Sort by preference level (1 first, then 2)
  candidates.sort((a, b) => a.preferenceLevel - b.preferenceLevel);

  return candidates;
}
