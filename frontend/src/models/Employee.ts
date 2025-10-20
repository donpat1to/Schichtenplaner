// backend/src/models/Employee.ts
export interface Employee {
  id: string;
  email: string;
  firstname: string;
  lastname: string;
  employeeType: 'manager' | 'personell' | 'apprentice' | 'guest';
  contractType?: 'small' | 'large' | 'flexible';
  canWorkAlone: boolean;
  isActive: boolean;
  isTrainee: boolean;
  createdAt: string;
  lastLogin?: string | null;
  roles?: string[];
}

export interface CreateEmployeeRequest {
  password: string;
  firstname: string;
  lastname: string;
  roles?: string[];
  employeeType: 'manager' | 'personell' | 'apprentice' | 'guest';
  contractType?: 'small' | 'large' | 'flexible';
  canWorkAlone: boolean;
  isTrainee?: boolean;
}

export interface UpdateEmployeeRequest {
  firstname?: string;
  lastname?: string;
  roles?: string[];
  employeeType?: 'manager' | 'personell' | 'apprentice' | 'guest';
  contractType?: 'small' | 'large' | 'flexible';
  canWorkAlone?: boolean;
  isActive?: boolean;
  isTrainee?: boolean;
}

export interface EmployeeWithPassword extends Employee {
  password: string;
}

export interface EmployeeAvailability {
  id: string;
  employeeId: string;
  planId: string;
  shiftId: string;
  preferenceLevel: 1 | 2 | 3; // 1:preferred, 2:available, 3:unavailable
  notes?: string;
}

export interface ManagerAvailability {
  id: string;
  employeeId: string;
  planId: string;
  dayOfWeek: number; // 1=Monday, 7=Sunday
  timeSlotId: string;
  isAvailable: boolean; // Simple available/not available
  assignedBy: string; // Always self for manager
}

export interface CreateAvailabilityRequest {
  planId: string;
  availabilities: Omit<EmployeeAvailability, 'id' | 'employeeId'>[];
}

export interface UpdateAvailabilityRequest {
  planId: string;
  availabilities: Omit<EmployeeAvailability, 'id' | 'employeeId'>[];
}

export interface ManagerSelfAssignmentRequest {
  planId: string;
  assignments: Omit<ManagerAvailability, 'id' | 'employeeId' | 'assignedBy'>[];
}

export interface EmployeeWithAvailabilities extends Employee {
  availabilities: EmployeeAvailability[];
}

// Additional types for the new roles system
export interface Role {
  role: 'admin' | 'user' | 'maintenance';
}

export interface EmployeeRole {
  employeeId: string;
  role: 'admin' | 'user' | 'maintenance';
}

// Employee type configuration
export interface EmployeeType {
  type: 'manager' | 'personell' | 'apprentice' | 'guest';
  category: 'internal' | 'external';
  has_contract_type: boolean;
}