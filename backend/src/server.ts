// backend/src/server.ts - Erweitert
import express from 'express';
import cors from 'cors';
import { db } from './services/databaseService.js';
import { seedData } from './scripts/seedData.js';
import authRoutes from './routes/auth.js';
import shiftTemplateRoutes from './routes/shiftTemplates.js';
import shiftPlanRoutes from './routes/shiftPlans.js';
import employeeRoutes from './routes/employees.js'; // NEU HINZUGEFÜGT

const app = express();
const PORT = 3002;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/shift-templates', shiftTemplateRoutes);
app.use('/api/shift-plans', shiftPlanRoutes);
app.use('/api/employees', employeeRoutes); // NEU HINZUGEFÜGT

// Health check
app.get('/api/health', (req, res) => {
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
  console.log('📊 Employee management ready!');
  
  await seedData();
});