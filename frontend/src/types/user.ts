// frontend/src/types/user.ts
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'instandhalter' | 'user';
  phone?: string;
  department?: string;
  lastLogin?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}