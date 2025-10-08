// frontend/src/services/authService.ts
const API_BASE = 'http://localhost:3002/api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: string;
  phone?: string;
  department?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresIn: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'instandhalter' | 'user';
  createdAt: string;
  lastLogin?: string;
  phone?: string;
  department?: string;
  isActive?: boolean;
}

class AuthService {
  private token: string | null = null;

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/auth/login`, {
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
    localStorage.setItem('user', JSON.stringify(data.user));
    
    return data;
  }

  // Register Methode hinzufügen
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Registrierung fehlgeschlagen');
    }

    // Nach der Erstellung automatisch einloggen
    return this.login({
      email: userData.email,
      password: userData.password
    });
  }

  // getCurrentUser als SYNCHRON machen
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  // Asynchrone Methode für Server-Abfrage
  async fetchCurrentUser(): Promise<User | null> {
    const token = this.getToken();
    if (!token) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const user = await response.json();
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

  // Für API Calls mit Authentication
  getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
}

export const authService = new AuthService();