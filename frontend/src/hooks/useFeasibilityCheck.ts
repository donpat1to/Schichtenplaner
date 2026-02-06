// frontend/src/hooks/useFeasibilityCheck.ts

import { useMemo } from 'react';
import { ShiftPlanWithData } from '../models/ShiftPlan';
import { Employee, EmployeeAvailability } from '../models/Employee';
import { WeeklyPlanWithDetails, EmployeeWithPreferences, PlanWeek } from '../models/WeeklyPlan';

export interface FeasibilityIssue {
  type: 'global_capacity' | 'per_slot' | 'employee';
  severity: 'info';
  message: string;
  details?: string;
}

export interface FeasibilityResult {
  isFeasible: boolean;
  issues: FeasibilityIssue[];
}

export interface MissingAvailabilityInfo {
  employeeNames: string[];
}

// Weekday names in German
const WEEKDAY_NAMES: Record<number, string> = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
  7: 'Sonntag'
};

// Helper to get time slot name or time range
const getTimeSlotLabel = (
  timeSlotId: string,
  timeSlots: { id: string; name: string; startTime: string; endTime: string }[]
): string => {
  const ts = timeSlots.find(t => t.id === timeSlotId);
  if (!ts) return 'Unbekannt';
  return ts.name || `${ts.startTime}-${ts.endTime}`;
};

// Hook for ShiftPlan feasibility check
interface ShiftPlanFeasibilityParams {
  shiftPlan: ShiftPlanWithData | null;
  employees: Employee[];
  availabilities: EmployeeAvailability[];
}

