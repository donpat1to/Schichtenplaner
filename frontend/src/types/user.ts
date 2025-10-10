// frontend/src/types/user.ts
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'instandhalter' | 'user';
  employeeType: 'chef' | 'neuling' | 'erfahren';
  isSufficientlyIndependent: boolean;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string | null;
  notes?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}