// frontend/src/services/shiftPlanService.ts
import { authService } from './authService';
import { ShiftPlan, CreateShiftPlanRequest, Shift } from '../../../backend/src/models/shiftPlan.js';

const API_BASE = 'http://localhost:3002/api/shift-plans';

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
    return data.map((plan: any) => ({
      id: plan.id,
      name: plan.name,
      startDate: plan.start_date,
      endDate: plan.end_date,
      templateId: plan.template_id,
      status: plan.status,
      createdBy: plan.created_by,
      createdAt: plan.created_at,
      shifts: plan.shifts || []
    }));
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

  async updateShiftPlanShift(planId: string, shift: Shift): Promise<void> {
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

  async addShiftPlanShift(planId: string, shift: Omit<Shift, 'id' | 'shiftPlanId' | 'assignedEmployees'>): Promise<void> {
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
