// backend/src/controllers/authController.ts
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { db } from '../services/databaseService.js';
import { AuthRequest } from '../middleware/auth.js';

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
  email: string;
  password: string;
}

export interface JWTPayload {
  id: string; // ← VON number ZU string ÄNDERN
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  //employee_type?: string;
  //is_sufficiently_independent?: string;
  role?: string;
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginRequest;

    console.log('🔐 Login attempt for email:', email);

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich' });
    }

    // Get user from database
    const user = await db.get<UserWithPassword>(
      'SELECT id, email, password, name, role FROM users WHERE email = ? AND is_active = 1',
      [email]
    );

    console.log('🔍 User found:', user ? 'Yes' : 'No');

    if (!user) {
      console.log('❌ No user found with email:', email);
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    console.log('🔑 Password valid:', validPassword);

    if (!validPassword) {
      console.log('❌ Invalid password for user:', email);
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    // Create token payload - KORREKT: id field verwenden
    const tokenPayload = {
      id: user.id.toString(), // ← WICHTIG: Dies wird als 'id' im JWT gespeichert
      email: user.email,
      role: user.role
    };

    console.log('🎫 Creating JWT with payload:', tokenPayload);

    // Create token
    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user;

    console.log('✅ Login successful for:', user.email);

    res.json({
      user: userWithoutPassword,
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

    const user = await db.get<User>(
      'SELECT id, email, name, role FROM users WHERE id = ? AND is_active = 1',
      [jwtUser.userId] // ← HIER: userId verwenden
    );

    console.log('🔍 User found in database:', user ? 'Yes' : 'No');

    if (!user) {
      console.log('❌ User not found in database for ID:', jwtUser.userId);
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    console.log('✅ Returning user:', user.email);
    res.json({ user });
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
    const { email, password, name, role = 'user' } = req.body as RegisterRequest;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({ 
        error: 'E-Mail, Passwort und Name sind erforderlich' 
      });
    }

    // Check if email already exists
    const existingUser = await db.get<User>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser) {
      return res.status(400).json({ 
        error: 'Ein Benutzer mit dieser E-Mail existiert bereits' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await db.run(
      `INSERT INTO users (email, password, name, role) 
       VALUES (?, ?, ?, ?)`,
      [email, hashedPassword, name, role]
    );

    if (!result.lastID) {
      throw new Error('Benutzer konnte nicht erstellt werden');
    }

    // Get created user
    const newUser = await db.get<User>(
      'SELECT id, email, name, role FROM users WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json({ user: newUser });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Fehler bei der Registrierung'
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    // Note: Since we're using JWTs, we don't need to do anything server-side
    // The client should remove the token from storage
    res.json({ message: 'Erfolgreich abgemeldet' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      error: 'Fehler beim Abmelden' 
    });
  }
};