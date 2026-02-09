// backend/src/controllers/holidayController.ts
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/databaseService.js';
import { AuthRequest } from '../middleware/auth.js';
import {
  Holiday,
  CreateHolidayRequest,
  UpdateHolidayRequest,
  ResolvedHoliday
} from '../models/Holiday.js';

// Helper function to parse a date string (YYYY-MM-DD) as local date
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Helper function to format a Date to YYYY-MM-DD string (local time)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to convert DB row to Holiday object
function mapRowToHoliday(row: any): Holiday {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    endDate: row.end_date || undefined,
    halfDay: row.half_day || undefined,
    isRecurring: row.is_recurring === 1,
    description: row.description || undefined,
    createdAt: row.created_at,
    createdBy: row.created_by
  };
}

// Helper function to resolve recurring holidays to a specific date range
function resolveHolidaysToDateRange(
  holidays: Holiday[],
  startDate: string,
  endDate: string
): ResolvedHoliday[] {
  const resolved: ResolvedHoliday[] = [];
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  for (const holiday of holidays) {
    if (holiday.isRecurring) {
      // For recurring holidays, generate occurrences for each year in range
      for (let year = startYear; year <= endYear; year++) {
        const holidayDate = parseLocalDate(holiday.date);
        const resolvedDate = new Date(year, holidayDate.getMonth(), holidayDate.getDate());

        // Check if the resolved date falls within the range
        if (resolvedDate >= start && resolvedDate <= end) {
          const dateStr = formatLocalDate(resolvedDate);

          if (holiday.endDate) {
            // Multi-day recurring holiday
            const origEndDate = parseLocalDate(holiday.endDate);
            const daysDiff = Math.ceil((origEndDate.getTime() - holidayDate.getTime()) / (1000 * 60 * 60 * 24));
            const resolvedEndDate = new Date(resolvedDate);
            resolvedEndDate.setDate(resolvedEndDate.getDate() + daysDiff);

            // Add each day of the multi-day holiday
            let currentDate = new Date(resolvedDate);
            while (currentDate <= resolvedEndDate && currentDate <= end) {
              if (currentDate >= start) {
                resolved.push({
                  id: holiday.id,
                  name: holiday.name,
                  date: formatLocalDate(currentDate),
                  halfDay: holiday.halfDay,
                  description: holiday.description
                });
              }
              currentDate.setDate(currentDate.getDate() + 1);
            }
          } else {
            resolved.push({
              id: holiday.id,
              name: holiday.name,
              date: dateStr,
              halfDay: holiday.halfDay,
              description: holiday.description
            });
          }
        }
      }
    } else {
      // Non-recurring holiday - check if it falls within range
      const holidayDate = parseLocalDate(holiday.date);

      if (holiday.endDate) {
        // Multi-day non-recurring holiday
        const endDateObj = parseLocalDate(holiday.endDate);
        let currentDate = new Date(holidayDate);

        while (currentDate <= endDateObj) {
          if (currentDate >= start && currentDate <= end) {
            resolved.push({
              id: holiday.id,
              name: holiday.name,
              date: formatLocalDate(currentDate),
              halfDay: holiday.halfDay,
              description: holiday.description
            });
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } else if (holidayDate >= start && holidayDate <= end) {
        resolved.push({
          id: holiday.id,
          name: holiday.name,
          date: holiday.date,
          halfDay: holiday.halfDay,
          description: holiday.description
        });
      }
    }
  }

  // Sort by date
  resolved.sort((a, b) => a.date.localeCompare(b.date));
  return resolved;
}

// Get all holidays
export const getHolidays = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('🔍 Fetching all holidays');

    const rows = await db.all<any>(`
      SELECT * FROM legal_holidays
      ORDER BY date ASC
    `);

    const holidays = rows.map(mapRowToHoliday);
    console.log('✅ Holidays fetched:', holidays.length);

    res.json(holidays);
  } catch (error) {
    console.error('❌ Error fetching holidays:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get holidays resolved to a specific date range
export const getHolidaysInRange = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      res.status(400).json({ error: 'Start and end dates are required' });
      return;
    }

    console.log('🔍 Fetching holidays in range:', start, 'to', end);

    const rows = await db.all<any>(`
      SELECT * FROM legal_holidays
    `);

    const holidays = rows.map(mapRowToHoliday);
    const resolved = resolveHolidaysToDateRange(holidays, start as string, end as string);

    console.log('✅ Resolved holidays:', resolved.length);
    res.json(resolved);
  } catch (error) {
    console.error('❌ Error fetching holidays in range:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get single holiday by ID
export const getHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    console.log('🔍 Fetching holiday:', id);

    const row = await db.get<any>(`
      SELECT * FROM legal_holidays WHERE id = ?
    `, [id]);

    if (!row) {
      res.status(404).json({ error: 'Holiday not found' });
      return;
    }

    const holiday = mapRowToHoliday(row);
    console.log('✅ Holiday fetched:', holiday.name);

    res.json(holiday);
  } catch (error) {
    console.error('❌ Error fetching holiday:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new holiday (Admin only)
export const createHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, date, endDate, halfDay, isRecurring, description }: CreateHolidayRequest = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!name || !date) {
      res.status(400).json({ error: 'Name and date are required' });
      return;
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      return;
    }

    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      res.status(400).json({ error: 'Invalid end date format. Use YYYY-MM-DD' });
      return;
    }

    // Validate end date is after start date
    if (endDate && endDate < date) {
      res.status(400).json({ error: 'End date must be after start date' });
      return;
    }

    // Half day cannot be set for multi-day holidays
    if (halfDay && endDate) {
      res.status(400).json({ error: 'Half day cannot be set for multi-day holidays' });
      return;
    }

    console.log('📝 Creating holiday:', name);

    const id = uuidv4();
    await db.run(`
      INSERT INTO legal_holidays (id, name, date, end_date, half_day, is_recurring, description, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, name, date, endDate || null, halfDay || null, isRecurring ? 1 : 0, description || null, userId]);

    const created = await db.get<any>('SELECT * FROM legal_holidays WHERE id = ?', [id]);
    const holiday = mapRowToHoliday(created);

    console.log('✅ Holiday created:', holiday.id);
    res.status(201).json(holiday);
  } catch (error) {
    console.error('❌ Error creating holiday:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update a holiday (Admin only)
export const updateHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, date, endDate, halfDay, isRecurring, description }: UpdateHolidayRequest = req.body;

    console.log('📝 Updating holiday:', id);

    const existing = await db.get<any>('SELECT * FROM legal_holidays WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Holiday not found' });
      return;
    }

    // Validate date format if provided
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      return;
    }

    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      res.status(400).json({ error: 'Invalid end date format. Use YYYY-MM-DD' });
      return;
    }

    // Determine effective values
    const effectiveDate = date || existing.date;
    const effectiveEndDate = endDate === null ? null : (endDate || existing.end_date);
    const effectiveHalfDay = halfDay === null ? null : (halfDay || existing.half_day);

    // Validate end date is after start date
    if (effectiveEndDate && effectiveEndDate < effectiveDate) {
      res.status(400).json({ error: 'End date must be after start date' });
      return;
    }

    // Half day cannot be set for multi-day holidays
    if (effectiveHalfDay && effectiveEndDate) {
      res.status(400).json({ error: 'Half day cannot be set for multi-day holidays' });
      return;
    }

    await db.run(`
      UPDATE legal_holidays
      SET name = COALESCE(?, name),
          date = COALESCE(?, date),
          end_date = ?,
          half_day = ?,
          is_recurring = COALESCE(?, is_recurring),
          description = COALESCE(?, description)
      WHERE id = ?
    `, [
      name,
      date,
      effectiveEndDate,
      effectiveHalfDay,
      isRecurring !== undefined ? (isRecurring ? 1 : 0) : null,
      description,
      id
    ]);

    const updated = await db.get<any>('SELECT * FROM legal_holidays WHERE id = ?', [id]);
    const holiday = mapRowToHoliday(updated);

    console.log('✅ Holiday updated:', holiday.name);
    res.json(holiday);
  } catch (error) {
    console.error('❌ Error updating holiday:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete a holiday (Admin only)
export const deleteHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    console.log('🗑️ Deleting holiday:', id);

    const existing = await db.get<any>('SELECT * FROM legal_holidays WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Holiday not found' });
      return;
    }

    await db.run('DELETE FROM legal_holidays WHERE id = ?', [id]);

    console.log('✅ Holiday deleted:', id);
    res.status(204).send();
  } catch (error) {
    console.error('❌ Error deleting holiday:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