export function useShiftPlanFeasibility({
  shiftPlan,
  employees,
  availabilities
}: ShiftPlanFeasibilityParams): {
  feasibilityResult: FeasibilityResult | null;
  missingAvailability: MissingAvailabilityInfo;
} {
  return useMemo(() => {
    // Calculate missing availability
    const employeesWithAvailability = new Set(
      availabilities
        .filter(a => a.planId === shiftPlan?.id)
        .map(a => a.employeeId)
    );

    const missingEmployees = employees.filter(
      emp => !employeesWithAvailability.has(emp.id)
    );

    const missingAvailability: MissingAvailabilityInfo = {
      employeeNames: missingEmployees.map(emp =>
        `${emp.firstname || ''} ${emp.lastname || ''}`.trim() || emp.username
      )
    };

    // If not all employees have availability, don't run feasibility check
    if (!shiftPlan || missingEmployees.length > 0 || employees.length === 0) {
      return {
        feasibilityResult: null,
        missingAvailability
      };
    }

    const issues: FeasibilityIssue[] = [];

    // Filter relevant employees (personell)
    const schedulableEmployees = employees.filter(
      emp => emp.employeeType === 'personell'
    );
    // Filter relevant employees (personell, not trainee)
    const schedulableEmployeesTraineeSupervisionSensible = employees.filter(
      emp => emp.employeeType === 'personell' && !emp.isTrainee
    );

    // Calculate total required slots (based on contractType: small=1, large=2)
    let totalRequired = 0;
    schedulableEmployees.forEach(emp => {
      if (emp.contractType === 'small') {
        totalRequired += 1;
      } else if (emp.contractType === 'large') {
        totalRequired += 2;
      }
      // flexible employees are not counted in required
    });

    // Calculate total min/max slots from shifts
    let totalMinSlots = 0;
    let totalMaxSlots = 0;
    shiftPlan.shifts.forEach(shift => {
      totalMinSlots += shift.minEmployees;
      totalMaxSlots += shift.maxEmployees;
    });

    // Check 1: Global Capacity
    if (totalRequired < totalMinSlots) {
      issues.push({
        type: 'global_capacity',
        severity: 'info',
        message: 'Globale Kapazität: Zu wenig Nachfrage',
        details: `Benötigte Schichten (${totalRequired}) < Mindestplätze (${totalMinSlots})`
      });
    } else if (totalRequired > totalMaxSlots) {
      issues.push({
        type: 'global_capacity',
        severity: 'info',
        message: 'Globale Kapazität: Zu viel Nachfrage',
        details: `Benötigte Schichten (${totalRequired}) > Maximalplätze (${totalMaxSlots})`
      });
    }

    // Check 2: Per-Shift availability trainee supervision sensible
    shiftPlan.shifts.forEach(shift => {
      // Count available employees for this shift (pref 1 or 2, not trainee)
      const availableForShift = availabilities.filter(
        a =>
          a.shiftId === shift.id &&
          (a.preferenceLevel === 1 || a.preferenceLevel === 2) &&
          schedulableEmployeesTraineeSupervisionSensible.some(emp => emp.id === a.employeeId)
      );

      const availableCount = availableForShift.length;

      if (availableCount < shift.minEmployees) {
        const dayName = WEEKDAY_NAMES[shift.dayOfWeek] || `Tag ${shift.dayOfWeek}`;
        const timeSlotLabel = getTimeSlotLabel(shift.timeSlotId, shiftPlan.timeSlots);

        issues.push({
          type: 'per_slot',
          severity: 'info',
          message: `${dayName} ${timeSlotLabel}: Zu wenig verfügbare Mitarbeiter - Neuling allein`,
          details: `Verfügbar: ${availableCount}, Minimum: ${shift.minEmployees}`
        });
      }
    });

    // Check 3: Per-Shift availability
    shiftPlan.shifts.forEach(shift => {
      // Count available employees for this shift (pref 1 or 2, not trainee)
      const availableForShift = availabilities.filter(
        a =>
          a.shiftId === shift.id &&
          (a.preferenceLevel === 1 || a.preferenceLevel === 2) &&
          schedulableEmployees.some(emp => emp.id === a.employeeId)
      );

      const availableCount = availableForShift.length;

      if (availableCount < shift.minEmployees) {
        const dayName = WEEKDAY_NAMES[shift.dayOfWeek] || `Tag ${shift.dayOfWeek}`;
        const timeSlotLabel = getTimeSlotLabel(shift.timeSlotId, shiftPlan.timeSlots);

        issues.push({
          type: 'per_slot',
          severity: 'info',
          message: `${dayName} ${timeSlotLabel}: Zu wenig verfügbare Mitarbeiter`,
          details: `Verfügbar: ${availableCount}, Minimum: ${shift.minEmployees}`
        });
      }
    });

    return {
      feasibilityResult: {
        isFeasible: issues.length === 0,
        issues
      },
      missingAvailability
    };
  }, [shiftPlan, employees, availabilities]);
}

// Hook for WeeklyPlan feasibility check
interface WeeklyPlanFeasibilityParams {
  weeklyPlan: WeeklyPlanWithDetails | null;
}

