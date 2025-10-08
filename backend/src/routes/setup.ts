// backend/src/routes/setup.ts
import express from 'express';
import { checkSetupStatus, setupAdmin } from '../controllers/setupController.js';

const router = express.Router();

router.get('/status', checkSetupStatus);
router.post('/admin', setupAdmin);

export default router;