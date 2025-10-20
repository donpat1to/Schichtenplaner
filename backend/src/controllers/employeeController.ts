// backend/src/controllers/employeeController.ts
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { db } from '../services/databaseService.js';
import { AuthRequest } from '../middleware/auth.js';
import { CreateEmployeeRequest } from '../models/Employee.js';

function generateEmail(firstname: string, lastname: string): string {
  // Convert German umlauts to their expanded forms
  const convertUmlauts = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/ü/g, 'ue')
      .replace(/ö/g, 'oe')
      .replace(/ä/g, 'ae')
      .replace(/ß/g, 'ss');
  };

  // Remove any remaining special characters and convert to lowercase
  const cleanFirstname = convertUmlauts(firstname).replace(/[^a-z0-9]/g, '');
  const cleanLastname = convertUmlauts(lastname).replace(/[^a-z0-9]/g, '');
  
  return `${cleanFirstname}.${cleanLastname}@sp.de`;
}

export const getEmployees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('🔍 Fetching employees - User:', req.user);
    
    const { includeInactive } = req.query;
    const includeInactiveFlag = includeInactive === 'true';
    
    let query = `
      SELECT 
        id, email, firstname, lastname, role, is_active as isActive, 
        employee_type as employeeType, 
        contract_type as contractType,
        can_work_alone as canWorkAlone,
        created_at as createdAt, 
        last_login as lastLogin
      FROM employees
    `;
    
    if (!includeInactiveFlag) {
      query += ' WHERE is_active = 1';
    }
    
    query += ' ORDER BY name';
    
    const employees = await db.all<any>(query);

    console.log('✅ Employees found:', employees.length);
    res.json(employees);
  } catch (error) {
    console.error('❌ Error fetching employees:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const employee = await db.get<any>(`
      SELECT 
        id, email, firstname, lastname, role, is_active as isActive, 
        employee_type as employeeType, 
        contract_type as contractType,
        can_work_alone as canWorkAlone,
        created_at as createdAt, 
        last_login as lastLogin
      FROM employees
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

    const { 
      password, 
      firstname, 
      lastname, 
      role, 
      employeeType, 
      contractType,
      canWorkAlone
    } = req.body as CreateEmployeeRequest;

    // Validation - REMOVED email check
    if (!password || !firstname || !lastname || !role || !employeeType || !contractType) {
      console.log('❌ Validation failed: Missing required fields');
      res.status(400).json({ 
        error: 'Password, firstname, lastname, role, employeeType und contractType sind erforderlich' 
      });
      return;
    }

    // Generate email automatically
    const email = generateEmail(firstname, lastname);
    console.log('📧 Generated email:', email);

    // Check if generated email already exists
    const existingUser = await db.get<any>('SELECT id FROM employees WHERE email = ? AND is_active = 1', [email]);
    
    if (existingUser) {
      console.log('❌ Generated email already exists:', email);
      res.status(409).json({ 
        error: `Employee with email ${email} already exists. Please use different firstname/lastname.` 
      });
      return;
    }

    // Hash password and create employee
    const hashedPassword = await bcrypt.hash(password, 10);
    const employeeId = uuidv4();

    await db.run(
      `INSERT INTO employees (
        id, email, password, firstname, lastname, role, employee_type, contract_type, can_work_alone, 
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employeeId, 
        email, 
        hashedPassword, 
        firstname, 
        lastname, 
        role, 
        employeeType, 
        contractType,
        canWorkAlone ? 1 : 0,
        1
      ]
    );

    // Return created employee with generated email
    const newEmployee = await db.get<any>(`
      SELECT 
        id, email, firstname, lastname, role, is_active as isActive,
        employee_type as employeeType, 
        contract_type as contractType,
        can_work_alone as canWorkAlone,
        created_at as createdAt, 
        last_login as lastLogin
      FROM employees
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
    const { firstname, lastname, role, isActive, employeeType, contractType, canWorkAlone } = req.body;

    console.log('📝 Update Employee Request:', { id, firstname, lastname, role, isActive, employeeType, contractType, canWorkAlone });

    // Check if employee exists and get current data
    const existingEmployee = await db.get<any>('SELECT * FROM employees WHERE id = ?', [id]);
    if (!existingEmployee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    // Generate new email if firstname or lastname changed
    let email = existingEmployee.email;
    if (firstname || lastname) {
      const newFirstname = firstname || existingEmployee.firstname;
      const newLastname = lastname || existingEmployee.lastname;
      email = generateEmail(newFirstname, newLastname);
      
      // Check if new email already exists (for another employee)
      const emailExists = await db.get<any>(
        'SELECT id FROM employees WHERE email = ? AND id != ? AND is_active = 1', 
        [email, id]
      );
      
      if (emailExists) {
        res.status(409).json({ 
          error: `Cannot update name - email ${email} already exists for another employee` 
        });
        return;
      }
    }

    // Update employee with potentially new email
    await db.run(
      `UPDATE employees 
       SET firstname = COALESCE(?, firstname),
           lastname = COALESCE(?, lastname),
           email = ?,
           role = COALESCE(?, role),
           is_active = COALESCE(?, is_active),
           employee_type = COALESCE(?, employee_type),
           contract_type = COALESCE(?, contract_type),
           can_work_alone = COALESCE(?, can_work_alone)
       WHERE id = ?`,
      [firstname, lastname, email, role, isActive, employeeType, contractType, canWorkAlone, id]
    );

    console.log('✅ Employee updated successfully with email:', email);

    // Return updated employee
    const updatedEmployee = await db.get<any>(`
      SELECT 
        id, email, firstname, lastname, role, is_active as isActive, 
        employee_type as employeeType, 
        contract_type as contractType,
        can_work_alone as canWorkAlone,
        created_at as createdAt, 
        last_login as lastLogin
      FROM employees
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

    // Check if employee exists
    const existingEmployee = await db.get<any>(`
      SELECT id, email, name, is_active, role 
      FROM employees
      WHERE id = ?
    `, [id]);

    if (!existingEmployee) {
      console.log('❌ Employee not found for deletion:', id);
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    console.log('📝 Found employee to delete:', existingEmployee);

    // Start transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // 1. Remove availabilities
      await db.run('DELETE FROM employee_availability WHERE employee_id = ?', [id]);
      
      // 2. Remove from assigned_shifts (JSON field cleanup)
      interface AssignedShift {
        id: string;
        assigned_employees: string;
      }
      
      const assignedShifts = await db.all<AssignedShift>(
        'SELECT id, assigned_employees FROM scheduled_shifts WHERE json_extract(assigned_employees, "$") LIKE ?', 
        [`%${id}%`]
      );
      
      for (const shift of assignedShifts) {
        try {
          const employeesArray: string[] = JSON.parse(shift.assigned_employees || '[]');
          const filteredEmployees = employeesArray.filter((empId: string) => empId !== id);
          await db.run(
            'UPDATE scheduled_shifts SET assigned_employees = ? WHERE id = ?',
            [JSON.stringify(filteredEmployees), shift.id]
          );
        } catch (parseError) {
          console.warn(`Could not parse assigned_employees for shift ${shift.id}:`, shift.assigned_employees);
          await db.run(
            'UPDATE scheduled_shifts SET assigned_employees = ? WHERE id = ?',
            [JSON.stringify([]), shift.id]
          );
        }
      }

      // 3. Nullify created_by references
      await db.run('UPDATE shift_plans SET created_by = NULL WHERE created_by = ?', [id]);

      // 4. Finally delete the employee
      await db.run('DELETE FROM employees WHERE id = ?', [id]);

      await db.run('COMMIT');
      console.log('✅ Successfully deleted employee:', existingEmployee.email);
      
      res.status(204).send();

    } catch (error) {
      await db.run('ROLLBACK');
      console.error('Error during deletion transaction:', error);
      throw error;
    }

  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAvailabilities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId } = req.params;

    // Check if employee exists
    const existingEmployee = await db.get('SELECT id FROM employees WHERE id = ?', [employeeId]);
    if (!existingEmployee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    const availabilities = await db.all<any>(`
      SELECT ea.*, s.day_of_week, s.time_slot_id 
      FROM employee_availability ea
      JOIN shifts s ON ea.shift_id = s.id
      WHERE ea.employee_id = ? 
      ORDER BY s.day_of_week, s.time_slot_id
    `, [employeeId]);

    //console.log('✅ Successfully got availabilities from employee:', availabilities);

    res.json(availabilities.map(avail => ({
      id: avail.id,
      employeeId: avail.employee_id,
      planId: avail.plan_id,
      dayOfWeek: avail.day_of_week,
      timeSlotId: avail.time_slot_id,
      preferenceLevel: avail.preference_level,
      notes: avail.notes
    })));
  } catch (error) {
    console.error('Error fetching availabilities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateAvailabilities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId } = req.params;
    const { planId, availabilities } = req.body;

    // Check if employee exists
    const existingEmployee = await db.get('SELECT id FROM employees WHERE id = ?', [employeeId]);
    if (!existingEmployee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    await db.run('BEGIN TRANSACTION');

    try {
      // Delete existing availabilities for this plan
      await db.run('DELETE FROM employee_availability WHERE employee_id = ? AND plan_id = ?', [employeeId, planId]);

      // Insert new availabilities
      for (const availability of availabilities) {
        const availabilityId = uuidv4();
        await db.run(
          `INSERT INTO employee_availability (id, employee_id, plan_id, shift_id, preference_level, notes) 
          VALUES (?, ?, ?, ?, ?, ?)`,
          [
            availabilityId,
            employeeId,
            planId,
            availability.shiftId,
            availability.preferenceLevel,
            availability.notes || null
          ]
        );
      }

      await db.run('COMMIT');

      console.log('✅ Successfully updated availablities employee:', );


      // Return updated availabilities
      const updatedAvailabilities = await db.all<any>(`
        SELECT * FROM employee_availability 
        WHERE employee_id = ? AND plan_id = ?
        ORDER BY day_of_week, time_slot_id
      `, [employeeId, planId]);

      res.json(updatedAvailabilities.map(avail => ({
        id: avail.id,
        employeeId: avail.employee_id,
        planId: avail.plan_id,
        dayOfWeek: avail.day_of_week,
        timeSlotId: avail.time_slot_id,
        preferenceLevel: avail.preference_level,
        notes: avail.notes
      })));

      console.log('✅ Successfully updated employee:', updateAvailabilities);

    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error updating availabilities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    // Get the current user from the auth middleware
    const currentUser = (req as AuthRequest).user;
    
    // Check if user is changing their own password or is an admin
    if (currentUser?.userId !== id && currentUser?.role !== 'admin') {
      res.status(403).json({ error: 'You can only change your own password' });
      return;
    } 

    // Check if employee exists and get password
    const employee = await db.get<{ password: string }>('SELECT password FROM employees WHERE id = ?', [id]);
    if (!employee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    // For non-admin users, verify current password
    if (currentUser?.role !== 'admin') {
      const isValidPassword = await bcrypt.compare(currentPassword, employee.password);
      if (!isValidPassword) {
        res.status(400).json({ error: 'Current password is incorrect' });
        return;
      }
    }

    // Validate new password
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long' });
      return;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.run('UPDATE employees SET password = ? WHERE id = ?', [hashedPassword, id]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};