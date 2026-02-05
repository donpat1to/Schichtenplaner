// backend/src/models/helpers/shiftPlanHelpers.ts
import { ShiftPlan, Shift, TimeSlot } from '../ShiftPlan.js';

export function hasDateRange(plan: ShiftPlan): boolean {
  return !!plan.startDate && !!plan.endDate;
}

export function validatePlanDates(plan: ShiftPlan): string[] {
  const errors: string[] = [];

  if (plan) {
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
// Business logic helpers
export function getShiftsForDay(plan: ShiftPlan, dayOfWeek: number): Shift[] {
  return plan.shifts.filter(shift => shift.dayOfWeek === dayOfWeek);
}

export function getTimeSlotById(plan: ShiftPlan, timeSlotId: string): TimeSlot | undefined {
  return plan.timeSlots.find(slot => slot.id === timeSlotId);
}

export function calculateTotalMinimumEmployees(plan: ShiftPlan): number {
  return plan.shifts.reduce((total, shift) => total + shift.minEmployees, 0);
}

// NEW: Helper for shift generation
export function generateShiftId(): string {
  return `shift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// NEW: Helper for time slot generation
export function generateTimeSlotId(): string {
  return `timeslot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}