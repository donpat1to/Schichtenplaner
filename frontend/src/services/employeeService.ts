// frontend/src/services/employeeService.ts
import { Employee, CreateEmployeeRequest, UpdateEmployeeRequest, EmployeeAvailability } from '../models/Employee';

const API_BASE_URL = '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export class EmployeeService {
  async getEmployees(includeInactive: boolean = false): Promise<Employee[]> {
    console.log('🔄 Fetching employees from API...');
    
    const token = localStorage.getItem('token');
    console.log('🔑 Token exists:', !!token);
    
    const response = await fetch(`${API_BASE_URL}/employees?includeInactive=${includeInactive}`, {
      headers: getAuthHeaders(),
    });
    
    console.log('📡 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      throw new Error('Failed to fetch employees');
    }
    
    const employees = await response.json();
    console.log('✅ Employees received:', employees.length);
    
    return employees;
  }

  async getEmployee(id: string): Promise<Employee> {
    const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch employee');
    }
    
    return response.json();
  }

  async createEmployee(employee: CreateEmployeeRequest): Promise<Employee> {
    const response = await fetch(`${API_BASE_URL}/employees`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(employee),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create employee');
    }
    
    return response.json();
  }

  async updateEmployee(id: string, employee: UpdateEmployeeRequest): Promise<Employee> {
    const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(employee),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update employee');
    }
    
    return response.json();
  }

  async deleteEmployee(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete employee');
    }
  }

  async getAvailabilities(employeeId: string): Promise<EmployeeAvailability[]> {
    const response = await fetch(`${API_BASE_URL}/employees/${employeeId}/availabilities`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch availabilities');
    }
    
    return response.json();
  }

  async updateAvailabilities(employeeId: string, data: { planId: string, availabilities: Omit<EmployeeAvailability, 'id' | 'employeeId'>[] }): Promise<EmployeeAvailability[]> {
    console.log('🔄 Updating availabilities for employee:', employeeId);
    const response = await fetch(`${API_BASE_URL}/employees/${employeeId}/availabilities`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update availabilities');
    }
    
    return response.json();
  }

  async changePassword(id: string, data: { currentPassword: string, newPassword: string }): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/employees/${id}/password`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to change password');
    }
  }

  async updateLastLogin(employeeId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/employees/${employeeId}/last-login`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to update last login');
      }
    } catch (error) {
      console.error('Error updating last login:', error);
      throw error;
    }
  }
}

export const employeeService = new EmployeeService();