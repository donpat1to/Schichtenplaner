// backend/src/controllers/shiftTemplateController.ts
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/databaseService.js';
import { 
  CreateShiftTemplateRequest, 
  UpdateShiftTemplateRequest 
} from '../models/ShiftTemplate.js';
import { AuthRequest } from '../middleware/auth.js';

export const getTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🔍 Lade Vorlagen...');

    const templates = await db.all<any>(`
      SELECT st.*, u.name as created_by_name 
      FROM shift_templates st
      LEFT JOIN users u ON st.created_by = u.id
      ORDER BY st.created_at DESC
    `);

    console.log(`✅ ${templates.length} Vorlagen gefunden:`, templates.map(t => t.name));

    // Für jede Vorlage die Schichten und Zeit-Slots laden
    const templatesWithShifts = await Promise.all(
      templates.map(async (template) => {
        // Lade Schicht-Slots
        const shiftSlots = await db.all<any>(`
          SELECT ts.*, tts.name as time_slot_name, tts.start_time as time_slot_start, tts.end_time as time_slot_end
          FROM template_shifts ts
          LEFT JOIN template_time_slots tts ON ts.time_slot_id = tts.id
          WHERE ts.template_id = ? 
          ORDER BY ts.day_of_week, tts.start_time
        `, [template.id]);

        // Lade Zeit-Slots
        const timeSlots = await db.all<any>(`
          SELECT * FROM template_time_slots 
          WHERE template_id = ? 
          ORDER BY start_time
        `, [template.id]);  

        return {
          ...template,
          shifts: shiftSlots.map(slot => ({
            id: slot.id,
            dayOfWeek: slot.day_of_week,
            timeSlot: {
              id: slot.time_slot_id,
              name: slot.time_slot_name,
              startTime: slot.time_slot_start,
              endTime: slot.time_slot_end
            },
            requiredEmployees: slot.required_employees,
            color: slot.color
          })),
          timeSlots: timeSlots.map(slot => ({
            id: slot.id,
            name: slot.name,
            startTime: slot.start_time,
            endTime: slot.end_time,
            description: slot.description
          }))
        };
      })
    );

    res.json(templatesWithShifts);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const template = await db.get<any>(`
      SELECT st.*, u.name as created_by_name 
      FROM shift_templates st
      LEFT JOIN users u ON st.created_by = u.id
      WHERE st.id = ?
    `, [id]);

    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    // Lade Schicht-Slots
    const shiftSlots = await db.all<any>(`
      SELECT ts.*, tts.name as time_slot_name, tts.start_time as time_slot_start, tts.end_time as time_slot_end
      FROM template_shifts ts
      LEFT JOIN template_time_slots tts ON ts.time_slot_id = tts.id
      WHERE ts.template_id = ? 
      ORDER BY ts.day_of_week, tts.start_time
    `, [id]);

    // Lade Zeit-Slots
    const timeSlots = await db.all<any>(`
      SELECT * FROM template_time_slots 
      WHERE template_id = ? 
      ORDER BY start_time
    `, [id]);

    const templateWithData = {
      ...template,
      shifts: shiftSlots.map(slot => ({
        id: slot.id,
        dayOfWeek: slot.day_of_week,
        timeSlot: {
          id: slot.time_slot_id,
          name: slot.time_slot_name,
          startTime: slot.time_slot_start,
          endTime: slot.time_slot_end
        },
        requiredEmployees: slot.required_employees,
        color: slot.color
      })),
      timeSlots: timeSlots.map(slot => ({
        id: slot.id,
        name: slot.name,
        startTime: slot.start_time,
        endTime: slot.end_time,
        description: slot.description
      }))
    };

    res.json(templateWithData);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createDefaultTemplate = async (userId: string): Promise<string> => {
  try {
    const templateId = uuidv4();
    
    await db.run('BEGIN TRANSACTION');

    try {
      // Erstelle die Standard-Vorlage
      await db.run(
        `INSERT INTO shift_templates (id, name, description, is_default, created_by) 
         VALUES (?, ?, ?, ?, ?)`,
        [templateId, 'Standardwoche', 'Standard Vorlage mit konfigurierten Zeit-Slots', true, userId]
      );

      // Füge Zeit-Slots hinzu
      const timeSlots = [
        { id: uuidv4(), name: 'Vormittag', startTime: '08:00', endTime: '12:00', description: 'Vormittagsschicht' },
        { id: uuidv4(), name: 'Nachmittag', startTime: '12:00', endTime: '16:00', description: 'Nachmittagsschicht' },
        { id: uuidv4(), name: 'Abend', startTime: '16:00', endTime: '20:00', description: 'Abendschicht' }
      ];

      for (const slot of timeSlots) {
        await db.run(
          `INSERT INTO template_time_slots (id, template_id, name, start_time, end_time, description) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [slot.id, templateId, slot.name, slot.startTime, slot.endTime, slot.description]
        );
      }

      // Erstelle Schichten für Mo-Do mit Zeit-Slot Referenzen
      for (let day = 1; day <= 4; day++) {
        // Vormittagsschicht
        await db.run(
          `INSERT INTO template_shifts (id, template_id, day_of_week, time_slot_id, required_employees, color) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), templateId, day, timeSlots[0].id, 1, '#3498db']
        );

        // Nachmittagsschicht
        await db.run(
          `INSERT INTO template_shifts (id, template_id, day_of_week, time_slot_id, required_employees, color) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), templateId, day, timeSlots[1].id, 1, '#e74c3c']
        );
      }

      // Freitag nur Vormittagsschicht
      await db.run(
        `INSERT INTO template_shifts (id, template_id, day_of_week, time_slot_id, required_employees, color) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), templateId, 5, timeSlots[0].id, 1, '#3498db']
      );

      await db.run('COMMIT');
      return templateId;
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating default template:', error);
    throw error;
  }
};