export function useWeeklyPlanFeasibility({
  weeklyPlan
}: WeeklyPlanFeasibilityParams): {
  feasibilityResult: FeasibilityResult | null;
  missingAvailability: MissingAvailabilityInfo;
} {
  return useMemo(() => {
    if (!weeklyPlan?.employees || !weeklyPlan?.weeks) {
      return {
        feasibilityResult: null,
        missingAvailability: { employeeNames: [] }
      };
    }

    // Calculate missing availability (employees without preferences)
    const missingEmployees = weeklyPlan.employees.filter(
      emp => emp.preferences.length === 0
    );

    const missingAvailability: MissingAvailabilityInfo = {
      employeeNames: missingEmployees.map(emp =>
        `${emp.firstname || ''} ${emp.lastname || ''}`.trim()
      )
    };

    // If not all employees have preferences, don't run feasibility check
    if (missingEmployees.length > 0 || weeklyPlan.employees.length === 0) {
      return {
        feasibilityResult: null,
        missingAvailability
      };
    }

    const issues: FeasibilityIssue[] = [];
    // Filter relevant employees (personell)
    const schedulableEmployees = weeklyPlan.employees.filter(
      emp => emp.employeeType === 'personell'
    );
    // Filter relevant employees (personell, not trainee)
    const schedulableEmployeesTraineeSupervisionSensible = weeklyPlan.employees.filter(
      emp => emp.employeeType === 'personell' && !emp.isTrainee
    );
    const weeks = weeklyPlan.weeks;

    // Calculate total required weeks (sum of requiredWeeks across all employees)
    const totalRequired = schedulableEmployees.reduce((sum, emp) => sum + emp.requiredWeeks, 0);

    // Calculate total min/max slots from weeks
    const totalMinSlots = weeks.reduce((sum, week) => sum + week.minEmployees, 0);
    const totalMaxSlots = weeks.reduce((sum, week) => sum + week.maxEmployees, 0);

    // Check 1: Global Capacity
    if (totalRequired < totalMinSlots) {
      issues.push({
        type: 'global_capacity',
        severity: 'info',
        message: 'Globale Kapazität: Zu wenig Nachfrage',
        details: `Benötigte Wochen (${totalRequired}) < Mindestplätze (${totalMinSlots})`
      });
    } else if (totalRequired > totalMaxSlots) {
      issues.push({
        type: 'global_capacity',
        severity: 'info',
        message: 'Globale Kapazität: Zu viel Nachfrage',
        details: `Benötigte Wochen (${totalRequired}) > Maximalplätze (${totalMaxSlots})`
      });
    }

    // Check 2: Individual Employee - each employee's requiredWeeks ≤ availableWeeks
    schedulableEmployees.forEach(emp => {
      // Count weeks where employee has pref 1 or 2
      const availableWeeks = emp.preferences.filter(
        p => p.preferenceLevel === 1 || p.preferenceLevel === 2
      ).length;

      if (emp.requiredWeeks > availableWeeks) {
        const empName = `${emp.firstname || ''} ${emp.lastname || ''}`.trim();
        issues.push({
          type: 'employee',
          severity: 'info',
          message: `${empName}: Nicht genug verfügbare Wochen`,
          details: `Benötigt: ${emp.requiredWeeks}, Verfügbar: ${availableWeeks}`
        });
      }
    });

    // Check 3: Per-Week availability
    weeks.forEach(week => {
      // Count employees available for this week (pref 1 or 2)
      const availableCount = schedulableEmployees.filter(emp =>
        emp.preferences.some(
          p => p.weekId === week.id && (p.preferenceLevel === 1 || p.preferenceLevel === 2)
        )
      ).length;

      if (availableCount < week.minEmployees) {
        issues.push({
          type: 'per_slot',
          severity: 'info',
          message: `KW ${week.weekNumber}: Zu wenig verfügbare Mitarbeiter`,
          details: `Verfügbar: ${availableCount}, Minimum: ${week.minEmployees}`
        });
      }
    });

    // Check 4: Per-Week availability trainee supervision sensible
    weeks.forEach(week => {
      // Count employees available for this week (pref 1 or 2)
      const availableCount = schedulableEmployeesTraineeSupervisionSensible.filter(emp =>
        emp.preferences.some(
          p => p.weekId === week.id && (p.preferenceLevel === 1 || p.preferenceLevel === 2)
        )
      ).length;

      if (availableCount < week.minEmployees) {
        issues.push({
          type: 'per_slot',
          severity: 'info',
          message: `KW ${week.weekNumber}: Zu wenig verfügbare Mitarbeiter - Neuling alleine`,
          details: `Verfügbar: ${availableCount}, Minimum: ${week.minEmployees}`
        });
      }
    });

    return {
      feasibilityResult: {
        isFeasible: issues.length === 0,
        issues
      },
      missingAvailability
    };
  }, [weeklyPlan]);
}
