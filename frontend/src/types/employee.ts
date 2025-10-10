// frontend/src/types/employee.ts
export interface Employee {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'instandhalter' | 'user';
  employeeType: 'chef' | 'neuling' | 'erfahren';
  isSufficientlyIndependent: boolean;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string | null;
  notes?: string;
}

export interface CreateEmployeeRequest {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'instandhalter' | 'user';
  employeeType: 'chef' | 'neuling' | 'erfahren';
  isSufficientlyIndependent: boolean;
  notes?: string;
}

export interface UpdateEmployeeRequest {
  name?: string;
  role?: 'admin' | 'instandhalter' | 'user';
  employeeType?: 'chef' | 'neuling' | 'erfahren';
  isSufficientlyIndependent?: boolean;
  isActive?: boolean;
  notes?: string;
}

export interface Availability {
  id: string;
  employeeId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}