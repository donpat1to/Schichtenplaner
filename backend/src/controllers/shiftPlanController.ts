// backend/src/controllers/shiftPlanController.ts
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/databaseService.js';
import { 
  CreateShiftPlanRequest, 
  UpdateShiftPlanRequest,
  ShiftPlan
} from '../models/ShiftPlan.js';
import { AuthRequest } from '../middleware/auth.js';
import { createPlanFromPreset, TEMPLATE_PRESETS } from '../models/defaults/shiftPlanDefaults.js';

async function getPlanWithDetails(planId: string) {
  const plan = await db.get<any>(`
    SELECT sp.*, e.name as created_by_name 
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
      SELECT sp.*, e.name as created_by_name 
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
      SELECT sp.*, e.name as created_by_name 
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

    if (!TEMPLATE_PRESETS[presetName as keyof typeof TEMPLATE_PRESETS]) {
      res.status(400).json({ error: 'Invalid preset name' });
      return;
    }

    const planRequest = createPlanFromPreset(
      presetName as keyof typeof TEMPLATE_PRESETS,
      isTemplate,
      startDate,
      endDate
    );

    // Use the provided name or the preset name
    planRequest.name = name || planRequest.name;

    const planId = uuidv4();
    const status = isTemplate ? 'template' : 'draft';

    await db.run('BEGIN TRANSACTION');

    try {
      // Insert plan
      await db.run(
        `INSERT INTO shift_plans (id, name, description, start_date, end_date, is_template, status, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [planId, planRequest.name, planRequest.description, startDate, endDate, isTemplate ? 1 : 0, status, userId]
      );

      // Create mapping from timeSlotKey to database timeSlotId
      const timeSlotKeyToId = new Map<string, string>();

      // Insert time slots and create mapping
      for (let i = 0; i < planRequest.timeSlots.length; i++) {
        const timeSlot = planRequest.timeSlots[i];
        const presetTimeSlot = TEMPLATE_PRESETS[presetName as keyof typeof TEMPLATE_PRESETS].timeSlots[i];
        const timeSlotId = uuidv4();
        
        await db.run(
          `INSERT INTO time_slots (id, plan_id, name, start_time, end_time, description) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [timeSlotId, planId, timeSlot.name, timeSlot.startTime, timeSlot.endTime, timeSlot.description || '']
        );

        // Store mapping using the key from preset
        timeSlotKeyToId.set(presetTimeSlot.name, timeSlotId);
      }

      // Insert shifts using the mapping
      for (const shift of planRequest.shifts) {
        const shiftId = uuidv4();
        const timeSlotId = timeSlotKeyToId.get((shift as any).timeSlotKey);
        
        if (!timeSlotId) {
          throw new Error(`Time slot key ${(shift as any).timeSlotKey} not found in mapping`);
        }

        await db.run(
          `INSERT INTO shifts (id, plan_id, day_of_week, time_slot_id, required_employees, color) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [shiftId, planId, shift.dayOfWeek, timeSlotId, shift.requiredEmployees, shift.color || '#3498db']
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
    console.error('Error creating plan from preset:', error);
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
    SELECT sp.*, e.name as created_by_name 
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
    }))
  };
}

// Helper function to generate scheduled shifts from template
async function generateScheduledShifts(planId: string, startDate: string, endDate: string): Promise<void> {
  try {
    console.log(`🔄 Generiere geplante Schichten für Plan ${planId} von ${startDate} bis ${endDate}`);
    
    // Get plan with shifts and time slots
    const plan = await getShiftPlanById(planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Generate scheduled shifts for each day in the date range
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay(); // Convert to 1-7 (Mon-Sun)

      // Find shifts for this day of week
      const shiftsForDay = plan.shifts.filter((shift: any) => shift.dayOfWeek === dayOfWeek);

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
            JSON.stringify([])
          ]
        );
      }
    }

    console.log(`✅ Geplante Schichten generiert für Plan ${planId}`);
    
  } catch (error) {
    console.error('❌ Fehler beim Generieren der geplanten Schichten:', error);
    throw error;
  }
}

