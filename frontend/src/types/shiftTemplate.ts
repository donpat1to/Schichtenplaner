// frontend/src/types/shiftTemplate.ts
export interface TemplateShift {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  shifts: TemplateShiftSlot[];
}

export interface TemplateShiftSlot {
  id: string;
  templateId?: string;
  dayOfWeek: number;
  timeRange: TemplateShiftTimeRange;
  requiredEmployees: number;
  color?: string;
}

export interface TemplateShiftTimeRange {
  id: string;
  name: string;     // e.g., "Frühschicht", "Spätschicht"
  startTime: string;
  endTime: string;
}

export const DEFAULT_TIME_SLOTS: TemplateShiftTimeRange[] = [
  { id: 'morning', name: 'Vormittag', startTime: '08:00', endTime: '12:00' },
  { id: 'afternoon', name: 'Nachmittag', startTime: '11:30', endTime: '15:30' },
];


export const DEFAULT_DAYS = [
  { id: 1, name: 'Montag' },
  { id: 2, name: 'Dienstag' },
  { id: 3, name: 'Donnerstag' },
  { id: 4, name: 'Mittwoch' },
  { id: 5, name: 'Freitag' },
  { id: 6, name: 'Samstag' },
  { id: 7, name: 'Sonntag' }
];