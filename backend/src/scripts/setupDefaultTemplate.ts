// backend/src/scripts/setupDefaultTemplate.ts
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/databaseService.js';
import { DEFAULT_ZEBRA_TIME_SLOTS } from '../models/defaults/shiftPlanDefaults.js';

interface AdminUser {
  id: string;
}

/**
 * Sets up the default shift template if it doesn't exist
 * @returns {Promise<void>}
 */
export async function setupDefaultTemplate(): Promise<void> {
  try {
    // Prüfen ob bereits eine Standard-Vorlage existiert - KORREKTUR: shift_plans verwenden
    const existingDefault = await db.get(
      'SELECT * FROM shift_plans WHERE is_template = 1 AND name = ?',
      ['Standardwoche']
    );

    if (existingDefault) {
      console.log('Standard-Vorlage existiert bereits');
      return;
    }

    // Admin-Benutzer für die Standard-Vorlage finden - KORREKTUR: employees verwenden
    const adminUser = await db.get<AdminUser>(
      'SELECT id FROM employees WHERE role = ?',
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

    try {
      // Standard-Vorlage erstellen - KORREKTUR: shift_plans verwenden
      await db.run(
        `INSERT INTO shift_plans (id, name, description, is_template, status, created_by) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          templateId,
          'Standardwoche',
          'Mo-Do: Vormittags- und Nachmittagsschicht, Fr: nur Vormittagsschicht',
          1, // is_template = true
          'template', // status = 'template'
          adminUser.id
        ]
      );

      console.log('Standard-Vorlage erstellt:', templateId);

      // Zeit-Slots erstellen - KORREKTUR: time_slots verwenden
      const timeSlots = DEFAULT_ZEBRA_TIME_SLOTS.map(slot => ({
        ...slot,
        id: uuidv4()
      }));

      for (const slot of timeSlots) {
        await db.run(
          `INSERT INTO time_slots (id, plan_id, name, start_time, end_time, description) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [slot.id, templateId, slot.name, slot.startTime, slot.endTime, slot.description]
        );
      }

      console.log('✅ Zeit-Slots erstellt');

      // Schichten für Mo-Do - KORREKTUR: shifts verwenden
      for (let day = 1; day <= 4; day++) {
        // Vormittagsschicht
        await db.run(
          `INSERT INTO shifts (id, plan_id, day_of_week, time_slot_id, required_employees, color) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), templateId, day, timeSlots[0].id, 2, '#3498db']
        );

        // Nachmittagsschicht
        await db.run(
          `INSERT INTO shifts (id, plan_id, day_of_week, time_slot_id, required_employees, color) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), templateId, day, timeSlots[1].id, 2, '#e74c3c']
        );
      }

      // Freitag nur Vormittagsschicht
      await db.run(
        `INSERT INTO shifts (id, plan_id, day_of_week, time_slot_id, required_employees, color) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), templateId, 5, timeSlots[0].id, 2, '#3498db']
      );

      console.log('✅ Schichten erstellt');

      // In der problematischen Stelle: KORREKTUR: shift_plans verwenden
      const createdTemplate = await db.get(
        'SELECT * FROM shift_plans WHERE id = ?',
        [templateId]
      ) as { name: string } | undefined;
      console.log('📋 Erstellte Vorlage:', createdTemplate?.name);

      const shiftCount = await db.get(
        'SELECT COUNT(*) as count FROM shifts WHERE plan_id = ?',
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