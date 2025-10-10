import { db } from '../services/databaseService.js';
import { ShiftTemplate } from '../models/ShiftTemplate.js';

async function checkTemplates() {
  try {
    const templates = await db.all<ShiftTemplate>(
      `SELECT st.*, u.name as created_by_name 
       FROM shift_templates st
       LEFT JOIN users u ON st.created_by = u.id`
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