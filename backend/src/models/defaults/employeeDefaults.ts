// backend/src/models/defaults/employeeDefaults.ts
import { EmployeeAvailability, ManagerAvailability } from '../Employee.js';

// Default employee data for quick creation
export const EMPLOYEE_DEFAULTS = {
  role: 'user' as const,
  employeeType: 'personell' as const,
  contractType: 'small' as const,
  canWorkAlone: false,
  isActive: true,
  isTrainee: false
};

// Manager-specific defaults
export const MANAGER_DEFAULTS = {
  role: 'admin' as const,
  employeeType: 'manager' as const,
  contractType: 'flexible' as const,
  canWorkAlone: true,
  isActive: true,
  isTrainee: false
};

// Apprentice defaults
export const APPRENTICE_DEFAULTS = {
  role: 'user' as const,
  employeeType: 'apprentice' as const,
  contractType: 'flexible' as const,
  canWorkAlone: false,
  isActive: true,
  isTrainee: false
};

// Guest defaults
export const GUEST_DEFAULTS = {
  role: 'user' as const,
  employeeType: 'guest' as const,
  contractType: undefined,
  canWorkAlone: false,
  isActive: true,
  isTrainee: false
};

export const EMPLOYEE_TYPE_CONFIG = {
  manager: { 
    value: 'manager' as const,
    label: 'Chef/Administrator', 
    color: '#e74c3c',
    category: 'internal' as const,
    hasContractType: true,
    independent: true,
    description: 'Vollzugriff auf alle Funktionen und Mitarbeiterverwaltung'
  },
  personell: { 
    value: 'personell' as const,
    label: 'Personal', 
    color: '#3498db',
    category: 'internal' as const,
    hasContractType: true,
    independent: true,
    description: 'Reguläre Mitarbeiter mit Vertrag'
  },
  apprentice: { 
    value: 'apprentice' as const,
    label: 'Auszubildender', 
    color: '#9b59b6',
    category: 'internal' as const,
    hasContractType: true,
    independent: false,
    description: 'Auszubildende mit flexiblem Vertrag'
  },
  guest: { 
    value: 'guest' as const,
    label: 'Gast', 
    color: '#95a5a6',
    category: 'external' as const,
    hasContractType: false,
    independent: false,
    description: 'Externe Mitarbeiter ohne Vertrag'
  }
} as const;

export const ROLE_CONFIG = [
  { value: 'user' as const, label: 'Mitarbeiter', description: 'Kann eigene Schichten einsehen', color: '#27ae60' },
  { value: 'maintenance' as const, label: 'Instandhalter', description: 'Kann Schichtpläne erstellen und Mitarbeiter verwalten', color: '#3498db' },
  { value: 'admin' as const, label: 'Administrator', description: 'Voller Zugriff auf alle Funktionen', color: '#e74c3c' }
] as const;

// Contract type descriptions
export const CONTRACT_TYPE_DESCRIPTIONS = {
  small: '1 Schicht pro Woche',
  large: '2 Schichten pro Woche',
  flexible: 'Flexible Arbeitszeiten'
} as const;


// Availability preference descriptions
export const AVAILABILITY_PREFERENCES = {
  1: { label: 'Bevorzugt', color: '#10b981', description: 'Möchte diese Schicht arbeiten' },
  2: { label: 'Möglich', color: '#f59e0b', description: 'Kann diese Schicht arbeiten' },
  3: { label: 'Nicht möglich', color: '#ef4444', description: 'Kann diese Schicht nicht arbeiten' }
} as const;

// Default availability for new employees (all shifts unavailable as level 3)
// UPDATED: Now uses shiftId instead of timeSlotId + dayOfWeek
export function createDefaultAvailabilities(employeeId: string, planId: string, shiftIds: string[]): Omit<EmployeeAvailability, 'id'>[] {
  const availabilities: Omit<EmployeeAvailability, 'id'>[] = [];
  
  // Create one availability entry per shift
  for (const shiftId of shiftIds) {
    availabilities.push({
      employeeId,
      planId,
      shiftId,
      preferenceLevel: 3 // Default to "unavailable" - employees must explicitly set availability
    });
  }
  
  return availabilities;
}

// Create complete manager availability for all days (default: only Mon-Tue available)
// NOTE: This function might need revision based on new schema requirements
export function createManagerDefaultSchedule(managerId: string, planId: string, timeSlotIds: string[]): Omit<ManagerAvailability, 'id'>[] {
  const assignments: Omit<ManagerAvailability, 'id'>[] = [];
  
  // Monday to Sunday (1-7)
  for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++) {
    for (const timeSlotId of timeSlotIds) {
      // Default: available only on Monday (1) and Tuesday (2)
      const isAvailable = dayOfWeek === 1 || dayOfWeek === 2;
      
      assignments.push({
        employeeId: managerId,
        planId,
        dayOfWeek,
        timeSlotId,
        isAvailable,
        assignedBy: managerId
      });
    }
  }
  
  return assignments;
}

export function getDefaultsByEmployeeType(employeeType: string) {
  switch (employeeType) {
    case 'manager':
      return MANAGER_DEFAULTS;
    case 'apprentice':
      return APPRENTICE_DEFAULTS;
    case 'guest':
      return GUEST_DEFAULTS;
    default:
      return EMPLOYEE_DEFAULTS;
  }
}