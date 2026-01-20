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
  WeeklyPlanWithDetails,
  PlanWeek,
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

  // Get requirements for all employees
  const allRequirements = await db.all<any>(`
    SELECT employee_id, required_weeks
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
  const employeesWithPreferences = employees.map((emp: any) => {
    const empPreferences = allPreferences
      .filter((p: any) => p.employee_id === emp.id)
      .map((p: any) => ({
        weekId: p.week_id,
        preferenceLevel: p.preference_level,
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
      assignedWeeks,
    };
  });

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

    // Get week counts for each plan
    const plansWithCounts = await Promise.all(
      plans.map(async (plan: any) => {
        const weekCount = await db.get<any>(
          'SELECT COUNT(*) as count FROM plan_weeks WHERE plan_id = ?',
          [plan.id]
        );
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
      SELECT required_weeks
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
    });
  } catch (error) {
    console.error('Error fetching my preferences:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const saveMyPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { preferences, requiredWeeks }: SavePreferencesRequest = req.body;
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

      // Upsert work requirement
      await db.run(
        `INSERT INTO weekly_work_requirements (id, employee_id, plan_id, required_weeks)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(employee_id, plan_id) DO UPDATE SET required_weeks = ?`,
        [uuidv4(), userId, id, requiredWeeks, requiredWeeks]
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
    const { employeeId, preferences, requiredWeeks }: AdminSavePreferencesRequest = req.body;

    const plan = await db.get('SELECT * FROM weekly_plans WHERE id = ?', [id]);
    if (!plan) {
      res.status(404).json({ error: 'Weekly plan not found' });
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

      // Upsert work requirement
      await db.run(
        `INSERT INTO weekly_work_requirements (id, employee_id, plan_id, required_weeks)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(employee_id, plan_id) DO UPDATE SET required_weeks = ?`,
        [uuidv4(), employeeId, id, requiredWeeks, requiredWeeks]
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
    ]);

    const header = summarySheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };

    // Assignments sheet
    const assignmentsSheet = workbook.addWorksheet('Wochenzuweisungen');

    // Header row: Week columns
    const headerRow = ['Mitarbeiter', 'Gewünschte Wochen', ...plan.weeks.map(w => `KW ${w.weekNumber}`)];
    const assignmentHeader = assignmentsSheet.addRow(headerRow);
    assignmentHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    assignmentHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };

    // Employee rows with assignments
    plan.employees?.forEach(emp => {
      const rowData: any[] = [
        `${emp.firstname} ${emp.lastname}${emp.isTrainee ? ' (T)' : ''}`,
        emp.requiredWeeks,
      ];

      plan.weeks.forEach(week => {
        const isAssigned = emp.assignedWeeks.includes(week.id);
        rowData.push(isAssigned ? '✓' : '');
      });

      const row = assignmentsSheet.addRow(rowData);

      // Color assigned cells
      plan.weeks.forEach((week, idx) => {
        const cell = row.getCell(idx + 3);
        if (emp.assignedWeeks.includes(week.id)) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90EE90' } };
          cell.alignment = { horizontal: 'center' };
        }
      });
    });

    // Adjust column widths
    assignmentsSheet.getColumn(1).width = 25;
    assignmentsSheet.getColumn(2).width = 18;
    for (let i = 3; i <= plan.weeks.length + 2; i++) {
      assignmentsSheet.getColumn(i).width = 12;
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
    }
    .info-section h2 {
      font-size: 14pt;
      margin-bottom: 12px;
      color: #34495e;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
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
    .assigned { background: #90EE90; }
    .trainee { color: #CDA8F0; font-weight: bold; }
    .legend {
      margin-top: 15px;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 5px;
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
    <p><strong>Beschreibung:</strong> ${plan.description || 'Keine'}</p>
    <p><strong>Status:</strong> ${plan.status}</p>
    <p><strong>Erstellt von:</strong> ${plan.createdByName || 'Unbekannt'}</p>
    <p><strong>Anzahl Wochen:</strong> ${plan.weeks.length}</p>
  </div>

  <h2>Wochenzuweisungen</h2>
  <table>
    <thead>
      <tr>
        <th>Mitarbeiter</th>
        <th>Wochen</th>
        ${plan.weeks.map(w => `<th>KW ${w.weekNumber}<br/>${formatDate(w.startDate)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${plan.employees?.map(emp => `
        <tr>
          <td style="text-align: left;" class="${emp.isTrainee ? 'trainee' : ''}">${emp.firstname} ${emp.lastname}${emp.isTrainee ? ' (T)' : ''}</td>
          <td>${emp.requiredWeeks}</td>
          ${plan.weeks.map(week => `
            <td class="${emp.assignedWeeks.includes(week.id) ? 'assigned' : ''}">${emp.assignedWeeks.includes(week.id) ? '✓' : ''}</td>
          `).join('')}
        </tr>
      `).join('') || '<tr><td colspan="100%">Keine Mitarbeiter</td></tr>'}
    </tbody>
  </table>

  <div class="legend">
    <strong>Legende:</strong> ✓ = Zugewiesen, (T) = Trainee
  </div>
</body>
</html>
    `;

    function formatDate(dateStr: string): string {
      const date = new Date(dateStr);
      return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    }

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(html, { waitUntil: 'networkidle' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: plan.weeks.length > 6,
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
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
