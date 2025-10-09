// frontend/src/services/employeeService.ts
import { Employee, CreateEmployeeRequest, UpdateEmployeeRequest, Availability } from '../types/employee';

const API_BASE_URL = 'http://localhost:3002/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export class EmployeeService {
  async getEmployees(): Promise<Employee[]> {
    console.log('🔄 Fetching employees from API...');
    
    const token = localStorage.getItem('token');
    console.log('🔑 Token exists:', !!token);
    
    const response = await fetch(`${API_BASE_URL}/employees`, {
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

  async getAvailabilities(employeeId: string): Promise<Availability[]> {
    const response = await fetch(`${API_BASE_URL}/employees/${employeeId}/availabilities`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch availabilities');
    }
    
    return response.json();
  }

  async updateAvailabilities(employeeId: string, availabilities: Availability[]): Promise<Availability[]> {
    const response = await fetch(`${API_BASE_URL}/employees/${employeeId}/availabilities`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(availabilities),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update availabilities');
    }
    
    return response.json();
  }
}

// ✅ Exportiere eine Instanz der Klasse
export const employeeService = new EmployeeService();