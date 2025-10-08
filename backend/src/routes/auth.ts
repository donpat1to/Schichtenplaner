// backend/src/routes/auth.ts
import express from 'express';
import { login, register, logout, getCurrentUser } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, getCurrentUser);

export default router;