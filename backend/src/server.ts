// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import { setupDefaultTemplate } from './scripts/setupDefaultTemplate.js';
import { initializeDatabase } from './scripts/initializeDatabase.js';

// Route imports
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import shiftPlanRoutes from './routes/shiftPlans.js';
import shiftTemplateRoutes from './routes/shiftTemplates.js';
import setupRoutes from './routes/setup.js';

const app = express();
const PORT = 3002;

// CORS und Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/setup', setupRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/shift-plans', shiftPlanRoutes);
app.use('/api/shift-templates', shiftTemplateRoutes);

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
    
    // Setup default template
    await setupDefaultTemplate();
    //console.log('✅ Default template checked/created');

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