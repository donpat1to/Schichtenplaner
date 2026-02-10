// backend/src/controllers/weeklyPlanController.ts
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/databaseService.js';
import {
  CreateWeeklyPlanRequest,
  UpdateWeeklyPlanRequest,
  SavePreferencesRequest,
  AdminSavePreferencesRequest,
  UpdateWeekRequest,
  UpdateWorkRequirementRequest,
  WeeklyPlanWithDetails,
  PlanWeek,
  EmployeeWithPreferences,
  WeeklyAssignment,
  CreateAssignmentsRequest,
  DEFAULT_WORK_DAYS
} from '../models/WeeklyPlan.js';
import { Holiday, ResolvedHoliday } from '../models/Holiday.js';
import { AuthRequest } from '../middleware/auth.js';
import ExcelJS from 'exceljs';
import { chromium } from 'playwright-chromium';

// Helper function to get ISO week number (Kalenderwoche)
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Helper function to generate weeks from date range with calendar week numbers
function generateWeeksFromDateRange(startDate: string, endDate: string): Omit<PlanWeek, 'id' | 'planId'>[] {
  const weeks: Omit<PlanWeek, 'id' | 'planId'>[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Ensure dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date format');
  }

  // Adjust to Monday of the week containing start date
  const dayOfWeek = start.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  start.setDate(start.getDate() + mondayOffset);

  // Adjust end date to Sunday of the week containing end date
  const endDayOfWeek = end.getDay();
  const sundayOffset = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
  const adjustedEnd = new Date(end);
  adjustedEnd.setDate(end.getDate() + sundayOffset);

  let currentWeekStart = new Date(start);

  while (currentWeekStart <= adjustedEnd) {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6);

    // Get calendar week number (Kalenderwoche)
    const weekNumber = getWeekNumber(currentWeekStart);

    weeks.push({
      weekNumber,
      startDate: currentWeekStart.toISOString().split('T')[0],
      endDate: weekEnd.toISOString().split('T')[0],
      minEmployees: 2,
      maxEmployees: 4,
    });

    // Move to next week
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }

  return weeks;
}

// Helper function to convert work_days string to array
function parseWorkDays(workDaysStr: string | null): number[] {
  if (!workDaysStr) return DEFAULT_WORK_DAYS;
  return workDaysStr.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d));
}

// Day names in German (index 0 = Sunday, 1 = Monday, etc.)
const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAY_NAMES_FULL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

// Helper function to get work days as text (e.g., "Mo, Di, Mi, Do, Fr")
function getWorkDaysText(workDays: number[]): string {
  return workDays.map(d => DAY_NAMES[d]).join(', ');
}

// Helper function to get assignment style in German
function getAssignmentStyleText(style: 'consecutive' | 'scattered' | 'flexible'): string {
  switch (style) {
    case 'consecutive': return 'Konsekutiv';
    case 'scattered': return 'Verteilt';
    case 'flexible': return 'Flexibel';
    default: return style;
  }
}

// Helper function to get assigned weeks as formatted text (e.g., "KW 1, KW 2, KW 5")
function getAssignedWeeksText(assignedWeekIds: string[], weeks: PlanWeek[]): string {
  const assignedWeeks = weeks
    .filter(w => assignedWeekIds.includes(w.id))
    .sort((a, b) => a.weekNumber - b.weekNumber);
  return assignedWeeks.map(w => `KW ${w.weekNumber}`).join(', ') || 'Keine';
}

// Helper function to get work days for calendar layout
function getWorkDaysForCalendar(workDays: number[]): { id: number; name: string; nameFull: string }[] {
  return workDays.map(d => ({
    id: d,
    name: DAY_NAMES[d],
    nameFull: DAY_NAMES_FULL[d]
  }));
}

// Helper function to get all days for calendar layout (Mo-Su) with work day indicator
function getAllDaysForCalendar(workDays: number[]): { id: number; name: string; nameFull: string; isWorkDay: boolean }[] {
  // Return all days Monday (1) through Sunday (0/7)
  const allDays = [1, 2, 3, 4, 5, 6, 0]; // Mo, Di, Mi, Do, Fr, Sa, So
  return allDays.map(d => ({
    id: d,
    name: DAY_NAMES[d],
    nameFull: DAY_NAMES_FULL[d],
    isWorkDay: workDays.includes(d === 0 ? 7 : d) || workDays.includes(d) // Handle Sunday as 7 or 0
  }));
}

// Helper function to format date as DD.MM
function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

// Helper function to format date as DD.MM.YYYY HH:mm
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Helper function to get employee suffix based on type
function getEmployeeSuffix(emp: { isTrainee: boolean; employeeType: string }): string {
  if (emp.isTrainee) return ' (T)';
  if (emp.employeeType === 'manager') return ' (M)';
  return '';
}

// Helper function to get the date for a specific day within a week
// dayOfWeek: 0 = Sunday, 1 = Monday, etc.
function getDateForDayInWeek(weekStartDate: string, dayOfWeek: number): string {
  const start = new Date(weekStartDate);
  // weekStartDate is Monday (day 1), so calculate offset
  // Monday = 1, so offset for Monday = 0, Tuesday = 1, etc.
  // For Sunday (0), offset = 6
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const targetDate = new Date(start);
  targetDate.setDate(start.getDate() + offset);
  return formatDateShort(targetDate.toISOString().split('T')[0]);
}

// Helper function to parse a date string (YYYY-MM-DD) as local date
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Helper function to format a Date to YYYY-MM-DD string (local time)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to convert DB row to Holiday object
function mapRowToHoliday(row: any): Holiday {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    endDate: row.end_date || undefined,
    halfDay: row.half_day || undefined,
    isRecurring: row.is_recurring === 1,
    description: row.description || undefined,
    createdAt: row.created_at,
    createdBy: row.created_by
  };
}

