// frontend/src/services/shiftPlanService.ts
import { authService } from './authService';
import { ShiftPlan, CreateShiftPlanRequest } from '../models/ShiftPlan';
import { TEMPLATE_PRESETS } from '../models/defaults/shiftPlanDefaults';  

const API_BASE_URL = '/api/shift-plans';

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// Helper function to handle responses
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const shiftPlanService = {
  async getShiftPlans(): Promise<ShiftPlan[]> {
    const response = await fetch(API_BASE_URL, {
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
    
    const plans = await response.json();
    
    // Ensure scheduledShifts is always an array
    return plans.map((plan: any) => ({
      ...plan,
      scheduledShifts: plan.scheduledShifts || []
    }));
  },

  async getShiftPlan(id: string): Promise<ShiftPlan> {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
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
    
    return await response.json();
  },

  async createShiftPlan(plan: CreateShiftPlanRequest): Promise<ShiftPlan> {
    const response = await fetch(API_BASE_URL, {
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
    const response = await fetch(`${API_BASE_URL}/${id}`, {
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
    const response = await fetch(`${API_BASE_URL}/${id}`, {
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

  // Get specific template or plan
  getTemplate: async (id: string): Promise<ShiftPlan> => {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },


  async regenerateScheduledShifts(planId: string):Promise<void> {
    try {
        console.log('🔄 Attempting to regenerate scheduled shifts...');
        
        // You'll need to add this API endpoint to your backend
        const response = await fetch(`${API_BASE_URL}/${planId}/regenerate-shifts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
        });

        if (response.ok) {
        console.log('✅ Scheduled shifts regenerated');
        } else {
        console.error('❌ Failed to regenerate shifts');
        }
    } catch (error) {
        console.error('❌ Error regenerating shifts:', error);
    }
  },

  // Create new plan
  createPlan: async (data: CreateShiftPlanRequest): Promise<ShiftPlan> => {
    const response = await fetch(`${API_BASE_URL}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  createFromPreset: async (data: {
    presetName: string;
    name: string;
    startDate: string;
    endDate: string;
    isTemplate?: boolean;
  }): Promise<ShiftPlan> => {
    const response = await fetch(`${API_BASE_URL}/from-preset`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  getTemplatePresets: async (): Promise<{name: string, label: string, description: string}[]> => {
    // name = label
     return Object.entries(TEMPLATE_PRESETS).map(([key, preset]) => ({
      name: key,
      label: preset.name,
      description: preset.description
    }));
  },

  async clearAssignments(planId: string): Promise<void> {
    try {
      console.log('🔄 Clearing assignments for plan:', planId);
      
      const response = await fetch(`${API_BASE_URL}/${planId}/clear-assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders()
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to clear assignments: ${response.status}`);
      }

      console.log('✅ Assignments cleared successfully');
      
    } catch (error) {
      console.error('❌ Error clearing assignments:', error);
      throw error;
    }
  },
};