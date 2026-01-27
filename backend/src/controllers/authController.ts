// backend/src/controllers/authController.ts
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { db } from '../services/databaseService.js';
import { AuthRequest } from '../middleware/auth.js';
import { Employee, EmployeeWithPassword } from '../models/Employee.js';

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

export interface UserWithPassword extends User {
  password: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface RegisterRequest {
  username: string;
  password: string;
  firstname?: string;
  lastname?: string;
  roles?: string[];
}

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

export const login = async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body as LoginRequest;

    console.log('🔐 Login attempt for identifier:', identifier);

    if (!identifier || !password) {
      console.log('❌ Missing identifier or password');
      return res.status(400).json({ error: 'Benutzername/E-Mail und Passwort sind erforderlich' });
    }

    // Get user from database with role from employee_roles table
    const user = await db.get<any>(
      `SELECT
        e.id, e.username, e.email, e.password, e.firstname, e.lastname,
        e.employee_type, e.contract_type,
        e.can_work_alone, e.is_active, e.is_trainee,
        er.role
       FROM employees e
       LEFT JOIN employee_roles er ON e.id = er.employee_id
       WHERE (LOWER(e.email) = LOWER(?) OR LOWER(e.username) = LOWER(?)) AND e.is_active = 1
       LIMIT 1`,
      [identifier, identifier]
    );

    console.log('🔍 User found:', user ? 'Yes' : 'No');

    if (!user) {
      console.log('❌ No user found with identifier:', identifier);
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    // Update last_login with current timestamp
    const currentTimestamp = new Date().toISOString();
    await db.run(
      'UPDATE employees SET last_login = ? WHERE id = ?', 
      [currentTimestamp, user.id]
    );

    console.log('✅ Timestamp set:', currentTimestamp);

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    console.log('🔑 Password valid:', validPassword);

    if (!validPassword) {
      console.log('❌ Invalid password for user:', identifier);
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    // Create token payload
    const tokenPayload = {
      id: user.id.toString(),
      email: user.email,
      role: user.role || 'user' // Fallback to 'user' if no role found
    };

    console.log('🎫 Creating JWT with payload:', tokenPayload);

    // Create token
    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Remove password from user object and format response
    const { password: _, ...userWithoutPassword } = user;
    const userResponse = {
      ...userWithoutPassword,
      username: user.username,
      employeeType: user.employee_type,
      contractType: user.contract_type,
      canWorkAlone: user.can_work_alone === 1,
      isActive: user.is_active === 1,
      isTrainee: user.is_trainee === 1,
      roles: user.role ? [user.role] : ['user']
    };

    console.log('✅ Login successful for:', user.username || user.email);

    res.json({
      user: userResponse,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ein Fehler ist beim Login aufgetreten' });
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const jwtUser = authReq.user;
    
    console.log('🔍 Getting current user for ID:', jwtUser?.userId);
    
    if (!jwtUser?.userId) {
      console.log('❌ No user ID in JWT');
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    // Get user with role from employee_roles table
    const user = await db.get<any>(
      `SELECT
        e.id, e.username, e.email, e.firstname, e.lastname,
        e.employee_type, e.contract_type,
        e.can_work_alone, e.is_active, e.is_trainee,
        er.role
       FROM employees e
       LEFT JOIN employee_roles er ON e.id = er.employee_id
       WHERE e.id = ? AND e.is_active = 1
       LIMIT 1`,
      [jwtUser.userId]
    );

    console.log('🔍 User found in database:', user ? 'Yes' : 'No');

    if (!user) {
      console.log('❌ User not found in database for ID:', jwtUser.userId);
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    // Format user response with roles array
    const userResponse = {
      ...user,
      username: user.username,
      employeeType: user.employee_type,
      contractType: user.contract_type,
      canWorkAlone: user.can_work_alone === 1,
      isActive: user.is_active === 1,
      isTrainee: user.is_trainee === 1,
      roles: user.role ? [user.role] : ['user']
    };

    console.log('✅ Returning user:', user.username || user.email);
    res.json({ user: userResponse });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Ein Fehler ist beim Abrufen des Benutzers aufgetreten' });
  }
};

export const validateToken = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Kein Token vorhanden' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as JWTPayload;
      
      // Verify that the decoded token has the required fields
      if (!decoded.id || !decoded.email || !decoded.role) {
        throw new Error('Invalid token structure');
      }
      
      res.json({ valid: true, user: decoded });
    } catch (jwtError) {
      return res.status(401).json({ valid: false, error: 'Ungültiger Token' });
    }
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({ valid: false, error: 'Fehler bei der Token-Validierung' });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { username, password, firstname, lastname, roles = ['user'] } = req.body as RegisterRequest;

    // Validate required fields
    if (!password || !username) {
      return res.status(400).json({
        error: 'Username und Password sind erforderlich'
      });
    }

    // Generate email automatically if names provided, otherwise use username-based email
    const email = (firstname && lastname) ? generateEmail(firstname, lastname) : `${username.toLowerCase()}@sp.de`;

    // Check if username already exists
    const existingUsername = await db.get<Employee>(
      'SELECT id FROM employees WHERE username = ?',
      [username]
    );

    if (existingUsername) {
      return res.status(400).json({
        error: `Ein Benutzer mit dem Benutzernamen ${username} existiert bereits`
      });
    }

    // Check if generated email already exists
    const existingUser = await db.get<Employee>(
      'SELECT id FROM employees WHERE email = ?',
      [email]
    );

    if (existingUser) {
      return res.status(400).json({
        error: `Ein Benutzer mit der E-Mail ${email} existiert bereits`
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const employeeId = uuidv4();

    // Start transaction for registration
    await db.run('BEGIN TRANSACTION');

    try {
      const result = await db.run(
        `INSERT INTO employees (id, username, email, password, firstname, lastname, employee_type, contract_type, can_work_alone, is_active, is_trainee)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [employeeId, username, email, hashedPassword, firstname || null, lastname || null, 'personell', 'small', false, 1, false]
      );

      if (!result.lastID) {
        throw new Error('Benutzer konnte nicht erstellt werden');
      }

      // Insert roles into employee_roles table
      for (const role of roles) {
        await db.run(
          `INSERT INTO employee_roles (employee_id, role) VALUES (?, ?)`,
          [employeeId, role]
        );
      }

      await db.run('COMMIT');

      // Get created user with role
      const newUser = await db.get<any>(
        `SELECT
          e.id, e.username, e.email, e.firstname, e.lastname,
          e.employee_type, e.contract_type, e.can_work_alone, e.is_active, e.is_trainee,
          er.role
         FROM employees e
         LEFT JOIN employee_roles er ON e.id = er.employee_id
         WHERE e.id = ?
         LIMIT 1`,
        [employeeId]
      );

      // Format response with roles array
      const userResponse = {
        ...newUser,
        username: newUser.username,
        employeeType: newUser.employee_type,
        contractType: newUser.contract_type,
        canWorkAlone: newUser.can_work_alone === 1,
        isActive: newUser.is_active === 1,
        isTrainee: newUser.is_trainee === 1,
        roles: newUser.role ? [newUser.role] : ['user']
      };

      res.status(201).json({ user: userResponse });

    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Fehler bei der Registrierung'
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    res.json({ message: 'Erfolgreich abgemeldet' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      error: 'Fehler beim Abmelden' 
    });
  }
};