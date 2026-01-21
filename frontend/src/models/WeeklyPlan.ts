// frontend/src/models/WeeklyPlan.ts

export interface WeeklyPlan {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'published' | 'archived';
  createdBy: string;
  createdAt: string;
  weeks?: PlanWeek[];
  preferences?: WeeklyPreference[];
  requirements?: WeeklyWorkRequirement[];
  assignments?: WeeklyAssignment[];
}

export interface PlanWeek {
  id: string;
  planId: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  minEmployees: number;
  maxEmployees: number;
}

export interface WeeklyPreference {
  id: string;
  employeeId: string;
  planId: string;
  weekId: string;
  preferenceLevel: 1 | 2 | 3; // 1=Preferred, 2=Available, 3=Unavailable
  notes?: string;
}

export interface WeeklyWorkRequirement {
  id: string;
  employeeId: string;
  planId: string;
  requiredWeeks: number;
  assignmentStyle: 'consecutive' | 'scattered' | 'flexible';
  assignmentStyleConsecutive: number;
}

export interface WeeklyAssignment {
  id: string;
  planId: string;
  weekId: string;
  employeeId: string;
  assignedAt: string;
  assignedBy: string;
}

// Request/Response DTOs
export interface CreateWeeklyPlanRequest {
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
}

export interface UpdateWeeklyPlanRequest {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: 'draft' | 'published' | 'archived';
}

export interface SavePreferencesRequest {
  preferences: {
    weekId: string;
    preferenceLevel: 1 | 2 | 3;
    notes?: string;
  }[];
  requiredWeeks: number;
  assignmentStyle?: 'consecutive' | 'scattered' | 'flexible';
  assignmentStyleConsecutive?: number;
}

export interface AdminSavePreferencesRequest {
  employeeId: string;
  preferences: {
    weekId: string;
    preferenceLevel: 1 | 2 | 3;
    notes?: string;
  }[];
  requiredWeeks: number;
  assignmentStyle?: 'consecutive' | 'scattered' | 'flexible';
  assignmentStyleConsecutive?: number;
}

export interface UpdateWeekRequest {
  minEmployees?: number;
  maxEmployees?: number;
}

export interface UpdateWorkRequirementRequest {
  requiredWeeks?: number;
  assignmentStyle?: 'consecutive' | 'scattered' | 'flexible';
  assignmentStyleConsecutive?: number;
}

// Response DTOs with additional data
export interface WeeklyPlanWithDetails extends WeeklyPlan {
  createdByName?: string;
  weeks: PlanWeek[];
  employees?: EmployeeWithPreferences[];
}

export interface EmployeeWithPreferences {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  employeeType: string;
  isTrainee: boolean;
  preferences: {
    weekId: string;
    preferenceLevel: 1 | 2 | 3;
    notes?: string;
  }[];
  requiredWeeks: number;
  assignmentStyle: 'consecutive' | 'scattered' | 'flexible';
  assignmentStyleConsecutive: number;
  assignedWeeks: string[]; // Array of weekIds
}

export interface EmployeeWorkRequirement {
  employeeId: string;
  requiredWeeks: number;
  assignmentStyle: 'consecutive' | 'scattered' | 'flexible';
  assignmentStyleConsecutive: number;
}

export interface MyPreferencesResponse {
  planId: string;
  employeeId: string;
  preferences: {
    weekId: string;
    preferenceLevel: 1 | 2 | 3;
    notes?: string;
  }[];
  requiredWeeks: number;
  assignmentStyle: 'consecutive' | 'scattered' | 'flexible';
  assignmentStyleConsecutive: number;
}

// Additional types for the enhanced weekly planning
export interface WeeklyAssignmentWithDetails extends WeeklyAssignment {
  employee?: {
    id: string;
    firstname: string;
    lastname: string;
    employeeType: string;
    isTrainee: boolean;
  };
  week?: {
    weekNumber: number;
    startDate: string;
    endDate: string;
    minEmployees: number;
    maxEmployees: number;
  };
}

export interface WeeklyPlanStatistics {
  totalWeeks: number;
  totalAssignedWeeks: number;
  totalRequiredWeeks: number;
  coverageRate: number;
  employeesCount: number;
  employeesWithPreferences: number;
  averageRequiredWeeks: number;
  consecutiveStyleAssignments: number;
  scatteredStyleAssignments: number;
}

// Types for consecutive assignment constraints
export interface ConsecutiveAssignmentConstraint {
  type: 'consecutive';
  employeeId: string;
  consecutiveSize: number;
}

export interface ScatteredAssignmentConstraint {
  type: 'scattered';
  employeeId: string;
}

export type AssignmentConstraint = ConsecutiveAssignmentConstraint | ScatteredAssignmentConstraint;

// Preference level helpers
export const PreferenceLevelLabels: Record<1 | 2 | 3, string> = {
  1: 'Bevorzugt',
  2: 'Verfügbar',
  3: 'Nicht verfügbar'
};

export const PreferenceLevelColors: Record<1 | 2 | 3, string> = {
  1: '#22c55e', // Green
  2: '#eab308', // Yellow
  3: '#ef4444'  // Red
};

export const getPreferenceLevelLabel = (level: 1 | 2 | 3): string => {
  return PreferenceLevelLabels[level];
};

export const getPreferenceLevelColor = (level: 1 | 2 | 3): string => {
  return PreferenceLevelColors[level];
};

// Date helper functions for weekly planning
export const getWeekDateRange = (startDate: string): { start: Date; end: Date } => {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
};

export const formatWeekRange = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' };
  return `${start.toLocaleDateString('de-DE', options)} - ${end.toLocaleDateString('de-DE', options)}`;
};

export const getCalendarWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};
