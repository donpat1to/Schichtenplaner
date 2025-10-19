// backend/src/models/scheduling.ts
import { Employee } from './Employee.js';
import { ShiftPlan } from './ShiftPlan.js';

// Add the missing type definitions
export interface Availability {
  id: string;
  employeeId: string;
  planId: string;
  dayOfWeek: number; // 1=Monday, 7=Sunday
  timeSlotId: string;
  preferenceLevel: 1 | 2 | 3; // 1:preferred, 2:available, 3:unavailable
  notes?: string;
}

export interface Constraint {
  type: string;
  severity: 'hard' | 'soft';
  parameters: {
    maxShiftsPerDay?: number;
    minEmployeesPerShift?: number;
    maxEmployeesPerShift?: number;
    enforceTraineeSupervision?: boolean;
    contractHoursLimit?: boolean;
    maxHoursPerWeek?: number;
    [key: string]: any;
  };
  weight?: number; // For soft constraints
}

export interface ScheduleRequest {
  shiftPlan: ShiftPlan;
  employees: Employee[];
  availabilities: Availability[];
  constraints: Constraint[];
}

export interface ScheduleResult {
  assignments: Assignment[];
  violations: Violation[];
  success: boolean;
  resolutionReport: string[];
  processingTime: number;
}

export interface Assignment {
  shiftId: string;
  employeeId: string;
  assignedAt: Date;
  score: number; // Qualität der Zuweisung (1-100)
}

export interface Violation {
  type: string;
  severity: 'critical' | 'warning';
  message: string;
  involvedEmployees?: string[];
  shiftId?: string;
  details?: any;
}

export interface SolverOptions {
  maxTimeInSeconds: number;
  numSearchWorkers: number;
  logSearchProgress: boolean;
}

export interface Solution {
  assignments: Assignment[];
  violations: Violation[];
  success: boolean;
  metadata: {
    solveTime: number;
    constraintsAdded: number;
    variablesCreated: number;
    optimal: boolean;
  };
  variables?: { [key: string]: number };
}

// Additional helper types for the scheduling system
export interface SchedulingConfig {
  maxRepairAttempts: number;
  targetEmployeesPerShift: number;
  enforceNoTraineeAlone: boolean;
  enforceExperiencedWithChef: boolean;
  preferEmployeePreferences: boolean;
}

export interface AssignmentResult {
  assignments: { [shiftId: string]: string[] }; // shiftId -> employeeIds
  violations: string[];
  resolutionReport: string[];
  success: boolean;
  statistics?: {
    totalAssignments: number;
    preferredAssignments: number;
    availableAssignments: number;
    coverageRate: number;
    violationCount: number;
  };
}

export interface EmployeeAvailabilitySummary {
  employeeId: string;
  employeeName: string;
  preferredSlots: number;
  availableSlots: number;
  unavailableSlots: number;
  totalSlots: number;
}

export interface ShiftRequirement {
  shiftId: string;
  timeSlotId: string;
  dayOfWeek: number;
  date?: string;
  requiredEmployees: number;
  minEmployees: number;
  maxEmployees: number;
  assignedEmployees: string[];
  isPriority: boolean;
}