// backend/src/models/ShiftPlan.ts
export interface ShiftPlan {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  isTemplate: boolean;
  status: 'draft' | 'published' | 'archived';
  createdBy: string;
  createdAt: string;
  timeSlots: TimeSlot[];
  shifts: Shift[];
}

export interface GenerateResult {
  success: boolean;
  message: string;
  assignments: {
    shiftId: string;
    employeeId: string;
  }[];
  violations: string[];
  processingTime: number;
  plan?: ShiftPlan;
}

export interface ShiftPlanStatistics {
  planInfo: {
    name: string;
    status: 'draft' | 'published' | 'archived';
    isTemplate: boolean;
    startDate?: string;
    endDate?: string;
  };
  totals: {
    totalShifts: number;
    totalAssignmentSlots: number; // Sum of requiredEmployees across all shifts
    totalAssignedSlots: number; // Count of assigned employeeIds (not null)
    totalEmployees: number;
  };
  coverage: {
    coverageRate: number; // totalAssignedSlots / totalAssignmentSlots
    employeesWithAssignments: number;
    averageAssignmentsPerEmployee: number;
  };
  breakdown: {
    employeeTypeBreakdown: Record<string, number>;
    shiftsByDay: Record<number, number>;
  };
  assignmentDistribution: {
    assignmentsPerEmployee: Record<string, number>;
    mostAssignedEmployee: [string, number] | null;
    leastAssignedEmployee: [string, number] | null;
  };
}

export interface TimeSlot {
  id: string;
  planId: string;
  name: string;
  startTime: string;
  endTime: string;
  description?: string;
}

export interface Shift {
  id: string;
  planId: string;
  timeSlotId: string;
  dayOfWeek: number; // 1=Monday, 7=Sunday
  requiredEmployees: number;
  minEmployees: number;
  maxEmployees: number;
  color?: string;
}

// Removed: ScheduledShift interface (no longer used)

export interface ShiftAssignment {
  id: string;
  planId: string;
  shiftId: string;
  employeeId: string;
  assignedAt: string;
  assignedBy: string;
}

// Request/Response DTOs
export interface CreateShiftPlanRequest {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  isTemplate: boolean;
  timeSlots: Omit<TimeSlot, 'id' | 'planId'>[];
  shifts: Omit<Shift, 'id' | 'planId'>[];
}

export interface UpdateShiftPlanRequest {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  isTemplate?: boolean;
  status?: 'draft' | 'published' | 'archived';
  timeSlots?: Omit<TimeSlot, 'id' | 'planId'>[];
  shifts?: Omit<Shift, 'id' | 'planId'>[];
}