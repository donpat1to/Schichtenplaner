// frontend/src/services/scheduling/utils.ts
import { SchedulingEmployee, SchedulingShift, Assignment } from './types';

// Scoring system
export function getAvailabilityScore(preferenceLevel: number): number {
  switch (preferenceLevel) {
    case 1: return 2;  // preferred
    case 2: return 1;  // available
    case 3: return -9999; // unavailable
    default: return 0;
  }
}

export function canAssign(emp: SchedulingEmployee, shiftId: string): boolean {
  if (emp.availability.get(shiftId) === 3) return false;
  if (emp.role === 'manager') return false; // Phase A: ignore manager
  return emp.assignedCount < emp.contract;
}

export function candidateScore(emp: SchedulingEmployee, shiftId: string): number {
  const availability = emp.availability.get(shiftId) || 3;
  const baseScore = -getAvailabilityScore(availability); // prefer higher availability scores
  const loadPenalty = emp.assignedCount * 0.5; // fairness: penalize already assigned
  const rolePenalty = emp.role === 'erfahren' ? 0 : 0.5; // prefer experienced
  
  return baseScore + loadPenalty + rolePenalty;
}

export function onlyNeuAssigned(assignment: string[], employees: Map<string, SchedulingEmployee>): boolean {
  if (assignment.length === 0) return false;
  return assignment.every(empId => {
    const emp = employees.get(empId);
    return emp?.role === 'neu';
  });
}

export function assignEmployee(emp: SchedulingEmployee, shiftId: string, assignments: Assignment): void {
  if (!assignments[shiftId]) {
    assignments[shiftId] = [];
  }
  assignments[shiftId].push(emp.id);
  emp.assignedCount++;
}

export function unassignEmployee(emp: SchedulingEmployee, shiftId: string, assignments: Assignment): void {
  if (assignments[shiftId]) {
    assignments[shiftId] = assignments[shiftId].filter(id => id !== emp.id);
    emp.assignedCount--;
  }
}

export function hasErfahrener(assignment: string[], employees: Map<string, SchedulingEmployee>): boolean {
  return assignment.some(empId => {
    const emp = employees.get(empId);
    return emp?.role === 'erfahren';
  });
}

export function wouldBeAloneIfAdded(
  candidate: SchedulingEmployee,
  shiftId: string,
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>
): boolean {
  const currentAssignment = assignments[shiftId] || [];
  
  // If adding to empty shift and candidate is neu, they would be alone
  if (currentAssignment.length === 0 && candidate.role === 'neu') {
    return true;
  }
  
  // If all current assignments are neu and candidate is neu, they would be alone together
  if (onlyNeuAssigned(currentAssignment, employees) && candidate.role === 'neu') {
    return true;
  }
  
  return false;
}

export function findViolations(
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  shifts: SchedulingShift[],
  managerShifts: string[] = []
): { type: string; shiftId?: string; employeeId?: string; severity: string }[] {
  const violations: any[] = [];
  const employeeMap = employees;

  // Check each shift
  shifts.forEach(shift => {
    const assignment = assignments[shift.id] || [];
    
    // Empty shift violation
    if (assignment.length === 0) {
      violations.push({
        type: 'EmptyShift',
        shiftId: shift.id,
        severity: 'error'
      });
    }
    
    // Neu alone violation
    if (onlyNeuAssigned(assignment, employeeMap)) {
      violations.push({
        type: 'NeuAlone',
        shiftId: shift.id,
        severity: 'error'
      });
    }
    
    // Manager without experienced (for manager shifts)
    if (managerShifts.includes(shift.id)) {
      const hasManager = assignment.some(empId => {
        const emp = employeeMap.get(empId);
        return emp?.role === 'manager';
      });
      
      if (hasManager && !hasErfahrener(assignment, employeeMap)) {
        violations.push({
          type: 'ManagerWithoutExperienced',
          shiftId: shift.id,
          severity: 'warning' // Could be warning instead of error
        });
      }
    }
  });

  // Check employee contracts
  employeeMap.forEach((emp, empId) => {
    if (emp.role !== 'manager' && emp.assignedCount > emp.contract) {
      violations.push({
        type: 'ContractExceeded',
        employeeId: empId,
        severity: 'error'
      });
    }
  });

  return violations;
}

export function canRemove(
  empId: string, 
  shiftId: string, 
  lockedShifts: Set<string>, 
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>
): boolean {
  // Wenn Schicht gesperrt ist, kann niemand entfernt werden
  if (lockedShifts.has(shiftId)) {
    return false;
  }
  
  const emp = employees.get(empId);
  if (!emp) return false;
  
  // Überprüfe ob Entfernen neue Verletzungen verursachen würde
  const currentAssignment = assignments[shiftId] || [];
  const wouldBeEmpty = currentAssignment.length <= 1;
  const wouldBeNeuAlone = wouldBeEmpty && emp.role === 'erfahren';
  const wouldBeExperiencedAlone = wouldBeExperiencedAloneIfRemoved(empId, shiftId, assignments, employees);
  
  return !wouldBeEmpty && !wouldBeNeuAlone && !wouldBeExperiencedAlone;
}

export function countExperiencedCanWorkAlone(
  assignment: string[], 
  employees: Map<string, SchedulingEmployee>
): string[] {
  return assignment.filter(empId => {
    const emp = employees.get(empId);
    return emp?.role === 'erfahren' && emp.originalData?.canWorkAlone;
  });
}

export function isManagerShiftWithOnlyNew(
  assignment: string[], 
  employees: Map<string, SchedulingEmployee>,
  managerId?: string
): boolean {
  if (!managerId || !assignment.includes(managerId)) return false;
  
  const nonManagerEmployees = assignment.filter(id => id !== managerId);
  return onlyNeuAssigned(nonManagerEmployees, employees);
}

export function isManagerAlone(
  assignment: string[], 
  managerId?: string
): boolean {
  return assignment.length === 1 && assignment[0] === managerId;
}

export function hasExperiencedAloneNotAllowed(
  assignment: string[], 
  employees: Map<string, SchedulingEmployee>
): { hasViolation: boolean; employeeId?: string } {
  if (assignment.length !== 1) return { hasViolation: false };
  
  const empId = assignment[0];
  const emp = employees.get(empId);
  
  if (emp && emp.role === 'erfahren' && !emp.originalData?.canWorkAlone) {
    return { hasViolation: true, employeeId: empId };
  }
  
  return { hasViolation: false };
}

export function isExperiencedCanWorkAlone(emp: SchedulingEmployee): boolean {
  return emp.role === 'erfahren' && emp.originalData?.canWorkAlone === true;
}

export function wouldBeExperiencedAloneIfRemoved(
  empId: string,
  shiftId: string,
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>
): boolean {
  const assignment = assignments[shiftId] || [];
  if (assignment.length <= 1) return false;
  
  const remainingAssignment = assignment.filter(id => id !== empId);
  if (remainingAssignment.length !== 1) return false;
  
  const remainingEmp = employees.get(remainingAssignment[0]);
  return remainingEmp?.role === 'erfahren' && !remainingEmp.originalData?.canWorkAlone;
}