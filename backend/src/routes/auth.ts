// backend/src/routes/auth.ts
import express from 'express';
import { 
  login, 
  register, 
  logout, 
  getCurrentUser, 
  validateToken 
} from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateLogin, validateRegister, handleValidationErrors } from '../middleware/validation.js';

const router = express.Router();

// Public routes
router.post('/login', validateLogin, handleValidationErrors, login);
router.post('/register', validateRegister, handleValidationErrors, register);
router.get('/validate', validateToken);

// Protected routes (require authentication)
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, getCurrentUser);

export default router;