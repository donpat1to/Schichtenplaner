// backend/src/controllers/shiftTemplateController.ts
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/databaseService.js';
import { ShiftTemplate, CreateShiftTemplateRequest, UpdateShiftTemplateRequest } from '../models/ShiftTemplate.js';

export const getTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = await db.all<ShiftTemplate>(`
      SELECT st.*, u.name as created_by_name 
      FROM shift_templates st
      LEFT JOIN users u ON st.created_by = u.id
      ORDER BY st.created_at DESC
    `);

    // Für jede Vorlage die Schichten laden
    const templatesWithShifts = await Promise.all(
      templates.map(async (template) => {
        const shifts = await db.all<any>(`
          SELECT * FROM template_shifts 
          WHERE template_id = ? 
          ORDER BY day_of_week, start_time
        `, [template.id]);

        return {
          ...template,
          shifts: shifts.map(shift => ({
            id: shift.id,
            dayOfWeek: shift.day_of_week,
            name: shift.name,
            startTime: shift.start_time,
            endTime: shift.end_time,
            requiredEmployees: shift.required_employees,
            color: shift.color
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

    const template = await db.get<ShiftTemplate>(`
      SELECT st.*, u.name as created_by_name 
      FROM shift_templates st
      LEFT JOIN users u ON st.created_by = u.id
      WHERE st.id = ?
    `, [id]);

    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const shifts = await db.all<any>(`
      SELECT * FROM template_shifts 
      WHERE template_id = ? 
      ORDER BY day_of_week, start_time
    `, [id]);

    const templateWithShifts = {
      ...template,
      shifts: shifts.map(shift => ({
        id: shift.id,
        dayOfWeek: shift.day_of_week,
        name: shift.name,
        startTime: shift.start_time,
        endTime: shift.end_time,
        requiredEmployees: shift.required_employees,
        color: shift.color
      }))
    };

    res.json(templateWithShifts);
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
        [templateId, 'Standardwoche', 'Mo-Do: 2 Schichten, Fr: 1 Schicht', true, userId]
      );

      // Vormittagsschicht Mo-Do
      for (let day = 1; day <= 4; day++) {
        await db.run(
          `INSERT INTO template_shifts (id, template_id, day_of_week, name, start_time, end_time, required_employees) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), templateId, day, 'Vormittagsschicht', '08:00', '12:00', 1]
        );
      }

      // Nachmittagsschicht Mo-Do
      for (let day = 1; day <= 4; day++) {
        await db.run(
          `INSERT INTO template_shifts (id, template_id, day_of_week, name, start_time, end_time, required_employees) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), templateId, day, 'Nachmittagsschicht', '11:30', '15:30', 1]
        );
      }

      // Freitag nur Vormittagsschicht
      await db.run(
        `INSERT INTO template_shifts (id, template_id, day_of_week, name, start_time, end_time, required_employees) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), templateId, 5, 'Vormittagsschicht', '08:00', '12:00', 1]
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
    const { name, description, isDefault, shifts }: CreateShiftTemplateRequest = req.body;
    const userId = (req as any).user?.userId; // From auth middleware

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

      // Insert shifts
      for (const shift of shifts) {
        const shiftId = uuidv4();
        await db.run(
          `INSERT INTO template_shifts (id, template_id, day_of_week, name, start_time, end_time, required_employees, color) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [shiftId, templateId, shift.dayOfWeek, shift.name, shift.startTime, shift.endTime, shift.requiredEmployees, shift.color || '#3498db']
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
      const createdTemplate = await db.get<ShiftTemplate>(`
        SELECT st.*, u.name as created_by_name 
        FROM shift_templates st
        LEFT JOIN users u ON st.created_by = u.id
        WHERE st.id = ?
      `, [templateId]);

      const templateShifts = await db.all<any>(`
        SELECT * FROM template_shifts 
        WHERE template_id = ? 
        ORDER BY day_of_week, start_time
      `, [templateId]);

      res.status(201).json({
        ...createdTemplate,
        shifts: templateShifts.map(shift => ({
          id: shift.id,
          dayOfWeek: shift.day_of_week,
          name: shift.name,
          startTime: shift.start_time,
          endTime: shift.end_time,
          requiredEmployees: shift.required_employees,
          color: shift.color
        }))
      });

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
    const { name, description, isDefault, shifts }: UpdateShiftTemplateRequest = req.body;

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

      // If updating shifts, replace all shifts
      if (shifts) {
        // Delete existing shifts
        await db.run('DELETE FROM template_shifts WHERE template_id = ?', [id]);

        // Insert new shifts
        for (const shift of shifts) {
          const shiftId = uuidv4();
          await db.run(
            `INSERT INTO template_shifts (id, template_id, day_of_week, name, start_time, end_time, required_employees, color) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [shiftId, id, shift.dayOfWeek, shift.name, shift.startTime, shift.endTime, shift.requiredEmployees, shift.color || '#3498db']
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
      const updatedTemplate = await db.get<ShiftTemplate>(`
        SELECT st.*, u.name as created_by_name 
        FROM shift_templates st
        LEFT JOIN users u ON st.created_by = u.id
        WHERE st.id = ?
      `, [id]);

      const templateShifts = await db.all<any>(`
        SELECT * FROM template_shifts 
        WHERE template_id = ? 
        ORDER BY day_of_week, start_time
      `, [id]);

      res.json({
        ...updatedTemplate,
        shifts: templateShifts.map(shift => ({
          id: shift.id,
          dayOfWeek: shift.day_of_week,
          name: shift.name,
          startTime: shift.start_time,
          endTime: shift.end_time,
          requiredEmployees: shift.required_employees,
          color: shift.color
        }))
      });

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
    // Template shifts will be automatically deleted due to CASCADE

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};