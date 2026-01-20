// backend/src/server.ts
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './scripts/initializeDatabase.js';
import fs from 'fs';
import helmet from 'helmet';
import type { ViteDevServer } from 'vite';

// Route imports
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import shiftPlanRoutes from './routes/shiftPlans.js';
import weeklyPlanRoutes from './routes/weeklyPlans.js';
import setupRoutes from './routes/setup.js';
import scheduledShifts from './routes/scheduledShifts.js';
import schedulingRoutes from './routes/scheduling.js';
import {
  apiLimiter,
  authLimiter,
  expensiveEndpointLimiter
} from './middleware/rateLimit.js';
import { ipSecurityCheck as authIpCheck } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3002;
const isDevelopment = process.env.NODE_ENV === 'development';
if (isDevelopment) {
  console.log('🔧 Running in Development mode');
} else if (process.env.NODE_ENV === 'production') {
  console.log('🚀 Running in Production mode');
} else {
  console.log('⚠️  NODE_ENV not set, defaulting to Development mode');
  console.error('❌ Please set NODE_ENV to "production" or "development" for proper behavior.');
  process.exit(1);
}

app.use(authIpCheck);

let vite: ViteDevServer | undefined;

if (isDevelopment) {
  // Dynamically import and setup Vite middleware
  const setupViteDevServer = async () => {
    try {
      const { createServer } = await import('vite');
      vite = await createServer({
        server: { middlewareMode: true },
        appType: 'spa'
      });
      app.use(vite.middlewares);
      console.log('🔧 Vite dev server integrated with Express');
    } catch (error) {
      console.warn('⚠️ Vite integration failed, using static files:', error);
    }
  };
  setupViteDevServer();
}

const configureStaticFiles = () => {
  const staticConfig = {
    maxAge: '1y',
    etag: false,
    immutable: true,
    index: false
  };

  // Serve frontend build
  const frontendPath = '/app/frontend-build';
  if (fs.existsSync(frontendPath)) {
    console.log('✅ Serving frontend from:', frontendPath);
    app.use(express.static(frontendPath, staticConfig));
  }

  // Serve premium assets if available
  const premiumPath = '/app/premium-dist';
  if (fs.existsSync(premiumPath)) {
    console.log('✅ Serving premium assets from:', premiumPath);
    app.use('/premium-assets', express.static(premiumPath, staticConfig));
  }
};

// Security configuration
if (process.env.NODE_ENV === 'production') {
  console.info('Checking for JWT_SECRET');
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-please-change') {
    console.error('❌ Fatal: JWT_SECRET not set or using default value');
    process.exit(1);
  }
}

const configureTrustProxy = (): string | string[] | boolean | number => {
  const trustedProxyIps = process.env.TRUSTED_PROXY_IPS;
  const trustProxyEnabled = process.env.TRUST_PROXY_ENABLED !== 'false';

  // If explicitly disabled
  if (!trustProxyEnabled) {
    console.log('🔒 Trust proxy: Disabled');
    return false;
  }

  // If specific IPs are provided via environment variable
  if (trustedProxyIps) {
    console.log('🔒 Trust proxy: Using configured IPs:', trustedProxyIps);

    // Handle comma-separated list of IPs/CIDR ranges
    if (trustedProxyIps.includes(',')) {
      return trustedProxyIps.split(',').map(ip => ip.trim());
    }

    // Handle single IP/CIDR
    return trustedProxyIps.trim();
  }

  // Default behavior for reverse proxy setup
  console.log('🔒 Trust proxy: Using reverse proxy defaults (trust all)');
  return true; // Trust all proxies when behind nginx
};

app.set('trust proxy', configureTrustProxy());

app.use((req, res, next) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const isHttps = protocol === 'https';

  // Add security warning for HTTP requests
  if (!isHttps && process.env.NODE_ENV === 'production') {
    res.setHeader('X-Security-Warning', 'This application is being accessed over HTTP. For secure communication, please use HTTPS.');

    // Log HTTP access in production
    console.warn(`⚠️  HTTP access detected: ${req.method} ${req.path} from ${req.ip}`);
  }

  next();
});

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: process.env.FORCE_HTTPS === 'true' ? [] : null
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }, // Enable HSTS for HTTPS
  crossOriginEmbedderPolicy: false
}));

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Middleware
app.use(express.json());

