import rateLimit from 'express-rate-limit';
import { Request } from 'express';

// Secure IP extraction that works with proxy settings
const getClientIP = (req: Request): string => {
  // Read from environment which header to trust
  const trustedHeader = process.env.TRUSTED_PROXY_HEADER || 'x-forwarded-for';

  const forwarded = req.headers[trustedHeader];
  const realIp = req.headers['x-real-ip'];
  const cfConnectingIp = req.headers['cf-connecting-ip']; // Cloudflare

  // If we have a forwarded header and trust proxy is configured
  if (forwarded) {
    if (Array.isArray(forwarded)) {
      const firstIP = forwarded[0].split(',')[0].trim();
      console.log(`🔍 Extracted IP from ${trustedHeader}: ${firstIP} (from: ${forwarded[0]})`);
      return firstIP;
    } else if (typeof forwarded === 'string') {
      const firstIP = forwarded.split(',')[0].trim();
      console.log(`🔍 Extracted IP from ${trustedHeader}: ${firstIP} (from: ${forwarded})`);
      return firstIP;
    }
  }

  // Cloudflare support
  if (cfConnectingIp) {
    console.log(`🔍 Using Cloudflare IP: ${cfConnectingIp}`);
    return cfConnectingIp.toString();
  }

  // Fallback to x-real-ip
  if (realIp) {
    console.log(`🔍 Using x-real-ip: ${realIp}`);
    return realIp.toString();
  }

  // Final fallback to connection remote address
  const remoteAddress = req.socket.remoteAddress || req.ip || 'unknown';
  console.log(`🔍 Using remote address: ${remoteAddress}`);
  return remoteAddress;
};

// Helper to check if an IP is a loopback address (IPv4 or IPv6)
const isLoopbackAddress = (ip: string): boolean => {
  // IPv4 loopback: 127.0.0.0/8
  if (ip.startsWith('127.') || ip === 'localhost') {
    return true;
  }

  // IPv6 loopback: ::1
  // Also handle IPv4-mapped IPv6 addresses like ::ffff:127.0.0.1
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return true;
  }

  // Handle full IPv6 loopback notation
  if (ip.toLowerCase().startsWith('0000:0000:0000:0000:0000:0000:0000:0001') ||
    ip.toLowerCase() === '0:0:0:0:0:0:0:1') {
    return true;
  }

  return false;
};

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

  const clientIP = getClientIP(req);

  // Skip for loopback addresses (local development)
  if (isLoopbackAddress(clientIP)) {
    console.log(`✅ Loopback address skipped: ${clientIP}`);
    return true;
  }

  // Skip for whitelisted IPs from environment
  const whitelist = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];
  if (whitelist.includes(clientIP)) {
    console.log(`✅ IP whitelisted: ${clientIP}`);
    return true;
  }

  return skipPaths.includes(req.path);
};

// Environment-based configuration
const getRateLimitConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes default
    max: isProduction
      ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000')  // Stricter in production
      : parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '5000'), // More lenient in development

    // Development-specific relaxations
    skip: (req: Request) => {
      // Skip all GET requests in development for easier testing
      if (!isProduction && req.method === 'GET') {
        return true;
      }

      return shouldSkipLimit(req);
    }
  };
};

// Main API limiter - nur für POST/PUT/DELETE
export const apiLimiter = rateLimit({
  ...getRateLimitConfig(),
  message: {
    error: 'Zu viele Anfragen, bitte verlangsamen Sie Ihre Aktionen'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
  handler: (req, res) => {
    const clientIP = getClientIP(req);
    console.warn(`🚨 Rate limit exceeded for IP: ${clientIP}, Path: ${req.path}, Method: ${req.method}`);

    res.status(429).json({
      error: 'Zu viele Anfragen',
      message: 'Bitte versuchen Sie es später erneut',
      retryAfter: '15 Minuten',
      clientIP: process.env.NODE_ENV === 'development' ? clientIP : undefined // Only expose IP in dev
    });
  }
});

// Strict limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: 'Zu viele Login-Versuche, bitte versuchen Sie es später erneut'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => getClientIP(req),
  handler: (req, res) => {
    const clientIP = getClientIP(req);
    console.warn(`🚨 Auth rate limit exceeded for IP: ${clientIP}`);

    res.status(429).json({
      error: 'Zu viele Login-Versuche',
      message: 'Aus Sicherheitsgründen wurde Ihr Konto temporär gesperrt',
      retryAfter: '15 Minuten'
    });
  }
});

// Separate limiter for expensive endpoints
export const expensiveEndpointLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.EXPENSIVE_ENDPOINT_LIMIT || '100'),
  message: {
    error: 'Zu viele Anfragen für diese Ressource'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req)
});