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
} from '../controllers/shiftTemplateController.js';

const router = express.Router();

router.use(authMiddleware);
router.get('/', getTemplates);
router.get('/:id', getShiftPlan);
router.post('/', createFromTemplate);
router.put('/:id', updateShiftPlan);
router.delete('/:id', deleteShiftPlan);

export default router;