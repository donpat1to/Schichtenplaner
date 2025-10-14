// frontend/src/services/scheduling/repairFunctions.ts
import { SchedulingEmployee, SchedulingShift, Assignment } from './types';
import { canAssign, assignEmployee, hasErfahrener } from './utils';

export function attemptRepairMoveErfahrener(
  targetShiftId: string,
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  allShifts: SchedulingShift[]
): boolean {
  
  for (const shift of allShifts) {
    const currentAssignment = assignments[shift.id] || [];
    
    // Skip if this shift doesn't have multiple employees
    if (currentAssignment.length <= 1) continue;
    
    for (const empId of currentAssignment) {
      const emp = employees.get(empId);
      if (!emp || emp.role !== 'erfahren') continue;
      
      // Check if employee can be moved to target shift
      if (canAssign(emp, targetShiftId)) {
        // Remove from current shift
        assignments[shift.id] = currentAssignment.filter(id => id !== empId);
        emp.assignedCount--;
        
        // Add to target shift
        assignEmployee(emp, targetShiftId, assignments);
        console.log(`🔧 Repaired: Moved erfahrener ${emp.id} to shift ${targetShiftId}`);
        return true;
      }
    }
  }
  
  return false;
}

export function attemptSwapBringErfahrener(
  targetShiftId: string,
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  allShifts: SchedulingShift[]
): boolean {
  const targetAssignment = assignments[targetShiftId] || [];
  
  for (const shift of allShifts) {
    if (shift.id === targetShiftId) continue;
    
    const currentAssignment = assignments[shift.id] || [];
    
    for (const erfahrenerId of currentAssignment) {
      const erfahrener = employees.get(erfahrenerId);
      if (!erfahrener || erfahrener.role !== 'erfahren') continue;
      
      // Check if erfahrener can go to target shift
      if (!canAssign(erfahrener, targetShiftId)) continue;
      
      // Find someone from target shift who can swap
      for (const targetEmpId of targetAssignment) {
        const targetEmp = employees.get(targetEmpId);
        if (!targetEmp) continue;
        
        // Check if target employee can go to the other shift
        if (canAssign(targetEmp, shift.id)) {
          // Perform swap
          assignments[shift.id] = currentAssignment.filter(id => id !== erfahrenerId).concat(targetEmpId);
          assignments[targetShiftId] = targetAssignment.filter(id => id !== targetEmpId).concat(erfahrenerId);
          
          erfahrener.assignedCount++;
          targetEmp.assignedCount--;
          
          console.log(`🔄 Swapped: ${erfahrener.id} <-> ${targetEmp.id}`);
          return true;
        }
      }
    }
  }
  
  return false;
}

export function attemptComplexRepairForManagerShift(
  targetShiftId: string,
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  allShifts: SchedulingShift[]
): boolean {
  // Try multiple repair strategies
  return attemptSwapBringErfahrener(targetShiftId, assignments, employees, allShifts) ||
         attemptRepairMoveErfahrener(targetShiftId, assignments, employees, allShifts);
}