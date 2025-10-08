// backend/src/controllers/setupController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/databaseService.js';

export const checkSetupStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    // First, ensure database is properly initialized
    try {
      const adminExists = await db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM users WHERE role = ?',
        ['admin']
      );

      res.json({
        needsSetup: !adminExists || adminExists.count === 0,
        message: adminExists && adminExists.count > 0 ? 'Admin user exists' : 'No admin user found'
      });
    } catch (dbError) {
      console.error('Database error in checkSetupStatus:', dbError);
      // If there's a database error, assume setup is needed
      res.json({
        needsSetup: true,
        message: 'Database not ready, setup required'
      });
    }
  } catch (error) {
    console.error('Error checking setup status:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      needsSetup: true 
    });
  }
};

export const setupAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if admin already exists
    const adminExists = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM users WHERE role = ?',
      ['admin']
    );

    if (adminExists && adminExists.count > 0) {
      res.status(400).json({ error: 'Admin user already exists' });
      return;
    }

    const { email, password, name, phone, department } = req.body;

    // Validation
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    // Password length validation
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }

    // Check if email already exists
    const existingUser = await db.get<{ id: string }>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser) {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const adminId = uuidv4();

    // Create admin user
    await db.run(
      `INSERT INTO users (id, email, password, name, role, phone, department, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [adminId, email, hashedPassword, name, 'admin', phone || null, department || null, true]
    );

    res.status(201).json({
      message: 'Admin user created successfully',
      userId: adminId,
      email: email
    });
  } catch (error) {
    console.error('Error in setup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};