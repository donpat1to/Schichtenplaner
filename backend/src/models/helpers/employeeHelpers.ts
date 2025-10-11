// backend/src/models/helpers/employeeHelpers.ts
import { Employee, CreateEmployeeRequest, EmployeeAvailability, ManagerAvailability } from '../Employee.js';

// Validation helpers
export function validateEmployee(employee: CreateEmployeeRequest): string[] {
  const errors: string[] = [];

  if (!employee.email || !employee.email.includes('@')) {
    errors.push('Valid email is required');
  }

  if (!employee.password || employee.password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (!employee.name || employee.name.trim().length < 2) {
    errors.push('Name is required and must be at least 2 characters long');
  }

  if (!employee.contractType) {
    errors.push('Contract type is required');
  }

  return errors;
}

export function validateAvailability(availability: Omit<EmployeeAvailability, 'id' | 'employeeId'>): string[] {
  const errors: string[] = [];

  if (availability.dayOfWeek < 1 || availability.dayOfWeek > 7) {
    errors.push('Day of week must be between 1 and 7');
  }

  if (![1, 2, 3].includes(availability.preferenceLevel)) {
    errors.push('Preference level must be 1, 2, or 3');
  }

  if (!availability.timeSlotId) {
    errors.push('Time slot ID is required');
  }

  if (!availability.planId) {
    errors.push('Plan ID is required');
  }

  return errors;
}

// Employee type guards
export function isManager(employee: Employee): boolean {
  return employee.employeeType === 'manager';
}

export function isTrainee(employee: Employee): boolean {
  return employee.employeeType === 'trainee';
}

export function isExperienced(employee: Employee): boolean {
  return employee.employeeType === 'experienced';
}

export function isAdmin(employee: Employee): boolean {
  return employee.role === 'admin';
}

// Business logic helpers
export function canEmployeeWorkAlone(employee: Employee): boolean {
  return employee.canWorkAlone && employee.employeeType === 'experienced';
}

export function getEmployeeWorkHours(employee: Employee): number {
  // Manager: no contract limit, others: small=1, large=2 shifts per week
  return isManager(employee) ? 999 : (employee.contractType === 'small' ? 1 : 2);
}

export function requiresAvailabilityPreference(employee: Employee): boolean {
  // Only non-managers use the preference system
  return !isManager(employee);
}

export function canSetOwnAvailability(employee: Employee): boolean {
  // Manager can set their own specific shift assignments
  return isManager(employee);
}

// Manager availability helpers
export function isManagerAvailable(
  managerAssignments: ManagerAvailability[], 
  dayOfWeek: number, 
  timeSlotId: string
): boolean {
  const assignment = managerAssignments.find(assignment => 
    assignment.dayOfWeek === dayOfWeek && 
    assignment.timeSlotId === timeSlotId
  );
  
  return assignment ? assignment.isAvailable : false;
}

export function getManagerAvailableShifts(managerAssignments: ManagerAvailability[]): ManagerAvailability[] {
  return managerAssignments.filter(assignment => assignment.isAvailable);
}

export function updateManagerAvailability(
  assignments: ManagerAvailability[],
  dayOfWeek: number,
  timeSlotId: string,
  isAvailable: boolean
): ManagerAvailability[] {
  return assignments.map(assignment => 
    assignment.dayOfWeek === dayOfWeek && assignment.timeSlotId === timeSlotId
      ? { ...assignment, isAvailable }
      : assignment
  );
}

export function validateManagerMinimumAvailability(managerAssignments: ManagerAvailability[]): boolean {
  const requiredShifts = [
    { dayOfWeek: 1, timeSlotId: 'morning' },
    { dayOfWeek: 1, timeSlotId: 'afternoon' },
    { dayOfWeek: 2, timeSlotId: 'morning' },
    { dayOfWeek: 2, timeSlotId: 'afternoon' }
  ];
  
  return requiredShifts.every(required => 
    isManagerAvailable(managerAssignments, required.dayOfWeek, required.timeSlotId)
  );
}