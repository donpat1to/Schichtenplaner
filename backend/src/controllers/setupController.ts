// backend/src/controllers/setupController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { db } from '../services/databaseService.js';

function generateEmail(firstname: string, lastname: string): string {
  const convertUmlauts = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/ü/g, 'ue')
      .replace(/ö/g, 'oe')
      .replace(/ä/g, 'ae')
      .replace(/ß/g, 'ss');
  };

  const cleanFirstname = convertUmlauts(firstname).replace(/[^a-z0-9]/g, '');
  const cleanLastname = convertUmlauts(lastname).replace(/[^a-z0-9]/g, '');
  
  return `${cleanFirstname}.${cleanLastname}@sp.de`;
}

export const checkSetupStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminExists = await db.get<{ 'COUNT(*)': number }>(
      `SELECT COUNT(*) 
       FROM employees e
       JOIN employee_roles er ON e.id = er.employee_id
       WHERE er.role = ? AND e.is_active = 1`,
      ['admin']
    );

    console.log('Admin exists check:', adminExists);
    
    const needsSetup = !adminExists || adminExists['COUNT(*)'] === 0;
    
    res.json({
      needsSetup: needsSetup
    });
  } catch (error) {
    console.error('Error checking setup status:', error);
    res.status(500).json({ 
      error: 'Internal server error during setup check'
    });
  }
};

export const setupAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if admin already exists
    const adminExists = await db.get<{ 'COUNT(*)': number }>(
      `SELECT COUNT(*) 
       FROM employees e
       JOIN employee_roles er ON e.id = er.employee_id
       WHERE er.role = ? AND e.is_active = 1`,
      ['admin']
    );

    console.log('🔍 Admin exists check:', adminExists);

    if (adminExists && adminExists['COUNT(*)'] > 0) {
      console.log('❌ Admin already exists');
      res.status(400).json({ error: 'Admin existiert bereits' });
      return;
    }

    const { password, firstname, lastname } = req.body;

    console.log('👤 Creating admin with data:', { firstname, lastname });

    // Validation
    if (!password || !firstname || !lastname) {
      res.status(400).json({ error: 'Passwort, Vorname und Nachname sind erforderlich' });
      return;
    }

    // Password length validation
    if (password.length < 6) {
      res.status(400).json({ error: 'Das Passwort muss mindestens 6 Zeichen lang sein' });
      return;
    }

    // Generate email automatically
    const email = generateEmail(firstname, lastname);
    console.log('📧 Generated admin email:', email);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const adminId = randomUUID();

    console.log('📝 Inserting admin user with ID:', adminId);

    // Start transaction for the entire setup process
    await db.run('BEGIN TRANSACTION');

    try {
      // ✅ CORRECTED: Create admin with valid 'manager' type and 'flexible' contract
      await db.run(
        `INSERT INTO employees (id, email, password, firstname, lastname, employee_type, contract_type, can_work_alone, is_active, is_trainee)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [adminId, email, hashedPassword, firstname, lastname, 'manager', 'flexible', true, 1, false]
      );

      // Assign admin role in employee_roles table
      await db.run(
        `INSERT INTO employee_roles (employee_id, role) VALUES (?, ?)`,
        [adminId, 'admin']
      );

      console.log('✅ Admin user created successfully with email:', email);

      // Commit the entire setup transaction
      await db.run('COMMIT');

      console.log('✅ Setup completed successfully');

      res.status(201).json({
        success: true,
        message: 'Admin erfolgreich erstellt',
        email: email,
        firstname: firstname,
        lastname: lastname
      });

    } catch (dbError) {
      await db.run('ROLLBACK');
      console.error('❌ Database error during admin creation:', dbError);
      res.status(500).json({ 
        error: 'Fehler beim Erstellen des Admin-Accounts'
      });
    }
  } catch (error) {
    console.error('❌ Error in setup:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Ein unerwarteter Fehler ist aufgetreten'
      });
    }
  }
};