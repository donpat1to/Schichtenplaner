// frontend/src/services/scheduling/utils.ts
import { SchedulingEmployee, SchedulingShift, Assignment } from './types';

export function canAssign(emp: SchedulingEmployee, shiftId: string): boolean {
  if (emp.availability.get(shiftId) === 3) return false;
  if (emp.role === 'manager') return true;
  return emp.assignedCount < emp.contract;
}

export function candidateScore(emp: SchedulingEmployee, shiftId: string): [number, number, number] {
  const availability = emp.availability.get(shiftId) || 3;
  const rolePriority = emp.role === 'erfahren' ? 0 : 1;
  return [availability, emp.assignedCount, rolePriority];
}

export function rolePriority(role: string): number {
  return role === 'erfahren' ? 0 : 1;
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

export function hasErfahrener(assignment: string[], employees: Map<string, SchedulingEmployee>): boolean {
  return assignment.some(empId => {
    const emp = employees.get(empId);
    return emp?.role === 'erfahren';
  });
}

export function respectsNewRuleIfAdded(
  emp: SchedulingEmployee, 
  shiftId: string, 
  assignments: Assignment, 
  employees: Map<string, SchedulingEmployee>
): boolean {
  const currentAssignment = assignments[shiftId] || [];
  
  if (emp.role === 'neu') {
    // Neu employee can only be added if there's already an erfahrener
    return hasErfahrener(currentAssignment, employees);
  }
  
  // Erfahren employees are always allowed
  return true;
}