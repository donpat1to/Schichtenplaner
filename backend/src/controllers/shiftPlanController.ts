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
import PDFDocument from 'pdfkit';

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

// Update the Excel export function with proper typing
export const exportShiftPlanToExcel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    console.log('📊 Starting Excel export for plan:', id);

    // Check if plan exists
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

    // Add Summary Sheet
    const summarySheet = workbook.addWorksheet('Planübersicht');

    // Summary data
    summarySheet.columns = [
      { header: 'Eigenschaft', key: 'property', width: 20 },
      { header: 'Wert', key: 'value', width: 30 }
    ];

    summarySheet.addRows([
      { property: 'Plan Name', value: plan.name },
      { property: 'Beschreibung', value: plan.description || 'Keine' },
      { property: 'Zeitraum', value: `${plan.startDate} bis ${plan.endDate}` },
      { property: 'Status', value: plan.status },
      { property: 'Erstellt von', value: plan.created_by_name || 'Unbekannt' },
      { property: 'Erstellt am', value: plan.createdAt },
      { property: 'Anzahl Schichten', value: plan.scheduledShifts?.length || 0 },
      { property: 'Anzahl Mitarbeiter', value: plan.employees?.length || 0 }
    ]);

    // Style summary sheet
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2C3E50' }
    };
    summarySheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add Timetable Sheet (matching React component visualization)
    const timetableSheet = workbook.addWorksheet('Schichtplan');

    // Get timetable data structure similar to React component
    const timetableData = getTimetableDataForExport(plan);
    const { days, allTimeSlots } = timetableData;

    // Create header row
    const headerRow = ['Schicht (Zeit)', ...days.map(day => day.name)];
    timetableSheet.addRow(headerRow);

    // Add data rows for each time slot
    allTimeSlots.forEach(timeSlot => {
      const rowData: any[] = [
        `${timeSlot.name}\n${timeSlot.startTime} - ${timeSlot.endTime}`
      ];

      days.forEach(day => {
        const shift = timeSlot.shiftsByDay[day.id];
        if (!shift) {
          rowData.push('Keine Schicht');
          return;
        }

        // Get assignments for this time slot and day
        const scheduledShift = plan.scheduledShifts?.find((scheduled: any) => {
          const scheduledDayOfWeek = getDayOfWeek(scheduled.date);
          return scheduledDayOfWeek === day.id && 
                scheduled.timeSlotId === timeSlot.id;
        });

        if (scheduledShift && scheduledShift.assignedEmployees.length > 0) {
          const employeeNames = scheduledShift.assignedEmployees.map((empId: string) => {
            const employee = plan.employees?.find((emp: any) => emp.id === empId);
            if (!employee) return 'Unbekannt';
            
            // Add role indicator similar to React component
            let roleIndicator = '';
            if (employee.isTrainee) {
              roleIndicator = ' (Trainee)';
            } else if (employee.roles?.includes('manager')) {
              roleIndicator = ' (Manager)';
            }
            
            return `${employee.firstname} ${employee.lastname}${roleIndicator}`;
          }).join('\n');
          
          rowData.push(employeeNames);
        } else {
          // Show required employees count like in React component
          const shiftsForSlot = plan.shifts?.filter((s: any) => 
            s.dayOfWeek === day.id && 
            s.timeSlotId === timeSlot.id
          ) || [];
          const totalRequired = shiftsForSlot.reduce((sum: number, s: any) => sum + s.requiredEmployees, 0);
          rowData.push(totalRequired === 0 ? '-' : `0/${totalRequired}`);
        }
      });

      timetableSheet.addRow(rowData);
    });

    // Style timetable sheet
    timetableSheet.getRow(1).font = { bold: true };
    timetableSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2C3E50' }
    };
    timetableSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Set row heights and wrap text
    timetableSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.height = 60;
        row.alignment = { vertical: 'top', wrapText: true };
      }
      
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        
        if (rowNumber === 1) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNumber === 1) {
          cell.alignment = { vertical: 'middle' };
        } else {
          cell.alignment = { vertical: 'top', wrapText: true };
        }
      });
    });

    // Auto-fit columns
    timetableSheet.columns.forEach(column => {
      if (column.width) {
        column.width = Math.max(column.width, 12);
      }
    });

    // Add Employee Overview Sheet
    const employeeSheet = workbook.addWorksheet('Mitarbeiterübersicht');

    employeeSheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'E-Mail', key: 'email', width: 25 },
      { header: 'Rolle', key: 'role', width: 15 },
      { header: 'Mitarbeiter Typ', key: 'type', width: 15 },
      { header: 'Vertragstyp', key: 'contract', width: 15 },
      { header: 'Trainee', key: 'trainee', width: 10 }
    ];

    plan.employees?.forEach((employee: any) => {
      employeeSheet.addRow({
        name: `${employee.firstname} ${employee.lastname}`,
        email: employee.email,
        role: employee.roles?.join(', ') || 'Benutzer',
        type: employee.employeeType,
        contract: employee.contractType || 'Nicht angegeben',
        trainee: employee.isTrainee ? 'Ja' : 'Nein'
      });
    });

    // Style employee sheet
    employeeSheet.getRow(1).font = { bold: true };
    employeeSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF34495E' }
    };
    employeeSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Schichtplan_${plan.name}_${new Date().toISOString().split('T')[0]}.xlsx"`);

    // Write to response
    await workbook.xlsx.write(res);

    console.log('✅ Excel export completed for plan:', id);

  } catch (error) {
    console.error('❌ Error exporting to Excel:', error);
    res.status(500).json({ error: 'Internal server error during Excel export' });
  }
};

