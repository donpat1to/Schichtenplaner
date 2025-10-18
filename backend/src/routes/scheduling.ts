// routes/scheduling.ts
import express from 'express';
import { SchedulingService } from '../services/SchedulingService.js';

const router = express.Router();

router.post('/generate-schedule', async (req, res) => {
  try {
    const { shiftPlan, employees, availabilities, constraints } = req.body;
    
    const scheduler = new SchedulingService();
    const result = await scheduler.generateOptimalSchedule({
      shiftPlan,
      employees, 
      availabilities,
      constraints
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Scheduling failed', details: error });
  }
});

export default router;