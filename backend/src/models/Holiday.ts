// backend/src/models/Holiday.ts

export interface Holiday {
  id: string;
  name: string;
  date: string;           // YYYY-MM-DD
  endDate?: string;       // YYYY-MM-DD (null for single day)
  halfDay?: 'morning' | 'afternoon';
  isRecurring: boolean;
  description?: string;
  createdAt: string;
  createdBy: string;
}

export interface CreateHolidayRequest {
  name: string;
  date: string;
  endDate?: string;
  halfDay?: 'morning' | 'afternoon';
  isRecurring?: boolean;
  description?: string;
}

export interface UpdateHolidayRequest {
  name?: string;
  date?: string;
  endDate?: string | null;
  halfDay?: 'morning' | 'afternoon' | null;
  isRecurring?: boolean;
  description?: string;
}

// Resolved holiday represents a specific date occurrence
// (handles recurring holidays resolved to a specific year)
export interface ResolvedHoliday {
  id: string;
  name: string;
  date: string;  // Actual date (recurring resolved to specific year)
  halfDay?: 'morning' | 'afternoon';
  description?: string;
}
