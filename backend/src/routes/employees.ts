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
import { 
  handleValidationErrors, 
  validateEmployee, 
  validateEmployeeUpdate, 
  validateChangePassword,
  validateId,
  validateEmployeeId,
  validateAvailabilities,
  validatePagination 
} from '../middleware/validation.js';

const router = express.Router();

// Alle Routes benötigen Authentication
router.use(authMiddleware);

// Employee CRUD Routes
router.get('/', validatePagination, handleValidationErrors, getEmployees);
router.get('/:id', validateId, handleValidationErrors, requireRole(['admin', 'maintenance']), getEmployee);
router.post('/', validateEmployee, handleValidationErrors, requireRole(['admin']), createEmployee);
router.put('/:id', validateId, validateEmployeeUpdate, handleValidationErrors, requireRole(['admin', 'maintenance']), updateEmployee);
router.delete('/:id', validateId, handleValidationErrors, requireRole(['admin']), deleteEmployee);

// Password & Login Routes
router.put('/:id/password', validateId, validateChangePassword, handleValidationErrors, changePassword);
router.put('/:id/last-login', validateId, handleValidationErrors, updateLastLogin);

// Availability Routes
router.get('/:employeeId/availabilities', validateEmployeeId, handleValidationErrors, getAvailabilities);
router.put('/:employeeId/availabilities', validateEmployeeId, validateAvailabilities, handleValidationErrors, updateAvailabilities);

export default router;