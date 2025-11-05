// backend/src/controllers/shiftPlanController.ts
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/databaseService.js';
import {
  CreateShiftPlanRequest,
  UpdateShiftPlanRequest,
} from '../models/ShiftPlan.js';
import { AuthRequest } from '../middleware/auth.js';
import { TEMPLATE_PRESETS } from '../models/defaults/shiftPlanDefaults.js';
import ExcelJS from 'exceljs';
import { chromium } from 'playwright';

async function getPlanWithDetails(planId: string) {
  const plan = await db.get<any>(`
    SELECT sp.*, e.firstname || ' ' || e.lastname as created_by_name 
    FROM shift_plans sp
    LEFT JOIN employees e ON sp.created_by = e.id
    WHERE sp.id = ?
  `, [planId]);

  if (!plan) return null;

  const [timeSlots, shifts] = await Promise.all([
    db.all<any>(`SELECT * FROM time_slots WHERE plan_id = ? ORDER BY start_time`, [planId]),
    db.all<any>(`
      SELECT s.*, ts.name as time_slot_name, ts.start_time, ts.end_time
      FROM shifts s
      LEFT JOIN time_slots ts ON s.time_slot_id = ts.id
      WHERE s.plan_id = ? 
      ORDER BY s.day_of_week, ts.start_time
    `, [planId])
  ]);

  return {
    plan: {
      ...plan,
      isTemplate: plan.is_template === 1,
      startDate: plan.start_date,
      endDate: plan.end_date,
      createdBy: plan.created_by,
      createdAt: plan.created_at,
    },
    timeSlots: timeSlots.map(slot => ({
      id: slot.id,
      planId: slot.plan_id,
      name: slot.name,
      startTime: slot.start_time,
      endTime: slot.end_time,
      description: slot.description
    })),
    shifts: shifts.map(shift => ({
      id: shift.id,
      planId: shift.plan_id,
      timeSlotId: shift.time_slot_id,
      dayOfWeek: shift.day_of_week,
      requiredEmployees: shift.required_employees,
      color: shift.color,
      timeSlot: {
        id: shift.time_slot_id,
        name: shift.time_slot_name,
        startTime: shift.start_time,
        endTime: shift.end_time
      }
    }))
  };
}

// Simplified getShiftPlans using shared helper
export const getShiftPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const plans = await db.all<any>(`
      SELECT sp.*, e.firstname || ' ' || e.lastname as created_by_name 
      FROM shift_plans sp
      LEFT JOIN employees e ON sp.created_by = e.id
      ORDER BY sp.created_at DESC
    `);

    const plansWithDetails = await Promise.all(
      plans.map(async (plan) => {
        const details = await getPlanWithDetails(plan.id);
        return details ? { ...details.plan, timeSlots: details.timeSlots, shifts: details.shifts } : null;
      })
    );

    res.json(plansWithDetails.filter(Boolean));
  } catch (error) {
    console.error('Error fetching shift plans:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getShiftPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const plan = await db.get<any>(`
      SELECT sp.*, e.firstname || ' ' || e.lastname as created_by_name 
      FROM shift_plans sp
      LEFT JOIN employees e ON sp.created_by = e.id
      WHERE sp.id = ?
    `, [id]);

    if (!plan) {
      res.status(404).json({ error: 'Shift plan not found' });
      return;
    }

    // Lade Zeit-Slots
    const timeSlots = await db.all<any>(`
      SELECT * FROM time_slots 
      WHERE plan_id = ? 
      ORDER BY start_time
    `, [id]);

    // Lade Schichten
    const shifts = await db.all<any>(`
      SELECT s.*, ts.name as time_slot_name, ts.start_time, ts.end_time
      FROM shifts s
      LEFT JOIN time_slots ts ON s.time_slot_id = ts.id
      WHERE s.plan_id = ? 
      ORDER BY s.day_of_week, ts.start_time
    `, [id]);

    // Lade geplante Schichten (nur für nicht-Template Pläne)
    let scheduledShifts = [];
    if (!plan.is_template) {
      scheduledShifts = await db.all<any>(`
        SELECT ss.*, ts.name as time_slot_name
        FROM scheduled_shifts ss
        LEFT JOIN time_slots ts ON ss.time_slot_id = ts.id
        WHERE ss.plan_id = ? 
        ORDER BY ss.date, ts.start_time
      `, [id]);
    }

    const planWithData = {
      ...plan,
      isTemplate: plan.is_template === 1,
      startDate: plan.start_date,
      endDate: plan.end_date,
      createdBy: plan.created_by,
      createdAt: plan.created_at,
      timeSlots: timeSlots.map(slot => ({
        id: slot.id,
        planId: slot.plan_id,
        name: slot.name,
        startTime: slot.start_time,
        endTime: slot.end_time,
        description: slot.description
      })),
      shifts: shifts.map(shift => ({
        id: shift.id,
        planId: shift.plan_id,
        timeSlotId: shift.time_slot_id,
        dayOfWeek: shift.day_of_week,
        requiredEmployees: shift.required_employees,
        color: shift.color,
        timeSlot: {
          id: shift.time_slot_id,
          name: shift.time_slot_name,
          startTime: shift.start_time,
          endTime: shift.end_time
        }
      })),
      scheduledShifts: scheduledShifts.map(shift => ({
        id: shift.id,
        planId: shift.plan_id,
        date: shift.date,
        timeSlotId: shift.time_slot_id,
        requiredEmployees: shift.required_employees,
        assignedEmployees: JSON.parse(shift.assigned_employees || '[]'),
        timeSlotName: shift.time_slot_name
      }))
    };

    res.json(planWithData);
  } catch (error) {
    console.error('Error fetching shift plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createDefaultTemplate = async (userId: string): Promise<string> => {
  try {
    const planId = uuidv4();

    await db.run('BEGIN TRANSACTION');

    try {
      // Erstelle den Standard-Plan (als Template)
      await db.run(
        `INSERT INTO shift_plans (id, name, description, is_template, status, created_by) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [planId, 'Standardwoche', 'Standard Vorlage mit konfigurierten Zeit-Slots', true, 'template', userId]
      );

      // Füge Zeit-Slots hinzu
      const timeSlots = [
        { id: uuidv4(), name: 'Vormittag', startTime: '08:00', endTime: '12:00', description: 'Vormittagsschicht' },
        { id: uuidv4(), name: 'Nachmittag', startTime: '11:30', endTime: '15:30', description: 'Nachmittagsschicht' }
      ];

      for (const slot of timeSlots) {
        await db.run(
          `INSERT INTO time_slots (id, plan_id, name, start_time, end_time, description) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [slot.id, planId, slot.name, slot.startTime, slot.endTime, slot.description]
        );
      }

      // Erstelle Schichten für Mo-Do mit Zeit-Slot Referenzen
      for (let day = 1; day <= 4; day++) {
        // Vormittagsschicht
        await db.run(
          `INSERT INTO shifts (id, plan_id, day_of_week, time_slot_id, required_employees, color) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), planId, day, timeSlots[0].id, 2, '#3498db']
        );

        // Nachmittagsschicht
        await db.run(
          `INSERT INTO shifts (id, plan_id, day_of_week, time_slot_id, required_employees, color) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), planId, day, timeSlots[1].id, 2, '#e74c3c']
        );
      }

      // Freitag nur Vormittagsschicht
      await db.run(
        `INSERT INTO shifts (id, plan_id, day_of_week, time_slot_id, required_employees, color) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), planId, 5, timeSlots[0].id, 2, '#3498db']
      );

      await db.run('COMMIT');
      return planId;
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating default template:', error);
    throw error;
  }
};

