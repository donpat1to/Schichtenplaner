// backend/src/routes/scheduledShifts.ts - COMPLETE REWRITE
import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { getScheduledShiftsFromPlan, getScheduledShift, updateScheduledShift } from '../controllers/scheduledShiftController.js';

const router = express.Router();

router.use(authMiddleware);

// Add a simple test route first
/*router.get('/test', (req, res) => {
  console.log('✅ /api/scheduled-shifts/test route hit');
  res.json({ message: 'Scheduled shifts router is working!' });
});*/

// GET all scheduled shifts for a plan (for debugging)
router.get('/plan/:planId', requireRole(['admin']), getScheduledShiftsFromPlan);

// GET specific scheduled shift
router.get('/:id', requireRole(['admin']), getScheduledShift);

// UPDATE scheduled shift
router.put('/:id', requireRole(['admin']), updateScheduledShift);

export default router;