// Helper function to resolve recurring holidays to a specific date range
function resolveHolidaysToDateRange(
  holidays: Holiday[],
  startDate: string,
  endDate: string
): ResolvedHoliday[] {
  const resolved: ResolvedHoliday[] = [];
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  for (const holiday of holidays) {
    if (holiday.isRecurring) {
      // For recurring holidays, generate occurrences for each year in range
      for (let year = startYear; year <= endYear; year++) {
        const holidayDate = parseLocalDate(holiday.date);
        const resolvedDate = new Date(year, holidayDate.getMonth(), holidayDate.getDate());

        // Check if the resolved date falls within the range
        if (resolvedDate >= start && resolvedDate <= end) {
          const dateStr = formatLocalDate(resolvedDate);

          if (holiday.endDate) {
            // Multi-day recurring holiday
            const origEndDate = parseLocalDate(holiday.endDate);
            const daysDiff = Math.ceil((origEndDate.getTime() - holidayDate.getTime()) / (1000 * 60 * 60 * 24));
            const resolvedEndDate = new Date(resolvedDate);
            resolvedEndDate.setDate(resolvedEndDate.getDate() + daysDiff);

            // Add each day of the multi-day holiday
            let currentDate = new Date(resolvedDate);
            while (currentDate <= resolvedEndDate && currentDate <= end) {
              if (currentDate >= start) {
                resolved.push({
                  id: holiday.id,
                  name: holiday.name,
                  date: formatLocalDate(currentDate),
                  halfDay: holiday.halfDay,
                  description: holiday.description
                });
              }
              currentDate.setDate(currentDate.getDate() + 1);
            }
          } else {
            resolved.push({
              id: holiday.id,
              name: holiday.name,
              date: dateStr,
              halfDay: holiday.halfDay,
              description: holiday.description
            });
          }
        }
      }
    } else {
      // Non-recurring holiday - check if it falls within range
      const holidayDate = parseLocalDate(holiday.date);

      if (holiday.endDate) {
        // Multi-day non-recurring holiday
        const endDateObj = parseLocalDate(holiday.endDate);
        let currentDate = new Date(holidayDate);

        while (currentDate <= endDateObj) {
          if (currentDate >= start && currentDate <= end) {
            resolved.push({
              id: holiday.id,
              name: holiday.name,
              date: formatLocalDate(currentDate),
              halfDay: holiday.halfDay,
              description: holiday.description
            });
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } else if (holidayDate >= start && holidayDate <= end) {
        resolved.push({
          id: holiday.id,
          name: holiday.name,
          date: holiday.date,
          halfDay: holiday.halfDay,
          description: holiday.description
        });
      }
    }
  }

  // Sort by date
  resolved.sort((a, b) => a.date.localeCompare(b.date));
  return resolved;
}

// Helper function to get holiday for a specific date
function getHolidayForDate(date: string, holidays: ResolvedHoliday[]): ResolvedHoliday | undefined {
  return holidays.find(h => h.date === date);
}

// Helper function to get the full date (YYYY-MM-DD) for a specific day within a week
function getFullDateForDayInWeek(weekStartDate: string, dayOfWeek: number): string {
  const start = parseLocalDate(weekStartDate);
  // weekStartDate is Monday (day 1), so calculate offset
  // Monday = 1, so offset for Monday = 0, Tuesday = 1, etc.
  // For Sunday (0), offset = 6
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const targetDate = new Date(start);
  targetDate.setDate(start.getDate() + offset);
  return formatLocalDate(targetDate);
}

// Helper function to get holidays for the plan's date range
async function getHolidaysForPlan(startDate: string, endDate: string): Promise<ResolvedHoliday[]> {
  const rows = await db.all<any>(`SELECT * FROM legal_holidays`);
  const holidays = rows.map(mapRowToHoliday);
  return resolveHolidaysToDateRange(holidays, startDate, endDate);
}

// Helper function to get plan with all details
async function getWeeklyPlanById(planId: string): Promise<WeeklyPlanWithDetails | null> {
  const plan = await db.get<any>(`
    SELECT wp.*, e.firstname || ' ' || e.lastname as created_by_name
    FROM weekly_plans wp
    LEFT JOIN employees e ON wp.created_by = e.id
    WHERE wp.id = ?
  `, [planId]);

  if (!plan) return null;

  // Get weeks
  const weeks = await db.all<any>(`
    SELECT * FROM plan_weeks WHERE plan_id = ? ORDER BY week_number
  `, [planId]);

  // Get all active employees with their preferences for this plan
  const employees = await db.all<any>(`
    SELECT
      e.id,
      e.firstname,
      e.lastname,
      e.email,
      e.employee_type,
      e.is_trainee
    FROM employees e
    WHERE e.is_active = 1 AND e.employee_type IN ('personell', 'manager')
    ORDER BY e.firstname, e.lastname
  `, []);

  // Get preferences for all employees
  const allPreferences = await db.all<any>(`
    SELECT employee_id, week_id, preference_level, notes
    FROM weekly_preferences
    WHERE plan_id = ?
  `, [planId]);

  // Get requirements for all employees (with new fields)
  const allRequirements = await db.all<any>(`
    SELECT employee_id, required_weeks, assignment_style, assignment_style_consecutive
    FROM weekly_work_requirements
    WHERE plan_id = ?
  `, [planId]);

  // Get assignments
  const allAssignments = await db.all<any>(`
    SELECT week_id, employee_id
    FROM weekly_assignments
    WHERE plan_id = ?
  `, [planId]);

  // Map employees with their preferences, requirements and assignments
  const employeesWithPreferences: EmployeeWithPreferences[] = employees.map((emp: any) => {
    const empPreferences = allPreferences
      .filter((p: any) => p.employee_id === emp.id)
      .map((p: any) => ({
        weekId: p.week_id,
        preferenceLevel: p.preference_level as 1 | 2 | 3,
        notes: p.notes,
      }));

    const requirement = allRequirements.find((r: any) => r.employee_id === emp.id);
    const assignedWeeks = allAssignments
      .filter((a: any) => a.employee_id === emp.id)
      .map((a: any) => a.week_id);

    return {
      id: emp.id,
      firstname: emp.firstname,
      lastname: emp.lastname,
      email: emp.email,
      employeeType: emp.employee_type,
      isTrainee: emp.is_trainee === 1,
      preferences: empPreferences,
      requiredWeeks: requirement?.required_weeks || 0,
      assignmentStyle: requirement?.assignment_style || 'flexible',
      assignmentStyleConsecutive: requirement?.assignment_style_consecutive || 1,
      assignedWeeks,
    };
  });

  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    startDate: plan.start_date,
    endDate: plan.end_date,
    workDays: parseWorkDays(plan.work_days),
    status: plan.status as 'draft' | 'published' | 'archived',
    createdBy: plan.created_by,
    createdAt: plan.created_at,
    createdByName: plan.created_by_name,
    weeks: weeks.map((w: any) => ({
      id: w.id,
      planId: w.plan_id,
      weekNumber: w.week_number,
      startDate: w.start_date,
      endDate: w.end_date,
      minEmployees: w.min_employees,
      maxEmployees: w.max_employees,
    })),
    employees: employeesWithPreferences,
  };
}

// ===== CRUD Operations =====

export const getWeeklyPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const plans = await db.all<any>(`
      SELECT wp.*, e.firstname || ' ' || e.lastname as created_by_name
      FROM weekly_plans wp
      LEFT JOIN employees e ON wp.created_by = e.id
      ORDER BY wp.created_at DESC
    `);

    // Get week counts and assignment statistics for each plan
    const plansWithCounts = await Promise.all(
      plans.map(async (plan: any) => {
        const weekCount = await db.get<any>(
          'SELECT COUNT(*) as count FROM plan_weeks WHERE plan_id = ?',
          [plan.id]
        );

        const assignmentCount = await db.get<any>(
          'SELECT COUNT(*) as count FROM weekly_assignments WHERE plan_id = ?',
          [plan.id]
        );

        const employeeCount = await db.get<any>(`
          SELECT COUNT(DISTINCT employee_id) as count 
          FROM weekly_work_requirements 
          WHERE plan_id = ?
        `, [plan.id]);

        return {
          id: plan.id,
          name: plan.name,
          description: plan.description,
          startDate: plan.start_date,
          endDate: plan.end_date,
          workDays: parseWorkDays(plan.work_days),
          status: plan.status,
          createdBy: plan.created_by,
          createdAt: plan.created_at,
          createdByName: plan.created_by_name,
          weekCount: weekCount?.count || 0,
          assignmentCount: assignmentCount?.count || 0,
          employeeCount: employeeCount?.count || 0,
        };
      })
    );

    res.json(plansWithCounts);
  } catch (error) {
    console.error('Error fetching weekly plans:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getWeeklyPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const plan = await getWeeklyPlanById(id);

    if (!plan) {
      res.status(404).json({ error: 'Weekly plan not found' });
      return;
    }

    res.json(plan);
  } catch (error) {
    console.error('Error fetching weekly plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createWeeklyPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, startDate, endDate, workDays }: CreateWeeklyPlanRequest = req.body;
    const userId = (req as AuthRequest).user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!name || !startDate || !endDate) {
      res.status(400).json({ error: 'Name, start date and end date are required' });
      return;
    }

    const planId = uuidv4();
    const workDaysStr = (workDays || DEFAULT_WORK_DAYS).join(',');

    await db.run('BEGIN TRANSACTION');

    try {
      // Create the plan
      await db.run(
        `INSERT INTO weekly_plans (id, name, description, start_date, end_date, work_days, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)`,
        [planId, name, description || '', startDate, endDate, workDaysStr, userId]
      );

      // Generate and insert weeks
      const weeks = generateWeeksFromDateRange(startDate, endDate);
      for (const week of weeks) {
        const weekId = uuidv4();
        await db.run(
          `INSERT INTO plan_weeks (id, plan_id, week_number, start_date, end_date, min_employees, max_employees)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [weekId, planId, week.weekNumber, week.startDate, week.endDate, week.minEmployees, week.maxEmployees]
        );
      }

      await db.run('COMMIT');

      const createdPlan = await getWeeklyPlanById(planId);
      res.status(201).json(createdPlan);
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating weekly plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateWeeklyPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, status, startDate, endDate, workDays }: UpdateWeeklyPlanRequest = req.body;

    const existingPlan = await db.get<{
      id: string;
      name: string;
      description: string;
      start_date: string;
      end_date: string;
      work_days: string;
      status: 'draft' | 'published' | 'archived';
      created_by: string;
      created_at: string;
    }>('SELECT * FROM weekly_plans WHERE id = ?', [id]);

    if (!existingPlan) {
      res.status(404).json({ error: 'Weekly plan not found' });
      return;
    }

    // If plan is not in draft status, don't allow date changes
    if (existingPlan.status !== 'draft' && (startDate || endDate)) {
      res.status(400).json({
        error: 'Cannot change dates of a non-draft plan. Please revert to draft status first.'
      });
      return;
    }

    await db.run('BEGIN TRANSACTION');

    try {
      // Convert workDays array to string if provided
      const workDaysStr = workDays ? workDays.join(',') : null;

      // Update basic plan information
      await db.run(
        `UPDATE weekly_plans
         SET name = COALESCE(?, name),
             description = COALESCE(?, description),
             work_days = COALESCE(?, work_days),
             status = COALESCE(?, status)
         WHERE id = ?`,
        [name, description, workDaysStr, status, id]
      );

      // If start or end dates are provided, need to update and regenerate weeks
      if (startDate || endDate) {
        // Get new start and end dates (use provided or existing values)
        const newStartDate = startDate || existingPlan.start_date;
        const newEndDate = endDate || existingPlan.end_date;

        // Update plan dates
        await db.run(
          `UPDATE weekly_plans
           SET start_date = ?, end_date = ?
           WHERE id = ?`,
          [newStartDate, newEndDate, id]
        );

        // Check if dates actually changed
        const datesChanged =
          (startDate && startDate !== existingPlan.start_date) ||
          (endDate && endDate !== existingPlan.end_date);

        if (datesChanged) {
          // Get existing weeks to check for associated data
          const existingWeeks = await db.all<any>(
            'SELECT * FROM plan_weeks WHERE plan_id = ? ORDER BY week_number',
            [id]
          );

          // Check if there are existing assignments - if yes, don't allow date changes
          if (existingWeeks.length > 0) {
            const hasAssignments = await db.get<any>(
              `SELECT COUNT(*) as count FROM weekly_assignments 
               WHERE plan_id = ?`,
              [id]
            );

            if (hasAssignments.count > 0) {
              await db.run('ROLLBACK');
              res.status(400).json({
                error: 'Cannot change dates when assignments already exist. Please clear assignments first.'
              });
              return;
            }
          }

          // Delete all existing weeks (cascade delete will also remove related preferences)
          await db.run('DELETE FROM plan_weeks WHERE plan_id = ?', [id]);

          // Generate new weeks
          const weeks = generateWeeksFromDateRange(newStartDate, newEndDate);
          for (const week of weeks) {
            const weekId = uuidv4();
            await db.run(
              `INSERT INTO plan_weeks (id, plan_id, week_number, start_date, end_date, min_employees, max_employees)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [weekId, id, week.weekNumber, week.startDate, week.endDate, week.minEmployees, week.maxEmployees]
            );
          }

          // Note: We don't delete work requirements (weekly_work_requirements),
          // as they still apply even if weeks change
          // Preferences are also not deleted as week IDs changed and old preferences were cascade deleted
        }
      }

      await db.run('COMMIT');

      const updatedPlan = await getWeeklyPlanById(id);
      res.json(updatedPlan);
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error updating weekly plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteWeeklyPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingPlan = await db.get('SELECT * FROM weekly_plans WHERE id = ?', [id]);
    if (!existingPlan) {
      res.status(404).json({ error: 'Weekly plan not found' });
      return;
    }

    await db.run('DELETE FROM weekly_plans WHERE id = ?', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting weekly plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== Week Management =====

export const updateWeek = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, weekId } = req.params;
    const { minEmployees, maxEmployees }: UpdateWeekRequest = req.body;

    const existingWeek = await db.get(
      'SELECT * FROM plan_weeks WHERE id = ? AND plan_id = ?',
      [weekId, id]
    );

    if (!existingWeek) {
      res.status(404).json({ error: 'Week not found in this plan' });
      return;
    }

    await db.run(
      `UPDATE plan_weeks
       SET min_employees = COALESCE(?, min_employees),
           max_employees = COALESCE(?, max_employees)
       WHERE id = ?`,
      [minEmployees, maxEmployees, weekId]
    );

    const updatedWeek = await db.get<any>('SELECT * FROM plan_weeks WHERE id = ?', [weekId]);
    res.json({
      id: updatedWeek.id,
      planId: updatedWeek.plan_id,
      weekNumber: updatedWeek.week_number,
      startDate: updatedWeek.start_date,
      endDate: updatedWeek.end_date,
      minEmployees: updatedWeek.min_employees,
      maxEmployees: updatedWeek.max_employees,
    });
  } catch (error) {
    console.error('Error updating week:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== Work Requirements Management =====

export const updateWorkRequirement = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, employeeId } = req.params;
    const { requiredWeeks, assignmentStyle, assignmentStyleConsecutive }: UpdateWorkRequirementRequest = req.body;

    const plan = await db.get('SELECT * FROM weekly_plans WHERE id = ?', [id]);
    if (!plan) {
      res.status(404).json({ error: 'Weekly plan not found' });
      return;
    }

    const employee = await db.get('SELECT * FROM employees WHERE id = ?', [employeeId]);
    if (!employee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    // Validate assignment style consecutive size
    if (assignmentStyleConsecutive !== undefined && (assignmentStyleConsecutive < 1 || assignmentStyleConsecutive > 10)) {
      res.status(400).json({ error: 'Assignment style consecutive size must be between 1 and 10' });
      return;
    }

    await db.run(
      `INSERT INTO weekly_work_requirements (id, employee_id, plan_id, required_weeks, assignment_style, assignment_style_consecutive)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(employee_id, plan_id) DO UPDATE SET
         required_weeks = COALESCE(?, required_weeks),
         assignment_style = COALESCE(?, assignment_style),
         assignment_style_consecutive = COALESCE(?, assignment_style_consecutive)`,
      [
        uuidv4(),
        employeeId,
        id,
        requiredWeeks || 0,
        assignmentStyle || 'flexible',
        assignmentStyleConsecutive || 1,
        requiredWeeks,
        assignmentStyle,
        assignmentStyleConsecutive
      ]
    );

    const updatedRequirement = await db.get<any>(`
      SELECT * FROM weekly_work_requirements 
      WHERE plan_id = ? AND employee_id = ?
    `, [id, employeeId]);

    res.json({
      employeeId: employeeId,
      planId: id,
      requiredWeeks: updatedRequirement.required_weeks,
      assignmentStyle: updatedRequirement.assignment_style,
      assignmentStyleConsecutive: updatedRequirement.assignment_style_consecutive,
    });
  } catch (error) {
    console.error('Error updating work requirement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== Preferences Management =====

export const getMyPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const plan = await db.get('SELECT * FROM weekly_plans WHERE id = ?', [id]);
    if (!plan) {
      res.status(404).json({ error: 'Weekly plan not found' });
      return;
    }

    const preferences = await db.all<any>(`
      SELECT week_id, preference_level, notes
      FROM weekly_preferences
      WHERE plan_id = ? AND employee_id = ?
    `, [id, userId]);

    const requirement = await db.get<any>(`
      SELECT required_weeks, assignment_style, assignment_style_consecutive
      FROM weekly_work_requirements
      WHERE plan_id = ? AND employee_id = ?
    `, [id, userId]);

    res.json({
      planId: id,
      employeeId: userId,
      preferences: preferences.map((p: any) => ({
        weekId: p.week_id,
        preferenceLevel: p.preference_level,
        notes: p.notes,
      })),
      requiredWeeks: requirement?.required_weeks || 0,
      assignmentStyle: requirement?.assignment_style || 'flexible',
      assignmentStyleConsecutive: requirement?.assignment_style_consecutive || 1,
    });
  } catch (error) {
    console.error('Error fetching my preferences:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const saveMyPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      preferences,
      requiredWeeks,
      assignmentStyle = 'flexible',
      assignmentStyleConsecutive = 1
    }: SavePreferencesRequest = req.body;

    const userId = (req as AuthRequest).user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const plan = await db.get('SELECT * FROM weekly_plans WHERE id = ?', [id]);
    if (!plan) {
      res.status(404).json({ error: 'Weekly plan not found' });
      return;
    }

    // Validate assignment style consecutive size
    if (assignmentStyleConsecutive < 1 || assignmentStyleConsecutive > 10) {
      res.status(400).json({ error: 'Assignment style consecutive size must be between 1 and 10' });
      return;
    }

    await db.run('BEGIN TRANSACTION');

    try {
      // Delete existing preferences for this user and plan
      await db.run(
        'DELETE FROM weekly_preferences WHERE plan_id = ? AND employee_id = ?',
        [id, userId]
      );

      // Insert new preferences
      for (const pref of preferences) {
        const prefId = uuidv4();
        await db.run(
          `INSERT INTO weekly_preferences (id, employee_id, plan_id, week_id, preference_level, notes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [prefId, userId, id, pref.weekId, pref.preferenceLevel, pref.notes || '']
        );
      }

      // Upsert work requirement with new fields
      await db.run(
        `INSERT INTO weekly_work_requirements (id, employee_id, plan_id, required_weeks, assignment_style, assignment_style_consecutive)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(employee_id, plan_id) DO UPDATE SET 
           required_weeks = ?,
           assignment_style = ?,
           assignment_style_consecutive = ?`,
        [
          uuidv4(),
          userId,
          id,
          requiredWeeks,
          assignmentStyle,
          assignmentStyleConsecutive,
          requiredWeeks,
          assignmentStyle,
          assignmentStyleConsecutive
        ]
      );

      await db.run('COMMIT');

      res.json({ message: 'Preferences saved successfully' });
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error saving preferences:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const saveEmployeePreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      employeeId,
      preferences,
      requiredWeeks,
      assignmentStyle = 'flexible',
      assignmentStyleConsecutive = 1
    }: AdminSavePreferencesRequest = req.body;

    const plan = await db.get('SELECT * FROM weekly_plans WHERE id = ?', [id]);
    if (!plan) {
      res.status(404).json({ error: 'Weekly plan not found' });
      return;
    }

    // Validate assignment style consecutive size
    if (assignmentStyleConsecutive < 1 || assignmentStyleConsecutive > 10) {
      res.status(400).json({ error: 'Assignment style consecutive size must be between 1 and 10' });
      return;
    }

    await db.run('BEGIN TRANSACTION');

    try {
      // Delete existing preferences for this employee and plan
      await db.run(
        'DELETE FROM weekly_preferences WHERE plan_id = ? AND employee_id = ?',
        [id, employeeId]
      );

      // Insert new preferences
      for (const pref of preferences) {
        const prefId = uuidv4();
        await db.run(
          `INSERT INTO weekly_preferences (id, employee_id, plan_id, week_id, preference_level, notes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [prefId, employeeId, id, pref.weekId, pref.preferenceLevel, pref.notes || '']
        );
      }

      // Upsert work requirement with new fields
      await db.run(
        `INSERT INTO weekly_work_requirements (id, employee_id, plan_id, required_weeks, assignment_style, assignment_style_consecutive)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(employee_id, plan_id) DO UPDATE SET 
           required_weeks = ?,
           assignment_style = ?,
           assignment_style_consecutive = ?`,
        [
          uuidv4(),
          employeeId,
          id,
          requiredWeeks,
          assignmentStyle,
          assignmentStyleConsecutive,
          requiredWeeks,
          assignmentStyle,
          assignmentStyleConsecutive
        ]
      );

      await db.run('COMMIT');

      res.json({ message: 'Employee preferences saved successfully' });
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error saving employee preferences:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== Solver & Assignments =====

export const generateAssignments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const plan = await getWeeklyPlanById(id);
    if (!plan) {
      res.status(404).json({ error: 'Weekly plan not found' });
      return;
    }

    // Import and run the weekly scheduling service
    const { WeeklySchedulingService } = await import('../services/WeeklySchedulingService.js');
    const schedulingService = new WeeklySchedulingService();

    const result = await schedulingService.generateOptimalSchedule({
      plan,
      weeks: plan.weeks,
      employees: plan.employees?.map(emp => ({
        id: emp.id,
        firstname: emp.firstname,
        lastname: emp.lastname,
        isTrainee: emp.isTrainee,
        employeeType: emp.employeeType,
      })) || [],
      preferences: plan.employees?.flatMap(emp =>
        emp.preferences.map(p => ({
          id: uuidv4(),
          employeeId: emp.id,
          planId: id,
          weekId: p.weekId,
          preferenceLevel: p.preferenceLevel as 1 | 2 | 3,
          notes: p.notes,
        }))
      ) || [],
      requirements: plan.employees?.map(emp => ({
        id: uuidv4(),
        employeeId: emp.id,
        planId: id,
        requiredWeeks: emp.requiredWeeks,
        assignmentStyle: emp.assignmentStyle,
        assignmentStyleConsecutive: emp.assignmentStyleConsecutive,
      })) || [],
    });

    if (result.success) {
      await db.run('BEGIN TRANSACTION');

      try {
        // Clear existing assignments
        await db.run('DELETE FROM weekly_assignments WHERE plan_id = ?', [id]);

        // Insert new assignments
        for (const assignment of result.assignments) {
          const assignmentId = uuidv4();
          await db.run(
            `INSERT INTO weekly_assignments (id, plan_id, week_id, employee_id, assigned_by)
             VALUES (?, ?, ?, ?, ?)`,
            [assignmentId, id, assignment.weekId, assignment.employeeId, userId]
          );
        }

        await db.run('COMMIT');
      } catch (error) {
        await db.run('ROLLBACK');
        throw error;
      }
    }

    res.json({
      success: result.success,
      assignments: result.assignments,
      violations: result.violations,
      resolutionReport: result.resolutionReport,
      processingTime: result.processingTime,
    });
  } catch (error) {
    console.error('Error generating assignments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createAssignments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { assignments }: CreateAssignmentsRequest = req.body;
    const userId = (req as AuthRequest).user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!assignments || !Array.isArray(assignments)) {
      res.status(400).json({ error: 'Assignments array is required' });
      return;
    }

    // Validate the plan exists
    const plan = await db.get('SELECT * FROM weekly_plans WHERE id = ?', [id]);
    if (!plan) {
      res.status(404).json({ error: 'Weekly plan not found' });
      return;
    }

    // Validate each assignment
    const errors: string[] = [];

    for (const assignment of assignments) {
      // Check week exists in this plan
      const week = await db.get(
        'SELECT * FROM plan_weeks WHERE id = ? AND plan_id = ?',
        [assignment.weekId, id]
      );
      if (!week) {
        errors.push(`Week ${assignment.weekId} not found in plan ${id}`);
        continue;
      }

      // Check employee exists and is active
      const employee = await db.get(
        'SELECT * FROM employees WHERE id = ? AND is_active = 1',
        [assignment.employeeId]
      );
      if (!employee) {
        errors.push(`Employee ${assignment.employeeId} not found or not active`);
        continue;
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
      return;
    }

    await db.run('BEGIN TRANSACTION');

    try {
      // Delete existing assignments for this plan
      await db.run('DELETE FROM weekly_assignments WHERE plan_id = ?', [id]);

      // Insert new assignments
      const insertedAssignments: WeeklyAssignment[] = [];

      for (const assignment of assignments) {
        const assignmentId = uuidv4();
        const assignedAt = new Date().toISOString();

        await db.run(
          `INSERT INTO weekly_assignments (id, plan_id, week_id, employee_id, assigned_at, assigned_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [assignmentId, id, assignment.weekId, assignment.employeeId, assignedAt, userId]
        );

        insertedAssignments.push({
          id: assignmentId,
          planId: id,
          weekId: assignment.weekId,
          employeeId: assignment.employeeId,
          assignedAt,
          assignedBy: userId,
        });
      }

      await db.run('COMMIT');

      res.status(201).json({
        message: 'Assignments created successfully',
        count: insertedAssignments.length,
        assignments: insertedAssignments,
      });
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating assignments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const clearAssignments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const plan = await db.get('SELECT * FROM weekly_plans WHERE id = ?', [id]);
    if (!plan) {
      res.status(404).json({ error: 'Weekly plan not found' });
      return;
    }

    await db.run('DELETE FROM weekly_assignments WHERE plan_id = ?', [id]);
    await db.run('UPDATE weekly_plans SET status = ? WHERE id = ?', ['draft', id]);

    res.json({ message: 'Assignments cleared successfully' });
  } catch (error) {
    console.error('Error clearing assignments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const publishPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const plan = await db.get('SELECT * FROM weekly_plans WHERE id = ?', [id]);
    if (!plan) {
      res.status(404).json({ error: 'Weekly plan not found' });
      return;
    }

    // Check if there are any assignments
    const assignmentCount = await db.get<any>(
      'SELECT COUNT(*) as count FROM weekly_assignments WHERE plan_id = ?',
      [id]
    );

    if (assignmentCount.count === 0) {
      res.status(400).json({ error: 'Cannot publish plan without assignments' });
      return;
    }

    await db.run('UPDATE weekly_plans SET status = ? WHERE id = ?', ['published', id]);

    const updatedPlan = await getWeeklyPlanById(id);
    res.json(updatedPlan);
  } catch (error) {
    console.error('Error publishing plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== Statistics =====

export const getPlanStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const plan = await getWeeklyPlanById(id);

    if (!plan) {
      res.status(404).json({ error: 'Weekly plan not found' });
      return;
    }

    const employees = plan.employees || [];
    const assignmentsCount = employees.reduce((sum, emp) => sum + emp.assignedWeeks.length, 0);
    const totalRequiredWeeks = employees.reduce((sum, emp) => sum + emp.requiredWeeks, 0);

    const assignmentStyles = {
      consecutive: employees.filter(emp => emp.assignmentStyle === 'consecutive').length,
      scattered: employees.filter(emp => emp.assignmentStyle === 'scattered').length,
      flexible: employees.filter(emp => emp.assignmentStyle === 'flexible').length,
    };

    const averageRequiredWeeks = employees.length > 0 ? totalRequiredWeeks / employees.length : 0;
    const coverageRate = plan.weeks.length > 0 ? assignmentsCount / (plan.weeks.length * 2) : 0; // Assuming 2 employees per week as target

    const statistics = {
      totalWeeks: plan.weeks.length,
      totalAssignedWeeks: assignmentsCount,
      totalRequiredWeeks,
      coverageRate: Math.round(coverageRate * 100),
      employeesCount: employees.length,
      employeesWithPreferences: employees.filter(emp => emp.preferences.length > 0).length,
      averageRequiredWeeks: Math.round(averageRequiredWeeks * 10) / 10,
      consecutiveStyleAssignments: assignmentStyles.consecutive,
      scatteredStyleAssignments: assignmentStyles.scattered,
      flexibleStyleAssignments: assignmentStyles.flexible,
      preferencesDistribution: {
        preferred: employees.reduce((sum, emp) => sum + emp.preferences.filter(p => p.preferenceLevel === 1).length, 0),
        available: employees.reduce((sum, emp) => sum + emp.preferences.filter(p => p.preferenceLevel === 2).length, 0),
        unavailable: employees.reduce((sum, emp) => sum + emp.preferences.filter(p => p.preferenceLevel === 3).length, 0),
      },
    };

    res.json(statistics);
  } catch (error) {
    console.error('Error fetching plan statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== Export Functions =====

export const exportWeeklyPlanToExcel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const plan = await getWeeklyPlanById(id);

    if (!plan) {
      res.status(404).json({ error: 'Weekly plan not found' });
      return;
    }

    if (plan.status !== 'published') {
      res.status(400).json({ error: 'Can only export published plans' });
      return;
    }

    // Fetch holidays for the plan date range
    const holidays = await getHolidaysForPlan(plan.startDate, plan.endDate);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Schichtplaner System';
    workbook.created = new Date();

    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } };
    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
    const holidayFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
    const holidayDateFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC107' } };

    const totalAssignments = plan.employees?.reduce((sum, emp) => sum + emp.assignedWeeks.length, 0) || 0;
    const allDays = getAllDaysForCalendar(plan.workDays);

    // ========== Sheet 1: Planübersicht (Enhanced) ==========
    const summarySheet = workbook.addWorksheet('Planübersicht');
    summarySheet.columns = [
      { header: 'Eigenschaft', key: 'property', width: 25 },
      { header: 'Wert', key: 'value', width: 40 }
    ];

    summarySheet.addRows([
      { property: 'Plan Name', value: plan.name },
      { property: 'Beschreibung', value: plan.description || 'Keine' },
      { property: 'Zeitraum', value: `${plan.startDate} bis ${plan.endDate}` },
      { property: 'Arbeitstage', value: getWorkDaysText(plan.workDays) },
      { property: 'Status', value: plan.status },
      { property: 'Erstellt von', value: plan.createdByName || 'Unbekannt' },
      { property: 'Erstellt am', value: formatDateTime(plan.createdAt) },
      { property: 'Anzahl Wochen', value: plan.weeks.length },
      { property: 'Anzahl Mitarbeiter', value: plan.employees?.length || 0 },
      { property: 'Zuweisungen gesamt', value: totalAssignments },
    ]);

    const summaryHeader = summarySheet.getRow(1);
    summaryHeader.font = headerFont;
    summaryHeader.fill = headerFill;

    // ========== Sheet 2: Wochenplan Details (Calendar Layout) ==========
    const calendarSheet = workbook.addWorksheet('Wochenplan Details');

    // Header row: Kalenderwoche | Zeitraum | Day columns (always show all 7 days Mo-Su)
    const calendarHeaderRow = ['Kalenderwoche', 'Zeitraum', ...allDays.map(d => d.nameFull)];
    const calendarHeader = calendarSheet.addRow(calendarHeaderRow);
    calendarHeader.font = headerFont;
    calendarHeader.fill = headerFill;
    calendarHeader.alignment = { horizontal: 'center', vertical: 'middle' };
    calendarHeader.height = 25;

    // Gray out non-work day headers
    allDays.forEach((day, index) => {
      if (!day.isWorkDay) {
        const cell = calendarHeader.getCell(index + 3); // +3 because columns 1 and 2 are KW and Zeitraum
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7F8C8D' } }; // Gray header for non-work days
      }
    });

    // Define border styles
    const thickBorder: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: 'FF2C3E50' } };
    const thinBorder: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FF2C3E50' } };

    // Style header row with thick borders
    calendarHeader.eachCell((cell) => {
      cell.border = { top: thickBorder, bottom: thickBorder, left: thinBorder, right: thinBorder };
    });
    calendarHeader.getCell(1).border = { top: thickBorder, bottom: thickBorder, left: thickBorder, right: thinBorder };
    calendarHeader.getCell(calendarHeaderRow.length).border = { top: thickBorder, bottom: thickBorder, left: thinBorder, right: thickBorder };

    // Add week rows with assigned employees
    plan.weeks.forEach((week, weekIndex) => {
      // Get employees assigned to this week
      const assignedEmployees = plan.employees
        ?.filter(emp => emp.assignedWeeks.includes(week.id))
        .map(emp => `${emp.firstname} ${emp.lastname}${getEmployeeSuffix(emp)}`) || [];

      const assignmentCount = assignedEmployees.length;
      const meetsMinimum = assignmentCount >= week.minEmployees;
      const isLastWeek = weekIndex === plan.weeks.length - 1;

      // First row: Date row (KW and Zeitraum values go here since they'll be merged)
      // Show all 7 days (Mo-Su)
      const dateRowData = [
        `KW ${week.weekNumber}`,
        `${formatDateShort(week.startDate)} - ${formatDateShort(week.endDate)}`,
        ...allDays.map(day => getDateForDayInWeek(week.startDate, day.id))
      ];
      const dateRow = calendarSheet.addRow(dateRowData);
      dateRow.height = 20;

      // Second row: Employee names (only show for work days, empty for non-work days)
      // For full holidays, show holiday info instead of employees
      const employeeNames = assignedEmployees.join('\n') || 'Keine Zuweisung';
      const empRowData = [
        '',
        '',
        ...allDays.map(day => {
          if (!day.isWorkDay) return '';

          const fullDate = getFullDateForDayInWeek(week.startDate, day.id);
          const holiday = getHolidayForDate(fullDate, holidays);

          if (holiday && !holiday.halfDay) {
            // Full holiday - show holiday info instead of employees
            return `Feiertag: ${holiday.name}${holiday.description ? '\n' + holiday.description : ''}`;
          }
          // Half-day or no holiday - show employees as normal
          return employeeNames;
        })
      ];
      const empRow = calendarSheet.addRow(empRowData);
      const maxAssignments = assignedEmployees.length;
      empRow.height = Math.max(30, 15 + (maxAssignments * 15));

      // Merge KW and Zeitraum cells across both rows
      const dateRowNum = dateRow.number;
      calendarSheet.mergeCells(dateRowNum, 1, dateRowNum + 1, 1); // KW column
      calendarSheet.mergeCells(dateRowNum, 2, dateRowNum + 1, 2); // Zeitraum column

      // Style date row
      dateRow.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.font = { bold: true, size: 9 };
        const bottomBorderStyle = thinBorder;

        if (colNumber <= 2) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
          cell.border = { top: thinBorder, bottom: bottomBorderStyle, left: colNumber === 1 ? thickBorder : thinBorder, right: thinBorder };
        } else {
          const dayIndex = colNumber - 3;
          const day = allDays[dayIndex];
          const isWorkDay = day?.isWorkDay ?? true;

          // Check if this day is a holiday
          const fullDate = getFullDateForDayInWeek(week.startDate, day.id);
          const holiday = getHolidayForDate(fullDate, holidays);

          if (holiday) {
            // Holiday: amber/yellow header
            cell.fill = holidayDateFill;
            cell.font = { bold: true, size: 9, color: { argb: 'FF856404' } };
            // Add comment with holiday name
            cell.note = holiday.name + (holiday.halfDay ? ` (${holiday.halfDay === 'morning' ? 'Vormittag' : 'Nachmittag'})` : '');
          } else if (isWorkDay) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3E8ED' } };
          } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0D0D0' } };
            cell.font = { bold: true, size: 9, color: { argb: 'FF999999' } };
          }
          cell.border = { top: thinBorder, bottom: bottomBorderStyle, left: thinBorder, right: colNumber === calendarHeaderRow.length ? thickBorder : thinBorder };
        }
      });

      // Style employee row
      empRow.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        const bottomBorderStyle = isLastWeek ? thickBorder : thinBorder;

        if (colNumber <= 2) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
          cell.border = { top: thinBorder, bottom: bottomBorderStyle, left: colNumber === 1 ? thickBorder : thinBorder, right: thinBorder };
        } else {
          const dayIndex = colNumber - 3;
          const day = allDays[dayIndex];
          const isWorkDay = day?.isWorkDay ?? true;

          // Check if this day is a holiday
          const fullDate = getFullDateForDayInWeek(week.startDate, day.id);
          const holiday = getHolidayForDate(fullDate, holidays);

          if (!isWorkDay) {
            // Non-work day: gray out
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
            cell.font = { color: { argb: 'FF999999' } };
          } else if (holiday) {
            // Holiday: amber/yellow fill
            cell.fill = holidayFill;
            cell.font = { color: { argb: 'FF856404' } };
          } else if (meetsMinimum) {
            // Work day with sufficient coverage
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E8' } };
          } else {
            // Work day with insufficient coverage
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5E8E8' } };
          }
          cell.border = { top: thinBorder, bottom: bottomBorderStyle, left: thinBorder, right: colNumber === calendarHeaderRow.length ? thickBorder : thinBorder };
        }
      });
    });

    // Adjust column widths (always 7 day columns)
    calendarSheet.getColumn(1).width = 12;
    calendarSheet.getColumn(2).width = 16;
    for (let i = 3; i <= 9; i++) { // 7 days: columns 3-9
      calendarSheet.getColumn(i).width = 22;
    }

    // ========== Sheet 3: Mitarbeiter Zuweisungen (Employee × Week Matrix) ==========
    const assignmentsSheet = workbook.addWorksheet('Mitarbeiter Zuweisungen');

    // Header row
    const assignmentsHeaderRow = [
      'Mitarbeiter', 'Typ', 'Trainee', 'Gewünschte Wochen', 'Zuteilungsstil', 'Blockgröße',
      ...plan.weeks.map(w => `KW ${w.weekNumber}`)
    ];
    const assignmentHeader = assignmentsSheet.addRow(assignmentsHeaderRow);
    assignmentHeader.font = headerFont;
    assignmentHeader.fill = headerFill;
    assignmentHeader.alignment = { horizontal: 'center', vertical: 'middle' };

    // Employee rows
    plan.employees?.forEach(emp => {
      const rowData: (string | number)[] = [
        `${emp.firstname} ${emp.lastname}`,
        emp.employeeType === 'manager' ? 'Manager' : 'Personal',
        emp.isTrainee ? 'Ja' : 'Nein',
        emp.requiredWeeks,
        getAssignmentStyleText(emp.assignmentStyle as 'consecutive' | 'scattered' | 'flexible'),
        emp.assignmentStyleConsecutive,
      ];

      plan.weeks.forEach(week => {
        rowData.push(emp.assignedWeeks.includes(week.id) ? '✓' : '');
      });

      const row = assignmentsSheet.addRow(rowData);

      // Style cells
      row.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Trainee text in purple
        if (emp.isTrainee && colNumber === 1) {
          cell.font = { color: { argb: 'FF9B59B6' }, bold: true };
        }

        // Consecutive style in yellow
        if (colNumber === 5 && emp.assignmentStyle === 'consecutive') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
        }

        // Assigned weeks in green with checkmark
        if (colNumber > 6) {
          const weekIndex = colNumber - 7;
          const week = plan.weeks[weekIndex];
          if (week && emp.assignedWeeks.includes(week.id)) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E8' } };
          }
        }
      });
    });

    // Adjust column widths
    assignmentsSheet.getColumn(1).width = 25;
    assignmentsSheet.getColumn(2).width = 12;
    assignmentsSheet.getColumn(3).width = 10;
    assignmentsSheet.getColumn(4).width = 18;
    assignmentsSheet.getColumn(5).width = 15;
    assignmentsSheet.getColumn(6).width = 12;
    for (let i = 7; i <= plan.weeks.length + 6; i++) {
      assignmentsSheet.getColumn(i).width = 10;
    }

    // ========== Sheet 4: Mitarbeiter Details ==========
    const detailsSheet = workbook.addWorksheet('Mitarbeiter Details');

    // Header row
    const detailsHeaderRow = [
      'Name', 'E-Mail', 'Typ', 'Trainee', 'Gewünschte Wochen',
      'Zuteilungsstil', 'Blockgröße', 'Zugewiesene Wochen'
    ];
    const detailsHeader = detailsSheet.addRow(detailsHeaderRow);
    detailsHeader.font = headerFont;
    detailsHeader.fill = headerFill;
    detailsHeader.alignment = { horizontal: 'center', vertical: 'middle' };

    // Employee rows
    plan.employees?.forEach(emp => {
      const rowData = [
        `${emp.firstname} ${emp.lastname}`,
        emp.email,
        emp.employeeType === 'manager' ? 'Manager' : 'Personal',
        emp.isTrainee ? 'Ja' : 'Nein',
        emp.requiredWeeks,
        getAssignmentStyleText(emp.assignmentStyle as 'consecutive' | 'scattered' | 'flexible'),
        emp.assignmentStyleConsecutive,
        getAssignedWeeksText(emp.assignedWeeks, plan.weeks)
      ];

      const row = detailsSheet.addRow(rowData);

      // Style cells
      row.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: colNumber === 8 ? 'left' : 'center', vertical: 'middle' };

        // Trainee name in purple
        if (emp.isTrainee && colNumber === 1) {
          cell.font = { color: { argb: 'FF9B59B6' }, bold: true };
        }
      });
    });

    // Adjust column widths
    detailsSheet.getColumn(1).width = 25;
    detailsSheet.getColumn(2).width = 30;
    detailsSheet.getColumn(3).width = 12;
    detailsSheet.getColumn(4).width = 10;
    detailsSheet.getColumn(5).width = 18;
    detailsSheet.getColumn(6).width = 15;
    detailsSheet.getColumn(7).width = 12;
    detailsSheet.getColumn(8).width = 40;

    // Send file
    const fileName = `Wochenplan_${plan.name}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    res.status(500).json({ error: 'Internal server error during Excel export' });
  }
};

export const exportWeeklyPlanToPDF = async (req: Request, res: Response): Promise<void> => {
  let browser;
  try {
    const { id } = req.params;
    const plan = await getWeeklyPlanById(id);

    if (!plan) {
      res.status(404).json({ error: 'Weekly plan not found' });
      return;
    }

    if (plan.status !== 'published') {
      res.status(400).json({ error: 'Can only export published plans' });
      return;
    }

    // Fetch holidays for the plan date range
    const holidays = await getHolidaysForPlan(plan.startDate, plan.endDate);

    const totalAssignments = plan.employees?.reduce((sum, emp) => sum + emp.assignedWeeks.length, 0) || 0;
    const allDays = getAllDaysForCalendar(plan.workDays);

    // Build calendar table rows (always show all 7 days Mo-Su)
    const calendarRows = plan.weeks.map(week => {
      const assignedEmployees = plan.employees
        ?.filter(emp => emp.assignedWeeks.includes(week.id))
        .map(emp => `${emp.firstname} ${emp.lastname}${getEmployeeSuffix(emp)}`) || [];
      const meetsMinimum = assignedEmployees.length >= week.minEmployees;
      const employeeNames = assignedEmployees.join('<br/>') || '<em>Keine</em>';

      return `
        <tr>
          <td class="kw-cell">KW ${week.weekNumber}</td>
          <td class="period-cell">${formatDateShort(week.startDate)} - ${formatDateShort(week.endDate)}</td>
          ${allDays.map(day => {
            const dayDate = getDateForDayInWeek(week.startDate, day.id);
            const fullDate = getFullDateForDayInWeek(week.startDate, day.id);
            const holiday = getHolidayForDate(fullDate, holidays);

            if (!day.isWorkDay) {
              // Non-work day: grayed out
              return `<td class="non-work-day"><div class="day-date non-work-day-header">${dayDate}</div><div class="day-content non-work-day-content"></div></td>`;
            }
            if (holiday && !holiday.halfDay) {
              // Full holiday - show only holiday info, not employees
              return `<td class="holiday"><div class="day-date holiday-header">${dayDate}</div><div class="day-content holiday-content"><strong>${holiday.name}</strong>${holiday.description ? `<div class="holiday-description">${holiday.description}</div>` : ''}</div></td>`;
            }
            if (holiday) {
              // Half-day holiday: show employees + holiday indicator
              const halfDayClass = ` holiday-half-${holiday.halfDay}`;
              return `<td class="holiday${halfDayClass}"><div class="day-date holiday-header">${dayDate}</div><div class="day-content holiday-content">${employeeNames}<div class="holiday-name">${holiday.name}</div></div></td>`;
            }
            const contentClass = meetsMinimum ? 'coverage-ok' : 'coverage-low';
            return `<td><div class="day-date">${dayDate}</div><div class="day-content ${contentClass}">${employeeNames}</div></td>`;
          }).join('')}
        </tr>
      `;
    }).join('');

    // Build assignment matrix rows
    const assignmentRows = plan.employees?.map(emp => {
      const weekCells = plan.weeks.map(week => {
        const isAssigned = emp.assignedWeeks.includes(week.id);
        return `<td class="${isAssigned ? 'assigned' : ''}">${isAssigned ? '✓' : ''}</td>`;
      }).join('');

      return `
        <tr>
          <td class="name-cell ${emp.isTrainee ? 'trainee' : ''}">${emp.firstname} ${emp.lastname}</td>
          <td>${emp.employeeType === 'manager' ? 'M' : 'P'}</td>
          <td>${emp.isTrainee ? 'Ja' : ''}</td>
          <td>${emp.requiredWeeks}</td>
          <td class="${emp.assignmentStyle === 'consecutive' ? 'consecutive-style' : ''}">${getAssignmentStyleText(emp.assignmentStyle as 'consecutive' | 'scattered' | 'flexible')}</td>
          <td>${emp.assignmentStyleConsecutive}</td>
          ${weekCells}
        </tr>
      `;
    }).join('') || '<tr><td colspan="100%">Keine Mitarbeiter</td></tr>';

    // Build employee details rows
    const detailRows = plan.employees?.map(emp => `
      <tr>
        <td class="name-cell ${emp.isTrainee ? 'trainee' : ''}">${emp.firstname} ${emp.lastname}</td>
        <td>${emp.email}</td>
        <td>${emp.employeeType === 'manager' ? 'Manager' : 'Personal'}</td>
        <td>${emp.isTrainee ? 'Ja' : 'Nein'}</td>
        <td>${emp.requiredWeeks}</td>
        <td>${getAssignmentStyleText(emp.assignmentStyle as 'consecutive' | 'scattered' | 'flexible')}</td>
        <td>${emp.assignmentStyleConsecutive}</td>
        <td class="weeks-cell">${getAssignedWeeksText(emp.assignedWeeks, plan.weeks)}</td>
      </tr>
    `).join('') || '<tr><td colspan="8">Keine Mitarbeiter</td></tr>';

    const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Wochenplan - ${plan.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 9pt;
      color: #2c3e50;
      padding: 15px;
    }
    .header {
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 3px solid #2c3e50;
    }
    h1 { font-size: 20pt; color: #2c3e50; margin-bottom: 5px; }
    h2 { font-size: 13pt; color: #2c3e50; margin: 20px 0 10px 0; padding-bottom: 5px; border-bottom: 2px solid #3498db; }
    .subtitle { font-size: 10pt; color: #7f8c8d; }

    /* Section 1: Info Grid */
    .info-section {
      background: #f8f9fa;
      padding: 12px;
      border-radius: 5px;
      margin-bottom: 20px;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
    }
    .info-item {
      padding: 8px;
      background: white;
      border-radius: 3px;
      border-left: 3px solid #3498db;
    }
    .info-item strong {
      display: block;
      margin-bottom: 3px;
      color: #2c3e50;
      font-size: 8pt;
    }
    .info-item span {
      color: #34495e;
      font-size: 9pt;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 8pt;
    }
    thead { background: #2c3e50; color: white; }
    thead th {
      padding: 8px 4px;
      text-align: center;
      font-weight: 600;
      border: 2px solid #2c3e50;
      font-size: 8pt;
    }
    td {
      padding: 6px 4px;
      border: 1px solid #dee2e6;
      text-align: center;
      vertical-align: top;
    }
    .name-cell { text-align: left; font-weight: 500; }
    .kw-cell { font-weight: bold; background: #f8f9fa; vertical-align: middle; }
    .period-cell { white-space: nowrap; vertical-align: middle; }
    .weeks-cell { text-align: left; }

    /* Calendar table specific styles */
    .calendar-table { border: 2px solid #2c3e50; }
    .calendar-table td { border: 2px solid #2c3e50; padding: 0; }
    .calendar-table .kw-cell, .calendar-table .period-cell { padding: 6px 4px; border: 2px solid #2c3e50; }

    /* Date box styling */
    .day-date {
      background: #e3e8ed;
      font-weight: bold;
      color: #2c3e50;
      padding: 4px 6px;
      text-align: center;
      border-bottom: 2px solid #2c3e50;
      font-size: 9pt;
    }
    .day-content {
      padding: 6px 4px;
      min-height: 30px;
    }

    /* Coverage colors */
    .coverage-ok { background: #E8F5E8; }
    .coverage-low { background: #F5E8E8; }
    .assigned { background: #E8F5E8; font-weight: bold; }
    .consecutive-style { background: #FFF9C4; }
    .trainee { color: #9B59B6; font-weight: bold; }

    /* Non-work day styling */
    .non-work-day { background: #f0f0f0; }
    .non-work-day-header { background: #d0d0d0; color: #999; }
    .non-work-day-content { background: #f0f0f0; color: #999; min-height: 30px; }
    th.non-work-day-th { background: #7F8C8D; }

    /* Holiday styling */
    .holiday { background: #fff3cd; }
    .holiday-header { background: #ffc107; color: #856404; }
    .holiday-content { background: #fff3cd; color: #856404; }
    .holiday-name { font-size: 7pt; font-style: italic; margin-top: 4px; }
    .holiday-description { font-size: 7pt; font-style: italic; margin-top: 2px; }
    .holiday-half-morning .holiday-content { background: linear-gradient(to bottom, #fff3cd 50%, #E8F5E8 50%); }
    .holiday-half-afternoon .holiday-content { background: linear-gradient(to bottom, #E8F5E8 50%, #fff3cd 50%); }
    .amber { background: #fff3cd; border-color: #ffc107; }

    /* Legend */
    .legend {
      margin: 10px 0;
      padding: 8px;
      background: #f8f9fa;
      border-radius: 5px;
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      font-size: 8pt;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .legend-color {
      width: 14px;
      height: 14px;
      border-radius: 2px;
      border: 1px solid #ccc;
    }
    .green { background: #E8F5E8; }
    .red { background: #F5E8E8; }
    .yellow { background: #FFF9C4; }
    .purple { background: white; color: #9B59B6; font-weight: bold; }

    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 8pt;
      color: #95a5a6;
      border-top: 1px solid #ecf0f1;
      padding-top: 8px;
    }

    @media print {
      body { padding: 10px; }
      .page-break { page-break-before: always; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <!-- Section 1: Header + Info -->
  <div class="header">
    <h1>Wochenplan: ${plan.name}</h1>
    <div class="subtitle">Zeitraum: ${plan.startDate} - ${plan.endDate}</div>
  </div>

  <div class="info-section">
    <div class="info-item">
      <strong>Beschreibung</strong>
      <span>${plan.description || 'Keine'}</span>
    </div>
    <div class="info-item">
      <strong>Arbeitstage</strong>
      <span>${getWorkDaysText(plan.workDays)}</span>
    </div>
    <div class="info-item">
      <strong>Erstellt von</strong>
      <span>${plan.createdByName || 'Unbekannt'}</span>
    </div>
    <div class="info-item">
      <strong>Erstellt am</strong>
      <span>${formatDateTime(plan.createdAt)}</span>
    </div>
    <div class="info-item">
      <strong>Anzahl Wochen</strong>
      <span>${plan.weeks.length}</span>
    </div>
    <div class="info-item">
      <strong>Mitarbeiter</strong>
      <span>${plan.employees?.length || 0}</span>
    </div>
    <div class="info-item">
      <strong>Zuweisungen</strong>
      <span>${totalAssignments}</span>
    </div>
  </div>

  <div class="page-break"></div>
  
  <!-- Section 2: Wochenplan Timetable (Calendar Grid) -->
  <h2>Wochenplan Details</h2>
  <table class="calendar-table">
    <thead>
      <tr>
        <th style="width: 60px;">KW</th>
        <th style="width: 100px;">Zeitraum</th>
        ${allDays.map(d => `<th${!d.isWorkDay ? ' class="non-work-day-th"' : ''}>${d.nameFull}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${calendarRows}
    </tbody>
  </table>

  <div class="legend">
    <div class="legend-item">
      <div class="legend-color green"></div>
      <span>Besetzung ausreichend (≥ Min.)</span>
    </div>
    <div class="legend-item">
      <div class="legend-color red"></div>
      <span>Unterbesetzung (< Min.)</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background: #f0f0f0;"></div>
      <span>Kein Arbeitstag</span>
    </div>
    <div class="legend-item">
      <div class="legend-color amber"></div>
      <span>Feiertag</span>
    </div>
    <div class="legend-item">
      <span class="purple">(T)</span>
      <span>Trainee</span>
    </div>
    <div class="legend-item">
      <span class="purple">(M)</span>
      <span>Manager</span>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- Section 3: Mitarbeiter-Zuweisungen (Matrix Table) -->
  <h2>Mitarbeiter Zuweisungen</h2>
  <table>
    <thead>
      <tr>
        <th>Mitarbeiter</th>
        <th>Typ</th>
        <th>Trainee</th>
        <th>Wochen</th>
        <th>Stil</th>
        <th>Block</th>
        ${plan.weeks.map(w => `<th>KW ${w.weekNumber}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${assignmentRows}
    </tbody>
  </table>

  <div class="legend">
    <div class="legend-item">
      <div class="legend-color green"></div>
      <span>Zugewiesen (✓)</span>
    </div>
    <div class="legend-item">
      <div class="legend-color yellow"></div>
      <span>Konsekutiv-Stil</span>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- Section 4: Mitarbeiter Details -->
  <h2>Mitarbeiter Details</h2>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>E-Mail</th>
        <th>Typ</th>
        <th>Trainee</th>
        <th>Wochen</th>
        <th>Stil</th>
        <th>Block</th>
        <th>Zugewiesene Wochen</th>
      </tr>
    </thead>
    <tbody>
      ${detailRows}
    </tbody>
  </table>

  <div class="footer">
    Erstellt am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} mit Schichtplaner System
  </div>
</body>
</html>
    `;

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(html, { waitUntil: 'networkidle' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    });

    await browser.close();

    const fileName = `Wochenplan_${plan.name}_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    if (browser) await browser.close();
    res.status(500).json({ error: 'Internal server error during PDF export' });
  }
};