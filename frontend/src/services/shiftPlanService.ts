// frontend/src/services/shiftPlanService.ts
import { authService } from './authService';
import { ShiftPlan, CreateShiftPlanRequest, ScheduledShift, CreateShiftFromTemplateRequest } from '../models/ShiftPlan';
import { TEMPLATE_PRESETS } from '../models/defaults/shiftPlanDefaults';  

const API_BASE = 'http://localhost:3002/api/shift-plans';

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
    
    return await response.json();
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
    
    return await response.json();
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

  /*getTemplates: async (): Promise<ShiftPlan[]> => {
    const response = await fetch(`${API_BASE}/templates`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },*/

  // Get specific template or plan
  getTemplate: async (id: string): Promise<ShiftPlan> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Create plan from template
  /*createFromTemplate: async (data: CreateShiftFromTemplateRequest): Promise<ShiftPlan> => {
    const response = await fetch(`${API_BASE}/from-template`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },*/

  // Create new plan
  createPlan: async (data: CreateShiftPlanRequest): Promise<ShiftPlan> => {
    const response = await fetch(`${API_BASE}`, {
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
    const response = await fetch(`${API_BASE}/from-preset`, {
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

  async updateScheduledShift(id: string, updates: { assignedEmployees: string[] }): Promise<void> {
    try {
      console.log('🔄 Updating scheduled shift via API:', { id, updates });
      
      const response = await fetch(`/api/scheduled-shifts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updates)
      });

      // First, check if we got any response
      if (!response.ok) {
        // Try to get error message from response
        const responseText = await response.text();
        console.error('❌ Server response:', responseText);
        
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        // Try to parse as JSON if possible
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If not JSON, use the text as is
          errorMessage = responseText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      // Try to parse successful response
      const responseText = await response.text();
      let result;
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        console.warn('⚠️ Response was not JSON, but request succeeded');
        result = { message: 'Update successful' };
      }
      
      console.log('✅ Scheduled shift updated successfully:', result);
      
    } catch (error) {
      console.error('❌ Error updating scheduled shift:', error);
      throw error;
    }
  },

  async getScheduledShift(id: string): Promise<any> {
    try {
      const response = await fetch(`/api/scheduled-shifts/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const responseText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = responseText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const responseText = await response.text();
      return responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      console.error('Error fetching scheduled shift:', error);
      throw error;
    }
  },

  // New method to get all scheduled shifts for a plan
  async getScheduledShiftsForPlan(planId: string): Promise<ScheduledShift[]> {
    try {
      const response = await fetch(`/api/scheduled-shifts/plan/${planId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch scheduled shifts: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching scheduled shifts for plan:', error);
      throw error;
    }
  }
};