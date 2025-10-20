// backend/src/models/helpers/employeeHelpers.ts
import { Employee, CreateEmployeeRequest, EmployeeAvailability } from '../Employee.js';

// Email generation function (same as in controllers)
function generateEmail(firstname: string, lastname: string): string {
  // Convert German umlauts to their expanded forms
  const convertUmlauts = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/ü/g, 'ue')
      .replace(/ö/g, 'oe')
      .replace(/ä/g, 'ae')
      .replace(/ß/g, 'ss');
  };

  // Remove any remaining special characters and convert to lowercase
  const cleanFirstname = convertUmlauts(firstname).replace(/[^a-z0-9]/g, '');
  const cleanLastname = convertUmlauts(lastname).replace(/[^a-z0-9]/g, '');
  
  return `${cleanFirstname}.${cleanLastname}@sp.de`;
}

// UPDATED: Validation for new employee model
export function validateEmployeeData(employee: CreateEmployeeRequest): string[] {
  const errors: string[] = [];

  // Email is now auto-generated, so no email validation needed
  
  if (employee.password?.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (!employee.firstname?.trim() || employee.firstname.trim().length < 2) {
    errors.push('First name is required and must be at least 2 characters long');
  }

  if (!employee.lastname?.trim() || employee.lastname.trim().length < 2) {
    errors.push('Last name is required and must be at least 2 characters long');
  }

  return errors;
}

// Generate email for employee (new helper function)
export function generateEmployeeEmail(firstname: string, lastname: string): string {
  return generateEmail(firstname, lastname);
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

// New helper for full name display
export const getFullName = (employee: { firstname: string; lastname: string }): string =>
  `${employee.firstname} ${employee.lastname}`;

// Helper for availability validation
export function validateAvailabilityData(availability: Omit<EmployeeAvailability, 'id' | 'employeeId'>): string[] {
  const errors: string[] = [];

  if (!availability.planId) {
    errors.push('Plan ID is required');
  }

  if (!availability.shiftId) {
    errors.push('Shift ID is required');
  }

  if (![1, 2, 3].includes(availability.preferenceLevel)) {
    errors.push('Preference level must be 1, 2, or 3');
  }

  return errors;
}