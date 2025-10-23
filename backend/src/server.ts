// backend/src/server.ts
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './scripts/initializeDatabase.js';
import fs from 'fs';

// Route imports
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import shiftPlanRoutes from './routes/shiftPlans.js';
import setupRoutes from './routes/setup.js';
import scheduledShifts from './routes/scheduledShifts.js';
import schedulingRoutes from './routes/scheduling.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3002;

// Middleware
app.use(express.json());

// API Routes
app.use('/api/setup', setupRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/shift-plans', shiftPlanRoutes);
app.use('/api/scheduled-shifts', scheduledShifts);
app.use('/api/scheduling', schedulingRoutes);

// Health route
app.get('/api/health', (req: any, res: any) => {
  res.json({ 
    status: 'OK', 
    message: 'Backend läuft!',
    timestamp: new Date().toISOString()
  });
});

// 🆕 STATIC FILE SERVING FÜR FRONTEND
const frontendBuildPath = path.join(__dirname, '../../frontend-build');
console.log('📁 Frontend build path:', frontendBuildPath);

// Überprüfe ob das Verzeichnis existiert
if (fs.existsSync(frontendBuildPath)) {
  console.log('✅ Frontend build directory exists');
  const files = fs.readdirSync(frontendBuildPath);
  console.log('📄 Files in frontend-build:', files);
  
  // Serviere statische Dateien
  app.use(express.static(frontendBuildPath));
  
  console.log('✅ Static file serving configured');
} else {
  console.log('❌ Frontend build directory NOT FOUND:', frontendBuildPath);
}

app.get('/', (req, res) => {
  const indexPath = path.join(frontendBuildPath, 'index.html');
  console.log('📄 Serving index.html from:', indexPath);
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error('❌ index.html not found at:', indexPath);
    res.status(404).send('Frontend not found - index.html missing');
  }
});

app.get('*', (req, res) => {
  // Ignoriere API Routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  const indexPath = path.join(frontendBuildPath, 'index.html');
  console.log('🔄 Client-side routing for:', req.path, '-> index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error('❌ index.html not found for client-side routing');
    res.status(404).json({ error: 'Frontend application not found' });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize the application
const initializeApp = async () => {
  try {
    // Initialize database with base schema
    await initializeDatabase();
    
    // Apply any pending migrations
    const { applyMigration } = await import('./scripts/applyMigration.js');
    await applyMigration();

    // Start server only after successful initialization
    app.listen(PORT, () => {
      console.log('🎉 APPLICATION STARTED SUCCESSFULLY!');
      console.log(`📍 Port: ${PORT}`);
      console.log(`📍 Frontend: http://localhost:${PORT}`);
      console.log(`📍 API: http://localhost:${PORT}/api`);
      console.log('');
      console.log(`🔧 Setup: http://localhost:${PORT}/api/setup/status`);
      console.log('📝 Create your admin account on first launch');
    });
  } catch (error) {
    console.error('❌ Error during initialization:', error);
    process.exit(1);
  }
};

// Start the application
initializeApp();