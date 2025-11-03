import { ShiftPlan, CreateShiftPlanRequest } from '../models/ShiftPlan';
import { TEMPLATE_PRESETS } from '../models/defaults/shiftPlanDefaults';
import { apiClient } from './apiClient';

export const shiftPlanService = {
  async getShiftPlans(): Promise<ShiftPlan[]> {
    try {
      const plans = await apiClient.get<ShiftPlan[]>('/shift-plans');
      
      // Ensure scheduledShifts is always an array
      return plans.map((plan: any) => ({
        ...plan,
        scheduledShifts: plan.scheduledShifts || []
      }));
    } catch (error: any) {
      if (error.statusCode === 401) {
        // You might want to import and use authService here if needed
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Laden der Schichtpläne');
    }
  },

  async getShiftPlan(id: string): Promise<ShiftPlan> {
    try {
      return await apiClient.get<ShiftPlan>(`/shift-plans/${id}`);
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Schichtplan nicht gefunden');
    }
  },

  async createShiftPlan(plan: CreateShiftPlanRequest): Promise<ShiftPlan> {
    try {
      return await apiClient.post<ShiftPlan>('/shift-plans', plan);
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Erstellen des Schichtplans');
    }
  },

  async updateShiftPlan(id: string, plan: Partial<ShiftPlan>): Promise<ShiftPlan> {
    try {
      return await apiClient.put<ShiftPlan>(`/shift-plans/${id}`, plan);
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Aktualisieren des Schichtplans');
    }
  },

  async deleteShiftPlan(id: string): Promise<void> {
    try {
      await apiClient.delete(`/shift-plans/${id}`);
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Löschen des Schichtplans');
    }
  },

  async getTemplate(id: string): Promise<ShiftPlan> {
    return await apiClient.get<ShiftPlan>(`/shift-plans/${id}`);
  },

  async regenerateScheduledShifts(planId: string): Promise<void> {
    try {
      console.log('🔄 Attempting to regenerate scheduled shifts...');
      await apiClient.post(`/shift-plans/${planId}/regenerate-shifts`);
      console.log('✅ Scheduled shifts regenerated');
    } catch (error) {
      console.error('❌ Error regenerating shifts:', error);
      throw error;
    }
  },

  async createPlan(data: CreateShiftPlanRequest): Promise<ShiftPlan> {
    return await apiClient.post<ShiftPlan>('/shift-plans', data);
  },

  async createFromPreset(data: {
    presetName: string;
    name: string;
    startDate: string;
    endDate: string;
    isTemplate?: boolean;
  }): Promise<ShiftPlan> {
    try {
      return await apiClient.post<ShiftPlan>('/shift-plans/from-preset', data);
    } catch (error: any) {
      throw new Error(error.message || `HTTP error! status: ${error.statusCode}`);
    }
  },

  async getTemplatePresets(): Promise<{name: string, label: string, description: string}[]> {
    return Object.entries(TEMPLATE_PRESETS).map(([key, preset]) => ({
      name: key,
      label: preset.name,
      description: preset.description
    }));
  },

  async clearAssignments(planId: string): Promise<void> {
    try {
      console.log('🔄 Clearing assignments for plan:', planId);
      await apiClient.post(`/shift-plans/${planId}/clear-assignments`);
      console.log('✅ Assignments cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing assignments:', error);
      throw error;
    }
  },

  async exportShiftPlanToExcel(planId: string): Promise<Blob> {
    try {
      console.log('📊 Exporting shift plan to Excel:', planId);
      
      // Use the apiClient with blob response handling
      const blob = await apiClient.request<Blob>(`/shift-plans/${planId}/export/excel`, {
        method: 'GET',
      }, 'blob');
      
      console.log('✅ Excel export successful');
      return blob;
    } catch (error: any) {
      console.error('❌ Error exporting to Excel:', error);
      
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      
      if (error.statusCode === 404) {
        throw new Error('Schichtplan nicht gefunden');
      }
      
      throw new Error('Fehler beim Excel-Export des Schichtplans');
    }
  },

  async exportShiftPlanToPDF(planId: string): Promise<Blob> {
    try {
      console.log('📄 Exporting shift plan to PDF:', planId);
      
      // Use the apiClient with blob response handling
      const blob = await apiClient.request<Blob>(`/shift-plans/${planId}/export/pdf`, {
        method: 'GET',
      }, 'blob');
      
      console.log('✅ PDF export successful');
      return blob;
    } catch (error: any) {
      console.error('❌ Error exporting to PDF:', error);
      
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      
      if (error.statusCode === 404) {
        throw new Error('Schichtplan nicht gefunden');
      }
      
      throw new Error('Fehler beim PDF-Export des Schichtplans');
    }
  },
};