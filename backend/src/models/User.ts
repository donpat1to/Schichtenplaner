// backend/src/models/User.ts
export interface User {
  id: string;
  email: string;
  password: string; // gehashed
  name: string;
  role: 'admin' | 'instandhalter' | 'user';
  createdAt: Date;
}

export interface UserSession {
  userId: string;
  token: string;
  expiresAt: Date;
}