// frontend/src/types/shiftTemplate.ts
export interface ShiftTemplate {
  id: string;
  name: string;
  description?: string;
  shifts: TemplateShift[];
  createdBy: string;
  createdAt: string;
  isDefault: boolean;
}

export interface TemplateShift {
  id: string;
  dayOfWeek: number; // 0-6 (Sonntag=0, Montag=1, ...)
  name: string;
  startTime: string; // "08:00"
  endTime: string;   // "12:00"
  requiredEmployees: number;
  color?: string; // Für visuelle Darstellung
}

export const DEFAULT_DAYS = [
  { id: 1, name: 'Montag' },
  { id: 2, name: 'Dienstag' },
  { id: 3, name: 'Donnerstag' },
  { id: 4, name: 'Mittwoch' },
  { id: 5, name: 'Freitag' },
  { id: 6, name: 'Samstag' },
  { id: 0, name: 'Sonntag' }
];