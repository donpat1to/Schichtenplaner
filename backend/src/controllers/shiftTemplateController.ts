// backend/src/controllers/shiftPlanController.ts
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/databaseService.js';
import { AuthRequest } from '../middleware/auth.js';
import { 
  CreateShiftPlanRequest, 
  UpdateShiftPlanRequest,
  CreateShiftFromTemplateRequest
} from '../models/ShiftPlan.js';

// Get all shift plans (including templates)
export const getShiftPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🔍 Lade Schichtpläne...');

    const shiftPlans = await db.all<any>(`
      SELECT sp.*, e.name as created_by_name 
      FROM shift_plans sp
      LEFT JOIN employees e ON sp.created_by = e.id
      ORDER BY sp.created_at DESC
    `);

    console.log(`✅ ${shiftPlans.length} Schichtpläne gefunden:`, shiftPlans.map(p => p.name));

    // Für jeden Plan die Schichten und Zeit-Slots laden
    const plansWithDetails = await Promise.all(
      shiftPlans.map(async (plan) => {
        // Lade Zeit-Slots
        const timeSlots = await db.all<any>(`
          SELECT * FROM time_slots 
          WHERE plan_id = ? 
          ORDER BY start_time
        `, [plan.id]);

        // Lade Schichten
        const shifts = await db.all<any>(`
          SELECT s.*, ts.name as time_slot_name, ts.start_time, ts.end_time
          FROM shifts s
          LEFT JOIN time_slots ts ON s.time_slot_id = ts.id
          WHERE s.plan_id = ? 
          ORDER BY s.day_of_week, ts.start_time
        `, [plan.id]);

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
          }))
        };
      })
    );

    res.json(plansWithDetails);
  } catch (error) {
    console.error('Error fetching shift plans:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get templates only (plans with is_template = true)
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
        // Lade Zeit-Slots
        const timeSlots = await db.all<any>(`
          SELECT * FROM time_slots 
          WHERE plan_id = ? 
          ORDER BY start_time
        `, [template.id]);

        // Lade Schichten
        const shifts = await db.all<any>(`
          SELECT s.*, ts.name as time_slot_name, ts.start_time, ts.end_time
          FROM shifts s
          LEFT JOIN time_slots ts ON s.time_slot_id = ts.id
          WHERE s.plan_id = ? 
          ORDER BY s.day_of_week, ts.start_time
        `, [template.id]);

        return {
          ...template,
          isTemplate: true,
          startDate: template.start_date,
          endDate: template.end_date,
          createdBy: template.created_by,
          createdAt: template.created_at,
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
      })
    );

    res.json(templatesWithDetails);
  } catch (error) {
    console.error('Error fetching templates:', error);
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
        { name: 'Vormittag', startTime: '08:00', endTime: '12:00', description: 'Vormittagsschicht' },
        { name: 'Nachmittag', startTime: '11:30', endTime: '15:30', description: 'Nachmittagsschicht' }
      ];

      for (const timeSlot of timeSlots) {
        const timeSlotId = uuidv4();
        await db.run(
          `INSERT INTO time_slots (id, plan_id, name, start_time, end_time, description) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [timeSlotId, planId, timeSlot.name, timeSlot.startTime, timeSlot.endTime, timeSlot.description]
        );
      }

      // Get the created time slots to use their IDs
      const createdTimeSlots = await db.all<any>(`
        SELECT * FROM time_slots WHERE plan_id = ? ORDER BY start_time
      `, [planId]);

      // Erstelle Schichten für Mo-Do mit Zeit-Slot Referenzen
      for (let day = 1; day <= 4; day++) {
        // Vormittagsschicht
        await db.run(
          `INSERT INTO shifts (id, plan_id, day_of_week, time_slot_id, required_employees, color) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), planId, day, createdTimeSlots[0].id, 2, '#3498db']
        );

        // Nachmittagsschicht
        await db.run(
          `INSERT INTO shifts (id, plan_id, day_of_week, time_slot_id, required_employees, color) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), planId, day, createdTimeSlots[1].id, 2, '#e74c3c']
        );
      }

      // Freitag nur Vormittagsschicht
      await db.run(
        `INSERT INTO shifts (id, plan_id, day_of_week, time_slot_id, required_employees, color) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), planId, 5, createdTimeSlots[0].id, 2, '#3498db']
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
        
        // Store mapping using time slot name as key (since we don't have original IDs)
        timeSlotIdMap.set(timeSlot.name, timeSlotId);
      }

      // Insert shifts - use the mapping to find correct timeSlotId
      for (const shift of shifts) {
        const shiftId = uuidv4();
        
        // Find timeSlotId by matching with time slot names
        let finalTimeSlotId = '';
        for (const [name, id] of timeSlotIdMap.entries()) {
          // This is a simple matching logic - you might need to adjust based on your data structure
          if (shift.timeSlotId.includes(name) || name.includes(shift.timeSlotId)) {
            finalTimeSlotId = id;
            break;
          }
        }

        // If no match found, use the first time slot (fallback)
        if (!finalTimeSlotId && timeSlotIdMap.size > 0) {
          finalTimeSlotId = Array.from(timeSlotIdMap.values())[0];
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

export const createFromTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { templatePlanId, name, startDate, endDate, description }: CreateShiftFromTemplateRequest = req.body;
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

        // Insert new time slots
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

        // Insert new shifts
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