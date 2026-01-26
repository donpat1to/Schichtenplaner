// backend/src/middleware/auth.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Re-export AuthRequest as an alias for Request (for backward compatibility)
// The Express.User type is extended in types/express.d.ts
export type AuthRequest = Request;

/**
 * Authentication middleware
 * Validates JWT token and attaches user info to request
 */
export const authMiddleware: RequestHandler = (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    console.log('❌ No token provided');
    res.status(401).json({ error: 'Access denied. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: string;
    };

    // Attach user info to request using Express.User structure
    req.user = {
      userId: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (error) {
    console.error('❌ Invalid token:', error);
    res.status(400).json({ error: 'Invalid token.' });
  }
};

/**
 * Role-based authorization middleware
 * Requires user to have one of the specified roles
 */
export const requireRole = (roles: string[]): RequestHandler => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      console.log(`❌ Insufficient permissions for user: ${req.user?.email}, role: ${req.user?.role}, required: ${roles.join(', ')}`);
      res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
      return;
    }
    console.log(`✅ Role check passed for user: ${req.user.email}, role: ${req.user.role}`);
    next();
  };
};

/**
 * Get client IP address from request
 * Handles X-Forwarded-For and X-Real-IP headers
 */
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

/**
 * IP security check middleware
 * Logs authentication attempts for security monitoring
 */
export const ipSecurityCheck: RequestHandler = (req, res, next) => {
  const clientIP = getClientIP(req);

  // Log suspicious activity
  const suspiciousPaths = ['/api/auth/login', '/api/auth/register'];
  if (suspiciousPaths.includes(req.path)) {
    console.log(`🔐 Auth attempt from IP: ${clientIP}, Path: ${req.path}`);
  }

  next();
};
