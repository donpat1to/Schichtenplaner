// backend/src/controllers/employeeController.ts
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { db } from '../services/databaseService.js';
import { AuthRequest } from '../middleware/auth.js';

export const getEmployees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employees = await db.all<any>(`
      SELECT 
        id, email, name, role, is_active as isActive, 
        phone, department, created_at as createdAt, 
        last_login as lastLogin
      FROM users 
      ORDER BY name
    `);

    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const employee = await db.get<any>(`
      SELECT 
        id, email, name, role, is_active as isActive, 
        phone, department, created_at as createdAt, 
        last_login as lastLogin
      FROM users 
      WHERE id = ?
    `, [id]);

    if (!employee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    res.json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, name, role, phone, department } = req.body;

    // Validierung
    if (!email || !password || !name || !role) {
      res.status(400).json({ error: 'Email, password, name and role are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }

    // Check if email already exists
    const existingUser = await db.get<any>('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const employeeId = uuidv4();

    await db.run(
      `INSERT INTO users (id, email, password, name, role, phone, department, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [employeeId, email, hashedPassword, name, role, phone, department, 1]
    );

    // Return employee without password
    const newEmployee = await db.get<any>(`
      SELECT 
        id, email, name, role, is_active as isActive, 
        phone, department, created_at as createdAt, 
        last_login as lastLogin
      FROM users 
      WHERE id = ?
    `, [employeeId]);

    res.status(201).json(newEmployee);
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, role, isActive, phone, department } = req.body;

    // Check if employee exists
    const existingEmployee = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!existingEmployee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    // Update employee
    await db.run(
      `UPDATE users 
       SET name = COALESCE(?, name),
           role = COALESCE(?, role),
           is_active = COALESCE(?, is_active),
           phone = COALESCE(?, phone),
           department = COALESCE(?, department)
       WHERE id = ?`,
      [name, role, isActive, phone, department, id]
    );

    // Return updated employee
    const updatedEmployee = await db.get<any>(`
      SELECT 
        id, email, name, role, is_active as isActive, 
        phone, department, created_at as createdAt, 
        last_login as lastLogin
      FROM users 
      WHERE id = ?
    `, [id]);

    res.json(updatedEmployee);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if employee exists
    const existingEmployee = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!existingEmployee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    // Soft delete - set is_active to false
    await db.run('UPDATE users SET is_active = 0 WHERE id = ?', [id]);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAvailabilities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId } = req.params;

    // Check if employee exists
    const existingEmployee = await db.get('SELECT id FROM users WHERE id = ?', [employeeId]);
    if (!existingEmployee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    const availabilities = await db.all<any>(`
      SELECT * FROM employee_availabilities 
      WHERE employee_id = ? 
      ORDER BY day_of_week, start_time
    `, [employeeId]);

    res.json(availabilities.map(avail => ({
      id: avail.id,
      employeeId: avail.employee_id,
      dayOfWeek: avail.day_of_week,
      startTime: avail.start_time,
      endTime: avail.end_time,
      isAvailable: avail.is_available === 1
    })));
  } catch (error) {
    console.error('Error fetching availabilities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateAvailabilities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId } = req.params;
    const availabilities = req.body;

    // Check if employee exists
    const existingEmployee = await db.get('SELECT id FROM users WHERE id = ?', [employeeId]);
    if (!existingEmployee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    await db.run('BEGIN TRANSACTION');

    try {
      // Delete existing availabilities
      await db.run('DELETE FROM employee_availabilities WHERE employee_id = ?', [employeeId]);

      // Insert new availabilities
      for (const availability of availabilities) {
        const availabilityId = uuidv4();
        await db.run(
          `INSERT INTO employee_availabilities (id, employee_id, day_of_week, start_time, end_time, is_available) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            availabilityId,
            employeeId,
            availability.dayOfWeek,
            availability.startTime,
            availability.endTime,
            availability.isAvailable ? 1 : 0
          ]
        );
      }

      await db.run('COMMIT');

      // Return updated availabilities
      const updatedAvailabilities = await db.all<any>(`
        SELECT * FROM employee_availabilities 
        WHERE employee_id = ? 
        ORDER BY day_of_week, start_time
      `, [employeeId]);

      res.json(updatedAvailabilities.map(avail => ({
        id: avail.id,
        employeeId: avail.employee_id,
        dayOfWeek: avail.day_of_week,
        startTime: avail.start_time,
        endTime: avail.end_time,
        isAvailable: avail.is_available === 1
      })));

    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error updating availabilities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};