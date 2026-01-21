// backend/src/routes/weeklyPlans.ts
import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  getWeeklyPlans,
  getWeeklyPlan,
  createWeeklyPlan,
  updateWeeklyPlan,
  deleteWeeklyPlan,
  updateWeek,
  getMyPreferences,
  saveMyPreferences,
  saveEmployeePreferences,
  generateAssignments,
  clearAssignments,
  publishPlan,
  getPlanStatistics,
  exportWeeklyPlanToExcel,
  exportWeeklyPlanToPDF,
} from '../controllers/weeklyPlanController.js';
import { handleValidationErrors, validateId } from '../middleware/validation.js';
import { body, param } from 'express-validator';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Validation middleware for weekly plans
const validateWeeklyPlan = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('description').optional().trim(),
];

const validateWeeklyPlanUpdate = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('status').optional().isIn(['draft', 'published', 'archived']).withMessage('Invalid status'),
  body('description').optional().trim(),
];

const validateWeekId = [
  param('weekId').isUUID().withMessage('Invalid week ID'),
];

const validateWeekUpdate = [
  body('minEmployees').optional().isInt({ min: 1, max: 10 }).withMessage('Min employees must be 1-10'),
  body('maxEmployees').optional().isInt({ min: 1, max: 10 }).withMessage('Max employees must be 1-10'),
];

const validatePreferences = [
  body('preferences').isArray().withMessage('Preferences must be an array'),
  body('preferences.*.weekId').isUUID().withMessage('Invalid week ID in preferences'),
  body('preferences.*.preferenceLevel').isIn([1, 2, 3]).withMessage('Preference level must be 1, 2, or 3'),
  body('requiredWeeks').isInt({ min: 0 }).withMessage('Required weeks must be a non-negative integer'),
  body('assignmentStyle').optional().isIn(['consecutive', 'scattered', 'flexible']).withMessage('Assignment style must be "consecutive", "scattered", or "flexible"'),
  body('assignmentStyleConsecutive').optional().isInt({ min: 1, max: 10 }).withMessage('Assignment block size must be between 1 and 10'),
];

const validateAdminPreferences = [
  body('employeeId').isUUID().withMessage('Employee ID is required'),
  ...validatePreferences,
];

// CRUD routes
router.get('/', getWeeklyPlans);
router.get('/:id', validateId, handleValidationErrors, getWeeklyPlan);
router.post('/', validateWeeklyPlan, handleValidationErrors, requireRole(['admin', 'maintenance']), createWeeklyPlan);
router.put('/:id', validateId, validateWeeklyPlanUpdate, handleValidationErrors, requireRole(['admin', 'maintenance']), updateWeeklyPlan);
router.delete('/:id', validateId, handleValidationErrors, requireRole(['admin', 'maintenance']), deleteWeeklyPlan);

// Week management
router.put('/:id/weeks/:weekId', validateId, validateWeekId, validateWeekUpdate, handleValidationErrors, requireRole(['admin', 'maintenance']), updateWeek);

// Preferences routes
router.get('/:id/my-preferences', validateId, handleValidationErrors, getMyPreferences);
router.post('/:id/preferences', validateId, validatePreferences, handleValidationErrors, saveMyPreferences);
router.post('/:id/admin-preferences', validateId, validateAdminPreferences, handleValidationErrors, requireRole(['admin', 'maintenance']), saveEmployeePreferences);

// Solver & Assignment routes
router.post('/:id/generate', validateId, handleValidationErrors, requireRole(['admin', 'maintenance']), generateAssignments);
router.post('/:id/clear-assignments', validateId, handleValidationErrors, requireRole(['admin', 'maintenance']), clearAssignments);
router.post('/:id/publish', validateId, handleValidationErrors, requireRole(['admin', 'maintenance']), publishPlan);

// Statistics route - ADD THIS
router.get('/:id/statistics', validateId, handleValidationErrors, getPlanStatistics);

// Export routes
router.get('/:id/export/excel', validateId, handleValidationErrors, requireRole(['admin', 'maintenance']), exportWeeklyPlanToExcel);
router.get('/:id/export/pdf', validateId, handleValidationErrors, requireRole(['admin', 'maintenance']), exportWeeklyPlanToPDF);

export default router;