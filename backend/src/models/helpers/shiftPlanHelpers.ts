// backend/src/models/helpers/shiftPlanHelpers.ts
import { ShiftPlan, Shift, ScheduledShift, TimeSlot } from '../ShiftPlan.js';

// Validation helpers
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

export function validateTimeSlot(timeSlot: { startTime: string; endTime: string }): string[] {
  const errors: string[] = [];
  
  if (!timeSlot.startTime || !timeSlot.endTime) {
    errors.push('Start time and end time are required');
    return errors;
  }
  
  const start = new Date(`2000-01-01T${timeSlot.startTime}`);
  const end = new Date(`2000-01-01T${timeSlot.endTime}`);
  
  if (start >= end) {
    errors.push('Start time must be before end time');
  }
  
  return errors;
}

// Type guards
export function isScheduledShift(shift: Shift | ScheduledShift): shift is ScheduledShift {
  return 'date' in shift;
}

export function isTemplateShift(shift: Shift | ScheduledShift): shift is Shift {
  return 'dayOfWeek' in shift && !('date' in shift);
}

// Business logic helpers
export function getShiftsForDay(plan: ShiftPlan, dayOfWeek: number): Shift[] {
  return plan.shifts.filter(shift => shift.dayOfWeek === dayOfWeek);
}

export function getTimeSlotById(plan: ShiftPlan, timeSlotId: string): TimeSlot | undefined {
  return plan.timeSlots.find(slot => slot.id === timeSlotId);
}

export function calculateTotalRequiredEmployees(plan: ShiftPlan): number {
  return plan.shifts.reduce((total, shift) => total + shift.requiredEmployees, 0);
}

/*export function getScheduledShiftByDateAndTime(
  plan: ShiftPlan, 
  date: string, 
  timeSlotId: string
): ScheduledShift | undefined {
  return plan.scheduledShifts?.find(shift => 
    shift.date === date && shift.timeSlotId === timeSlotId
  );
}*/

export function canPublishPlan(plan: ShiftPlan): { canPublish: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!hasDateRange(plan)) {
    errors.push('Plan must have a date range to be published');
  }
  
  if (plan.shifts.length === 0) {
    errors.push('Plan must have at least one shift');
  }
  
  if (plan.timeSlots.length === 0) {
    errors.push('Plan must have at least one time slot');
  }
  
  // Validate all shifts
  plan.shifts.forEach((shift, index) => {
    const shiftErrors = validateRequiredEmployees(shift);
    if (shiftErrors.length > 0) {
      errors.push(`Shift ${index + 1}: ${shiftErrors.join(', ')}`);
    }
  });
  
  return {
    canPublish: errors.length === 0,
    errors
  };
}