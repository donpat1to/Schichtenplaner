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

// 🆕 STATIC FILE SERVING
// Use absolute path that matches Docker container structure
const frontendBuildPath = path.resolve('/app/frontend-build');
console.log('📁 Frontend build path:', frontendBuildPath);

if (frontendBuildPath) {
  // Serviere statische Dateien
  app.use(express.static(frontendBuildPath));
  
  // List files for debugging
  try {
    const files = fs.readdirSync(frontendBuildPath);
    console.log('📄 Files in frontend-build:', files);
  } catch (err) {
    console.log('❌ Could not read frontend-build directory:', err);
  }
  
  console.log('✅ Static file serving configured');
} else {
  console.log('❌ Frontend build directory NOT FOUND in any location');
}

// Root route
app.get('/', (req, res) => {
  if (!frontendBuildPath) {
    return res.status(500).send('Frontend build not found');
  }
  
  const indexPath = path.join(frontendBuildPath, 'index.html');
  console.log('📄 Serving index.html from:', indexPath);
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error('❌ index.html not found at:', indexPath);
    res.status(404).send('Frontend not found - index.html missing');
  }
});

// Client-side routing fallback
app.get('*', (req, res) => {
  // Ignoriere API Routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  if (!frontendBuildPath) {
    return res.status(500).json({ error: 'Frontend application not available' });
  }
  
  const indexPath = path.join(frontendBuildPath, 'index.html');
  console.log('🔄 Client-side routing for:', req.path, '->', indexPath);
  
  if (fs.existsSync(indexPath)) {
    // Use absolute path with res.sendFile
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error sending index.html:', err);
        res.status(500).send('Error loading application');
      }
    });
  } else {
    console.error('❌ index.html not found for client-side routing at:', indexPath);
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