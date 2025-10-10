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
}

export interface CreateEmployeeRequest {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'instandhalter' | 'user';
  employeeType: 'chef' | 'neuling' | 'erfahren';
  isSufficientlyIndependent: boolean;
}

export interface UpdateEmployeeRequest {
  name?: string;
  role?: 'admin' | 'instandhalter' | 'user';
  employeeType?: 'chef' | 'neuling' | 'erfahren';
  isSufficientlyIndependent?: boolean;
  isActive?: boolean;
}

export interface Availability {
  id: string;
  employeeId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  availabilityLevel: 1 | 2 | 3; // 1: bevorzugt, 2: möglich, 3: nicht möglich
}