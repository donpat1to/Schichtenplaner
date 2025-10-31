// backend/src/models/helpers/employeeHelpers.ts
import { Employee, CreateEmployeeRequest, EmployeeAvailability } from '../Employee.js';

// Email generation function
function generateEmail(firstname: string, lastname: string): string {
  const convertUmlauts = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/ü/g, 'ue')
      .replace(/ö/g, 'oe')
      .replace(/ä/g, 'ae')
      .replace(/ß/g, 'ss');
  };

  const cleanFirstname = convertUmlauts(firstname).replace(/[^a-z0-9]/g, '');
  const cleanLastname = convertUmlauts(lastname).replace(/[^a-z0-9]/g, '');

  return `${cleanFirstname}.${cleanLastname}@sp.de`;
}

// UPDATED: Validation for new employee model with employee types
export function validateEmployeeData(employee: CreateEmployeeRequest): string[] {
  const errors: string[] = [];

  if (employee.password?.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!employee.firstname?.trim() || employee.firstname.trim().length < 2) {
    errors.push('First name is required and must be at least 2 characters long');
  }

  if (!employee.lastname?.trim() || employee.lastname.trim().length < 2) {
    errors.push('Last name is required and must be at least 2 characters long');
  }

  // Validate employee type
  const validEmployeeTypes = ['manager', 'personell', 'apprentice', 'guest'];
  if (!employee.employeeType || !validEmployeeTypes.includes(employee.employeeType)) {
    errors.push(`Employee type must be one of: ${validEmployeeTypes.join(', ')}`);
  }

  // Validate contract type based on employee type
  if (employee.employeeType !== 'guest') {
    // Internal types require contract type
    if (!employee.contractType) {
      errors.push(`Contract type is required for employee type: ${employee.employeeType}`);
    } else {
      const validContractTypes = ['small', 'large', 'flexible'];
      if (!validContractTypes.includes(employee.contractType)) {
        errors.push(`Contract type must be one of: ${validContractTypes.join(', ')}`);
      }
    }
  } else {
    // External types (guest) should not have contract type
    if (employee.contractType) {
      errors.push('Contract type is not allowed for guest employees');
    }
  }

  // Validate isTrainee - only applicable for personell type
  if (employee.isTrainee && employee.employeeType !== 'personell') {
    errors.push('isTrainee is only allowed for personell employee type');
  }

  return errors;
}

// Generate email for employee
export function generateEmployeeEmail(firstname: string, lastname: string): string {
  return generateEmail(firstname, lastname);
}

// UPDATED: Business logic helpers for new employee types
export const isManager = (employee: Employee): boolean =>
  employee.employeeType === 'manager';

export const isPersonell = (employee: Employee): boolean =>
  employee.employeeType === 'personell';

export const isApprentice = (employee: Employee): boolean =>
  employee.employeeType === 'apprentice';

export const isGuest = (employee: Employee): boolean =>
  employee.employeeType === 'guest';

export const isInternal = (employee: Employee): boolean =>
  ['manager', 'personell', 'apprentice'].includes(employee.employeeType);

export const isExternal = (employee: Employee): boolean =>
  employee.employeeType === 'guest';

// UPDATED: Trainee logic - now based on isTrainee field for personell type
export const isTrainee = (employee: Employee): boolean =>
  employee.employeeType === 'personell' && employee.isTrainee;

export const isExperienced = (employee: Employee): boolean =>
  employee.employeeType === 'personell' && !employee.isTrainee;

// Role-based helpers
export const isAdmin = (employee: Employee): boolean =>
  employee.roles?.includes('admin') || false;

export const isMaintenance = (employee: Employee): boolean =>
  employee.roles?.includes('maintenance') || false;

export const isUser = (employee: Employee): boolean =>
  employee.roles?.includes('user') || false;

// UPDATED: Work alone permission - managers and experienced personell can work alone
export const canEmployeeWorkAlone = (employee: Employee): boolean =>
  employee.canWorkAlone && (isManager(employee) || isExperienced(employee));

// Helper for full name display
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

// UPDATED: Helper to get employee type category
export const getEmployeeCategory = (employee: Employee): 'internal' | 'external' => {
  return isInternal(employee) ? 'internal' : 'external';
};

// Helper to check if employee requires contract type
export const requiresContractType = (employee: Employee): boolean => {
  return isInternal(employee);
};