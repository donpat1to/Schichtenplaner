// backend/src/scripts/setupDefaultTemplate.ts
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/databaseService.js';
import { DEFAULT_ZEBRA_TIME_SLOTS, TemplateShift } from '../models/ShiftPlan.js';

interface AdminUser {
  id: string;
}

/**
 * Sets up the default shift template if it doesn't exist
 * @returns {Promise<void>}
 */
export async function setupDefaultTemplate(): Promise<void> {
  try {
    // Prüfen ob bereits eine Standard-Vorlage existiert
    const existingDefault = await db.get(
      'SELECT * FROM shift_templates WHERE is_default = 1'
    );

    if (existingDefault) {
      console.log('Standard-Vorlage existiert bereits');
      return;
    }

    // Admin-Benutzer für die Standard-Vorlage finden
    const adminUser = await db.get<AdminUser>(
      'SELECT id FROM users WHERE role = ?',
      ['admin']
    );

    if (!adminUser) {
      console.log('Kein Admin-Benutzer gefunden. Standard-Vorlage kann nicht erstellt werden.');
      return;
    }

    const templateId = uuidv4();
    console.log('🔄 Erstelle Standard-Vorlage mit ID:', templateId);

    // Transaktion starten
    await db.run('BEGIN TRANSACTION');

    const timeSlots = DEFAULT_TIME_SLOTS;


    try {
      // Standard-Vorlage erstellen
      await db.run(
        `INSERT INTO shift_templates (id, name, description, is_default, created_by) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          templateId,
          'Standard Wochenplan',
          'Mo-Do: Vormittags- und Nachmittagsschicht, Fr: nur Vormittagsschicht',
          1,
          adminUser.id
        ]
      );

      console.log('Standard-Vorlage erstellt:', templateId);

      for (const slot of timeSlots) {
        await db.run(
          `INSERT INTO template_time_slots (id, template_id, name, start_time, end_time) 
           VALUES (?, ?, ?, ?, ?)`,
          [slot.id, templateId, slot.name, slot.startTime, slot.endTime]
        );
      }

      console.log('✅ Zeit-Slots erstellt');

      // Schichten für Mo-Do
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

      console.log('✅ Schichten erstellt');

      // In der problematischen Stelle:
      const createdTemplate = await db.get(
        'SELECT * FROM shift_templates WHERE id = ?',
        [templateId]
      ) as { name: string } | undefined;
      console.log('📋 Erstellte Vorlage:', createdTemplate?.name);

      const shiftCount = await db.get(
        'SELECT COUNT(*) as count FROM template_shifts WHERE template_id = ?',
        [templateId]
      ) as { count: number } | undefined;
      console.log(`📊 Anzahl Schichten: ${shiftCount?.count}`);

      await db.run('COMMIT');
      console.log('🎉 Standard-Vorlage erfolgreich initialisiert');

    } catch (error) {
      await db.run('ROLLBACK');
      console.error('❌ Fehler beim Erstellen der Vorlage:', error);
      throw error;
    }
  } catch (error) {
    console.error('❌ Fehler in setupDefaultTemplate:', error);
  }
}