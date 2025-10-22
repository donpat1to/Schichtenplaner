// backend/src/server.ts
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { initializeDatabase } from './scripts/initializeDatabase.js';

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

// Serviere statische Frontend-Dateien
app.use(express.static(path.join(__dirname, '../../frontend-build')));

// API Routes
app.use('/api/setup', setupRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/shift-plans', shiftPlanRoutes);
app.use('/api/scheduled-shifts', scheduledShifts);
app.use('/api/scheduling', schedulingRoutes);

// Error handling middleware should come after routes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Health route
app.get('/api/health', (req: any, res: any) => {
  res.json({ 
    status: 'OK', 
    message: 'Backend läuft!',
    timestamp: new Date().toISOString()
  });
});

// Setup status route (additional endpoint for clarity)
app.get('/api/initial-setup', async (req: any, res: any) => {
  try {
    const { db } = await import('./services/databaseService.js');
    
    const adminExists = await db.get<{ 'COUNT(*)': number }>(
      'SELECT COUNT(*) FROM employees WHERE role = ?',
      ['admin']
    );

    res.json({
      needsInitialSetup: !adminExists || adminExists['COUNT(*)'] === 0
    });
  } catch (error) {
    console.error('Error checking initial setup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initialize the application
const initializeApp = async () => {
  try {
    // Initialize database with base schema
    await initializeDatabase();
    //console.log('✅ Database initialized successfully');
    
    // Apply any pending migrations
    const { applyMigration } = await import('./scripts/applyMigration.js');
    await applyMigration();
    //console.log('✅ Database migrations applied');

    // Start server only after successful initialization
    app.listen(PORT, () => {
      console.log('🎉 BACKEND STARTED SUCCESSFULLY!');
      console.log(`📍 Port: ${PORT}`);
      console.log(`📍 Health: http://localhost:${PORT}/api/health`);
      console.log('');
      console.log(`🔧 Setup ready at: http://localhost:${PORT}/api/setup/status`);
      console.log('📝 Create your admin account on first launch');
    });
  } catch (error) {
    console.error('❌ Error during initialization:', error);
    process.exit(1); // Exit if initialization fails
  }
};

// Start the application
initializeApp();