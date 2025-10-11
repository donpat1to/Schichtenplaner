// backend/src/scripts/checkTemplates.ts
import { db } from '../services/databaseService.js';

async function checkTemplates() {
  try {
    // KORREKTUR: employees statt users verwenden
    const templates = await db.all<any>(
      `SELECT sp.*, e.name as created_by_name 
       FROM shift_plans sp
       LEFT JOIN employees e ON sp.created_by = e.id
       WHERE sp.is_template = 1`
    );

    console.log('Templates:', templates);

    for (const template of templates) {
      const shifts = await db.all<any>(
        `SELECT s.*, ts.name as time_slot_name 
         FROM shifts s
         LEFT JOIN time_slots ts ON s.time_slot_id = ts.id
         WHERE s.plan_id = ?`,
        [template.id]
      );
      console.log(`Shifts for template ${template.id}:`, shifts);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkTemplates();