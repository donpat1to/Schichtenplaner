// backend/src/models/ShiftTemplate.ts
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

export interface CreateShiftTemplateRequest {
  name: string;
  description?: string;
  isDefault: boolean;
  shifts: Omit<TemplateShift, 'id' | 'templateId'>[];
  timeSlots: Omit<TemplateShiftTimeRange, 'id'>[];
}

export interface UpdateShiftTemplateRequest {
  name?: string;
  description?: string;
  isDefault?: boolean;
  shifts?: Omit<TemplateShift, 'id' | 'templateId'>[];
  timeSlots?: Omit<TemplateShiftTimeRange, 'id'>[];
}