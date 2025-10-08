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
  updateAvailabilities
} from '../controllers/employeeController.js';

const router = express.Router();

// Alle Routes benötigen Authentication
router.use(authMiddleware);

// Employee CRUD Routes
router.get('/', requireRole(['admin', 'instandhalter']), getEmployees);
router.get('/:id', requireRole(['admin', 'instandhalter']), getEmployee);
router.post('/', requireRole(['admin']), createEmployee);
router.put('/:id', requireRole(['admin']), updateEmployee);
router.delete('/:id', requireRole(['admin']), deleteEmployee);

// Availability Routes
router.get('/:employeeId/availabilities', requireRole(['admin', 'instandhalter']), getAvailabilities);
router.put('/:employeeId/availabilities', requireRole(['admin', 'instandhalter']), updateAvailabilities);

export default router;