// backend/src/models/Shift.ts
export interface ShiftTemplate {
  id: string;
  name: string;
  shifts: TemplateShift[];
  createdBy: string;
}

export interface TemplateShift {
  dayOfWeek: number; // 0-6
  name: string;
  startTime: string; // "08:00"
  endTime: string;   // "12:00"
  requiredEmployees: number;
}

export interface ShiftPlan {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  templateId?: string;
  shifts: AssignedShift[];
  status: 'draft' | 'published';
  createdBy: string;
}

export interface AssignedShift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  requiredEmployees: number;
  assignedEmployees: string[];
}