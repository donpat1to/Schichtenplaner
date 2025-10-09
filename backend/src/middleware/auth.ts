// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.header('Authorization');
  console.log('🔐 Auth middleware - Authorization header:', authHeader);
  
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    console.log('❌ No token provided');
    res.status(401).json({ error: 'Access denied. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    console.log('✅ Token valid for user:', decoded.email, 'ID:', decoded.id);
    
    // KORREKTUR: Verwende 'id' aus dem JWT Payload
    req.user = {
      userId: decoded.id,
      email: decoded.email,
      role: decoded.role
    };
    next();
  } catch (error) {
    console.error('❌ Invalid token:', error);
    res.status(400).json({ error: 'Invalid token.' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      console.log('❌ Insufficient permissions for user:', req.user?.email);
      res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
      return;
    }
    next();
  };
};