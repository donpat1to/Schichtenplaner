// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import { db } from './services/databaseService.js';
import { seedData } from './scripts/seedData.js';
import authRoutes from './routes/auth.js';
import shiftTemplateRoutes from './routes/shiftTemplates.js';
import shiftPlanRoutes from './routes/shiftPlans.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/shift-templates', shiftTemplateRoutes);
app.use('/api/shift-plans', shiftPlanRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await seedData();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await db.close();
  process.exit(0);
});