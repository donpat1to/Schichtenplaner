// backend/src/models/WeeklyPlan.ts

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
}

export interface AdminSavePreferencesRequest {
  employeeId: string;
  preferences: {
    weekId: string;
    preferenceLevel: 1 | 2 | 3;
    notes?: string;
  }[];
  requiredWeeks: number;
}

export interface UpdateWeekRequest {
  minEmployees?: number;
  maxEmployees?: number;
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
  assignedWeeks: string[]; // Array of weekIds
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
}

// Solver input/output types
export interface WeeklyScheduleRequest {
  plan: WeeklyPlan;
  weeks: PlanWeek[];
  employees: {
    id: string;
    firstname: string;
    lastname: string;
    isTrainee: boolean;
    employeeType: string;
  }[];
  preferences: WeeklyPreference[];
  requirements: WeeklyWorkRequirement[];
}

export interface WeeklyScheduleResult {
  success: boolean;
  assignments: {
    weekId: string;
    employeeId: string;
  }[];
  violations: string[];
  resolutionReport: string[];
  processingTime: number;
}
