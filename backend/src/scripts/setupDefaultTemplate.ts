// backend/src/scripts/setupDefaultTemplate.ts
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/databaseService.js';

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

    // Transaktion starten
    await db.run('BEGIN TRANSACTION');

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

      // Vormittagsschicht Mo-Do
      for (let day = 1; day <= 4; day++) {
        await db.run(
          `INSERT INTO template_shifts (id, template_id, day_of_week, name, start_time, end_time, required_employees) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), templateId, day, 'Vormittagsschicht', '08:00', '12:00', 1]
        );
      }

      console.log('Vormittagsschichten Mo-Do erstellt');

      // Nachmittagsschicht Mo-Do
      for (let day = 1; day <= 4; day++) {
        await db.run(
          `INSERT INTO template_shifts (id, template_id, day_of_week, name, start_time, end_time, required_employees) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), templateId, day, 'Nachmittagsschicht', '11:30', '15:30', 1]
        );
      }

      console.log('Nachmittagsschichten Mo-Do erstellt');

      // Freitag nur Vormittagsschicht
      await db.run(
        `INSERT INTO template_shifts (id, template_id, day_of_week, name, start_time, end_time, required_employees) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), templateId, 5, 'Vormittagsschicht', '08:00', '12:00', 1]
      );

      console.log('Freitag Vormittagsschicht erstellt');

      await db.run('COMMIT');
      console.log('Standard-Vorlage erfolgreich initialisiert');
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Fehler beim Erstellen der Standard-Vorlage:', error);
    throw error;
  }
}