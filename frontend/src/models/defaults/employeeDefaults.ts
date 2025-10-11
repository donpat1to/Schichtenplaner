// backend/src/models/defaults/employeeDefaults.ts
import { EmployeeAvailability, ManagerAvailability } from '../Employee.js';

// Default employee data for quick creation
export const EMPLOYEE_DEFAULTS = {
  role: 'user' as const,
  employeeType: 'experienced' as const,
  contractType: 'small' as const,
  canWorkAlone: false,
  isActive: true
};

// Manager-specific defaults
export const MANAGER_DEFAULTS = {
  role: 'admin' as const,
  employeeType: 'manager' as const,
  contractType: 'large' as const, // Not really used but required by DB
  canWorkAlone: true,
  isActive: true
};

export const EMPLOYEE_TYPE_CONFIG = {
  manager: { 
    value: 'manager' as const,
    label: 'Chef/Administrator', 
    color: '#e74c3c',
    independent: true,
    description: 'Vollzugriff auf alle Funktionen und Mitarbeiterverwaltung'
  },
  experienced: { 
    value: 'experienced' as const,
    label: 'Erfahren', 
    color: '#3498db',
    independent: true,
    description: 'Langjährige Erfahrung, kann komplexe Aufgaben übernehmen'
  },
  trainee: { 
    value: 'trainee' as const,
    label: 'Neuling', 
    color: '#27ae60', 
    independent: false,
    description: 'Benötigt Einarbeitung und Unterstützung'
  }
} as const;

export const ROLE_CONFIG = [
  { value: 'user', label: 'Mitarbeiter', description: 'Kann eigene Schichten einsehen', color: '#27ae60' },
  { value: 'instandhalter', label: 'Instandhalter', description: 'Kann Schichtpläne erstellen und Mitarbeiter verwalten', color: '#3498db' },
  { value: 'admin', label: 'Administrator', description: 'Voller Zugriff auf alle Funktionen', color: '#e74c3c' }
] as const;

// Contract type descriptions
export const CONTRACT_TYPE_DESCRIPTIONS = {
  small: '1 Schicht pro Woche',
  large: '2 Schichten pro Woche',
  manager: 'Kein Vertragslimit - Immer MO und DI verfügbar'
} as const;

// Availability preference descriptions
export const AVAILABILITY_PREFERENCES = {
  1: { label: 'Bevorzugt', color: '#10b981', description: 'Möchte diese Schicht arbeiten' },
  2: { label: 'Möglich', color: '#f59e0b', description: 'Kann diese Schicht arbeiten' },
  3: { label: 'Nicht möglich', color: '#ef4444', description: 'Kann diese Schicht nicht arbeiten' }
} as const;

// Default availability for new employees (all shifts unavailable as level 3)
export function createDefaultAvailabilities(employeeId: string, planId: string, timeSlotIds: string[]): Omit<EmployeeAvailability, 'id'>[] {
  const availabilities: Omit<EmployeeAvailability, 'id'>[] = [];
  
  // Monday to Friday (1-5)
  for (let day = 1; day <= 5; day++) {
    for (const timeSlotId of timeSlotIds) {
      availabilities.push({
        employeeId,
        planId,
        dayOfWeek: day,
        timeSlotId,
        preferenceLevel: 3 // Default to "unavailable" - employees must explicitly set availability
      });
    }
  }
  
  return availabilities;
}

// Create complete manager availability for all days (default: only Mon-Tue available)
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