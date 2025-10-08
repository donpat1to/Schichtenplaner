// backend/src/routes/shiftPlans.ts
import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { 
  getShiftPlans, 
  getShiftPlan, 
  createShiftPlan, 
  updateShiftPlan, 
  deleteShiftPlan 
} from '../controllers/shiftPlanController';

const router = express.Router();

router.use(authMiddleware);
router.get('/', getShiftPlans);
router.get('/:id', getShiftPlan);
router.post('/', requireRole(['admin', 'instandhalter']), createShiftPlan);
router.put('/:id', updateShiftPlan);
router.delete('/:id', deleteShiftPlan);

export default router;