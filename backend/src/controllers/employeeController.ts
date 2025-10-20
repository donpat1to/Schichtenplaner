// backend/src/controllers/employeeController.ts
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { db } from '../services/databaseService.js';
import { AuthRequest } from '../middleware/auth.js';
import { CreateEmployeeRequest } from '../models/Employee.js';

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

export const getEmployees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('🔍 Fetching employees - User:', req.user);
    
    const { includeInactive } = req.query;
    const includeInactiveFlag = includeInactive === 'true';
    
    let query = `
      SELECT 
        e.id, e.email, e.firstname, e.lastname, 
        e.is_active, 
        e.employee_type, 
        e.contract_type,
        e.can_work_alone,
        e.is_trainee,
        e.created_at, 
        e.last_login,
        er.role
      FROM employees e
      LEFT JOIN employee_roles er ON e.id = er.employee_id
    `;
    
    if (!includeInactiveFlag) {
      query += ' WHERE e.is_active = 1';
    }
    
    query += ' ORDER BY e.firstname, e.lastname';
    
    const employees = await db.all<any>(query);

    // Format employees with proper field names and roles array
    const employeesWithRoles = employees.map(emp => ({
      id: emp.id,
      email: emp.email,
      firstname: emp.firstname,
      lastname: emp.lastname,
      isActive: emp.is_active === 1,
      employeeType: emp.employee_type,
      contractType: emp.contract_type,
      canWorkAlone: emp.can_work_alone === 1,
      isTrainee: emp.is_trainee === 1,
      createdAt: emp.created_at,
      lastLogin: emp.last_login,
      roles: emp.role ? [emp.role] : ['user']
    }));

    console.log('✅ Employees found:', employeesWithRoles.length);
    res.json(employeesWithRoles);
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
        e.id, e.email, e.firstname, e.lastname, 
        e.is_active, 
        e.employee_type, 
        e.contract_type,
        e.can_work_alone,
        e.is_trainee,
        e.created_at, 
        e.last_login,
        er.role
      FROM employees e
      LEFT JOIN employee_roles er ON e.id = er.employee_id
      WHERE e.id = ?
      LIMIT 1
    `, [id]);

    if (!employee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    // Format employee with proper field names
    const employeeWithRoles = {
      id: employee.id,
      email: employee.email,
      firstname: employee.firstname,
      lastname: employee.lastname,
      isActive: employee.is_active === 1,
      employeeType: employee.employee_type,
      contractType: employee.contract_type,
      canWorkAlone: employee.can_work_alone === 1,
      isTrainee: employee.is_trainee === 1,
      createdAt: employee.created_at,
      lastLogin: employee.last_login,
      roles: employee.role ? [employee.role] : ['user']
    };

    res.json(employeeWithRoles);
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
      roles = ['user'],
      employeeType, 
      contractType,
      canWorkAlone = false,
      isTrainee = false
    } = req.body as CreateEmployeeRequest;

    // Validation
    if (!password || !firstname || !lastname || !employeeType) {
      console.log('❌ Validation failed: Missing required fields');
      res.status(400).json({ 
        error: 'Password, firstname, lastname und employeeType sind erforderlich' 
      });
      return;
    }

    // ✅ ENHANCED: Validate employee type exists and get category info
    const employeeTypeInfo = await db.get<{type: string, category: string, has_contract_type: number}>(
      'SELECT type, category, has_contract_type FROM employee_types WHERE type = ?',
      [employeeType]
    );

    if (!employeeTypeInfo) {
      res.status(400).json({ 
        error: `Ungültiger employeeType: ${employeeType}. Gültige Typen: manager, personell, apprentice, guest` 
      });
      return;
    }

    // ✅ ENHANCED: Contract type validation based on category
    if (employeeTypeInfo.has_contract_type === 1) {
      // Internal types require contract type
      if (!contractType) {
        res.status(400).json({ 
          error: `contractType ist erforderlich für employeeType: ${employeeType}` 
        });
        return;
      }
      if (!['small', 'large', 'flexible'].includes(contractType)) {
        res.status(400).json({ 
          error: `Ungültiger contractType: ${contractType}. Gültige Werte: small, large, flexible` 
        });
        return;
      }
    } else {
      // External types (guest) should not have contract type
      if (contractType) {
        res.status(400).json({ 
          error: `contractType ist nicht erlaubt für employeeType: ${employeeType}` 
        });
        return;
      }
    }

    // ✅ ENHANCED: isTrainee validation - only applicable for personell type
    if (isTrainee && employeeType !== 'personell') {
      res.status(400).json({ 
        error: `isTrainee ist nur für employeeType 'personell' erlaubt` 
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

    // Start transaction for employee creation and role assignment
    await db.run('BEGIN TRANSACTION');

    try {
      // Insert employee with proper contract type handling
      await db.run(
        `INSERT INTO employees (
          id, email, password, firstname, lastname, employee_type, contract_type, can_work_alone, 
          is_active, is_trainee
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          employeeId, 
          email, 
          hashedPassword, 
          firstname, 
          lastname, 
          employeeType, 
          contractType, // Will be NULL for external types
          canWorkAlone ? 1 : 0,
          1,
          isTrainee ? 1 : 0
        ]
      );

      // Insert roles into employee_roles table
      for (const role of roles) {
        await db.run(
          `INSERT INTO employee_roles (employee_id, role) VALUES (?, ?)`,
          [employeeId, role]
        );
      }

      await db.run('COMMIT');

      // Return created employee
      const newEmployee = await db.get<any>(`
        SELECT 
          e.id, e.email, e.firstname, e.lastname, 
          e.is_active,
          e.employee_type, 
          e.contract_type,
          e.can_work_alone,
          e.is_trainee,
          e.created_at, 
          e.last_login,
          er.role
        FROM employees e
        LEFT JOIN employee_roles er ON e.id = er.employee_id
        WHERE e.id = ?
        LIMIT 1
      `, [employeeId]);

      // Format response with proper field names
      const employeeWithRoles = {
        id: newEmployee.id,
        email: newEmployee.email,
        firstname: newEmployee.firstname,
        lastname: newEmployee.lastname,
        isActive: newEmployee.is_active === 1,
        employeeType: newEmployee.employee_type,
        contractType: newEmployee.contract_type,
        canWorkAlone: newEmployee.can_work_alone === 1,
        isTrainee: newEmployee.is_trainee === 1,
        createdAt: newEmployee.created_at,
        lastLogin: newEmployee.last_login,
        roles: newEmployee.role ? [newEmployee.role] : ['user']
      };

      res.status(201).json(employeeWithRoles);

    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { firstname, lastname, roles, isActive, employeeType, contractType, canWorkAlone, isTrainee } = req.body;

    console.log('📝 Update Employee Request:', { 
      id, firstname, lastname, roles, isActive, 
      employeeType, contractType, canWorkAlone, isTrainee 
    });

    // Check if employee exists and get current data
    const existingEmployee = await db.get<any>('SELECT * FROM employees WHERE id = ?', [id]);
    if (!existingEmployee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    // Validate employee type if provided
    if (employeeType) {
      const validEmployeeType = await db.get(
        'SELECT type FROM employee_types WHERE type = ?',
        [employeeType]
      );

      if (!validEmployeeType) {
        res.status(400).json({ 
          error: `Ungültiger employeeType: ${employeeType}` 
        });
        return;
      }
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

    // Start transaction for employee update and role management
    await db.run('BEGIN TRANSACTION');

    try {
      // Update employee with new schema
      await db.run(
        `UPDATE employees 
         SET firstname = COALESCE(?, firstname),
             lastname = COALESCE(?, lastname),
             email = ?,
             is_active = COALESCE(?, is_active),
             employee_type = COALESCE(?, employee_type),
             contract_type = COALESCE(?, contract_type),
             can_work_alone = COALESCE(?, can_work_alone),
             is_trainee = COALESCE(?, is_trainee)
         WHERE id = ?`,
        [firstname, lastname, email, isActive, employeeType, contractType, canWorkAlone, isTrainee, id]
      );

      // Update roles if provided
      if (roles) {
        // Delete existing roles
        await db.run('DELETE FROM employee_roles WHERE employee_id = ?', [id]);
        
        // Insert new roles
        for (const role of roles) {
          await db.run(
            `INSERT INTO employee_roles (employee_id, role) VALUES (?, ?)`,
            [id, role]
          );
        }
      }

      await db.run('COMMIT');

      console.log('✅ Employee updated successfully with email:', email);

      // Return updated employee
      const updatedEmployee = await db.get<any>(`
        SELECT 
          e.id, e.email, e.firstname, e.lastname, 
          e.is_active, 
          e.employee_type, 
          e.contract_type,
          e.can_work_alone,
          e.is_trainee,
          e.created_at, 
          e.last_login,
          er.role
        FROM employees e
        LEFT JOIN employee_roles er ON e.id = er.employee_id
        WHERE e.id = ?
        LIMIT 1
      `, [id]);

      // Format response with proper field names
      const employeeWithRoles = {
        id: updatedEmployee.id,
        email: updatedEmployee.email,
        firstname: updatedEmployee.firstname,
        lastname: updatedEmployee.lastname,
        isActive: updatedEmployee.is_active === 1,
        employeeType: updatedEmployee.employee_type,
        contractType: updatedEmployee.contract_type,
        canWorkAlone: updatedEmployee.can_work_alone === 1,
        isTrainee: updatedEmployee.is_trainee === 1,
        createdAt: updatedEmployee.created_at,
        lastLogin: updatedEmployee.last_login,
        roles: updatedEmployee.role ? [updatedEmployee.role] : ['user']
      };

      res.json(employeeWithRoles);

    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteEmployee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    console.log('🗑️ Starting deletion process for employee ID:', id);

    // UPDATED: Check if employee exists with role from employee_roles
    const existingEmployee = await db.get<any>(`
      SELECT 
        e.id, e.email, e.firstname, e.lastname, e.is_active,
        er.role
      FROM employees e
      LEFT JOIN employee_roles er ON e.id = er.employee_id
      WHERE e.id = ?
      LIMIT 1
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

      // 3. Remove roles from employee_roles
      await db.run('DELETE FROM employee_roles WHERE employee_id = ?', [id]);

      // 4. Nullify created_by references
      await db.run('UPDATE shift_plans SET created_by = NULL WHERE created_by = ?', [id]);

      // 5. Finally delete the employee
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

    res.json(availabilities.map(avail => ({
      id: avail.id,
      employeeId: avail.employee_id,
      planId: avail.plan_id,
      shiftId: avail.shift_id,
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

      // Return updated availabilities
      const updatedAvailabilities = await db.all<any>(`
        SELECT ea.*, s.day_of_week, s.time_slot_id 
        FROM employee_availability ea
        JOIN shifts s ON ea.shift_id = s.id
        WHERE ea.employee_id = ? AND ea.plan_id = ?
        ORDER BY s.day_of_week, s.time_slot_id
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

      console.log('✅ Successfully updated employee availabilities');

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

export const updateLastLogin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if employee exists
    const employee = await db.get('SELECT id FROM employees WHERE id = ?', [id]);
    if (!employee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    // Update last_login with current timestamp
    const currentTimestamp = new Date().toISOString();
    await db.run(
      'UPDATE employees SET last_login = ? WHERE id = ?', 
      [currentTimestamp, id]
    );

    console.log(`✅ Last login updated for employee ${id}: ${currentTimestamp}`);
    
    res.json({ 
      message: 'Last login updated successfully',
      lastLogin: currentTimestamp
    });
  } catch (error) {
    console.error('Error updating last login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};