export const exportShiftPlanToPDF = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    console.log('📄 Starting PDF export for plan:', id);

    // Check if plan exists
    const plan = await getShiftPlanById(id);
    if (!plan) {
      res.status(404).json({ error: 'Shift plan not found' });
      return;
    }

    if (plan.status !== 'published') {
      res.status(400).json({ error: 'Can only export published shift plans' });
      return;
    }

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Schichtplan_${plan.name}_${new Date().toISOString().split('T')[0]}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add title
    doc.fontSize(20).font('Helvetica-Bold').text(`Schichtplan: ${plan.name}`, 50, 50);
    doc.fontSize(12).font('Helvetica').text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 50, 80);

    // Plan summary
    let yPosition = 120;
    doc.fontSize(14).font('Helvetica-Bold').text('Plan Informationen', 50, yPosition);
    yPosition += 30;

    doc.fontSize(10).font('Helvetica');
    doc.text(`Plan Name: ${plan.name}`, 50, yPosition);
    yPosition += 20;

    if (plan.description) {
      doc.text(`Beschreibung: ${plan.description}`, 50, yPosition);
      yPosition += 20;
    }

    doc.text(`Zeitraum: ${plan.startDate} bis ${plan.endDate}`, 50, yPosition);
    yPosition += 20;
    doc.text(`Status: ${plan.status}`, 50, yPosition);
    yPosition += 20;
    doc.text(`Erstellt von: ${plan.created_by_name || 'Unbekannt'}`, 50, yPosition);
    yPosition += 20;
    doc.text(`Erstellt am: ${plan.createdAt}`, 50, yPosition);
    yPosition += 20;
    doc.text(`Anzahl Schichten: ${plan.scheduledShifts?.length || 0}`, 50, yPosition);
    yPosition += 20;
    doc.text(`Anzahl Mitarbeiter: ${plan.employees?.length || 0}`, 50, yPosition);
    yPosition += 40;

    // Get timetable data for PDF
    const timetableData = getTimetableDataForExport(plan);
    const { days, allTimeSlots } = timetableData;

    // Add timetable section
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('Schichtplan Timetable', 50, 50);

    let currentY = 80;

    // Define column widths
    const timeSlotColWidth = 100;
    const dayColWidth = (500 - timeSlotColWidth) / days.length;

    // Table headers
    doc.fontSize(10).font('Helvetica-Bold');
    
    // Time slot header
    doc.rect(50, currentY, timeSlotColWidth, 20).fillAndStroke('#2c3e50', '#2c3e50');
    doc.fillColor('white').text('Schicht (Zeit)', 55, currentY + 5, { width: timeSlotColWidth - 10, align: 'left' });
    
    // Day headers
    days.forEach((day, index) => {
      const xPos = 50 + timeSlotColWidth + (index * dayColWidth);
      doc.rect(xPos, currentY, dayColWidth, 20).fillAndStroke('#2c3e50', '#2c3e50');
      doc.fillColor('white').text(day.name, xPos + 5, currentY + 5, { width: dayColWidth - 10, align: 'center' });
    });

    doc.fillColor('black');
    currentY += 20;

    // Time slot rows
    allTimeSlots.forEach((timeSlot, rowIndex) => {
      // Check if we need a new page
      if (currentY > 650) {
        doc.addPage();
        currentY = 50;
        
        // Redraw headers on new page
        doc.fontSize(10).font('Helvetica-Bold');
        doc.rect(50, currentY, timeSlotColWidth, 20).fillAndStroke('#2c3e50', '#2c3e50');
        doc.fillColor('white').text('Schicht (Zeit)', 55, currentY + 5, { width: timeSlotColWidth - 10, align: 'left' });
        
        days.forEach((day, index) => {
          const xPos = 50 + timeSlotColWidth + (index * dayColWidth);
          doc.rect(xPos, currentY, dayColWidth, 20).fillAndStroke('#2c3e50', '#2c3e50');
          doc.fillColor('white').text(day.name, xPos + 5, currentY + 5, { width: dayColWidth - 10, align: 'center' });
        });
        
        doc.fillColor('black');
        currentY += 20;
      }

      // Alternate row background
      const rowBgColor = rowIndex % 2 === 0 ? '#f8f9fa' : 'white';
      
      // Time slot cell
      doc.rect(50, currentY, timeSlotColWidth, 40).fillAndStroke(rowBgColor, '#dee2e6');
      doc.fontSize(9).font('Helvetica-Bold').text(timeSlot.name, 55, currentY + 5, { width: timeSlotColWidth - 10 });
      doc.fontSize(8).font('Helvetica').text(`${timeSlot.startTime} - ${timeSlot.endTime}`, 55, currentY + 18, { width: timeSlotColWidth - 10 });

      // Day cells
      days.forEach((day, colIndex) => {
        const xPos = 50 + timeSlotColWidth + (colIndex * dayColWidth);
        const shift = timeSlot.shiftsByDay[day.id];
        
        doc.rect(xPos, currentY, dayColWidth, 40).fillAndStroke(rowBgColor, '#dee2e6');
        
        if (!shift) {
          doc.fontSize(8).font('Helvetica-Oblique').fillColor('#ccc').text('Keine Schicht', xPos + 5, currentY + 15, { 
            width: dayColWidth - 10, 
            align: 'center' 
          });
        } else {
          // Get assignments for this time slot and day
          const scheduledShift = plan.scheduledShifts?.find((scheduled: any) => {
            const scheduledDayOfWeek = getDayOfWeek(scheduled.date);
            return scheduledDayOfWeek === day.id && 
                  scheduled.timeSlotId === timeSlot.id;
          });

          doc.fillColor('black').fontSize(8).font('Helvetica');
          
          if (scheduledShift && scheduledShift.assignedEmployees.length > 0) {
            let textY = currentY + 5;
            scheduledShift.assignedEmployees.forEach((empId: string, empIndex: number) => {
              if (textY < currentY + 35) { // Don't overflow cell
                const employee = plan.employees?.find((emp: any) => emp.id === empId);
                if (employee) {
                  let roleIndicator = '';
                  if (employee.isTrainee) {
                    roleIndicator = ' (T)';
                    doc.fillColor('#cda8f0'); // Trainee color
                  } else if (employee.roles?.includes('manager')) {
                    roleIndicator = ' (M)';
                    doc.fillColor('#CC0000'); // Manager color
                  } else {
                    doc.fillColor('#642ab5'); // Regular personnel color
                  }
                  
                  const name = `${employee.firstname} ${employee.lastname}${roleIndicator}`;
                  doc.text(name, xPos + 5, textY, { width: dayColWidth - 10, align: 'left' });
                  textY += 10;
                }
              }
            });
            doc.fillColor('black');
          } else {
            // Show required count like in React component
            const shiftsForSlot = plan.shifts?.filter((s: any) => 
              s.dayOfWeek === day.id && 
              s.timeSlotId === timeSlot.id
            ) || [];
            const totalRequired = shiftsForSlot.reduce((sum: number, s: any) => sum + s.requiredEmployees, 0);
            const displayText = totalRequired === 0 ? '-' : `0/${totalRequired}`;
            
            doc.fillColor('#666').fontSize(9).font('Helvetica-Oblique')
               .text(displayText, xPos + 5, currentY + 15, { width: dayColWidth - 10, align: 'center' });
            doc.fillColor('black');
          }
        }
      });

      currentY += 40;
    });

    // Add employee overview page
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('Mitarbeiterübersicht', 50, 50);

    currentY = 80;

    // Table headers
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Name', 50, currentY);
    doc.text('E-Mail', 200, currentY);
    doc.text('Rolle', 350, currentY);
    doc.text('Typ', 450, currentY);
    currentY += 15;

    // Horizontal line
    doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
    currentY += 10;

    doc.fontSize(9).font('Helvetica');

    plan.employees?.forEach((employee: any) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
        // Re-add headers
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Name', 50, currentY);
        doc.text('E-Mail', 200, currentY);
        doc.text('Rolle', 350, currentY);
        doc.text('Typ', 450, currentY);
        currentY += 25;
      }

      doc.text(`${employee.firstname} ${employee.lastname}`, 50, currentY);
      doc.text(employee.email, 200, currentY, { width: 140 });
      doc.text(employee.roles?.join(', ') || 'Benutzer', 350, currentY, { width: 90 });
      doc.text(employee.employeeType, 450, currentY);

      currentY += 20;
    });

    // Add footer to each page
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);

      doc.fontSize(8).font('Helvetica');
      doc.text(
        `Seite ${i + 1} von ${pages.count} • Erstellt am: ${new Date().toLocaleString('de-DE')} • Schichtplaner System`,
        50,
        800,
        { align: 'center', width: 500 }
      );
    }

    // Finalize PDF
    doc.end();

    console.log('✅ PDF export completed for plan:', id);

  } catch (error) {
    console.error('❌ Error exporting to PDF:', error);
    res.status(500).json({ error: 'Internal server error during PDF export' });
  }
};

// Helper function to get day of week from date string
function getDayOfWeek(dateString: string): number {
  const date = new Date(dateString);
  return date.getDay() === 0 ? 7 : date.getDay();
}

// Helper function to get German day names
function getGermanDayName(dayIndex: number): string {
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  return days[dayIndex];
}