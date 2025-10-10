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
  name: string;
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
    
    const data = await response.json();
    
    // Convert snake_case to camelCase
    return data.map((plan: any) => ({
      id: plan.id,
      name: plan.name,
      startDate: plan.start_date, // Convert here
      endDate: plan.end_date,     // Convert here
      templateId: plan.template_id,
      status: plan.status,
      createdBy: plan.created_by,
      createdAt: plan.created_at,
      shifts: plan.shifts || []
    }));
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
    
    const data = await response.json();
    
    // Convert snake_case to camelCase
    return {
      id: data.id,
      name: data.name,
      startDate: data.start_date, // Convert here
      endDate: data.end_date,     // Convert here
      templateId: data.template_id,
      status: data.status,
      createdBy: data.created_by,
      createdAt: data.created_at,
      shifts: data.shifts || []
    };
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
  },

  async updateShiftPlanShift(planId: string, shift: ShiftPlanShift): Promise<void> {
    const response = await fetch(`${API_BASE}/${planId}/shifts/${shift.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders()
      },
      body: JSON.stringify(shift)
    });

    if (!response.ok) {
      if (response.status === 401) {
        authService.logout();
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Aktualisieren der Schicht');
    }
  },

  async addShiftPlanShift(planId: string, shift: Omit<ShiftPlanShift, 'id' | 'shiftPlanId' | 'assignedEmployees'>): Promise<void> {
    const response = await fetch(`${API_BASE}/${planId}/shifts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders()
      },
      body: JSON.stringify(shift)
    });

    if (!response.ok) {
      if (response.status === 401) {
        authService.logout();
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Hinzufügen der Schicht');
    }
  },

  async deleteShiftPlanShift(planId: string, shiftId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/${planId}/shifts/${shiftId}`, {
      method: 'DELETE',
      headers: {
        ...authService.getAuthHeaders()
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        authService.logout();
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Löschen der Schicht');
    }
  }
};
