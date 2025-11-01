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
  const possiblePaths = [
    // Production path (Docker)
    '/app/frontend-build',
    // Development paths
    path.resolve(__dirname, '../../frontend/dist'),
    path.resolve(__dirname, '../frontend/dist'), // Added for monorepo
    path.resolve(process.cwd(), 'frontend/dist'), // Current directory
    path.resolve(process.cwd(), '../frontend/dist'), // Parent directory
    // Vite dev server fallback
    ...(isDevelopment ? [path.resolve(__dirname, '../../frontend')] : [])
  ];

  for (const testPath of possiblePaths) {
    try {
      if (fs.existsSync(testPath)) {
        // In development, check for dist or direct source
        if (fs.existsSync(path.join(testPath, 'index.html'))) {
          console.log('✅ Found frontend at:', testPath);
          app.use(express.static(testPath));
          return testPath;
        }
        // For Vite dev server in development
        else if (isDevelopment && fs.existsSync(path.join(testPath, 'index.html'))) {
          console.log('🔧 Development: Serving frontend source from:', testPath);
          app.use(express.static(testPath));
          return testPath;
        }
      }
    } catch (error) {
      // Silent catch
    }
  }
  return null;
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
  const trustProxyEnabled = process.env.TRUST_PROXY_ENABLED !== 'false'; // Default true for production

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

  // Default behavior based on environment
  if (process.env.NODE_ENV === 'production') {
    console.log('🔒 Trust proxy: Using production defaults (private networks)');
    return [
      'loopback', 
      'linklocal', 
      'uniquelocal',
      '10.0.0.0/8',
      '172.16.0.0/12', 
      '192.168.0.0/16'
    ];
  } else {
    console.log('🔒 Trust proxy: Development mode (disabled)');
    return false;
  }
};

app.set('trust proxy', configureTrustProxy());

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
    },
  },
  hsts: false,
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
const staticPath = configureStaticFiles();

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
app.get('*', async (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next(); // API routes handled normally
  }

  // Vite dev server handling
  if (vite) {
    try {
      const template = fs.readFileSync(
        path.resolve(__dirname, '../../frontend/index.html'),
        'utf-8'
      );
      const html = await vite.transformIndexHtml(req.url, template);
      return res.send(html);
    } catch (error) {
      console.error('Vite transformation error:', error);
    }
  }

  // Static file fallback
  if (staticPath) {
    const indexPath = path.join(staticPath, 'index.html');
    return res.sendFile(indexPath);
  }

  res.status(500).send('Frontend not available');
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