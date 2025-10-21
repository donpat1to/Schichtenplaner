// backend/src/routes/shiftPlans.ts
import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { 
  getShiftPlans, 
  getShiftPlan, 
  createShiftPlan, 
  updateShiftPlan, 
  deleteShiftPlan,
  createFromPreset,
  clearAssignments
} from '../controllers/shiftPlanController.js';

const router = express.Router();

router.use(authMiddleware);

// Combined routes for both shift plans and templates

// GET all shift plans (including templates)
router.get('/' , authMiddleware, getShiftPlans);

// GET specific shift plan or template
router.get('/:id', authMiddleware, getShiftPlan);

// POST create new shift plan
router.post('/', requireRole(['admin', 'maintenance']), createShiftPlan);

// POST create new plan from preset
router.post('/from-preset', requireRole(['admin', 'maintenance']), createFromPreset);

// PUT update shift plan or template
router.put('/:id', requireRole(['admin', 'maintenance']), updateShiftPlan);

// DELETE shift plan or template
router.delete('/:id', requireRole(['admin', 'maintenance']), deleteShiftPlan);

// POST clear assignments and reset to draft
router.post('/:id/clear-assignments', requireRole(['admin', 'maintenance']), clearAssignments);

export default router;