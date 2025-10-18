// backend/src/types/scheduling.ts
import { Employee } from './Employee.js';
import { ShiftPlan } from './ShiftPlan.js';

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
}