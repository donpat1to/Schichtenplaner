// frontend/src/services/shiftPlanService.ts
import { authService } from './authService';

const API_BASE = 'http://localhost:3002/api/shift-plans';

export interface CreateShiftPlanRequest {
  name: string;
  startDate: string;
  endDate: string;
  templateId?: string;
}

export interface ShiftPlan {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  templateId?: string;
  status: 'draft' | 'published';
  createdBy: string;
  createdAt: string;
  shifts: ShiftPlanShift[];
}

export interface ShiftPlanShift {
  id: string;
  shiftPlanId: string;
  date: string;
  startTime: string;
  endTime: string;
  requiredEmployees: number;
  assignedEmployees: string[];
}

export const shiftPlanService = {
  async getShiftPlans(): Promise<ShiftPlan[]> {
    const response = await fetch(API_BASE, {
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders()
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        authService.logout();
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Laden der Schichtpläne');
    }
    
    return response.json();
  },

  async getShiftPlan(id: string): Promise<ShiftPlan> {
    const response = await fetch(`${API_BASE}/${id}`, {
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders()
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        authService.logout();
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Schichtplan nicht gefunden');
    }
    
    return response.json();
  },

  async createShiftPlan(plan: CreateShiftPlanRequest): Promise<ShiftPlan> {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders()
      },
      body: JSON.stringify(plan)
    });

    if (!response.ok) {
      if (response.status === 401) {
        authService.logout();
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Erstellen des Schichtplans');
    }

    return response.json();
  },

  async updateShiftPlan(id: string, plan: Partial<ShiftPlan>): Promise<ShiftPlan> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders()
      },
      body: JSON.stringify(plan)
    });

    if (!response.ok) {
      if (response.status === 401) {
        authService.logout();
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Aktualisieren des Schichtplans');
    }

    return response.json();
  },

  async deleteShiftPlan(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders()
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        authService.logout();
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Löschen des Schichtplans');
    }
  }
};