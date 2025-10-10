// backend/src/models/Shift.ts
export interface Shift {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  shifts: ShiftSlot[];
}

export interface ShiftSlot {
  id: string;
  shiftId: string;
  dayOfWeek: number;
  name: string;
  startTime: string;
  endTime: string;
  requiredEmployees: number;
  color?: string;
}

export interface CreateShiftRequest {
  name: string;
  description?: string;
  isDefault: boolean;
  shifts: Omit<ShiftSlot, 'id' | 'shiftId'>[];
}

export interface UpdateShiftSlotRequest {
  name?: string;
  description?: string;
  isDefault?: boolean;
  shifts?: Omit<ShiftSlot, 'id' | 'shiftId'>[];
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
