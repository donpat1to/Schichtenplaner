import { WeeklyPlan } from './WeeklyPlan';
import { PlanWeek } from './WeeklyPlan';
import { WeeklyPreference } from './WeeklyPlan';
import { WeeklyWorkRequirement } from './WeeklyPlan';

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