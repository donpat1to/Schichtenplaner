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
  //console.log('🔐 Auth middleware - Authorization header:', authHeader);
  
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    console.log('❌ No token provided');
    res.status(401).json({ error: 'Access denied. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    //console.log('✅ Token valid for user:', decoded.email, 'ID:', decoded.id);
    
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
      console.log(`❌ Insufficient permissions for user: ${req.user?.email}, role: ${req.user?.role}, required: ${roles.join(', ')}`);
      res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
      return;
    }
    console.log(`✅ Role check passed for user: ${req.user.email}, role: ${req.user.role}`);
    next();
  };
};

// Add this function to your existing auth.ts
export const getClientIP = (req: Request): string => {
  const trustedHeader = process.env.TRUSTED_PROXY_HEADER || 'x-forwarded-for';
  const forwarded = req.headers[trustedHeader];
  const realIp = req.headers['x-real-ip'];
  
  if (forwarded) {
    if (Array.isArray(forwarded)) {
      return forwarded[0].split(',')[0].trim();
    } else if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
  }
  
  if (realIp) {
    return realIp.toString();
  }
  
  return req.socket.remoteAddress || req.ip || 'unknown';
};

// Add IP-based security checks
export const ipSecurityCheck = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const clientIP = getClientIP(req);
  
  // Log suspicious activity
  const suspiciousPaths = ['/api/auth/login', '/api/auth/register'];
  if (suspiciousPaths.includes(req.path)) {
    console.log(`🔐 Auth attempt from IP: ${clientIP}, Path: ${req.path}`);
  }
  
  next();
}