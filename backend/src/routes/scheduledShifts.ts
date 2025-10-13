// backend/src/routes/scheduledShifts.ts - COMPLETE REWRITE
import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { db } from '../services/databaseService.js';

const router = express.Router();

router.use(authMiddleware);

// GET all scheduled shifts for a plan (for debugging)
router.get('/plan/:planId', async (req, res) => {
  try {
    const { planId } = req.params;
    
    const shifts = await db.all(
      `SELECT * FROM scheduled_shifts WHERE plan_id = ? ORDER BY date, time_slot_id`,
      [planId]
    );

    // Parse JSON arrays safely
    const parsedShifts = shifts.map((shift: any) => {
      try {
        return {
          ...shift,
          assigned_employees: JSON.parse(shift.assigned_employees || '[]')
        };
      } catch (parseError) {
        console.error('Error parsing assigned_employees:', parseError);
        return {
          ...shift,
          assigned_employees: []
        };
      }
    });

    res.json(parsedShifts);
  } catch (error) {
    console.error('Error fetching scheduled shifts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET specific scheduled shift
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const shift = await db.get(
      'SELECT * FROM scheduled_shifts WHERE id = ?',
      [id]
    ) as any;

    if (!shift) {
      return res.status(404).json({ error: 'Scheduled shift not found' });
    }

    // Parse JSON array
    const parsedShift = {
      ...shift,
      assigned_employees: JSON.parse(shift.assigned_employees || '[]')
    };

    res.json(parsedShift);
  } catch (error: any) {
    console.error('Error fetching scheduled shift:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

// UPDATE scheduled shift
router.put('/:id', requireRole(['admin', 'instandhalter']), async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedEmployees } = req.body;

    console.log('🔄 Updating scheduled shift:', { 
      id, 
      assignedEmployees,
      body: req.body 
    });

    if (!Array.isArray(assignedEmployees)) {
      return res.status(400).json({ error: 'assignedEmployees must be an array' });
    }

    // Check if shift exists
    const existingShift = await db.get(
      'SELECT id FROM scheduled_shifts WHERE id = ?',
      [id]
    ) as any;

    if (!existingShift) {
      console.error('❌ Scheduled shift not found:', id);
      return res.status(404).json({ error: `Scheduled shift ${id} not found` });
    }

    // Update the shift
    const result = await db.run(
      'UPDATE scheduled_shifts SET assigned_employees = ? WHERE id = ?',
      [JSON.stringify(assignedEmployees), id]
    );

    console.log('✅ Scheduled shift updated successfully');
    
    res.json({ 
      message: 'Scheduled shift updated successfully',
      id: id,
      assignedEmployees: assignedEmployees
    });

  } catch (error: any) {
    console.error('❌ Error updating scheduled shift:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

export default router;