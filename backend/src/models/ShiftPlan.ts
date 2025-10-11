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

// Default time slots for ZEBRA (specific workplace)
export const DEFAULT_ZEBRA_TIME_SLOTS: Omit<TimeSlot, 'id' | 'planId'>[] = [
  { 
    name: 'Vormittag', 
    startTime: '08:00', 
    endTime: '12:00',
    description: 'Vormittagsschicht'
  },
  { 
    name: 'Nachmittag', 
    startTime: '11:30', 
    endTime: '15:30',
    description: 'Nachmittagsschicht'
  },
];

// Default time slots for general use
export const DEFAULT_TIME_SLOTS: Omit<TimeSlot, 'id' | 'planId'>[] = [
  { 
    name: 'Vormittag', 
    startTime: '08:00', 
    endTime: '12:00',
    description: 'Vormittagsschicht'
  },
  { 
    name: 'Nachmittag', 
    startTime: '11:30', 
    endTime: '15:30',
    description: 'Nachmittagsschicht'
  },
  { 
    name: 'Abend', 
    startTime: '14:00', 
    endTime: '18:00',
    description: 'Abendschicht'
  },
];

// Helper functions
export function validateRequiredEmployees(shift: Shift | ScheduledShift): string[] {
  const errors: string[] = [];
  
  if (shift.requiredEmployees < 1) {
    errors.push('Required employees must be at least 1');
  }
  
  if (shift.requiredEmployees > 10) {
    errors.push('Required employees cannot exceed 10');
  }
  
  return errors;
}


export function isTemplate(plan: ShiftPlan): boolean {
  return plan.isTemplate || plan.status === 'template';
}

export function hasDateRange(plan: ShiftPlan): boolean {
  return !isTemplate(plan) && !!plan.startDate && !!plan.endDate;
}

export function validatePlanDates(plan: ShiftPlan): string[] {
  const errors: string[] = [];
  
  if (!isTemplate(plan)) {
    if (!plan.startDate) errors.push('Start date is required for non-template plans');
    if (!plan.endDate) errors.push('End date is required for non-template plans');
    if (plan.startDate && plan.endDate && plan.startDate > plan.endDate) {
      errors.push('Start date must be before end date');
    }
  }
  
  return errors;
}

// Type guards
export function isScheduledShift(shift: Shift | ScheduledShift): shift is ScheduledShift {
  return 'date' in shift;
}

// Template presets for quick setup
// Default shifts for ZEBRA standard week template with variable required employees
export const DEFAULT_ZEBRA_SHIFTS: Omit<Shift, 'id' | 'planId'>[] = [
  // Monday-Thursday: Morning + Afternoon
  ...Array.from({ length: 4 }, (_, i) => i + 1).flatMap(day => [
    { timeSlotId: 'morning', dayOfWeek: day, requiredEmployees: 2, color: '#3498db' },
    { timeSlotId: 'afternoon', dayOfWeek: day, requiredEmployees: 2, color: '#e74c3c' }
  ]),
  // Friday: Morning only
  { timeSlotId: 'morning', dayOfWeek: 5, requiredEmployees: 2, color: '#3498db' }
];

// Default shifts for general standard week template with variable required employees
export const DEFAULT_SHIFTS: Omit<Shift, 'id' | 'planId'>[] = [
  // Monday-Friday: Morning + Afternoon + Evening
  ...Array.from({ length: 5 }, (_, i) => i + 1).flatMap(day => [
    { timeSlotId: 'morning', dayOfWeek: day, requiredEmployees: 2, color: '#3498db' },
    { timeSlotId: 'afternoon', dayOfWeek: day, requiredEmployees: 2, color: '#e74c3c' },
    { timeSlotId: 'evening', dayOfWeek: day, requiredEmployees: 1, color: '#2ecc71' } // Only 1 for evening
  ])
];

// Template presets for quick creation
export const TEMPLATE_PRESETS = {
  ZEBRA_STANDARD: {
    name: 'ZEBRA Standardwoche',
    description: 'Standard Vorlage für ZEBRA: Mo-Do Vormittag+Nachmittag, Fr nur Vormittag',
    timeSlots: DEFAULT_ZEBRA_TIME_SLOTS,
    shifts: DEFAULT_ZEBRA_SHIFTS
  },
  GENERAL_STANDARD: {
    name: 'Standard Wochenplan',
    description: 'Standard Vorlage: Mo-Fr Vormittag+Nachmittag+Abend',
    timeSlots: DEFAULT_TIME_SLOTS,
    shifts: DEFAULT_SHIFTS
  }
} as const;