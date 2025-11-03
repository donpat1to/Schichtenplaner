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
  exportShiftPlanToPDF
} from '../controllers/shiftPlanController.js';
import { 
  validateShiftPlan, 
  validateShiftPlanUpdate, 
  validateCreateFromPreset, 
  handleValidationErrors, 
  validateId 
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

router.get('/:id/export/excel', validateId, handleValidationErrors, requireRole(['admin', 'maintenance']), exportShiftPlanToExcel);
router.get('/:id/export/pdf', validateId, handleValidationErrors, requireRole(['admin', 'maintenance']), exportShiftPlanToPDF);

export default router;