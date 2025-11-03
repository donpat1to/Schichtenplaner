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

  // NEW: Load employees for export functionality
  const employees = await db.all<any>(`
    SELECT id, firstname, lastname, email, role, isActive 
    FROM employees 
    WHERE isActive = 1
    ORDER BY firstname, lastname
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
    employees: employees.map(emp => ({
      id: emp.id,
      firstname: emp.firstname,
      lastname: emp.lastname,
      email: emp.email,
      role: emp.role,
      isActive: emp.isActive === 1
    }))
  };
}

// Helper function to generate scheduled shifts from template
export const generateScheduledShifts = async(planId: string, startDate: string, endDate: string): Promise<void> => {
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

    // For now, return a simple CSV as placeholder
    // In a real implementation, you would use a library like exceljs or xlsx
    
    const csvData = generateCSVFromPlan(plan);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Schichtplan_${plan.name}_${new Date().toISOString().split('T')[0]}.xlsx"`);
    
    // For now, return CSV as placeholder - replace with actual Excel generation
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="Schichtplan_${plan.name}_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvData);

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

    // For now, return a simple HTML as placeholder
    // In a real implementation, you would use a library like pdfkit, puppeteer, or html-pdf
    
    const pdfData = generateHTMLFromPlan(plan);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Schichtplan_${plan.name}_${new Date().toISOString().split('T')[0]}.pdf"`);
    
    // For now, return HTML as placeholder - replace with actual PDF generation
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="Schichtplan_${plan.name}_${new Date().toISOString().split('T')[0]}.html"`);
    res.send(pdfData);

    console.log('✅ PDF export completed for plan:', id);

  } catch (error) {
    console.error('❌ Error exporting to PDF:', error);
    res.status(500).json({ error: 'Internal server error during PDF export' });
  }
};

// Helper function to generate CSV data
function generateCSVFromPlan(plan: any): string {
  const headers = ['Datum', 'Tag', 'Schicht', 'Zeit', 'Zugewiesene Mitarbeiter', 'Benötigte Mitarbeiter'];
  const rows: string[] = [headers.join(';')];

  // Group scheduled shifts by date for better organization
  const shiftsByDate = new Map();
  
  plan.scheduledShifts?.forEach((scheduledShift: any) => {
    const date = scheduledShift.date;
    if (!shiftsByDate.has(date)) {
      shiftsByDate.set(date, []);
    }
    shiftsByDate.get(date).push(scheduledShift);
  });

  // Sort dates chronologically
  const sortedDates = Array.from(shiftsByDate.keys()).sort();

  sortedDates.forEach(date => {
    const dateShifts = shiftsByDate.get(date);
    const dateObj = new Date(date);
    const dayName = getGermanDayName(dateObj.getDay());

    dateShifts.forEach((scheduledShift: any) => {
      const timeSlot = plan.timeSlots?.find((ts: any) => ts.id === scheduledShift.timeSlotId);
      const employeeNames = scheduledShift.assignedEmployees.map((empId: string) => {
        const employee = plan.employees?.find((emp: any) => emp.id === empId);
        return employee ? `${employee.firstname} ${employee.lastname}` : 'Unbekannt';
      }).join(', ');

      const row = [
        date,
        dayName,
        timeSlot?.name || 'Unbekannt',
        timeSlot ? `${timeSlot.startTime} - ${timeSlot.endTime}` : '',
        employeeNames || 'Keine Zuweisungen',
        scheduledShift.requiredEmployees || 2
      ].map(field => `"${field}"`).join(';');

      rows.push(row);
    });
  });

  // Add plan summary
  rows.push('');
  rows.push('Plan Zusammenfassung');
  rows.push(`"Plan Name";"${plan.name}"`);
  rows.push(`"Zeitraum";"${plan.startDate} bis ${plan.endDate}"`);
  rows.push(`"Status";"${plan.status}"`);
  rows.push(`"Erstellt von";"${plan.created_by_name || 'Unbekannt'}"`);
  rows.push(`"Erstellt am";"${plan.createdAt}"`);
  rows.push(`"Anzahl Schichten";"${plan.scheduledShifts?.length || 0}"`);

  return rows.join('\n');
}

// Helper function to generate HTML data
function generateHTMLFromPlan(plan: any): string {
  const shiftsByDate = new Map();
  
  plan.scheduledShifts?.forEach((scheduledShift: any) => {
    const date = scheduledShift.date;
    if (!shiftsByDate.has(date)) {
      shiftsByDate.set(date, []);
    }
    shiftsByDate.get(date).push(scheduledShift);
  });

  const sortedDates = Array.from(shiftsByDate.keys()).sort();

  let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Schichtplan: ${plan.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #2c3e50; }
        h2 { color: #34495e; margin-top: 30px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .summary { background-color: #e8f4fd; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .date-section { margin-bottom: 30px; }
    </style>
</head>
<body>
    <h1>Schichtplan: ${plan.name}</h1>
    
    <div class="summary">
        <h2>Plan Informationen</h2>
        <p><strong>Zeitraum:</strong> ${plan.startDate} bis ${plan.endDate}</p>
        <p><strong>Status:</strong> ${plan.status}</p>
        <p><strong>Erstellt von:</strong> ${plan.created_by_name || 'Unbekannt'}</p>
        <p><strong>Erstellt am:</strong> ${plan.createdAt}</p>
        <p><strong>Anzahl Schichten:</strong> ${plan.scheduledShifts?.length || 0}</p>
    </div>

    <h2>Schichtzuweisungen</h2>
  `;

  sortedDates.forEach(date => {
    const dateShifts = shiftsByDate.get(date);
    const dateObj = new Date(date);
    const dayName = getGermanDayName(dateObj.getDay());
    
    html += `
    <div class="date-section">
        <h3>${date} (${dayName})</h3>
        <table>
            <thead>
                <tr>
                    <th>Schicht</th>
                    <th>Zeit</th>
                    <th>Zugewiesene Mitarbeiter</th>
                    <th>Benötigte Mitarbeiter</th>
                </tr>
            </thead>
            <tbody>
    `;

    dateShifts.forEach((scheduledShift: any) => {
      const timeSlot = plan.timeSlots?.find((ts: any) => ts.id === scheduledShift.timeSlotId);
      const employeeNames = scheduledShift.assignedEmployees.map((empId: string) => {
        const employee = plan.employees?.find((emp: any) => emp.id === empId);
        return employee ? `${employee.firstname} ${employee.lastname}` : 'Unbekannt';
      }).join(', ') || 'Keine Zuweisungen';

      html += `
                <tr>
                    <td>${timeSlot?.name || 'Unbekannt'}</td>
                    <td>${timeSlot ? `${timeSlot.startTime} - ${timeSlot.endTime}` : ''}</td>
                    <td>${employeeNames}</td>
                    <td>${scheduledShift.requiredEmployees || 2}</td>
                </tr>
      `;
    });

    html += `
            </tbody>
        </table>
    </div>
    `;
  });

  html += `
    <div style="margin-top: 40px; font-size: 12px; color: #666; text-align: center;">
        Erstellt am: ${new Date().toLocaleString('de-DE')}
    </div>
</body>
</html>
  `;

  return html;
}

// Helper function to get German day names
function getGermanDayName(dayIndex: number): string {
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  return days[dayIndex];
}