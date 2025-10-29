// frontend/src/services/authService.ts
import { Employee } from '../models/Employee';
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Login fehlgeschlagen');
    }

    const data: AuthResponse = await response.json();
    this.token = data.token;
    localStorage.setItem('token', data.token);
    localStorage.setItem('employee', JSON.stringify(data.employee));
    return data;
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Registrierung fehlgeschlagen');
    }

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
    if (!token) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const user = data.user;
        localStorage.setItem('user', JSON.stringify(user));
        return user;
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }

    return null;
  }

  logout(): void {
    this.token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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