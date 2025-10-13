// backend/src/routes/shiftPlans.ts
import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { 
  getShiftPlans, 
  getShiftPlan, 
  createShiftPlan, 
  updateShiftPlan, 
  deleteShiftPlan,
  getTemplates,
  //createFromTemplate,
  createFromPreset
} from '../controllers/shiftPlanController.js';

const router = express.Router();

router.use(authMiddleware);

// Combined routes for both shift plans and templates

// GET all shift plans (including templates)
router.get('/', getShiftPlans);

// GET templates only
router.get('/templates', getTemplates);

// GET specific shift plan or template
router.get('/:id', getShiftPlan);

// POST create new shift plan
router.post('/', requireRole(['admin', 'instandhalter']), createShiftPlan);

// POST create new plan from template
//router.post('/from-template', requireRole(['admin', 'instandhalter']), createFromTemplate);

// POST create new plan from preset
router.post('/from-preset', requireRole(['admin', 'instandhalter']), createFromPreset);

// PUT update shift plan or template
router.put('/:id', requireRole(['admin', 'instandhalter']), updateShiftPlan);

// DELETE shift plan or template
router.delete('/:id', requireRole(['admin', 'instandhalter']), deleteShiftPlan);

export default router;