import { Employee } from '../models/Employee';
import { apiClient } from './apiClient';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: string;
}

export interface AuthResponse {
  employee: Employee;
  token: string;
  expiresIn: string;
}

class AuthService {
  private token: string | null = null;

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const data = await apiClient.post<AuthResponse>('/auth/login', credentials);
    this.token = data.token;
    localStorage.setItem('token', data.token);
    localStorage.setItem('employee', JSON.stringify(data.employee));
    return data;
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    await apiClient.post('/employees', userData);
    return this.login({
      email: userData.email,
      password: userData.password
    });
  }

  getCurrentEmployee(): Employee | null {
    const employeeStr = localStorage.getItem('employee');
    return employeeStr ? JSON.parse(employeeStr) : null;
  }

  async fetchCurrentEmployee(): Promise<Employee | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      const data = await apiClient.get<{ user: Employee }>('/auth/me');
      localStorage.setItem('user', JSON.stringify(data.user));
      return data.user;
    } catch (error) {
      console.error('Error fetching current user:', error);
      return null;
    }
  }

  logout(): void {
    this.token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('employee');
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
}

export const authService = new AuthService();