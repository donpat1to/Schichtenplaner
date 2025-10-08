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
      WHERE is_active = 1
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
    console.log('🔍 Starting employee creation process with data:', {
      ...req.body,
      password: '***hidden***'
    });

    const { email, password, name, role, phone, department } = req.body;

    // Validierung
    if (!email || !password || !name || !role) {
      console.log('❌ Validation failed: Missing required fields');
      res.status(400).json({ error: 'Email, password, name and role are required' });
      return;
    }

    if (password.length < 6) {
      console.log('❌ Validation failed: Password too short');
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }

    // First check for ANY user with this email to debug
    const allUsersWithEmail = await db.all<any>('SELECT id, email, is_active FROM users WHERE email = ?', [email]);
    console.log('🔍 Found existing users with this email:', allUsersWithEmail);

    // Check if email already exists among active users only
    const existingActiveUser = await db.get<any>('SELECT id, is_active FROM users WHERE email = ? AND is_active = 1', [email]);
    console.log('🔍 Checking active users with this email:', existingActiveUser);
    
    if (existingActiveUser) {
      console.log('❌ Email exists for active user:', existingActiveUser);
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
    console.log('🗑️ Starting deletion process for employee ID:', id);

    // Get full employee details first
    const existingEmployee = await db.get<any>(`
      SELECT id, email, name, is_active, role 
      FROM users 
      WHERE id = ?
    `, [id]);

    if (!existingEmployee) {
      console.log('❌ Employee not found for deletion:', id);
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    console.log('📝 Found employee to delete:', existingEmployee);

    try {
      // Start transaction
      await db.run('BEGIN TRANSACTION');

      // Remove all references first
      const queries = [
        // 1. Remove availabilities
        'DELETE FROM employee_availabilities WHERE employee_id = ?',
        
        // 2. Remove from assigned shifts
        `UPDATE assigned_shifts 
         SET assigned_employees = json_remove(
           assigned_employees, 
           '$[' || (
             SELECT key 
             FROM json_each(assigned_employees) 
             WHERE value = ? 
             LIMIT 1
           ) || ']'
         )
         WHERE json_extract(assigned_employees, '$') LIKE ?`,

        // 3. Nullify references
        'UPDATE shift_plans SET created_by = NULL WHERE created_by = ?',
        'UPDATE shift_templates SET created_by = NULL WHERE created_by = ?',

        // 4. Delete the user
        'DELETE FROM users WHERE id = ?'
      ];

      // Execute all cleanup queries
      for (const query of queries) {
        if (query.includes('json_extract')) {
          await db.run(query, [id, `%${id}%`]);
        } else {
          await db.run(query, [id]);
        }
      }

      // Verify the deletion
      const verifyDeletion = await db.get<{count: number}>(`
        SELECT 
          (SELECT COUNT(*) FROM users WHERE id = ?) + 
          (SELECT COUNT(*) FROM employee_availabilities WHERE employee_id = ?) + 
          (SELECT COUNT(*) FROM assigned_shifts WHERE json_extract(assigned_employees, '$') LIKE ?) as count
      `, [id, id, `%${id}%`]);

      if ((verifyDeletion?.count ?? 0) > 0) {
        throw new Error('Failed to remove all references to the employee');
      }

      // If we got here, everything worked
      await db.run('COMMIT');
      console.log('✅ Successfully deleted employee:', existingEmployee.email);
      
      res.status(204).send();
    } catch (error) {
      console.error('Error during deletion, rolling back:', error);
      await db.run('ROLLBACK');
      throw error;
    }

    console.log('Attempting to delete employee:', { id, email: existingEmployee.email });

    try {
      // Start a transaction to ensure all deletes succeed or none do
      await db.run('BEGIN TRANSACTION');

      console.log('Starting transaction for deletion of employee:', id);

      // First verify the current state
      const beforeState = await db.all(`
        SELECT 
          (SELECT COUNT(*) FROM employee_availabilities WHERE employee_id = ?) as avail_count,
          (SELECT COUNT(*) FROM shift_templates WHERE created_by = ?) as template_count,
          (SELECT COUNT(*) FROM shift_plans WHERE created_by = ?) as plan_count,
          (SELECT COUNT(*) FROM users WHERE id = ?) as user_count
      `, [id, id, id, id]);
      console.log('Before deletion state:', beforeState[0]);

      // Clear all references first
      await db.run(`DELETE FROM employee_availabilities WHERE employee_id = ?`, [id]);
      await db.run(`UPDATE shift_plans SET created_by = NULL WHERE created_by = ?`, [id]);
      await db.run(`UPDATE shift_templates SET created_by = NULL WHERE created_by = ?`, [id]);
      await db.run(`UPDATE assigned_shifts 
        SET assigned_employees = json_remove(assigned_employees, '$[' || json_each.key || ']')
        FROM json_each(assigned_shifts.assigned_employees)
        WHERE json_each.value = ?`, [id]);

      // Now delete the user
      await db.run('DELETE FROM users WHERE id = ?', [id]);
      
      // Verify the deletion
      const verifyAfterDelete = await db.all(`
        SELECT 
          (SELECT COUNT(*) FROM users WHERE id = ?) as user_exists,
          (SELECT COUNT(*) FROM users WHERE email = ?) as email_exists,
          (SELECT COUNT(*) FROM users WHERE email = ? AND is_active = 1) as active_email_exists
      `, [id, existingEmployee.email, existingEmployee.email]);
      
      console.log('🔍 Verification after delete:', verifyAfterDelete[0]);

      // Verify the deletion worked
      const verifyDeletion = await db.all<{user_count: number, avail_count: number, shift_refs: number}>(`
        SELECT 
          (SELECT COUNT(*) FROM users WHERE id = ?) as user_count,
          (SELECT COUNT(*) FROM employee_availabilities WHERE employee_id = ?) as avail_count,
          (SELECT COUNT(*) FROM assigned_shifts WHERE json_extract(assigned_employees, '$') LIKE ?) as shift_refs
      `, [id, id, `%${id}%`]);

      const counts = verifyDeletion[0];
      if (!counts || counts.user_count > 0 || counts.avail_count > 0 || counts.shift_refs > 0) {
        console.error('Deletion verification failed:', counts);
        await db.run('ROLLBACK');
        throw new Error('Failed to delete all user data');
      }

      // If we got here, the deletion was successful
      await db.run('COMMIT');
      console.log('✅ Deletion committed successfully');

      // Final verification after commit
      const finalCheck = await db.get('SELECT * FROM users WHERE email = ?', [existingEmployee.email]);
      console.log('🔍 Final verification - any user with this email:', finalCheck);
    } catch (err) {
      console.error('Error during deletion transaction:', err);
      await db.run('ROLLBACK');
      throw err;
    }

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