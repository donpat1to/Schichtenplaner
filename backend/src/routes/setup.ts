import express from 'express';
import { checkSetupStatus, setupAdmin } from '../controllers/setupController.js';
import { validateSetupAdmin, handleValidationErrors } from '../middleware/validation.js';

const router = express.Router();

router.get('/status', checkSetupStatus);
router.post('/admin', validateSetupAdmin, handleValidationErrors, setupAdmin);

export default router;