// backend/src/controllers/setupController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { db } from '../services/databaseService.js';

export const checkSetupStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminExists = await db.get<{ 'COUNT(*)': number }>(
      'SELECT COUNT(*) FROM users WHERE role = ?',
      ['admin']
    );

    res.json({
      needsSetup: !adminExists || adminExists['COUNT(*)'] === 0
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
      'SELECT COUNT(*) FROM users WHERE role = ?',
      ['admin']
    );

    if (adminExists && adminExists['COUNT(*)'] > 0) {
      res.status(400).json({ error: 'Admin existiert bereits' });
      return;
    }

    const { password, name, phone, department } = req.body;
    const email = 'admin@instandhaltung.de'; // Fixed admin email

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

    try {
      // Create admin user
      await db.run(
        `INSERT INTO users (id, email, password, name, role, phone, department, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [adminId, email, hashedPassword, name, 'admin', phone || null, department || null, true]
      );

      res.status(201).json({
        success: true,
        message: 'Admin erfolgreich erstellt',
        email: email
      });
    } catch (dbError) {
      console.error('Database error during admin creation:', dbError);
      res.status(500).json({ 
        error: 'Fehler beim Erstellen des Admin-Accounts'
      });
    }
  } catch (error) {
    console.error('Error in setup:', error);
    res.status(500).json({ 
      error: 'Ein unerwarteter Fehler ist aufgetreten'
    });
  }
};