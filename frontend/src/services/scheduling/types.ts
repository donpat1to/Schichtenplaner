// frontend/src/services/scheduling/types.ts
import { ScheduledShift } from "../../models/ShiftPlan";

export interface SchedulingEmployee {
  id: string;
  name: string;
  role: 'manager' | 'erfahren' | 'neu';
  contract: number; // max assignments per week
  availability: Map<string, number>; // shiftId -> preferenceLevel (1,2,3)
  assignedCount: number;
  originalData: any; // reference to original employee data
}

export interface SchedulingShift {
  id: string;
  requiredEmployees: number;
  isManagerShift?: boolean;
  originalData: any; // reference to original shift data
}

export interface Assignment {
  [shiftId: string]: string[]; // employee IDs
}

export interface SchedulingResult {
  assignments: Assignment;
  violations: string[];
  success: boolean;
}

export interface SchedulingConstraints {
  enforceNoTraineeAlone: boolean;
  enforceExperiencedWithChef: boolean;
  maxRepairAttempts: number;
}

export interface AssignmentResult {
  assignments: { [shiftId: string]: string[] };
  violations: string[];
  success: boolean;
  pattern: WeeklyPattern;
}

export interface WeeklyPattern {
  weekShifts: ScheduledShift[];
  assignments: { [shiftId: string]: string[] };
  weekNumber: number;
}