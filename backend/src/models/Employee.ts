// backend/src/models/Employee.ts
export interface Employee {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'instandhalter' | 'user';
  employeeType: 'chef' | 'neuling' | 'erfahren';
  isSufficientlyIndependent: boolean;
  isActive: boolean;
  notes?: string;
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

export interface EmployeeWithPassword extends Employee {
  password: string;
}