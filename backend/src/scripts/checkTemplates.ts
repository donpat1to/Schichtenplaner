import { db } from '../services/databaseService.js';
import { ShiftPlan } from '../models/ShiftPlan.js';

async function checkTemplates() {
  try {
    const templates = await db.all<ShiftPlan>(
      `SELECT sp.*, u.name as created_by_name 
       FROM shift_plans sp
       LEFT JOIN users u ON sp.created_by = u.id`
    );

    console.log('Templates:', templates);

    for (const template of templates) {
      const shifts = await db.all<any>(
        `SELECT * FROM template_shifts WHERE template_id = ?`,
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