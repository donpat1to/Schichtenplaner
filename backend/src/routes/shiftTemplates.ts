// backend/src/routes/shiftTemplates.ts
import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { 
  getTemplates, 
  getTemplate, 
  createTemplate, 
  updateTemplate, 
  deleteTemplate 
} from '../controllers/shiftTemplateController';

const router = express.Router();

router.use(authMiddleware);
router.get('/', getTemplates);
router.get('/:id', getTemplate);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;