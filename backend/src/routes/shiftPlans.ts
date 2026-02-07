import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  getShiftPlans,
  getShiftPlan,
  createShiftPlan,
  updateShiftPlan,
  deleteShiftPlan,
  createFromPreset,
  clearAssignments,
  exportShiftPlanToExcel,
  exportShiftPlanToPDF,
  addTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  addShift,
  updateShift,
  deleteShift,
  generateAssignments,
  publishPlan,
  getPlanStatistics,
  createAssignments,
} from '../controllers/shiftPlanController.js';
import {
  validateShiftPlan,
  validateShiftPlanUpdate,
  validateCreateFromPreset,
  handleValidationErrors,
  validateId,
  validateTimeSlot,
  validateTimeSlotUpdate,
  validateShiftCreate,
  validateShiftUpdate,
  validateSlotId,
  validateShiftId
} from '../middleware/validation.js';

const router = express.Router();

router.use(authMiddleware);

// Combined routes for both shift plans and templates
router.get('/', getShiftPlans);
router.get('/:id', validateId, handleValidationErrors, getShiftPlan);
router.post('/', validateShiftPlan, handleValidationErrors, requireRole(['admin', 'maintenance']), createShiftPlan);
router.post('/from-preset', validateCreateFromPreset, handleValidationErrors, requireRole(['admin', 'maintenance']), createFromPreset);
router.put('/:id', validateId, validateShiftPlanUpdate, handleValidationErrors, requireRole(['admin', 'maintenance']), updateShiftPlan);
router.delete('/:id', validateId, handleValidationErrors, requireRole(['admin', 'maintenance']), deleteShiftPlan);
router.post('/:id/clear-assignments', validateId, handleValidationErrors, requireRole(['admin', 'maintenance']), clearAssignments);

// Time slot management
router.post('/:id/time-slots', validateId, validateTimeSlot, handleValidationErrors, requireRole(['admin', 'maintenance']), addTimeSlot);
router.put('/:id/time-slots/:slotId', validateId, validateSlotId, validateTimeSlotUpdate, handleValidationErrors, requireRole(['admin', 'maintenance']), updateTimeSlot);
router.delete('/:id/time-slots/:slotId', validateId, validateSlotId, handleValidationErrors, requireRole(['admin', 'maintenance']), deleteTimeSlot);

// Shift management
router.post('/:id/shifts', validateId, validateShiftCreate, handleValidationErrors, requireRole(['admin', 'maintenance']), addShift);
router.patch('/:id/shifts/:shiftId', validateId, validateShiftId, validateShiftUpdate, handleValidationErrors, requireRole(['admin', 'maintenance']), updateShift);
router.delete('/:id/shifts/:shiftId', validateId, validateShiftId, handleValidationErrors, requireRole(['admin', 'maintenance']), deleteShift);

// Solver & Assignment routes
router.post('/:id/generate', validateId, handleValidationErrors, requireRole(['admin', 'maintenance']), generateAssignments);
router.post('/:id/clear-assignments', validateId, handleValidationErrors, requireRole(['admin', 'maintenance']), clearAssignments);
router.post('/:id/publish', validateId, handleValidationErrors, requireRole(['admin', 'maintenance']), publishPlan);
router.post('/:id/create', validateId, handleValidationErrors, requireRole(['admin', 'maintenance']), createAssignments);

// Statistics route
router.get('/:id/statistics', validateId, handleValidationErrors, getPlanStatistics);

// Export routes
router.get('/:id/export/excel', validateId, handleValidationErrors, requireRole(['admin', 'maintenance']), exportShiftPlanToExcel);
router.get('/:id/export/pdf', validateId, handleValidationErrors, requireRole(['admin', 'maintenance']), exportShiftPlanToPDF);


export default router;