// Rate limiting - weniger restriktiv in Development
if (process.env.NODE_ENV === 'production') {
  console.log('🔒 Applying production rate limiting');
  app.use('/api/', apiLimiter);
} else {
  console.log('🔧 Development: Relaxed rate limiting applied');
  // In development, you might want to be more permissive
  app.use('/api/', apiLimiter);
}

// API Routes
app.use('/api/setup', setupRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/shift-plans', shiftPlanRoutes);
app.use('/api/weekly-plans', weeklyPlanRoutes);
app.use('/api/scheduled-shifts', scheduledShifts);
app.use('/api/scheduling', expensiveEndpointLimiter, schedulingRoutes);

// Health route
app.get('/api/health', (req: express.Request, res: express.Response) => {
  res.json({
    status: 'OK',
    message: 'Backend läuft!',
    timestamp: new Date().toISOString(),
    mode: process.env.NODE_ENV || 'development'
  });
});

// 🆕 IMPROVED STATIC FILE SERVING
const findFrontendBuildPath = (): string | null => {
  const possiblePaths = [
    // Production path (Docker)
    '/app/frontend-build',
    // Development paths
    path.resolve(__dirname, '../../frontend/dist'),
    path.resolve(__dirname, '../../frontend-build'),
    path.resolve(process.cwd(), '../frontend/dist'),
    path.resolve(process.cwd(), 'frontend-build'),
  ];

  for (const testPath of possiblePaths) {
    try {
      if (fs.existsSync(testPath)) {
        const indexPath = path.join(testPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          console.log('✅ Found frontend build at:', testPath);
          return testPath;
        }
      }
    } catch (error) {
      // Silent catch - just try next path
    }
  }
  return null;
};

const frontendBuildPath = findFrontendBuildPath();
configureStaticFiles();

if (frontendBuildPath) {
  app.use(express.static(frontendBuildPath));
  console.log('✅ Static file serving configured');
} else {
  console.log(isDevelopment ?
    '🔧 Development: Frontend served by Vite dev server (localhost:3003)' :
    '❌ Production: No frontend build found'
  );
}

// Root route
app.get('/', async (req, res) => {
  // In development with Vite middleware
  if (vite) {
    try {
      const template = fs.readFileSync(
        path.resolve(__dirname, '../../frontend/index.html'),
        'utf-8'
      );
      const html = await vite.transformIndexHtml(req.url, template);
      res.send(html);
    } catch (error) {
      res.status(500).send('Vite dev server error');
    }
    return;
  }

  // Fallback to static file serving
  if (!frontendBuildPath) {
    return res.status(500).send('Frontend not available');
  }

  const indexPath = path.join(frontendBuildPath, 'index.html');
  res.sendFile(indexPath);
});

// Client-side routing fallback
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }

  // Skip file extensions (assets)
  if (req.path.match(/\.[a-z0-9]+$/i)) {
    return next();
  }

  // Serve React app for all other routes
  const frontendPath = '/app/frontend-build';
  const indexPath = path.join(frontendPath, 'index.html');

  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend not available');
  }
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);

  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({
      error: 'Internal server error',
      message: 'Something went wrong'
    });
  } else {
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      stack: err.stack
    });
  }
});

// 404 handling
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize the application
const initializeApp = async () => {
  try {
    await initializeDatabase();
    const { applyMigration } = await import('./scripts/applyMigration.js');
    await applyMigration();

    if (isDevelopment && process.env.SEED_TEST_DATA === 'true') {
      try {
        const { seedTestData } = await import('./scripts/seedTestData.js');
        await seedTestData();
        console.log('✅ Test data seeded successfully');
      } catch (error) {
        console.log('⚠️ Test data seeding skipped or failed:', error);
      }
    }

    app.listen(PORT, () => {
      console.log('🎉 APPLICATION STARTED SUCCESSFULLY!');
      console.log(`📍 Port: ${PORT}`);
      console.log(`📍 Mode: ${process.env.NODE_ENV || 'development'}`);
      if (frontendBuildPath) {
        console.log(`📍 Frontend: http://localhost:${PORT}`);
      } else if (isDevelopment) {
        console.log(`📍 Frontend (Vite): http://localhost:3003`);
      }
      console.log(`📍 API: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Error during initialization:', error);
    process.exit(1);
  }
};

initializeApp();