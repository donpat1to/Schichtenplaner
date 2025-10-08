// backend/src/models/Employee.ts
export interface Employee {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'instandhalter' | 'user';
  isActive: boolean;
  phone?: string;
  department?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface Availability {
  id: string;
  employeeId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
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