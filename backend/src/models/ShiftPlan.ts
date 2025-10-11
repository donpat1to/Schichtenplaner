// backend/src/models/ShiftPlan.ts
export interface ShiftPlan {
  id: string;
  name: string;
  description?: string;
  startDate?: string; // Optional for templates
  endDate?: string;   // Optional for templates
  isTemplate: boolean;
  status: 'draft' | 'published' | 'archived' | 'template';
  createdBy: string;
  createdAt: string;
  timeSlots: TimeSlot[];
  shifts: Shift[];
  scheduledShifts?: ScheduledShift[]; // Only for non-template plans with dates
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
  timeSlot: any;
  id: string;
  planId: string;
  timeSlotId: string;
  dayOfWeek: number; // 1=Monday, 7=Sunday
  requiredEmployees: number;
  color?: string;
}

export interface ScheduledShift {
  id: string;
  planId: string;
  date: string;
  timeSlotId: string;
  requiredEmployees: number;
  assignedEmployees: string[]; // employee IDs
}

export interface ShiftAssignment {
  id: string;
  scheduledShiftId: string;
  employeeId: string;
  assignmentStatus: 'assigned' | 'cancelled';
  assignedAt: string;
  assignedBy: string;
}

export interface EmployeeAvailability {
  id: string;
  employeeId: string;
  planId: string;
  dayOfWeek: number;
  timeSlotId: string;
  preferenceLevel: 1 | 2 | 3; // 1:preferred, 2:available, 3:unavailable
  notes?: string;
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
  status?: 'draft' | 'published' | 'archived' | 'template';
  timeSlots?: Omit<TimeSlot, 'id' | 'planId'>[];
  shifts?: Omit<Shift, 'id' | 'planId'>[];
}

export interface CreateShiftFromTemplateRequest {
  templatePlanId: string;
  name: string;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface AssignEmployeeRequest {
  employeeId: string;
  scheduledShiftId: string;
}

export interface UpdateAvailabilityRequest {
  planId: string;
  availabilities: Omit<EmployeeAvailability, 'id' | 'employeeId'>[];
}

export interface UpdateRequiredEmployeesRequest {
  requiredEmployees: number;
}