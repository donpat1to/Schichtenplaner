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
  swapCandidates: SwapCandidateInfo[];
  // Whether unassign is allowed
  canUnassign: boolean;
  unassignBlockedReason?: string;
}

export interface SwapCandidateInfo {
  employeeId: string;
  employeeName: string;
  isTrainee: boolean;
  canWorkAlone: boolean;
  // The shift/week that would be swapped (candidate gives this, source takes this)
  swapShift?: {
    shiftId: string;
    dayOfWeek: number;
    dayName: string;
    timeSlotName: string;
    startTime: string;
    endTime: string;
  };
  swapWeek?: {
    weekId: string;
    weekNumber: number;
    startDate: string;
    endDate: string;
  };
  // Preference levels for the swap
  theirPreferenceForSourceShift: number;  // How much candidate wants the source's shift
  sourcePreferenceForTheirShift: number;  // How much source wants candidate's shift
  // All current assignments for display
  currentShiftCount?: number;
  currentWeekCount?: number;
  currentShifts?: {
    shiftId: string;
    dayOfWeek: number;
    dayName: string;
    timeSlotName: string;
    startTime: string;
    endTime: string;
  }[];
  currentWeeks?: {
    weekId: string;
    weekNumber: number;
    startDate: string;
    endDate: string;
  }[];
}

/** @deprecated Use SwapCandidateInfo instead */
export interface ReplacementCandidate {
  employeeId: string;
  employeeName: string;
  preferenceLevel: number;
  isTrainee: boolean;
  canWorkAlone: boolean;
  currentShiftCount?: number;
  currentWeekCount?: number;
  currentShifts?: {
    shiftId: string;
    dayOfWeek: number;
    dayName: string;
    timeSlotName: string;
    startTime: string;
    endTime: string;
  }[];
  currentWeeks?: {
    weekId: string;
    weekNumber: number;
    startDate: string;
    endDate: string;
  }[];
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
  shiftId?: string;  // The shift the source employee is giving up
  weekId?: string;   // The week the source employee is giving up
  // For swaps:
  swapEmployeeId?: string;      // The employee to swap with
  swapShiftId?: string;         // The shift source employee will take (from swap partner)
  swapWeekId?: string;          // The week source employee will take (from swap partner)
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

  async changePasswordByAdmin(
    id: string,
    data: { newPassword: string, confirmPassword: string }
  ): Promise<void> {
    return apiClient.put<void>(`/employees/${id}/password-by-admin`, data);
  }

  async updateLastLogin(employeeId: string): Promise<void> {
    try {
      await apiClient.patch(`/employees/${employeeId}/last-login`);
    } catch (error) {
      console.error('Error updating last login:', error);
      throw error;
    }
  }
}

export const employeeService = new EmployeeService();