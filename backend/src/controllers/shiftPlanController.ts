// backend/src/controllers/shiftPlanController.ts
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/databaseService.js';
import { AuthRequest } from '../middleware/auth.js';
import { ShiftPlan, CreateShiftPlanRequest } from '../models/ShiftPlan.js';

export const getShiftPlans = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    let query = `
      SELECT sp.*, u.name as created_by_name 
      FROM shift_plans sp
      LEFT JOIN users u ON sp.created_by = u.id
    `;

    // Regular users can only see published plans
    if (userRole === 'user') {
      query += ` WHERE sp.status = 'published'`;
    }

    query += ` ORDER BY sp.created_at DESC`;

    const shiftPlans = await db.all<ShiftPlan>(query);

    res.json(shiftPlans);
  } catch (error) {
    console.error('Error fetching shift plans:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getShiftPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    let query = `
      SELECT sp.*, u.name as created_by_name 
      FROM shift_plans sp
      LEFT JOIN users u ON sp.created_by = u.id
      WHERE sp.id = ?
    `;

    // Regular users can only see published plans
    if (userRole === 'user') {
      query += ` AND sp.status = 'published'`;
    }

    const shiftPlan = await db.get<ShiftPlan>(query, [id]);

    if (!shiftPlan) {
      res.status(404).json({ error: 'Shift plan not found' });
      return;
    }

    // Load assigned shifts
    const assignedShifts = await db.all<any>(`
      SELECT * FROM assigned_shifts 
      WHERE shift_plan_id = ? 
      ORDER BY date, start_time
    `, [id]);

    const shiftPlanWithShifts = {
      ...shiftPlan,
      shifts: assignedShifts.map(shift => ({
        id: shift.id,
        date: shift.date,
        name: shift.name,
        startTime: shift.start_time,
        endTime: shift.end_time,
        requiredEmployees: shift.required_employees,
        assignedEmployees: JSON.parse(shift.assigned_employees || '[]')
      }))
    };

    res.json(shiftPlanWithShifts);
  } catch (error) {
    console.error('Error fetching shift plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createShiftPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, startDate, endDate, templateId }: CreateShiftPlanRequest = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!name || !startDate || !endDate) {
      res.status(400).json({ error: 'Name, start date and end date are required' });
      return;
    }

    const shiftPlanId = uuidv4();

    await db.run('BEGIN TRANSACTION');

    try {
      // Create shift plan
      await db.run(
        `INSERT INTO shift_plans (id, name, start_date, end_date, template_id, status, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [shiftPlanId, name, startDate, endDate, templateId, 'draft', userId]
      );

      // If template is provided, generate shifts from template
      if (templateId) {
        await generateShiftsFromTemplate(shiftPlanId, templateId, startDate, endDate);
      }

      await db.run('COMMIT');

      // Return created shift plan
      const createdPlan = await db.get<ShiftPlan>(`
        SELECT sp.*, u.name as created_by_name 
        FROM shift_plans sp
        LEFT JOIN users u ON sp.created_by = u.id
        WHERE sp.id = ?
      `, [shiftPlanId]);

      const assignedShifts = await db.all<any>(`
        SELECT * FROM assigned_shifts 
        WHERE shift_plan_id = ? 
        ORDER BY date, start_time
      `, [shiftPlanId]);

      res.status(201).json({
        ...createdPlan,
        shifts: assignedShifts.map(shift => ({
          id: shift.id,
          date: shift.date,
          name: shift.name,
          startTime: shift.start_time,
          endTime: shift.end_time,
          requiredEmployees: shift.required_employees,
          assignedEmployees: JSON.parse(shift.assigned_employees || '[]')
        }))
      });

    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error creating shift plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateShiftPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, status, shifts } = req.body;
    const userId = req.user?.userId;

    // Check if shift plan exists
    const existingPlan: any = await db.get('SELECT * FROM shift_plans WHERE id = ?', [id]);
    if (!existingPlan) {
      res.status(404).json({ error: 'Shift plan not found' });
      return;
    }

    // Check permissions (only admin/instandhalter or creator can update)
    if (existingPlan.created_by !== userId && !['admin', 'instandhalter'].includes(req.user?.role || '')) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    await db.run('BEGIN TRANSACTION');

    try {
      // Update shift plan
      if (name !== undefined || status !== undefined) {
        await db.run(
          `UPDATE shift_plans 
           SET name = COALESCE(?, name), 
               status = COALESCE(?, status)
           WHERE id = ?`,
          [name, status, id]
        );
      }

      // Update shifts if provided
      if (shifts) {
        for (const shift of shifts) {
          await db.run(
            `UPDATE assigned_shifts 
             SET required_employees = ?, 
                 assigned_employees = ?
             WHERE id = ? AND shift_plan_id = ?`,
            [shift.requiredEmployees, JSON.stringify(shift.assignedEmployees || []), shift.id, id]
          );
        }
      }

      await db.run('COMMIT');

      // Return updated shift plan
      const updatedPlan = await db.get<ShiftPlan>(`
        SELECT sp.*, u.name as created_by_name 
        FROM shift_plans sp
        LEFT JOIN users u ON sp.created_by = u.id
        WHERE sp.id = ?
      `, [id]);

      const assignedShifts = await db.all<any>(`
        SELECT * FROM assigned_shifts 
        WHERE shift_plan_id = ? 
        ORDER BY date, start_time
      `, [id]);

      res.json({
        ...updatedPlan,
        shifts: assignedShifts.map(shift => ({
          id: shift.id,
          date: shift.date,
          startTime: shift.start_time,
          endTime: shift.end_time,
          requiredEmployees: shift.required_employees,
          assignedEmployees: JSON.parse(shift.assigned_employees || '[]')
        }))
      });

    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error updating shift plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteShiftPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    // Check if shift plan exists
    const existingPlan: any = await db.get('SELECT * FROM shift_plans WHERE id = ?', [id]);
    if (!existingPlan) {
      res.status(404).json({ error: 'Shift plan not found' });
      return;
    }

    // Check permissions (only admin/instandhalter or creator can delete)
    if (existingPlan.created_by !== userId && !['admin', 'instandhalter'].includes(req.user?.role || '')) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    await db.run('DELETE FROM shift_plans WHERE id = ?', [id]);
    // Assigned shifts will be automatically deleted due to CASCADE

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting shift plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper function to generate shifts from template
async function generateShiftsFromTemplate(shiftPlanId: string, templateId: string, startDate: string, endDate: string): Promise<void> {
  try {
    console.log(`🔄 Generiere Schichten von Vorlage ${templateId} für Plan ${shiftPlanId}`);
    
    // Get template shifts with time slot information
    const templateShifts = await db.all<any>(`
      SELECT ts.*, tts.name as time_slot_name, tts.start_time, tts.end_time
      FROM template_shifts ts
      LEFT JOIN template_time_slots tts ON ts.time_slot_id = tts.id
      WHERE ts.template_id = ? 
      ORDER BY ts.day_of_week, tts.start_time
    `, [templateId]);

    console.log(`📋 Gefundene Template-Schichten: ${templateShifts.length}`);

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Generate shifts ONLY for days that have template shifts defined
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      // Convert JS day (0=Sunday) to our format (1=Monday, 7=Sunday)
      const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();

      // Find template shifts for this day of week
      const shiftsForDay = templateShifts.filter(shift => shift.day_of_week === dayOfWeek);

      // Only create shifts if there are template shifts defined for this weekday
      if (shiftsForDay.length > 0) {
        for (const templateShift of shiftsForDay) {
          const shiftId = uuidv4();
          
          await db.run(
            `INSERT INTO assigned_shifts (id, shift_plan_id, date, name, start_time, end_time, required_employees, assigned_employees) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              shiftId,
              shiftPlanId,
              date.toISOString().split('T')[0], // YYYY-MM-DD format
              templateShift.time_slot_name || 'Schicht',
              templateShift.start_time,
              templateShift.end_time,
              templateShift.required_employees,
              JSON.stringify([])
            ]
          );
        }
        console.log(`✅ ${shiftsForDay.length} Schichten erstellt für ${date.toISOString().split('T')[0]}`);
      }
    }

    console.log(`🎉 Schicht-Generierung abgeschlossen für Plan ${shiftPlanId}`);
    
  } catch (error) {
    console.error('❌ Fehler beim Generieren der Schichten:', error);
    throw error;
  }
}