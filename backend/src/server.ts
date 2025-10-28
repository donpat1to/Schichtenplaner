// backend/src/server.ts
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './scripts/initializeDatabase.js';
import fs from 'fs';
import helmet from 'helmet';

// Route imports
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import shiftPlanRoutes from './routes/shiftPlans.js';
import setupRoutes from './routes/setup.js';
import scheduledShifts from './routes/scheduledShifts.js';
import schedulingRoutes from './routes/scheduling.js';
import { authLimiter, apiLimiter } from './middleware/rateLimit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3002;
const isDevelopment = process.env.NODE_ENV === 'development';

// Security configuration
if (process.env.NODE_ENV === 'production') {
  console.info('Checking for JWT_SECRET');
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-please-change') {
    console.error('❌ Fatal: JWT_SECRET not set or using default value');
    process.exit(1);
  }
}

// Security headers
app.use(helmet({
  contentSecurityPolicy: isDevelopment ? false : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
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
  app.use('/api/', apiLimiter);
} else {
  console.log('🔧 Development: Rate limiting relaxed');
}

// API Routes
app.use('/api/setup', setupRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/shift-plans', shiftPlanRoutes);
app.use('/api/scheduled-shifts', scheduledShifts);
app.use('/api/scheduling', schedulingRoutes);

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
app.get('/', (req, res) => {
  if (!frontendBuildPath) {
    if (isDevelopment) {
      return res.redirect('http://localhost:3003');
    }
    return res.status(500).send('Frontend build not found');
  }
  
  const indexPath = path.join(frontendBuildPath, 'index.html');
  res.sendFile(indexPath);
});

// Client-side routing fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  if (!frontendBuildPath) {
    if (isDevelopment) {
      return res.redirect(`http://localhost:3003${req.path}`);
    }
    return res.status(500).json({ error: 'Frontend application not available' });
  }
  
  const indexPath = path.join(frontendBuildPath, 'index.html');
  res.sendFile(indexPath);
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