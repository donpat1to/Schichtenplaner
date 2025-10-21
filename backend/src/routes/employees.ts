// backend/src/routes/employees.ts
import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getAvailabilities,
  updateAvailabilities,
  changePassword,
  updateLastLogin
} from '../controllers/employeeController.js';

const router = express.Router();

// Alle Routes benötigen Authentication
router.use(authMiddleware);

// Employee CRUD Routes
router.get('/', authMiddleware, getEmployees);
router.get('/:id', requireRole(['admin', 'instandhalter']), getEmployee);
router.post('/', requireRole(['admin']), createEmployee);
router.put('/:id', requireRole(['admin']), updateEmployee);
router.delete('/:id', requireRole(['admin']), deleteEmployee);
router.put('/:id/password', authMiddleware, changePassword);
router.put('/:id/last-login', authMiddleware, updateLastLogin);

// Availability Routes
router.get('/:employeeId/availabilities', authMiddleware, getAvailabilities);
router.put('/:employeeId/availabilities', authMiddleware, updateAvailabilities);

export default router;