// backend/src/models/helpers/employeeHelpers.ts
import { Employee, CreateEmployeeRequest, EmployeeAvailability } from '../Employee.js';

// Simplified validation - use schema validation instead
export function validateEmployeeData(employee: CreateEmployeeRequest): string[] {
  const errors: string[] = [];

  if (!employee.email?.includes('@')) {
    errors.push('Valid email is required');
  }

  if (employee.password?.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (!employee.name?.trim() || employee.name.trim().length < 2) {
    errors.push('Name is required and must be at least 2 characters long');
  }

  return errors;
}

// Simplified business logic helpers
export const isManager = (employee: Employee): boolean => 
  employee.employeeType === 'manager';

export const isTrainee = (employee: Employee): boolean => 
  employee.employeeType === 'trainee';

export const isExperienced = (employee: Employee): boolean => 
  employee.employeeType === 'experienced';

export const isAdmin = (employee: Employee): boolean => 
  employee.role === 'admin';

export const canEmployeeWorkAlone = (employee: Employee): boolean => 
  employee.canWorkAlone && isExperienced(employee);

export const getEmployeeWorkHours = (employee: Employee): number =>
  isManager(employee) ? 999 : (employee.contractType === 'small' ? 1 : 2);
