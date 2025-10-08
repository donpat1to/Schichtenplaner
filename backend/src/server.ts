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
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
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
    
    // Define proper interface for the result
    interface AdminCountResult {
      count: number;
    }
    
    const adminExists = await db.get<AdminCountResult>(
      'SELECT COUNT(*) as count FROM users WHERE role = ?',
      ['admin']
    );

    res.json({
      needsInitialSetup: !adminExists || adminExists.count === 0
    });
  } catch (error) {
    console.error('Error checking initial setup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log('🎉 BACKEND STARTED SUCCESSFULLY!');
  console.log(`📍 Port: ${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/api/health`);

  try {
    await initializeDatabase();
    console.log('✅ Database initialized successfully');
    
    await setupDefaultTemplate();
    console.log('✅ Default template checked/created');
  } catch (error) {
    console.error('❌ Error during initialization:', error);
  }

  console.log('');
  console.log(`🔧 Setup ready at: http://localhost:${PORT}/api/setup/status`);
  console.log('📝 Create your admin account on first launch');
});