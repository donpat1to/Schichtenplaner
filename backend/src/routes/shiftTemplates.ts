// backend/src/routes/shiftTemplates.ts
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { 
  getTemplates,
  getShiftPlans,
  getShiftPlan,
  createFromTemplate,
  updateShiftPlan,
  deleteShiftPlan
} from '../controllers/shiftPlanController.js';


const router = express.Router();

router.use(authMiddleware);
router.get('/', getTemplates);
router.get('/:id', getShiftPlan);
router.post('/', requireRole(['admin', 'instandhalter']), createFromTemplate);
router.put('/:id', requireRole(['admin', 'instandhalter']), updateShiftPlan);
router.delete('/:id', requireRole(['admin', 'instandhalter']), deleteShiftPlan);

export default router;