export const createShiftPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, startDate, endDate, isTemplate, timeSlots, shifts }: CreateShiftPlanRequest = req.body;
    const userId = (req as AuthRequest).user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const planId = uuidv4();
    const status = isTemplate ? 'template' : 'draft';

    // Start transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // Insert plan
      await db.run(
        `INSERT INTO shift_plans (id, name, description, start_date, end_date, is_template, status, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [planId, name, description, startDate, endDate, isTemplate ? 1 : 0, status, userId]
      );

      // Create mapping for time slot IDs
      const timeSlotIdMap = new Map<string, string>();

      // Insert time slots - always generate new IDs
      for (const timeSlot of timeSlots) {
        const timeSlotId = uuidv4();
        await db.run(
          `INSERT INTO time_slots (id, plan_id, name, start_time, end_time, description) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [timeSlotId, planId, timeSlot.name, timeSlot.startTime, timeSlot.endTime, timeSlot.description || '']
        );

        // Store the mapping if the timeSlot had a temporary ID
        if ((timeSlot as any).id) {
          timeSlotIdMap.set((timeSlot as any).id, timeSlotId);
        }
      }

      // Insert shifts - update timeSlotId using the mapping if needed
      for (const shift of shifts) {
        const shiftId = uuidv4();
        let finalTimeSlotId = shift.timeSlotId;

        // If timeSlotId exists in mapping, use the new ID
        if (timeSlotIdMap.has(shift.timeSlotId)) {
          finalTimeSlotId = timeSlotIdMap.get(shift.timeSlotId)!;
        }

        await db.run(
          `INSERT INTO shifts (id, plan_id, day_of_week, time_slot_id, required_employees, color) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [shiftId, planId, shift.dayOfWeek, finalTimeSlotId, shift.requiredEmployees, shift.color || '#3498db']
        );
      }

      // If this is not a template, generate scheduled shifts
      if (!isTemplate && startDate && endDate) {
        await generateScheduledShifts(planId, startDate, endDate);
      }

      await db.run('COMMIT');

      // Return created plan
      const createdPlan = await getShiftPlanById(planId);
      res.status(201).json(createdPlan);

    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error creating shift plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createFromPreset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { presetName, name, startDate, endDate, isTemplate } = req.body;
    const userId = (req as AuthRequest).user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    console.log(`🔍 Received preset request:`, { presetName, name, startDate, endDate, isTemplate });

    // Debug: Log available presets
    console.log(`🔍 Available presets:`, Object.keys(TEMPLATE_PRESETS));

    if (!TEMPLATE_PRESETS[presetName as keyof typeof TEMPLATE_PRESETS]) {
      console.log(`❌ Invalid preset name: ${presetName}`);
      console.log(`✅ Valid presets: ${Object.keys(TEMPLATE_PRESETS).join(', ')}`);
      res.status(400).json({ error: 'Invalid preset name' });
      return;
    }

    const preset = TEMPLATE_PRESETS[presetName as keyof typeof TEMPLATE_PRESETS];
    console.log(`✅ Using preset:`, preset.name);

    const planId = uuidv4();
    const status = isTemplate ? 'template' : 'draft';

    await db.run('BEGIN TRANSACTION');

    try {
      // Insert plan
      await db.run(
        `INSERT INTO shift_plans (id, name, description, start_date, end_date, is_template, status, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [planId, name || preset.name, preset.description, startDate, endDate, isTemplate ? 1 : 0, status, userId]
      );

      // Create mapping from time slot names/IDs to database timeSlotId
      const timeSlotMap = new Map<string, string>();

      // Insert time slots and create mapping
      for (const timeSlot of preset.timeSlots) {
        const timeSlotId = uuidv4();

        await db.run(
          `INSERT INTO time_slots (id, plan_id, name, start_time, end_time, description) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [timeSlotId, planId, timeSlot.name, timeSlot.startTime, timeSlot.endTime, timeSlot.description || '']
        );

        // Store mapping using the time slot name as key
        // Both the original timeSlotId (if exists) and the name should work
        if ((timeSlot as any).timeSlotId) {
          timeSlotMap.set((timeSlot as any).timeSlotId, timeSlotId);
        }
        timeSlotMap.set(timeSlot.name, timeSlotId);

        console.log(`✅ Created time slot: ${timeSlot.name} -> ${timeSlotId}`);
      }

      console.log(`🔍 Time slot mapping:`, Array.from(timeSlotMap.entries()));

      // Insert shifts using the mapping
      let shiftCount = 0;
      for (const shift of preset.shifts) {
        const shiftId = uuidv4();

        // Try to find the timeSlotId using different strategies
        let timeSlotId = timeSlotMap.get(shift.timeSlotId);

        if (!timeSlotId) {
          // Fallback: try to find by name or other properties
          console.warn(`⚠️ Time slot not found by ID: ${shift.timeSlotId}, trying fallback...`);

          // Look for time slot by name or other matching logic
          for (const [key, value] of timeSlotMap.entries()) {
            if (key.includes(shift.timeSlotId) || shift.timeSlotId.includes(key)) {
              timeSlotId = value;
              console.log(`✅ Found time slot via fallback: ${shift.timeSlotId} -> ${key} -> ${timeSlotId}`);
              break;
            }
          }
        }

        if (!timeSlotId) {
          console.error(`❌ Could not find time slot for shift:`, shift);
          // Use first time slot as fallback
          timeSlotId = Array.from(timeSlotMap.values())[0];
          console.log(`🔄 Using first time slot as fallback: ${timeSlotId}`);
        }

        await db.run(
          `INSERT INTO shifts (id, plan_id, day_of_week, time_slot_id, required_employees, color) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [shiftId, planId, shift.dayOfWeek, timeSlotId, shift.requiredEmployees, shift.color || '#3498db']
        );

        shiftCount++;
        console.log(`✅ Created shift ${shiftCount}: day ${shift.dayOfWeek}, timeSlot ${timeSlotId}`);
      }

      // If this is not a template, generate scheduled shifts
      if (!isTemplate && startDate && endDate) {
        console.log(`🔄 Generating scheduled shifts...`);
        await generateScheduledShifts(planId, startDate, endDate);
      }

      await db.run('COMMIT');

      console.log(`✅ Successfully created plan from preset: ${planId}`);

      // Return created plan
      const createdPlan = await getShiftPlanById(planId);
      res.status(201).json(createdPlan);

    } catch (error) {
      await db.run('ROLLBACK');
      console.error('❌ Error in transaction:', error);
      throw error;
    }

  } catch (error) {
    console.error('❌ Error creating plan from preset:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateShiftPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, startDate, endDate, status, timeSlots, shifts }: UpdateShiftPlanRequest = req.body;

    // Check if plan exists
    const existingPlan = await db.get('SELECT * FROM shift_plans WHERE id = ?', [id]);
    if (!existingPlan) {
      res.status(404).json({ error: 'Shift plan not found' });
      return;
    }

    await db.run('BEGIN TRANSACTION');

    try {
      // Update plan
      if (name !== undefined || description !== undefined || startDate !== undefined || endDate !== undefined || status !== undefined) {
        await db.run(
          `UPDATE shift_plans 
           SET name = COALESCE(?, name), 
               description = COALESCE(?, description),
               start_date = COALESCE(?, start_date),
               end_date = COALESCE(?, end_date),
               status = COALESCE(?, status)
           WHERE id = ?`,
          [name, description, startDate, endDate, status, id]
        );
      }

      // If updating time slots, replace all time slots
      if (timeSlots) {
        // Delete existing time slots
        await db.run('DELETE FROM time_slots WHERE plan_id = ?', [id]);

        // Insert new time slots - always generate new IDs
        for (const timeSlot of timeSlots) {
          const timeSlotId = uuidv4();
          await db.run(
            `INSERT INTO time_slots (id, plan_id, name, start_time, end_time, description) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [timeSlotId, id, timeSlot.name, timeSlot.startTime, timeSlot.endTime, timeSlot.description || '']
          );
        }
      }

      // If updating shifts, replace all shifts
      if (shifts) {
        // Delete existing shifts
        await db.run('DELETE FROM shifts WHERE plan_id = ?', [id]);

        // Insert new shifts - use new timeSlotId (they should reference the newly created time slots)
        for (const shift of shifts) {
          const shiftId = uuidv4();
          await db.run(
            `INSERT INTO shifts (id, plan_id, day_of_week, time_slot_id, required_employees, color) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [shiftId, id, shift.dayOfWeek, shift.timeSlotId, shift.requiredEmployees, shift.color || '#3498db']
          );
        }
      }

      await db.run('COMMIT');

      // Return updated plan
      const updatedPlan = await getShiftPlanById(id);
      res.json(updatedPlan);

    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error updating shift plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteShiftPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if plan exists
    const existingPlan = await db.get('SELECT * FROM shift_plans WHERE id = ?', [id]);
    if (!existingPlan) {
      res.status(404).json({ error: 'Shift plan not found' });
      return;
    }

    await db.run('DELETE FROM shift_plans WHERE id = ?', [id]);
    // Time slots, shifts, and scheduled shifts will be automatically deleted due to CASCADE

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting shift plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper function to get plan by ID
async function getShiftPlanById(planId: string): Promise<any> {
  const plan = await db.get<any>(`
    SELECT sp.*, e.firstname || ' ' || e.lastname as created_by_name 
    FROM shift_plans sp
    LEFT JOIN employees e ON sp.created_by = e.id
    WHERE sp.id = ?
  `, [planId]);

  if (!plan) {
    return null;
  }

  // Lade Zeit-Slots
  const timeSlots = await db.all<any>(`
    SELECT * FROM time_slots 
    WHERE plan_id = ? 
    ORDER BY start_time
  `, [planId]);

  // Lade Schichten
  const shifts = await db.all<any>(`
    SELECT s.*, ts.name as time_slot_name, ts.start_time, ts.end_time
    FROM shifts s
    LEFT JOIN time_slots ts ON s.time_slot_id = ts.id
    WHERE s.plan_id = ? 
    ORDER BY s.day_of_week, ts.start_time
  `, [planId]);

  // Lade geplante Schichten (nur für nicht-Template Pläne)
  let scheduledShifts = [];
  if (!plan.is_template) {
    scheduledShifts = await db.all<any>(`
      SELECT ss.*, ts.name as time_slot_name
      FROM scheduled_shifts ss
      LEFT JOIN time_slots ts ON ss.time_slot_id = ts.id
      WHERE ss.plan_id = ? 
      ORDER BY ss.date, ts.start_time
    `, [planId]);
  }

  // Load employees without role column + join with employee_roles
  const employees = await db.all<any>(`
    SELECT 
      e.id, 
      e.firstname, 
      e.lastname, 
      e.email, 
      e.employee_type,
      e.contract_type,
      e.can_work_alone,
      e.is_trainee,
      e.is_active as isActive,
      GROUP_CONCAT(er.role) as roles
    FROM employees e
    LEFT JOIN employee_roles er ON e.id = er.employee_id
    WHERE e.is_active = 1
    GROUP BY e.id
    ORDER BY e.firstname, e.lastname
  `, []);

  return {
    ...plan,
    isTemplate: plan.is_template === 1,
    startDate: plan.start_date,
    endDate: plan.end_date,
    createdBy: plan.created_by,
    createdAt: plan.created_at,
    timeSlots: timeSlots.map(slot => ({
      id: slot.id,
      planId: slot.plan_id,
      name: slot.name,
      startTime: slot.start_time,
      endTime: slot.end_time,
      description: slot.description
    })),
    shifts: shifts.map(shift => ({
      id: shift.id,
      planId: shift.plan_id,
      timeSlotId: shift.time_slot_id,
      dayOfWeek: shift.day_of_week,
      requiredEmployees: shift.required_employees,
      color: shift.color,
      timeSlot: {
        id: shift.time_slot_id,
        name: shift.time_slot_name,
        startTime: shift.start_time,
        endTime: shift.end_time
      }
    })),
    scheduledShifts: scheduledShifts.map(shift => ({
      id: shift.id,
      planId: shift.plan_id,
      date: shift.date,
      timeSlotId: shift.time_slot_id,
      requiredEmployees: shift.required_employees,
      assignedEmployees: JSON.parse(shift.assigned_employees || '[]'),
      timeSlotName: shift.time_slot_name
    })),
    // Include employees with proper role handling
    employees: employees.map(emp => ({
      id: emp.id,
      firstname: emp.firstname,
      lastname: emp.lastname,
      email: emp.email,
      employeeType: emp.employee_type,
      contractType: emp.contract_type,
      canWorkAlone: emp.can_work_alone === 1,
      isTrainee: emp.is_trainee === 1,
      isActive: emp.isActive === 1,
      roles: emp.roles ? emp.roles.split(',') : [] // Convert comma-separated roles to array
    }))
  };
}

// Helper function to generate scheduled shifts from template
export const generateScheduledShifts = async (planId: string, startDate: string, endDate: string): Promise<void> => {
  try {
    console.log(`🔄 Generating scheduled shifts for Plan ${planId} from ${startDate} to ${endDate}`);

    // Get plan with shifts and time slots
    const plan = await getShiftPlanById(planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    console.log('📋 Plan shifts:', plan.shifts?.length);
    console.log('⏰ Plan time slots:', plan.timeSlots?.length);

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Generate scheduled shifts for each day in the date range
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay(); // Convert to 1-7 (Mon-Sun)

      // Find shifts for this day of week
      const shiftsForDay = plan.shifts.filter((shift: any) => shift.dayOfWeek === dayOfWeek);

      console.log(`📅 Date: ${date.toISOString().split('T')[0]}, Day: ${dayOfWeek}, Shifts: ${shiftsForDay.length}`);

      for (const shift of shiftsForDay) {
        const scheduledShiftId = uuidv4();

        await db.run(
          `INSERT INTO scheduled_shifts (id, plan_id, date, time_slot_id, required_employees, assigned_employees) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            scheduledShiftId,
            planId,
            date.toISOString().split('T')[0], // YYYY-MM-DD format
            shift.timeSlotId,
            shift.requiredEmployees,
            JSON.stringify([]) // Start with empty assignments
          ]
        );

        console.log(`✅ Created scheduled shift: ${scheduledShiftId}`);
      }
    }

    console.log(`✅ Scheduled shifts generated for Plan ${planId}`);

  } catch (error) {
    console.error('❌ Error generating scheduled shifts:', error);
    throw error;
  }
}

export const generateScheduledShiftsForPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if plan exists
    const existingPlan = await getShiftPlanById(id);
    if (!existingPlan) {
      res.status(404).json({ error: 'Shift plan not found' });
      return;
    }

    console.log('🔄 Manually generating scheduled shifts for plan:', {
      id,
      name: existingPlan.name,
      isTemplate: existingPlan.isTemplate,
      startDate: existingPlan.startDate,
      endDate: existingPlan.endDate,
      hasShifts: existingPlan.shifts?.length || 0
    });

    if (existingPlan.isTemplate) {
      res.status(400).json({ error: 'Cannot generate scheduled shifts for templates' });
      return;
    }

    if (!existingPlan.startDate || !existingPlan.endDate) {
      res.status(400).json({ error: 'Plan must have start and end dates' });
      return;
    }

    // Delete existing scheduled shifts
    await db.run('DELETE FROM scheduled_shifts WHERE plan_id = ?', [id]);
    console.log('🗑️ Deleted existing scheduled shifts');

    // Generate new scheduled shifts
    await generateScheduledShifts(id, existingPlan.startDate, existingPlan.endDate);

    // Return updated plan
    const updatedPlan = await getShiftPlanById(id);

    console.log('✅ Successfully generated scheduled shifts:', {
      scheduledShifts: updatedPlan.scheduledShifts?.length || 0
    });

    res.json(updatedPlan);

  } catch (error) {
    console.error('❌ Error generating scheduled shifts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


export const regenerateScheduledShifts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if plan exists
    const existingPlan = await getShiftPlanById(id);
    if (!existingPlan) {
      res.status(404).json({ error: 'Shift plan not found' });
      return;
    }

    // Delete existing scheduled shifts
    await db.run('DELETE FROM scheduled_shifts WHERE plan_id = ?', [id]);

    // Generate new scheduled shifts
    if (existingPlan.startDate && existingPlan.endDate) {
      await generateScheduledShifts(id, existingPlan.startDate, existingPlan.endDate);
    }

    console.log(`✅ Regenerated scheduled shifts for plan ${id}`);

    // Return updated plan
    const updatedPlan = await getShiftPlanById(id);
    res.json(updatedPlan);

  } catch (error) {
    console.error('Error regenerating scheduled shifts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getScheduledShiftsFromPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { planId } = req.params;

    const shifts = await db.all(
      `SELECT * FROM scheduled_shifts WHERE plan_id = ? ORDER BY date, time_slot_id`,
      [planId]
    );

    // Parse JSON arrays safely
    const parsedShifts = shifts.map((shift: any) => {
      try {
        return {
          ...shift,
          assigned_employees: JSON.parse(shift.assigned_employees || '[]')
        };
      } catch (parseError) {
        console.error('Error parsing assigned_employees:', parseError);
        return {
          ...shift,
          assigned_employees: []
        };
      }
    });

    res.json(parsedShifts);
  } catch (error) {
    console.error('Error fetching scheduled shifts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getScheduledShift = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const shift = await db.get(
      'SELECT * FROM scheduled_shifts WHERE id = ?',
      [id]
    ) as any;

    if (!shift) {
      res.status(404).json({ error: 'Scheduled shift not found' });
    }

    // Parse JSON array
    const parsedShift = {
      ...shift,
      assigned_employees: JSON.parse(shift.assigned_employees || '[]')
    };

    res.json(parsedShift);
  } catch (error: any) {
    console.error('Error fetching scheduled shift:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
};

export const updateScheduledShift = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { assignedEmployees } = req.body;

    console.log('🔄 Updating scheduled shift:', {
      id,
      assignedEmployees,
      body: req.body
    });

    if (!Array.isArray(assignedEmployees)) {
      res.status(400).json({ error: 'assignedEmployees must be an array' });
    }

    // Check if shift exists
    const existingShift = await db.get(
      'SELECT id FROM scheduled_shifts WHERE id = ?',
      [id]
    ) as any;

    if (!existingShift) {
      console.error('❌ Scheduled shift not found:', id);
      res.status(404).json({ error: `Scheduled shift ${id} not found` });
    }

    // Update the shift
    const result = await db.run(
      'UPDATE scheduled_shifts SET assigned_employees = ? WHERE id = ?',
      [JSON.stringify(assignedEmployees), id]
    );

    console.log('✅ Scheduled shift updated successfully');

    res.json({
      message: 'Scheduled shift updated successfully',
      id: id,
      assignedEmployees: assignedEmployees
    });

  } catch (error: any) {
    console.error('❌ Error updating scheduled shift:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
};

export const clearAssignments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    console.log('🔄 Clearing assignments for plan:', id);

    // Check if plan exists
    const existingPlan = await db.get('SELECT * FROM shift_plans WHERE id = ?', [id]);
    if (!existingPlan) {
      res.status(404).json({ error: 'Shift plan not found' });
      return;
    }

    await db.run('BEGIN TRANSACTION');

    try {
      // Get all scheduled shifts for this plan
      const scheduledShifts = await db.all<any>(
        'SELECT id FROM scheduled_shifts WHERE plan_id = ?',
        [id]
      );

      console.log(`📋 Found ${scheduledShifts.length} scheduled shifts to clear`);

      // Clear all assignments (set assigned_employees to empty array)
      for (const shift of scheduledShifts) {
        await db.run(
          'UPDATE scheduled_shifts SET assigned_employees = ? WHERE id = ?',
          [JSON.stringify([]), shift.id]
        );
        console.log(`✅ Cleared assignments for shift: ${shift.id}`);
      }

      // Update plan status back to draft
      await db.run(
        'UPDATE shift_plans SET status = ? WHERE id = ?',
        ['draft', id]
      );

      await db.run('COMMIT');

      console.log(`✅ Successfully cleared all assignments for plan ${id}`);

      res.json({
        message: 'Assignments cleared successfully',
        clearedShifts: scheduledShifts.length
      });

    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ Error clearing assignments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Helper interfaces for export
interface ExportDay {
  id: number;
  name: string;
}

interface ExportTimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  shiftsByDay: { [dayId: number]: any };
}

interface ExportTimetableData {
  days: ExportDay[];
  allTimeSlots: ExportTimeSlot[];
}

function getTimetableDataForExport(plan: any): ExportTimetableData {
  const weekdays = [
    { id: 1, name: 'Montag' },
    { id: 2, name: 'Dienstag' },
    { id: 3, name: 'Mittwoch' },
    { id: 4, name: 'Donnerstag' },
    { id: 5, name: 'Freitag' },
    { id: 6, name: 'Samstag' },
    { id: 7, name: 'Sonntag' }
  ];

  if (!plan.shifts || !plan.timeSlots) {
    return { days: [], allTimeSlots: [] };
  }

  // Create a map for quick time slot lookups with proper typing
  const timeSlotMap = new Map<string, any>();
  plan.timeSlots.forEach((ts: any) => {
    timeSlotMap.set(ts.id, ts);
  });

  // Group shifts by day
  const shiftsByDay: { [dayId: number]: any[] } = plan.shifts.reduce((acc: any, shift: any) => {
    if (!acc[shift.dayOfWeek]) {
      acc[shift.dayOfWeek] = [];
    }

    const timeSlot = timeSlotMap.get(shift.timeSlotId);
    const enhancedShift = {
      ...shift,
      timeSlotName: timeSlot?.name,
      startTime: timeSlot?.startTime,
      endTime: timeSlot?.endTime
    };

    acc[shift.dayOfWeek].push(enhancedShift);
    return acc;
  }, {});

  // Sort shifts within each day by start time
  Object.keys(shiftsByDay).forEach(day => {
    const dayNum = parseInt(day);
    shiftsByDay[dayNum].sort((a: any, b: any) => {
      const timeA = a.startTime || '';
      const timeB = b.startTime || '';
      return timeA.localeCompare(timeB);
    });
  });

  // Get unique days that have shifts
  const days: ExportDay[] = Array.from(new Set(plan.shifts.map((shift: any) => shift.dayOfWeek)))
    .sort()
    .map(dayId => {
      return weekdays.find(day => day.id === dayId) || { id: dayId as number, name: `Tag ${dayId}` };
    });

  // Get all unique time slots (rows) by collecting from all shifts
  const allTimeSlotsMap = new Map<string, ExportTimeSlot>();
  days.forEach(day => {
    shiftsByDay[day.id]?.forEach((shift: any) => {
      const timeSlot = timeSlotMap.get(shift.timeSlotId);
      if (timeSlot && !allTimeSlotsMap.has(timeSlot.id)) {
        const exportTimeSlot: ExportTimeSlot = {
          id: timeSlot.id,
          name: timeSlot.name,
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
          shiftsByDay: {}
        };
        allTimeSlotsMap.set(timeSlot.id, exportTimeSlot);
      }
    });
  });

  // Populate shifts for each time slot by day
  days.forEach(day => {
    shiftsByDay[day.id]?.forEach((shift: any) => {
      const timeSlot = allTimeSlotsMap.get(shift.timeSlotId);
      if (timeSlot) {
        timeSlot.shiftsByDay[day.id] = shift;
      }
    });
  });

  // Convert to array and sort by start time
  const allTimeSlots = Array.from(allTimeSlotsMap.values()).sort((a: ExportTimeSlot, b: ExportTimeSlot) => {
    return (a.startTime || '').localeCompare(b.startTime || '');
  });

  return { days, allTimeSlots };
}

// Export shift plan to Excel
// Export shift plan to Excel
export const exportShiftPlanToExcel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    console.log('📊 Starting Excel export for plan:', id);

    const plan = await getShiftPlanById(id);
    if (!plan) {
      res.status(404).json({ error: 'Shift plan not found' });
      return;
    }
    if (plan.status !== 'published') {
      res.status(400).json({ error: 'Can only export published shift plans' });
      return;
    }

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Schichtplaner System';
    workbook.created = new Date();

    /* -------------------------------------------------------------------------- */
    /*                           📋 1. Summary Sheet                              */
    /* -------------------------------------------------------------------------- */
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
      { property: 'Erstellt von', value: plan.created_by_name || 'Unbekannt' },
      { property: 'Erstellt am', value: new Date(plan.createdAt).toLocaleString('de-DE') },
      { property: 'Anzahl Schichten', value: plan.scheduledShifts?.length || 0 },
      { property: 'Anzahl Mitarbeiter', value: plan.employees?.length || 0 }
    ]);

    // Style header
    const header1 = summarySheet.getRow(1);
    header1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
    summarySheet.columns.forEach(col => (col.alignment = { vertical: 'middle', wrapText: true }));

    /* -------------------------------------------------------------------------- */
    /*                        📅 2. Timetable / Schichtplan Sheet                 */
    /* -------------------------------------------------------------------------- */
    const timetableSheet = workbook.addWorksheet('Schichtplan');
    const timetableData = getTimetableDataForExport(plan);
    const { days, allTimeSlots } = timetableData;

    // Calculate max employees per shift to determine row structure
    let maxEmployeesPerShift = 1;
    for (const timeSlot of allTimeSlots) {
      for (const day of days) {
        const scheduledShift = plan.scheduledShifts?.find(
          (s: any) => getDayOfWeek(s.date) === day.id && s.timeSlotId === timeSlot.id
        );
        if (scheduledShift && scheduledShift.assignedEmployees?.length > maxEmployeesPerShift) {
          maxEmployeesPerShift = scheduledShift.assignedEmployees.length;
        }
      }
    }

    // Header
    const headerRow = ['Schicht (Zeit)', ...days.map(d => d.name)];
    const header = timetableSheet.addRow(headerRow);
    header.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Content rows - each time slot can have multiple employee rows
    for (const timeSlot of allTimeSlots) {
      // Find max employees for this time slot across all days
      let maxEmployeesInTimeSlot = 0;
      for (const day of days) {
        const scheduledShift = plan.scheduledShifts?.find(
          (s: any) => getDayOfWeek(s.date) === day.id && s.timeSlotId === timeSlot.id
        );
        if (scheduledShift && scheduledShift.assignedEmployees?.length > maxEmployeesInTimeSlot) {
          maxEmployeesInTimeSlot = scheduledShift.assignedEmployees.length;
        }
      }

      // If no employees assigned, show at least one row with requirement count
      const rowsToCreate = Math.max(maxEmployeesInTimeSlot, 1);

      for (let empIndex = 0; empIndex < rowsToCreate; empIndex++) {
        const rowData: any[] = [];

        // First cell: time slot name (only in first row, merged for others)
        if (empIndex === 0) {
          rowData.push(`${timeSlot.name}\n${timeSlot.startTime} - ${timeSlot.endTime}`);
        } else {
          rowData.push(''); // Empty for merged cells
        }

        // Day cells
        for (const day of days) {
          const shift = timeSlot.shiftsByDay[day.id];

          if (!shift) {
            rowData.push(empIndex === 0 ? 'Keine Schicht' : '');
            continue;
          }

          const scheduledShift = plan.scheduledShifts?.find(
            (s: any) => getDayOfWeek(s.date) === day.id && s.timeSlotId === timeSlot.id
          );

          if (scheduledShift && scheduledShift.assignedEmployees?.length > 0) {
            if (empIndex < scheduledShift.assignedEmployees.length) {
              const empId = scheduledShift.assignedEmployees[empIndex];
              const emp = plan.employees?.find((e: any) => e.id === empId);

              if (!emp) {
                rowData.push({ text: 'Unbekannt', color: 'FF888888' });
              } else if (emp.isTrainee) {
                rowData.push({
                  text: `${emp.firstname} ${emp.lastname} (T)`,
                  color: 'FFCDA8F0'
                });
              } else if (emp.employeeType === 'manager') {
                rowData.push({
                  text: `${emp.firstname} ${emp.lastname} (M)`,
                  color: 'FFCC0000'
                });
              } else {
                rowData.push({
                  text: `${emp.firstname} ${emp.lastname}`,
                  color: 'FF642AB5'
                });
              }
            } else {
              rowData.push(''); // Empty cell if no more employees
            }
          } else {
            // No employees assigned, show requirement count only in first row
            if (empIndex === 0) {
              const shiftsForSlot = plan.shifts?.filter(
                (s: any) => s.dayOfWeek === day.id && s.timeSlotId === timeSlot.id
              ) || [];
              const totalRequired = shiftsForSlot.reduce(
                (sum: number, s: any) => sum + s.requiredEmployees,
                0
              );
              rowData.push(totalRequired === 0 ? '-' : `0/${totalRequired}`);
            } else {
              rowData.push('');
            }
          }
        }

        const row = timetableSheet.addRow(rowData);

        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          cell.alignment = { vertical: 'middle', wrapText: true, horizontal: 'center' };

          // Handle colored employee names
          if (typeof cell.value === 'object' && cell.value !== null && 'text' in cell.value) {
            const employeeData = cell.value as unknown as { text: string; color: string };
            cell.value = employeeData.text;
            cell.font = { color: { argb: employeeData.color } };
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }

          if (cell.value === 'Keine Schicht') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } };
            cell.font = { color: { argb: 'FF888888' }, italic: true };
          }

          if (colNumber === 1) {
            cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          }
        });

        row.height = 25;
      }

      // Merge time slot cells vertically if multiple rows were created
      if (rowsToCreate > 1) {
        const currentRow = timetableSheet.lastRow!.number;
        const startRow = currentRow - rowsToCreate + 1;
        timetableSheet.mergeCells(startRow, 1, currentRow, 1);
      }
    }

    // Adjust column widths
    timetableSheet.getColumn(1).width = 25; // Time slot column
    for (let i = 2; i <= days.length + 1; i++) {
      timetableSheet.getColumn(i).width = 30;
    }

    // Add legend row at bottom
    const legendRow = timetableSheet.addRow([
      'Legende:',
      '■ Manager',
      '■ Trainee',
      '■ Mitarbeiter',
      '■ Keine Schicht'
    ]);

    // Style each square with its respective color
    legendRow.getCell(1).font = { bold: true };
    legendRow.getCell(2).font = { color: { argb: 'FFCC0000' } };   // Red = Manager
    legendRow.getCell(3).font = { color: { argb: 'FFCDA8F0' } };   // Purple = Trainee
    legendRow.getCell(4).font = { color: { argb: 'FF642AB5' } };   // Blue = Mitarbeiter
    legendRow.getCell(5).font = { color: { argb: 'FF888888' } };   // Gray = Keine Schicht

    legendRow.eachCell(cell => {
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.font = { ...cell.font, italic: true };
    });

    /* -------------------------------------------------------------------------- */
    /*                        👥 3. Employee Overview Sheet                       */
    /* -------------------------------------------------------------------------- */
    const employeeSheet = workbook.addWorksheet('Mitarbeiterübersicht');
    employeeSheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'E-Mail', key: 'email', width: 25 },
      { header: 'Rolle', key: 'role', width: 18 },
      { header: 'Mitarbeiter Typ', key: 'type', width: 15 },
      { header: 'Vertragstyp', key: 'contract', width: 18 },
      { header: 'Trainee', key: 'trainee', width: 10 }
    ];

    plan.employees?.forEach((e: any) =>
      employeeSheet.addRow({
        name: `${e.firstname} ${e.lastname}`,
        email: e.email,
        role: e.roles?.join(', ') || 'Benutzer',
        type: e.employeeType || 'Unbekannt',
        contract: e.contractType || 'Nicht angegeben',
        trainee: e.isTrainee ? 'Ja' : 'Nein'
      })
    );

    const empHeader = employeeSheet.getRow(1);
    empHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    empHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34495E' } };
    empHeader.alignment = { horizontal: 'center', vertical: 'middle' };

    /* -------------------------------------------------------------------------- */
    /*                            📤 4. Send Response                             */
    /* -------------------------------------------------------------------------- */
    const fileName = `Schichtplan_${plan.name}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);

    console.log('✅ Excel export completed for plan:', id);
  } catch (error) {
    console.error('❌ Error exporting to Excel:', error);
    res.status(500).json({ error: 'Internal server error during Excel export' });
  }
};

export const exportShiftPlanToPDF = async (req: Request, res: Response): Promise<void> => {
  let browser;
  try {
    const { id } = req.params;
    console.log('📄 Starting PDF export for plan:', id);

    const plan = await getShiftPlanById(id);
    if (!plan) {
      res.status(404).json({ error: 'Shift plan not found' });
      return;
    }

    if (plan.status !== 'published') {
      res.status(400).json({ error: 'Can only export published shift plans' });
      return;
    }

    // Get timetable data (same as Excel)
    const timetableData = getTimetableDataForExport(plan);
    const { days, allTimeSlots } = timetableData;

    // Generate HTML content
    const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Schichtplan - ${plan.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #2c3e50;
      padding: 20px;
    }
    .header { 
      margin-bottom: 30px; 
      padding-bottom: 20px;
      border-bottom: 3px solid #2c3e50;
    }
    h1 { 
      font-size: 24pt; 
      color: #2c3e50; 
      margin-bottom: 10px;
    }
    .subtitle { 
      font-size: 11pt; 
      color: #7f8c8d; 
      margin-bottom: 5px;
    }
    .info-section {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .info-section h2 {
      font-size: 14pt;
      margin-bottom: 12px;
      color: #34495e;
      border-bottom: 2px solid #34495e;
      padding-bottom: 5px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .info-item {
      display: flex;
      gap: 8px;
    }
    .info-label {
      font-weight: 600;
      color: #34495e;
    }
    .info-value {
      color: #555;
    }
    
    /* Timetable styles */
    .timetable-section {
      margin-top: 30px;
      page-break-before: always;
    }
    .timetable-section h2 {
      font-size: 16pt;
      margin-bottom: 15px;
      color: #2c3e50;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      page-break-inside: auto;
    }
    thead {
      background: #2c3e50;
      color: white;
    }
    thead th {
      padding: 12px 8px;
      text-align: center;
      font-weight: 600;
      border: 1px solid #2c3e50;
      font-size: 10pt;
    }
    tbody tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    tbody tr:nth-child(even) {
      background: #f8f9fa;
    }
    td {
      padding: 10px 8px;
      border: 1px solid #dee2e6;
      vertical-align: top;
    }
    .time-slot-cell {
      font-weight: 600;
      background: #ecf0f1;
      white-space: nowrap;
      min-width: 120px;
    }
    .time-slot-name {
      font-size: 10pt;
      color: #2c3e50;
      margin-bottom: 3px;
    }
    .time-slot-time {
      font-size: 9pt;
      color: #7f8c8d;
      font-weight: normal;
    }
    .employee-list {
      list-style: none;
      padding: 0;
    }
    .employee-list li {
      margin-bottom: 4px;
      font-size: 9pt;
    }
    .employee-manager { color: #CC0000; font-weight: 600; }
    .employee-trainee { color: #CDA8F0; font-weight: 600; }
    .employee-regular { color: #642AB5; }
    .no-shift {
      color: #999;
      font-style: italic;
      text-align: center;
    }
    .required-count {
      color: #666;
      font-style: italic;
      text-align: center;
    }
    
    /* Legend */
    .legend {
      margin-top: 15px;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 5px;
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      page-break-inside: avoid;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 9pt;
    }
    .legend-square {
      width: 12px;
      height: 12px;
      border-radius: 2px;
    }
    
    /* Employee section */
    .employee-section {
      margin-top: 30px;
      page-break-before: always;
    }
    .employee-section h2 {
      font-size: 16pt;
      margin-bottom: 15px;
      color: #2c3e50;
    }
    .employee-table {
      width: 100%;
    }
    .employee-table thead {
      background: #34495e;
    }
    .employee-table td {
      font-size: 9pt;
    }
    
    /* Footer */
    .footer {
      position: fixed;
      bottom: 15px;
      left: 20px;
      right: 20px;
      text-align: center;
      font-size: 8pt;
      color: #7f8c8d;
      border-top: 1px solid #dee2e6;
      padding-top: 8px;
    }
    
    @media print {
      body { padding: 15px; }
      .header { page-break-after: avoid; }
      .info-section { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Schichtplan: ${plan.name}</h1>
    <div class="subtitle">Erstellt am: ${new Date().toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}</div>
  </div>

  <div class="info-section">
    <h2>Plan Informationen</h2>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Plan Name:</span>
        <span class="info-value">${plan.name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Status:</span>
        <span class="info-value">${plan.status}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Beschreibung:</span>
        <span class="info-value">${plan.description || 'Keine'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Erstellt von:</span>
        <span class="info-value">${plan.created_by_name || 'Unbekannt'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Zeitraum:</span>
        <span class="info-value">${plan.startDate} bis ${plan.endDate}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Erstellt am:</span>
        <span class="info-value">${new Date(plan.createdAt).toLocaleString('de-DE')}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Anzahl Schichten:</span>
        <span class="info-value">${plan.scheduledShifts?.length || 0}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Anzahl Mitarbeiter:</span>
        <span class="info-value">${plan.employees?.length || 0}</span>
      </div>
    </div>
  </div>

  <div class="timetable-section">
    <h2>Schichtplan Timetable</h2>
    <table>
      <thead>
        <tr>
          <th>Schicht (Zeit)</th>
          ${days.map(day => `<th>${day.name}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${allTimeSlots.map(timeSlot => `
          <tr>
            <td class="time-slot-cell">
              <div class="time-slot-name">${timeSlot.name}</div>
              <div class="time-slot-time">${timeSlot.startTime} - ${timeSlot.endTime}</div>
            </td>
            ${days.map(day => {
      const shift = timeSlot.shiftsByDay[day.id];

      if (!shift) {
        return '<td class="no-shift">Keine Schicht</td>';
      }

      const scheduledShift = plan.scheduledShifts?.find((s: any) =>
        getDayOfWeek(s.date) === day.id && s.timeSlotId === timeSlot.id
      );

      if (scheduledShift && scheduledShift.assignedEmployees?.length > 0) {
        const employeeItems = scheduledShift.assignedEmployees.map((empId: string) => {
          const emp = plan.employees?.find((e: any) => e.id === empId);
          if (!emp) return '<li>Unbekannt</li>';

          let cssClass = 'employee-regular';
          let suffix = '';

          if (emp.isTrainee) {
            cssClass = 'employee-trainee';
            suffix = ' (T)';
          } else if (emp.employeeType === 'manager') {
            cssClass = 'employee-manager';
            suffix = ' (M)';
          }

          return `<li class="${cssClass}">${emp.firstname} ${emp.lastname}${suffix}</li>`;
        }).join('');

        return `<td><ul class="employee-list">${employeeItems}</ul></td>`;
      } else {
        const shiftsForSlot = plan.shifts?.filter((s: any) =>
          s.dayOfWeek === day.id && s.timeSlotId === timeSlot.id
        ) || [];
        const totalRequired = shiftsForSlot.reduce((sum: number, s: any) =>
          sum + s.requiredEmployees, 0
        );
        const displayText = totalRequired === 0 ? '-' : `0/${totalRequired}`;
        return `<td class="required-count">${displayText}</td>`;
      }
    }).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="legend">
      <div class="legend-item">
        <div class="legend-square" style="background: #CC0000;"></div>
        <span>Manager</span>
      </div>
      <div class="legend-item">
        <div class="legend-square" style="background: #CDA8F0;"></div>
        <span>Trainee</span>
      </div>
      <div class="legend-item">
        <div class="legend-square" style="background: #642AB5;"></div>
        <span>Mitarbeiter</span>
      </div>
      <div class="legend-item">
        <div class="legend-square" style="background: #ededed;"></div>
        <span>Keine Schicht</span>
      </div>
    </div>
  </div>

  <div class="employee-section">
    <h2>Mitarbeiterübersicht</h2>
    <table class="employee-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>E-Mail</th>
          <th>Rolle</th>
          <th>Mitarbeiter Typ</th>
          <th>Vertragstyp</th>
          <th>Trainee</th>
        </tr>
      </thead>
      <tbody>
        ${plan.employees?.map((emp: any) => `
          <tr>
            <td>${emp.firstname} ${emp.lastname}</td>
            <td>${emp.email}</td>
            <td>${emp.roles?.join(', ') || 'Benutzer'}</td>
            <td>${emp.employeeType || 'Unbekannt'}</td>
            <td>${emp.contractType || 'Nicht angegeben'}</td>
            <td>${emp.isTrainee ? 'Ja' : 'Nein'}</td>
          </tr>
        `).join('') || '<tr><td colspan="6" style="text-align: center; color: #999;">Keine Mitarbeiter</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="footer">
    Erstellt am: ${new Date().toLocaleString('de-DE')} • Schichtplaner System
  </div>
</body>
</html>
    `;

    // Launch browser and generate PDF
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(html, { waitUntil: 'networkidle' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="font-size: 8pt; text-align: center; width: 100%; color: #7f8c8d; padding-top: 5px;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `
    });

    await browser.close();

    // Set response headers and send PDF
    const fileName = `Schichtplan_${plan.name}_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);

    console.log('✅ PDF export completed for plan:', id);

  } catch (error) {
    console.error('❌ Error exporting to PDF:', error);
    if (browser) {
      await browser.close();
    }
    res.status(500).json({ error: 'Internal server error during PDF export' });
  }
};

// Helper function to get day of week from date string
function getDayOfWeek(dateString: string): number {
  const date = new Date(dateString);
  return date.getDay() === 0 ? 7 : date.getDay();
}