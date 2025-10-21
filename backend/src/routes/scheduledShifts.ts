// backend/src/routes/scheduledShifts.ts
import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { 
  regenerateScheduledShifts,
  generateScheduledShiftsForPlan,
  getScheduledShift,
  getScheduledShiftsFromPlan,
  updateScheduledShift
} from '../controllers/shiftPlanController.js';

const router = express.Router();

router.use(authMiddleware);


router.post('/:id/generate-shifts', requireRole(['admin', 'maintenance']), generateScheduledShiftsForPlan);

router.post('/:id/regenerate-shifts', requireRole(['admin', 'maintenance']), regenerateScheduledShifts);

// GET all scheduled shifts for a plan
router.get('/plan/:planId', authMiddleware, getScheduledShiftsFromPlan);

// GET specific scheduled shift
router.get('/:id', authMiddleware, getScheduledShift);

// UPDATE scheduled shift
router.put('/:id', authMiddleware, updateScheduledShift);

export default router;