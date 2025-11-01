import { Employee, CreateEmployeeRequest, UpdateEmployeeRequest, EmployeeAvailability } from '../models/Employee';
import { apiClient } from './apiClient';

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
}

export const employeeService = new EmployeeService();