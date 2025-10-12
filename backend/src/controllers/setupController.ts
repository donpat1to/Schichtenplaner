// backend/src/controllers/setupController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { randomUUID } from 'crypto';
import { db } from '../services/databaseService.js';
//import { initializeDefaultTemplates } from './shiftPlanController.js';

export const checkSetupStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminExists = await db.get<{ 'COUNT(*)': number }>(
      'SELECT COUNT(*) FROM employees WHERE role = ? AND is_active = 1',
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
      'SELECT COUNT(*) FROM employees WHERE role = ? AND is_active = 1',
      ['admin']
    );

    console.log('🔍 Admin exists check:', adminExists);

    if (adminExists && adminExists['COUNT(*)'] > 0) {
      console.log('❌ Admin already exists');
      res.status(400).json({ error: 'Admin existiert bereits' });
      return;
    }

    const { password, name } = req.body;
    const email = 'admin@instandhaltung.de';

    console.log('👤 Creating admin with data:', { name, email });

    // Validation
    if (!password || !name) {
      res.status(400).json({ error: 'Passwort und Name sind erforderlich' });
      return;
    }

    // Password length validation
    if (password.length < 6) {
      res.status(400).json({ error: 'Das Passwort muss mindestens 6 Zeichen lang sein' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const adminId = randomUUID();

    console.log('📝 Inserting admin user with ID:', adminId);

    // Start transaction for the entire setup process
    await db.run('BEGIN TRANSACTION');

    try {
      // Create admin user
      await db.run(
        `INSERT INTO employees (id, email, password, name, role, is_active, employee_type, contract_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [adminId, email, hashedPassword, name, 'admin', 1, 'manager', 'large']
      );

      console.log('✅ Admin user created successfully');

      // Initialize default templates WITHOUT starting a new transaction
      //console.log('🔄 Initialisiere Standard-Vorlagen...');
      //await initializeDefaultTemplates(adminId, false);

      // Commit the entire setup transaction
      await db.run('COMMIT');

      console.log('✅ Setup completed successfully');

      res.status(201).json({
        success: true,
        message: 'Admin erfolgreich erstellt',
        email: email
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