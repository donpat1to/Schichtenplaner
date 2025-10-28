import express from 'express';
import { SchedulingService } from '../services/SchedulingService.js';
import { validateSchedulingRequest, handleValidationErrors } from '../middleware/validation.js';

const router = express.Router();

router.post('/generate-schedule', validateSchedulingRequest, handleValidationErrors, async (req: express.Request, res: express.Response) => {
  try {
    const { shiftPlan, employees, availabilities, constraints } = req.body;
    
    console.log('Received scheduling request:', {
      shiftPlan: shiftPlan?.name,
      employeeCount: employees?.length,
      availabilityCount: availabilities?.length,
      constraintCount: constraints?.length
    });

    const scheduler = new SchedulingService();
    const result = await scheduler.generateOptimalSchedule({
      shiftPlan,
      employees, 
      availabilities,
      constraints: constraints || []
    });
    
    console.log('Scheduling completed:', {
      success: result.success,
      assignments: Object.keys(result.assignments).length,
      violations: result.violations.length
    });

    res.json(result);
  } catch (error) {
    console.error('Scheduling failed:', error);
    res.status(500).json({ 
      error: 'Scheduling failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check for scheduling service
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'scheduling',
    timestamp: new Date().toISOString()
  });
});

export default router;