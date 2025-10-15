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


router.post('/:id/generate-shifts', requireRole(['admin', 'instandhalter']), generateScheduledShiftsForPlan);

router.post('/:id/regenerate-shifts', requireRole(['admin', 'instandhalter']), regenerateScheduledShifts);

// GET all scheduled shifts for a plan
router.get('/plan/:planId', requireRole(['admin']), getScheduledShiftsFromPlan);

// GET specific scheduled shift
router.get('/:id', requireRole(['admin']), getScheduledShift);

// UPDATE scheduled shift
router.put('/:id', requireRole(['admin']), updateScheduledShift);

export default router;