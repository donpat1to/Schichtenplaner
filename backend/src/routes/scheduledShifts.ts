import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { 
  regenerateScheduledShifts,
  generateScheduledShiftsForPlan,
  getScheduledShift,
  getScheduledShiftsFromPlan,
  updateScheduledShift
} from '../controllers/shiftPlanController.js';
import { 
  validateId, 
  validatePlanId, 
  validateScheduledShiftUpdate, 
  handleValidationErrors 
} from '../middleware/validation.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/:id/generate-shifts', validateId, handleValidationErrors, requireRole(['admin', 'maintenance']), generateScheduledShiftsForPlan);
router.post('/:id/regenerate-shifts', validateId, handleValidationErrors, requireRole(['admin', 'maintenance']), regenerateScheduledShifts);
router.get('/plan/:planId', validatePlanId, handleValidationErrors, getScheduledShiftsFromPlan);
router.get('/:id', validateId, handleValidationErrors, getScheduledShift);
router.put('/:id', validateId, validateScheduledShiftUpdate, handleValidationErrors, updateScheduledShift);

export default router;