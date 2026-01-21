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
} from '../models/WeeklyPlan.js';
import { AuthRequest } from '../middleware/auth.js';
import ExcelJS from 'exceljs';
import { chromium } from 'playwright-chromium';

// Helper function to generate weeks from date range
function generateWeeksFromDateRange(startDate: string, endDate: string): Omit<PlanWeek, 'id' | 'planId'>[] {
  const weeks: Omit<PlanWeek, 'id' | 'planId'>[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Adjust to Monday of the week containing start date
  const dayOfWeek = start.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  start.setDate(start.getDate() + mondayOffset);

  let weekNumber = 1;
  let currentWeekStart = new Date(start);

  while (currentWeekStart <= end) {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6);

    weeks.push({
      weekNumber,
      startDate: currentWeekStart.toISOString().split('T')[0],
      endDate: weekEnd.toISOString().split('T')[0],
      minEmployees: 2,
      maxEmployees: 3,
    });

    weekNumber++;
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }

  return weeks;
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
      assignmentStyle: requirement?.assignment_style || 'scattered',
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
    const { name, description, startDate, endDate }: CreateWeeklyPlanRequest = req.body;
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

    await db.run('BEGIN TRANSACTION');

    try {
      // Create the plan
      await db.run(
        `INSERT INTO weekly_plans (id, name, description, start_date, end_date, status, created_by)
         VALUES (?, ?, ?, ?, ?, 'draft', ?)`,
        [planId, name, description || '', startDate, endDate, userId]
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
    const { name, description, status }: UpdateWeeklyPlanRequest = req.body;

    const existingPlan = await db.get('SELECT * FROM weekly_plans WHERE id = ?', [id]);
    if (!existingPlan) {
      res.status(404).json({ error: 'Weekly plan not found' });
      return;
    }

    await db.run(
      `UPDATE weekly_plans
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           status = COALESCE(?, status)
       WHERE id = ?`,
      [name, description, status, id]
    );

    const updatedPlan = await getWeeklyPlanById(id);
    res.json(updatedPlan);
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
        assignmentStyle || 'scattered',
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
      assignmentStyle: requirement?.assignment_style || 'scattered',
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
      assignmentStyle = 'scattered',
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
      assignmentStyle = 'scattered',
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

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Schichtplaner System';
    workbook.created = new Date();

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Planübersicht');
    summarySheet.columns = [
      { header: 'Eigenschaft', key: 'property', width: 25 },
      { header: 'Wert', key: 'value', width: 35 }
    ];

    summarySheet.addRows([
      { property: 'Plan Name', value: plan.name },
      { property: 'Beschreibung', value: plan.description || 'Keine' },
      { property: 'Zeitraum', value: `${plan.startDate} bis ${plan.endDate}` },
      { property: 'Status', value: plan.status },
      { property: 'Erstellt von', value: plan.createdByName || 'Unbekannt' },
      { property: 'Anzahl Wochen', value: plan.weeks.length },
      { property: 'Anzahl Mitarbeiter', value: plan.employees?.length || 0 },
    ]);

    const header = summarySheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };

    // Assignments sheet
    const assignmentsSheet = workbook.addWorksheet('Wochenzuweisungen');

    // Header row: Week columns
    const headerRow = ['Mitarbeiter', 'Gewünschte Wochen', 'Zuteilungsstil', 'Blockgröße', ...plan.weeks.map(w => `KW ${w.weekNumber}`)];
    const assignmentHeader = assignmentsSheet.addRow(headerRow);
    assignmentHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    assignmentHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };

    // Employee rows with assignments
    plan.employees?.forEach(emp => {
      const rowData: any[] = [
        `${emp.firstname} ${emp.lastname}${emp.isTrainee ? ' (T)' : ''}`,
        emp.requiredWeeks,
        emp.assignmentStyle === 'consecutive' ? 'Konsekutiv' : 'Verteilt',
        emp.assignmentStyleConsecutive,
      ];

      plan.weeks.forEach(week => {
        const isAssigned = emp.assignedWeeks.includes(week.id);
        rowData.push(isAssigned ? '✓' : '');
      });

      const row = assignmentsSheet.addRow(rowData);

      // Color assigned cells
      plan.weeks.forEach((week, idx) => {
        const cell = row.getCell(idx + 5); // +5 because we have 4 columns before weeks
        if (emp.assignedWeeks.includes(week.id)) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90EE90' } };
          cell.alignment = { horizontal: 'center' };
        }
      });

      // Color consecutive style employees differently
      const styleCell = row.getCell(3);
      if (emp.assignmentStyle === 'consecutive') {
        styleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0E68C' } };
        styleCell.alignment = { horizontal: 'center' };
      }
    });

    // Adjust column widths
    assignmentsSheet.getColumn(1).width = 25;
    assignmentsSheet.getColumn(2).width = 18;
    assignmentsSheet.getColumn(3).width = 15;
    assignmentsSheet.getColumn(4).width = 12;
    for (let i = 5; i <= plan.weeks.length + 4; i++) {
      assignmentsSheet.getColumn(i).width = 12;
    }

    // Preferences sheet
    const preferencesSheet = workbook.addWorksheet('Präferenzen');
    const prefHeaderRow = ['Mitarbeiter', ...plan.weeks.map(w => `KW ${w.weekNumber}`)];
    const prefHeader = preferencesSheet.addRow(prefHeaderRow);
    prefHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    prefHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };

    plan.employees?.forEach(emp => {
      const rowData: any[] = [`${emp.firstname} ${emp.lastname}`];

      plan.weeks.forEach(week => {
        const preference = emp.preferences.find(p => p.weekId === week.id);
        let value = '';
        let color = '';

        if (preference) {
          switch (preference.preferenceLevel) {
            case 1: value = '✓'; color = 'FF90EE90'; break; // Green for preferred
            case 2: value = '○'; color = 'FFFFFF99'; break; // Yellow for available
            case 3: value = '✗'; color = 'FFFF9999'; break; // Red for unavailable
          }
        }
        rowData.push(value);

        const row = preferencesSheet.getRow(preferencesSheet.rowCount);
        const cell = row.getCell(rowData.length);
        if (color) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
        }
        cell.alignment = { horizontal: 'center' };
      });

      preferencesSheet.addRow(rowData);
    });

    // Adjust column widths for preferences sheet
    preferencesSheet.getColumn(1).width = 25;
    for (let i = 2; i <= plan.weeks.length + 1; i++) {
      preferencesSheet.getColumn(i).width = 12;
    }

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
      font-size: 10pt;
      color: #2c3e50;
      padding: 20px;
    }
    .header {
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #2c3e50;
    }
    h1 { font-size: 24pt; color: #2c3e50; margin-bottom: 10px; }
    .subtitle { font-size: 11pt; color: #7f8c8d; }
    .info-section {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 30px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 15px;
    }
    .info-item {
      padding: 10px;
      background: white;
      border-radius: 3px;
      border-left: 4px solid #3498db;
    }
    .info-item strong {
      display: block;
      margin-bottom: 5px;
      color: #2c3e50;
    }
    .info-item span {
      color: #34495e;
    }
    .info-section h2 {
      font-size: 14pt;
      margin-bottom: 12px;
      color: #34495e;
      grid-column: 1 / -1;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    thead { background: #2c3e50; color: white; }
    thead th {
      padding: 12px 8px;
      text-align: center;
      font-weight: 600;
      border: 1px solid #2c3e50;
    }
    td {
      padding: 10px 8px;
      border: 1px solid #dee2e6;
      text-align: center;
    }
    .assigned { background: #90EE90 !important; }
    .block-style { background: #F0E68C !important; }
    .trainee { color: #CDA8F0; font-weight: bold; }
    .legend {
      margin-top: 15px;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 5px;
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .legend-color {
      width: 20px;
      height: 20px;
      border-radius: 3px;
    }
    .green { background: #90EE90; }
    .yellow { background: #F0E68C; }
    .red { background: #FF9999; }
    .pref-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    .employee-card {
      border: 1px solid #dee2e6;
      border-radius: 5px;
      padding: 15px;
      background: #f8f9fa;
    }
    .employee-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid #dee2e6;
    }
    .employee-name {
      font-weight: bold;
      font-size: 11pt;
    }
    .employee-details {
      display: flex;
      gap: 15px;
      font-size: 9pt;
      color: #7f8c8d;
    }
    .preferences-list {
      list-style: none;
    }
    .preference-item {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      border-bottom: 1px dotted #dee2e6;
    }
    .preference-week {
      font-weight: 500;
    }
    .preference-level-1 { color: #27ae60; }
    .preference-level-2 { color: #f39c12; }
    .preference-level-3 { color: #e74c3c; }
    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 9pt;
      color: #95a5a6;
      border-top: 1px solid #ecf0f1;
      padding-top: 10px;
    }
    @media print {
      body { padding: 10px; }
      .legend { break-inside: avoid; }
      table { break-inside: avoid; }
      .pref-grid { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Wochenplan: ${plan.name}</h1>
    <div class="subtitle">Zeitraum: ${plan.startDate} - ${plan.endDate}</div>
  </div>

  <div class="info-section">
    <h2>Plan Informationen</h2>
    <div class="info-item">
      <strong>Beschreibung:</strong>
      <span>${plan.description || 'Keine'}</span>
    </div>
    <div class="info-item">
      <strong>Status:</strong>
      <span>${plan.status}</span>
    </div>
    <div class="info-item">
      <strong>Erstellt von:</strong>
      <span>${plan.createdByName || 'Unbekannt'}</span>
    </div>
    <div class="info-item">
      <strong>Anzahl Wochen:</strong>
      <span>${plan.weeks.length}</span>
    </div>
    <div class="info-item">
      <strong>Anzahl Mitarbeiter:</strong>
      <span>${plan.employees?.length || 0}</span>
    </div>
    <div class="info-item">
      <strong>Gesamte Zuweisungen:</strong>
      <span>${plan.employees?.reduce((sum, emp) => sum + emp.assignedWeeks.length, 0) || 0}</span>
    </div>
  </div>

  <h2>Wochenzuweisungen</h2>
  <table>
    <thead>
      <tr>
        <th>Mitarbeiter</th>
        <th>Wochen</th>
        <th>Stil</th>
        <th>Block</th>
        ${plan.weeks.map(w => `<th>KW ${w.weekNumber}<br/>${formatDate(w.startDate)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${plan.employees?.map(emp => `
        <tr>
          <td style="text-align: left;" class="${emp.isTrainee ? 'trainee' : ''}">
            ${emp.firstname} ${emp.lastname}${emp.isTrainee ? ' (T)' : ''}
          </td>
          <td>${emp.requiredWeeks}</td>
          <td class="${emp.assignmentStyle === 'consecutive' ? 'consecutive-style' : ''}">
            ${emp.assignmentStyle === 'consecutive' ? 'Konsekutiv' : 'Verteilt'}
          </td>
          <td>${emp.assignmentStyleConsecutive}</td>
          ${plan.weeks.map(week => `
            <td class="${emp.assignedWeeks.includes(week.id) ? 'assigned' : ''}">
              ${emp.assignedWeeks.includes(week.id) ? '✓' : ''}
            </td>
          `).join('')}
        </tr>
      `).join('') || '<tr><td colspan="100%">Keine Mitarbeiter</td></tr>'}
    </tbody>
  </table>

  <div class="legend">
    <div class="legend-item">
      <div class="legend-color green"></div>
      <span>Zugewiesene Wochen</span>
    </div>
    <div class="legend-item">
      <div class="legend-color yellow"></div>
      <span>Block-Zuteilung</span>
    </div>
    <div class="legend-item">
      <div class="legend-color"></div>
      <span>(T) = Trainee</span>
    </div>
  </div>

  <h2>Präferenzen der Mitarbeiter</h2>
  <div class="pref-grid">
    ${plan.employees?.map(emp => `
      <div class="employee-card">
        <div class="employee-header">
          <div class="employee-name">
            ${emp.firstname} ${emp.lastname}${emp.isTrainee ? ' (T)' : ''}
          </div>
          <div class="employee-details">
            <span>${emp.requiredWeeks} Wochen</span>
            <span>${emp.assignmentStyle === 'consecutive' ? 'Konsekutiv' : 'Verteilt'}</span>
            <span>${emp.assignedWeeks.length} zugewiesen</span>
          </div>
        </div>
        <ul class="preferences-list">
          ${emp.preferences.map(pref => {
      const week = plan.weeks.find(w => w.id === pref.weekId);
      return `
            <li class="preference-item">
              <span class="preference-week">KW ${week?.weekNumber || '?'}: ${week?.startDate || ''}</span>
              <span class="preference-level-${pref.preferenceLevel}">
                ${getPreferenceLabel(pref.preferenceLevel)}
              </span>
            </li>
          `}).join('')}
          ${emp.preferences.length === 0 ? '<li>Keine Präferenzen eingetragen</li>' : ''}
        </ul>
      </div>
    `).join('') || '<p>Keine Mitarbeiter</p>'}
  </div>

  <div class="legend">
    <div class="legend-item">
      <div class="legend-color green"></div>
      <span>Bevorzugt (✓)</span>
    </div>
    <div class="legend-item">
      <div class="legend-color yellow"></div>
      <span>Verfügbar (○)</span>
    </div>
    <div class="legend-item">
      <div class="legend-color red"></div>
      <span>Nicht verfügbar (✗)</span>
    </div>
  </div>

  <div class="footer">
    Erstellt am ${new Date().toLocaleDateString('de-DE')} mit Schichtplaner System
  </div>
</body>
</html>
    `;

    function formatDate(dateStr: string): string {
      const date = new Date(dateStr);
      return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    }

    function getPreferenceLabel(level: number): string {
      switch (level) {
        case 1: return '✓ Bevorzugt';
        case 2: return '○ Verfügbar';
        case 3: return '✗ Nicht verfügbar';
        default: return '';
      }
    }

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(html, { waitUntil: 'networkidle' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: plan.weeks.length > 4,
      printBackground: true,
      margin: { top: '15mm', right: '10mm', bottom: '15mm', left: '10mm' },
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