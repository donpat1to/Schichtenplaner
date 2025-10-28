import rateLimit from 'express-rate-limit';
import { Request } from 'express';

// Helper to check if request should be limited
const shouldSkipLimit = (req: Request): boolean => {
  const skipPaths = [
    '/api/health', 
    '/api/setup/status',
    '/api/auth/validate'
  ];
  
  // Skip for successful GET requests (data fetching)
  if (req.method === 'GET' && req.path.startsWith('/api/')) {
    return true;
  }
  
  return skipPaths.includes(req.path);
};

// Main API limiter - nur für POST/PUT/DELETE
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 non-GET requests per 15 minutes
  message: { 
    error: 'Zu viele Anfragen, bitte verlangsamen Sie Ihre Aktionen' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // ✅ Skip für GET requests (Data Fetching)
    if (req.method === 'GET') return true;
    
    // ✅ Skip für Health/Status Checks
    return shouldSkipLimit(req);
  }
});

// Strict limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { 
    error: 'Zu viele Login-Versuche, bitte versuchen Sie es später erneut' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});