export const getTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🔍 Lade Vorlagen...');

    const templates = await db.all<any>(`
      SELECT sp.*, e.name as created_by_name 
      FROM shift_plans sp
      LEFT JOIN employees e ON sp.created_by = e.id
      WHERE sp.is_template = 1
      ORDER BY sp.created_at DESC
    `);

    console.log(`✅ ${templates.length} Vorlagen gefunden:`, templates.map(t => t.name));

    const templatesWithDetails = await Promise.all(
      templates.map(async (template) => {
        const details = await getPlanWithDetails(template.id);
        return details ? { ...details.plan, timeSlots: details.timeSlots, shifts: details.shifts } : null;
      })
    );

    res.json(templatesWithDetails.filter(Boolean));
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Neue Funktion: Create from Template
export const createFromTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { templatePlanId, name, startDate, endDate, description } = req.body;
    const userId = (req as AuthRequest).user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get the template plan
    const templatePlan = await getShiftPlanById(templatePlanId);
    if (!templatePlan) {
      res.status(404).json({ error: 'Template plan not found' });
      return;
    }

    if (!templatePlan.isTemplate) {
      res.status(400).json({ error: 'Specified plan is not a template' });
      return;
    }

    const planId = uuidv4();

    await db.run('BEGIN TRANSACTION');

    try {
      // Create new plan from template
      await db.run(
        `INSERT INTO shift_plans (id, name, description, start_date, end_date, is_template, status, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [planId, name, description || templatePlan.description, startDate, endDate, 0, 'draft', userId]
      );

      // Copy time slots
      for (const timeSlot of templatePlan.timeSlots) {
        const newTimeSlotId = uuidv4();
        await db.run(
          `INSERT INTO time_slots (id, plan_id, name, start_time, end_time, description) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [newTimeSlotId, planId, timeSlot.name, timeSlot.startTime, timeSlot.endTime, timeSlot.description || '']
        );
      }

      // Get the newly created time slots
      const newTimeSlots = await db.all<any>(`
        SELECT * FROM time_slots WHERE plan_id = ? ORDER BY start_time
      `, [planId]);

      // Copy shifts
      for (const shift of templatePlan.shifts) {
        const shiftId = uuidv4();
        
        // Find matching time slot in new plan
        const originalTimeSlot = templatePlan.timeSlots.find((ts: any) => ts.id === shift.timeSlotId);
        const newTimeSlot = newTimeSlots.find((ts: any) => 
          ts.name === originalTimeSlot?.name && 
          ts.start_time === originalTimeSlot?.startTime && 
          ts.end_time === originalTimeSlot?.endTime
        );

        if (newTimeSlot) {
          await db.run(
            `INSERT INTO shifts (id, plan_id, day_of_week, time_slot_id, required_employees, color) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [shiftId, planId, shift.dayOfWeek, newTimeSlot.id, shift.requiredEmployees, shift.color || '#3498db']
          );
        }
      }

      // Generate scheduled shifts for the date range
      if (startDate && endDate) {
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
    console.error('Error creating plan from template:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Neue Funktion: Initialize Default Templates
export const initializeDefaultTemplates = async (userId: string): Promise<void> => {
  try {
    console.log('🔄 Initialisiere Standard-Vorlagen...');

    // Check if templates already exist
    const existingTemplates = await db.all<any>(
      'SELECT COUNT(*) as count FROM shift_plans WHERE is_template = 1'
    );

    if (existingTemplates[0].count > 0) {
      console.log('✅ Vorlagen existieren bereits');
      return;
    }

    await db.run('BEGIN TRANSACTION');

    try {
      // Create all template presets from shiftPlanDefaults
      for (const [presetKey, preset] of Object.entries(TEMPLATE_PRESETS)) {
        const planId = uuidv4();
        
        // Create the template plan
        await db.run(
          `INSERT INTO shift_plans (id, name, description, is_template, status, created_by) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [planId, preset.name, preset.description, true, 'template', userId]
        );

        // Create time slots with new UUIDs
        const timeSlotMap = new Map<string, string>(); // Map original timeSlotId to new UUID
        
        for (const timeSlot of preset.timeSlots) {
          const newTimeSlotId = uuidv4();
          await db.run(
            `INSERT INTO time_slots (id, plan_id, name, start_time, end_time, description) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [newTimeSlotId, planId, timeSlot.name, timeSlot.startTime, timeSlot.endTime, timeSlot.description || '']
          );
          
          // Store mapping from original timeSlotId to new UUID
          timeSlotMap.set((timeSlot as any).timeSlotId || timeSlot.name, newTimeSlotId);
        }

        // Create shifts using the time slot mapping
        for (const shift of preset.shifts) {
          const shiftId = uuidv4();
          const timeSlotId = timeSlotMap.get(shift.timeSlotId);
          
          if (timeSlotId) {
            await db.run(
              `INSERT INTO shifts (id, plan_id, day_of_week, time_slot_id, required_employees, color) 
               VALUES (?, ?, ?, ?, ?, ?)`,
              [shiftId, planId, shift.dayOfWeek, timeSlotId, shift.requiredEmployees, shift.color || '#3498db']
            );
          }
        }

        console.log(`✅ Vorlage erstellt: ${preset.name}`);
      }

      await db.run('COMMIT');
      console.log('✅ Alle Standard-Vorlagen wurden initialisiert');

    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ Fehler beim Initialisieren der Vorlagen:', error);
    throw error;
  }
};