export const createTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, isDefault, shifts, timeSlots }: CreateShiftTemplateRequest = req.body;
    const userId = (req as AuthRequest).user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Wenn diese Vorlage als Standard markiert werden soll,
    // zuerst alle anderen Vorlagen auf nicht-Standard setzen
    if (isDefault) {
      await db.run('UPDATE shift_templates SET is_default = 0');
    }

    const templateId = uuidv4();

    // Start transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // Insert template
      await db.run(
        `INSERT INTO shift_templates (id, name, description, is_default, created_by) 
         VALUES (?, ?, ?, ?, ?)`,
        [templateId, name, description, isDefault ? 1 : 0, userId]
      );

      // Insert time slots
      for (const timeSlot of timeSlots) {
        const timeSlotId = timeSlot.id || uuidv4();
        await db.run(
          `INSERT INTO template_time_slots (id, template_id, name, start_time, end_time, description) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [timeSlotId, templateId, timeSlot.name, timeSlot.startTime, timeSlot.endTime, description]
        );
      }

      // Insert shifts
      for (const shift of shifts) {
        const shiftId = uuidv4();
        await db.run(
          `INSERT INTO template_shifts (id, template_id, day_of_week, time_slot_id, required_employees, color) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [shiftId, templateId, shift.dayOfWeek, shift.timeSlot.id, shift.requiredEmployees, shift.color || '#3498db']
        );
      }

      // If this is set as default, remove default from other templates
      if (isDefault) {
        await db.run(
          `UPDATE shift_templates SET is_default = 0 WHERE id != ? AND is_default = 1`,
          [templateId]
        );
      }

      await db.run('COMMIT');

      // Return created template
      const createdTemplate = await getTemplateById(templateId);
      res.status(201).json(createdTemplate);

    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, isDefault, shifts, timeSlots }: UpdateShiftTemplateRequest = req.body;

    // Check if template exists
    const existingTemplate = await db.get('SELECT * FROM shift_templates WHERE id = ?', [id]);
    if (!existingTemplate) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    await db.run('BEGIN TRANSACTION');

    try {
      // Wenn diese Vorlage als Standard markiert werden soll,
      // zuerst alle anderen Vorlagen auf nicht-Standard setzen
      if (isDefault) {
        await db.run('UPDATE shift_templates SET is_default = 0');
      }

      // Update template
      if (name !== undefined || description !== undefined || isDefault !== undefined) {
        await db.run(
          `UPDATE shift_templates 
           SET name = COALESCE(?, name), 
               description = COALESCE(?, description),
               is_default = COALESCE(?, is_default)
           WHERE id = ?`,
          [name, description, isDefault ? 1 : 0, id]
        );
      }

      // If updating time slots, replace all time slots
      if (timeSlots) {
        // Delete existing time slots
        await db.run('DELETE FROM template_time_slots WHERE template_id = ?', [id]);

        // Insert new time slots
        for (const timeSlot of timeSlots) {
          const timeSlotId = timeSlot.id || uuidv4();
          await db.run(
            `INSERT INTO template_time_slots (id, template_id, name, start_time, end_time, description) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [timeSlotId, id, timeSlot.name, timeSlot.startTime, timeSlot.endTime, description]
          );
        }
      }

      // If updating shifts, replace all shifts
      if (shifts) {
        // Delete existing shifts
        await db.run('DELETE FROM template_shifts WHERE template_id = ?', [id]);

        // Insert new shifts
        for (const shift of shifts) {
          const shiftId = uuidv4();
          await db.run(
            `INSERT INTO template_shifts (id, template_id, day_of_week, time_slot_id, required_employees, color) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [shiftId, id, shift.dayOfWeek, shift.timeSlot.id, shift.requiredEmployees, shift.color || '#3498db']
          );
        }
      }

      // If this is set as default, remove default from other templates
      if (isDefault) {
        await db.run(
          `UPDATE shift_templates SET is_default = 0 WHERE id != ? AND is_default = 1`,
          [id]
        );
      }

      await db.run('COMMIT');

      // Return updated template
      const updatedTemplate = await getTemplateById(id);
      res.json(updatedTemplate);

    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if template exists
    const existingTemplate = await db.get('SELECT * FROM shift_templates WHERE id = ?', [id]);
    if (!existingTemplate) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    await db.run('DELETE FROM shift_templates WHERE id = ?', [id]);
    // Template shifts and time slots will be automatically deleted due to CASCADE

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper function to get template by ID
async function getTemplateById(templateId: string): Promise<any> {
  const template = await db.get<any>(`
    SELECT st.*, u.name as created_by_name 
    FROM shift_templates st
    LEFT JOIN users u ON st.created_by = u.id
    WHERE st.id = ?
  `, [templateId]);

  if (!template) {
    return null;
  }

  // Lade Schicht-Slots
  const shiftSlots = await db.all<any>(`
    SELECT ts.*, tts.name as time_slot_name, tts.start_time as time_slot_start, tts.end_time as time_slot_end
    FROM template_shifts ts
    LEFT JOIN template_time_slots tts ON ts.time_slot_id = tts.id
    WHERE ts.template_id = ? 
    ORDER BY ts.day_of_week, tts.start_time
  `, [templateId]);

  // Lade Zeit-Slots
  const timeSlots = await db.all<any>(`
    SELECT * FROM template_time_slots 
    WHERE template_id = ? 
    ORDER BY start_time
  `, [templateId]);

  return {
    ...template,
    shifts: shiftSlots.map(slot => ({
      id: slot.id,
      dayOfWeek: slot.day_of_week,
      timeSlot: {
        id: slot.time_slot_id,
        name: slot.time_slot_name,
        startTime: slot.time_slot_start,
        endTime: slot.time_slot_end
      },
      requiredEmployees: slot.required_employees,
      color: slot.color
    })),
    timeSlots: timeSlots.map(slot => ({
      id: slot.id,
      name: slot.name,
      startTime: slot.start_time,
      endTime: slot.end_time,
      description: slot.description
    }))
  };
}