// backend/src/server.ts - Login für alle Benutzer
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
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


// Start server
app.listen(PORT, async () => {
  console.log('🎉 BACKEND STARTED SUCCESSFULLY!');
  console.log(`📍 Port: ${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/api/health`);

  try {
    await initializeDatabase();
    await setupDefaultTemplate();
    console.log('✅ Standard-Vorlage überprüft/erstellt');
  } catch (error) {
    console.error('❌ Fehler bei der Initialisierung:', error);
  }

  console.log('');
  console.log('🔧 Setup ready at: http://localhost:${PORT}/api/setup/status');
  console.log('📝 Create your admin account on first launch');
});
