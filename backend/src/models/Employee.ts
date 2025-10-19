// backend/src/models/Employee.ts
export interface Employee {
  id: string;
  email: string;
  firstname: string;
  lastname: string;
  role: 'admin' | 'maintenance' | 'user';
  employeeType: 'manager' | 'trainee' | 'experienced';
  contractType: 'small' | 'large';
  canWorkAlone: boolean;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string | null;
}

export interface CreateEmployeeRequest {
  password: string;
  firstname: string;
  lastname: string;
  role: 'admin' | 'maintenance' | 'user';
  employeeType: 'manager' | 'trainee' | 'experienced';
  contractType: 'small' | 'large';
  canWorkAlone: boolean;
}

export interface UpdateEmployeeRequest {
  firstname?: string;
  lastname?: string;
  role?: 'admin' | 'maintenance' | 'user';
  employeeType?: 'manager' | 'trainee' | 'experienced';
  contractType?: 'small' | 'large';
  canWorkAlone?: boolean;
  isActive?: boolean;
}

export interface EmployeeWithPassword extends Employee {
  password: string;
}

export interface EmployeeAvailability {
  id: string;
  employeeId: string;
  planId: string;
  shiftId: string; // Now references shift_id instead of time_slot_id + day_of_week
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