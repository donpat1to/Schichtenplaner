// backend/src/scripts/seedData.ts - Erweitert
import { db } from '../services/databaseService.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export const seedData = async () => {
  try {
    console.log('Starting database seeding...');

    // Admin User erstellen
    const adminId = uuidv4();
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await db.run(
      `INSERT OR IGNORE INTO users (id, email, password, name, role, phone, department, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [adminId, 'admin@schichtplan.de', hashedPassword, 'System Administrator', 'admin', '+49 123 456789', 'IT', 1]
    );

    // Test-Mitarbeiter erstellen
    const testUsers = [
      {
        id: uuidv4(),
        email: 'instandhalter@schichtplan.de',
        password: await bcrypt.hash('instandhalter123', 10),
        name: 'Max Instandhalter',
        role: 'instandhalter',
        phone: '+49 123 456790',
        department: 'Produktion'
      },
      {
        id: uuidv4(),
        email: 'mitarbeiter1@schichtplan.de',
        password: await bcrypt.hash('user123', 10),
        name: 'Anna Müller',
        role: 'user',
        phone: '+49 123 456791',
        department: 'Logistik'
      },
      {
        id: uuidv4(),
        email: 'mitarbeiter2@schichtplan.de',
        password: await bcrypt.hash('user123', 10),
        name: 'Tom Schmidt',
        role: 'user',
        phone: '+49 123 456792',
        department: 'Produktion'
      }
    ];

    for (const user of testUsers) {
      await db.run(
        `INSERT OR IGNORE INTO users (id, email, password, name, role, phone, department, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [user.id, user.email, user.password, user.name, user.role, user.phone, user.department, 1]
      );
    }

    // Standard Vorlage erstellen
    const templateId = uuidv4();
    await db.run(
      `INSERT OR IGNORE INTO shift_templates (id, name, description, is_default, created_by) 
       VALUES (?, ?, ?, ?, ?)`,
      [templateId, 'Standard Woche', 'Standard Schichtplan für Montag bis Freitag', 1, adminId]
    );

    // Standard Schichten
    const shifts = [
      { day: 1, name: 'Vormittag', start: '08:00', end: '12:00', employees: 2 },
      { day: 1, name: 'Nachmittag', start: '11:30', end: '15:30', employees: 2 },
      { day: 2, name: 'Vormittag', start: '08:00', end: '12:00', employees: 2 },
      { day: 2, name: 'Nachmittag', start: '11:30', end: '15:30', employees: 2 },
      { day: 3, name: 'Vormittag', start: '08:00', end: '12:00', employees: 2 },
      { day: 3, name: 'Nachmittag', start: '11:30', end: '15:30', employees: 2 },
      { day: 4, name: 'Vormittag', start: '08:00', end: '12:00', employees: 2 },
      { day: 4, name: 'Nachmittag', start: '11:30', end: '15:30', employees: 2 },
      { day: 5, name: 'Vormittag', start: '08:00', end: '12:00', employees: 2 }
    ];

    for (const shift of shifts) {
      await db.run(
        `INSERT OR IGNORE INTO template_shifts (id, template_id, day_of_week, name, start_time, end_time, required_employees) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), templateId, shift.day, shift.name, shift.start, shift.end, shift.employees]
      );
    }

    console.log('✅ Test data seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
  }
};