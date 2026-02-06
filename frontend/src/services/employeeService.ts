import { Employee, CreateEmployeeRequest, UpdateEmployeeRequest, EmployeeAvailability } from '../models/Employee';
import { apiClient } from './apiClient';

// Types for conflict detection
export interface AvailabilityConflict {
  type: 'shift' | 'weekly';
  planId: string;
  planName: string;
  planStatus: string;
  employeeId: string;
  employeeName: string;
  shiftId?: string;
  shiftDetails?: {
    dayOfWeek: number;
    dayName: string;
    timeSlotName: string;
    startTime: string;
    endTime: string;
  };
  weekId?: string;
  weekDetails?: {
    weekNumber: number;
    startDate: string;
    endDate: string;
  };
  replacementCandidates: ReplacementCandidate[];
  // Whether unassign is allowed
  canUnassign: boolean;
  unassignBlockedReason?: string;
}

export interface ReplacementCandidate {
  employeeId: string;
  employeeName: string;
  preferenceLevel: number;
  isTrainee: boolean;
  canWorkAlone: boolean;
  currentShiftCount?: number;
  currentWeekCount?: number;
}

export interface ConflictCheckRequest {
  planId: string;
  planType: 'shift' | 'weekly';
  availabilities: Array<{
    shiftId?: string;
    weekId?: string;
    preferenceLevel: number;
  }>;
}

export interface ConflictResolution {
  action: 'swap' | 'unassign' | 'force_keep' | 'cancel';
  employeeId: string;
  shiftId?: string;
  weekId?: string;
  replacementEmployeeId?: string;
}

// Context data for frontend constraint checking
export interface ConflictContextData {
  employees: Array<{
    id: string;
    firstname: string;
    lastname: string;
    employeeType: string;
    contractType: string | null;
    canWorkAlone: boolean;
    isTrainee: boolean;
    isActive: boolean;
  }>;
  shifts: Array<{
    id: string;
    planId: string;
    dayOfWeek: number;
    timeSlotId: string;
    minEmployees: number;
    maxEmployees: number;
  }>;
  availabilities: Array<{
    employeeId: string;
    shiftId: string;
    preferenceLevel: number;
  }>;
  assignments: Array<{
    shiftId: string;
    employeeId: string;
  }>;
}

export interface ConflictCheckResponse {
  conflicts: AvailabilityConflict[];
  contextData?: ConflictContextData;
}

export class EmployeeService {
  async getEmployees(includeInactive: boolean = false): Promise<Employee[]> {
    console.log('🔄 Fetching employees from API...');

    try {
      const employees = await apiClient.get<Employee[]>(`/employees?includeInactive=${includeInactive}`);
      console.log('✅ Employees received:', employees.length);
      return employees;
    } catch (error) {
      console.error('❌ Error fetching employees:', error);
      throw error; // Let useBackendValidation handle this
    }
  }

  async getEmployee(id: string): Promise<Employee> {
    return apiClient.get<Employee>(`/employees/${id}`);
  }

  async createEmployee(employee: CreateEmployeeRequest): Promise<Employee> {
    return apiClient.post<Employee>('/employees', employee);
  }

  async updateEmployee(id: string, employee: UpdateEmployeeRequest): Promise<Employee> {
    return apiClient.put<Employee>(`/employees/${id}`, employee);
  }

  async deleteEmployee(id: string): Promise<void> {
    await apiClient.delete(`/employees/${id}`);
  }

  async getAvailabilities(employeeId: string): Promise<EmployeeAvailability[]> {
    return apiClient.get<EmployeeAvailability[]>(`/employees/${employeeId}/availabilities`);
  }

  async updateAvailabilities(
    employeeId: string, 
    data: { planId: string, availabilities: Omit<EmployeeAvailability, 'id' | 'employeeId'>[] }
  ): Promise<EmployeeAvailability[]> {
    console.log('🔄 Updating availabilities for employee:', employeeId);
    return apiClient.put<EmployeeAvailability[]>(`/employees/${employeeId}/availabilities`, data);
  }

  async changePassword(
    id: string, 
    data: { currentPassword: string, newPassword: string, confirmPassword: string }
  ): Promise<void> {
    return apiClient.put<void>(`/employees/${id}/password`, data);
  }

  async updateLastLogin(employeeId: string): Promise<void> {
    try {
      await apiClient.patch(`/employees/${employeeId}/last-login`);
    } catch (error) {
      console.error('Error updating last login:', error);
      throw error;
    }
  }

  async checkAvailabilityConflicts(
    employeeId: string,
    data: ConflictCheckRequest
  ): Promise<ConflictCheckResponse> {
    console.log('🔍 Checking availability conflicts for employee:', employeeId);
    return apiClient.post<ConflictCheckResponse>(
      `/employees/${employeeId}/check-availability-conflicts`,
      data
    );
  }
}

export const employeeService = new EmployeeService();