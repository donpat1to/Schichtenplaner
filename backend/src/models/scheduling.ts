// backend/src/models/scheduling.ts
import { Employee } from './Employee.js';
import { ShiftPlan } from './ShiftPlan.js';

// Availability interface
export interface Availability {
  id: string;
  employeeId: string;
  planId: string;
  shiftId: string;
  preferenceLevel: 1 | 2 | 3;
  notes?: string;
  // Optional convenience fields
  dayOfWeek?: number;
  timeSlotId?: string;
  timeSlotName?: string;
  startTime?: string;
  endTime?: string;
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
  weight?: number;
}

export interface ScheduleRequest {
  shiftPlan: ShiftPlan;
  employees: Employee[];
  availabilities: Availability[];
  constraints: Constraint[];
}

export interface ScheduleResult {
  success: boolean;
  assignments: {
    shiftId: string;
    employeeId: string;
    assignmentIndex: number;
  }[]
  violations: string[];
  resolutionReport: string[];
  processingTime: number;
}

export interface Assignment {
  shiftId: string;
  employeeId: string;
  assignedAt: Date;
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

// New types for the updated schema
export interface EmployeeWithRoles extends Employee {
  roles: string[];
}