// backend/src/models/ShiftTemplate.ts
export interface ShiftTemplate {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  shifts: TemplateShift[];
}

export interface TemplateShift {
  id: string;
  templateId: string;
  dayOfWeek: number;
  name: string;
  startTime: string;
  endTime: string;
  requiredEmployees: number;
  color?: string;
}

export interface CreateShiftTemplateRequest {
  name: string;
  description?: string;
  isDefault: boolean;
  shifts: Omit<TemplateShift, 'id' | 'templateId'>[];
}

export interface UpdateShiftTemplateRequest {
  name?: string;
  description?: string;
  isDefault?: boolean;
  shifts?: Omit<TemplateShift, 'id' | 'templateId'>[];
}