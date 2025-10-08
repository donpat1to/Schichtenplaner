// frontend/src/types/employee.ts
export interface Employee {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'instandhalter' | 'user';
  isActive: boolean;
  createdAt: string;
  lastLogin?: string | null;
  phone?: string;
  department?: string;
}

export interface Availability {
  id: string;
  employeeId: string;
  dayOfWeek: number; // 0-6 (Sonntag-Samstag)
  startTime: string; // "08:00"
  endTime: string;   // "16:00"
  isAvailable: boolean;
}

export interface CreateEmployeeRequest {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'instandhalter' | 'user';
  phone?: string;
  department?: string;
}

export interface UpdateEmployeeRequest {
  name?: string;
  role?: 'admin' | 'instandhalter' | 'user';
  isActive?: boolean;
  phone?: string;
  department?: string;
}