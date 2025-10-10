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
  templateId: string;
  dayOfWeek: number;
  timeSlot: TemplateShiftTimeSlot;
  requiredEmployees: number;
  color?: string;
}

export interface TemplateShiftTimeSlot {
  id: string;
  name: string;     // e.g., "Frühschicht", "Spätschicht"
  startTime: string;
  endTime: string;
}

export const DEFAULT_TIME_SLOTS: TemplateShiftTimeSlot[] = [
  { id: 'morning', name: 'Vormittag', startTime: '08:00', endTime: '12:00' },
  { id: 'afternoon', name: 'Nachmittag', startTime: '11:30', endTime: '15:30' },
];


export interface CreateShiftTemplateRequest {
  name: string;
  description?: string;
  isDefault: boolean;
  shifts: Omit<TemplateShiftSlot, 'id' | 'templateId'>[];
  timeSlots: TemplateShiftTimeSlot[];
}

export interface UpdateShiftTemplateRequest {
  name?: string;
  description?: string;
  isDefault?: boolean;
  shifts?: Omit<TemplateShiftSlot, 'id' | 'templateId'>[];
  timeSlots?: TemplateShiftTimeSlot[];
}