// backend/src/routes/holidays.ts
import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  getHolidays,
  getHolidaysInRange,
  getHoliday,
  createHoliday,
  updateHoliday,
  deleteHoliday
} from '../controllers/holidayController.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/holidays - List all holidays (any authenticated user)
router.get('/', getHolidays);

// GET /api/holidays/range?start=&end= - Get resolved holidays in date range (any authenticated user)
router.get('/range', getHolidaysInRange);

// GET /api/holidays/:id - Get single holiday (any authenticated user)
router.get('/:id', getHoliday);

// POST /api/holidays - Create holiday (Admin only)
router.post('/', requireRole(['admin']), createHoliday);

// PUT /api/holidays/:id - Update holiday (Admin only)
router.put('/:id', requireRole(['admin']), updateHoliday);

// DELETE /api/holidays/:id - Delete holiday (Admin only)
router.delete('/:id', requireRole(['admin']), deleteHoliday);

export default router;
