// frontend/src/services/weeklyPlanService.ts
import {
  WeeklyPlan,
  WeeklyPlanWithDetails,
  CreateWeeklyPlanRequest,
  UpdateWeeklyPlanRequest,
  SavePreferencesRequest,
  MyPreferencesResponse,
  PlanWeek,
} from '../models/WeeklyPlan';
import { apiClient } from './apiClient';

export interface WeeklyPlanListItem extends WeeklyPlan {
  weekCount: number;
}

export interface GenerateResult {
  success: boolean;
  assignments: { weekId: string; employeeId: string }[];
  violations: string[];
  resolutionReport: string[];
  processingTime: number;
}

export const weeklyPlanService = {
  // CRUD operations
  async getWeeklyPlans(): Promise<WeeklyPlanListItem[]> {
    try {
      return await apiClient.get<WeeklyPlanListItem[]>('/weekly-plans');
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Laden der Wochenpläne');
    }
  },

  async getWeeklyPlan(id: string): Promise<WeeklyPlanWithDetails> {
    try {
      return await apiClient.get<WeeklyPlanWithDetails>(`/weekly-plans/${id}`);
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Wochenplan nicht gefunden');
    }
  },

  async createWeeklyPlan(plan: CreateWeeklyPlanRequest): Promise<WeeklyPlanWithDetails> {
    try {
      return await apiClient.post<WeeklyPlanWithDetails>('/weekly-plans', plan);
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Erstellen des Wochenplans');
    }
  },

  async updateWeeklyPlan(id: string, plan: UpdateWeeklyPlanRequest): Promise<WeeklyPlanWithDetails> {
    try {
      return await apiClient.put<WeeklyPlanWithDetails>(`/weekly-plans/${id}`, plan);
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Aktualisieren des Wochenplans');
    }
  },

  async deleteWeeklyPlan(id: string): Promise<void> {
    try {
      await apiClient.delete(`/weekly-plans/${id}`);
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Löschen des Wochenplans');
    }
  },

  // Week management
  async updateWeek(planId: string, weekId: string, data: { minEmployees?: number; maxEmployees?: number }): Promise<PlanWeek> {
    try {
      return await apiClient.put<PlanWeek>(`/weekly-plans/${planId}/weeks/${weekId}`, data);
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Aktualisieren der Woche');
    }
  },

  // Preferences
  async getMyPreferences(planId: string): Promise<MyPreferencesResponse> {
    try {
      return await apiClient.get<MyPreferencesResponse>(`/weekly-plans/${planId}/my-preferences`);
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Laden der Präferenzen');
    }
  },

  async saveMyPreferences(planId: string, data: SavePreferencesRequest): Promise<void> {
    try {
      await apiClient.post(`/weekly-plans/${planId}/preferences`, data);
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Speichern der Präferenzen');
    }
  },

  async saveEmployeePreferences(
    planId: string,
    employeeId: string,
    data: SavePreferencesRequest
  ): Promise<void> {
    try {
      await apiClient.post(`/weekly-plans/${planId}/admin-preferences`, {
        employeeId,
        ...data,
      });
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Speichern der Mitarbeiterpräferenzen');
    }
  },

  // Solver & Assignments
  async generateAssignments(planId: string): Promise<GenerateResult> {
    try {
      return await apiClient.post<GenerateResult>(`/weekly-plans/${planId}/generate`);
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler bei der Generierung der Zuweisungen');
    }
  },

  async clearAssignments(planId: string): Promise<void> {
    try {
      await apiClient.post(`/weekly-plans/${planId}/clear-assignments`);
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Löschen der Zuweisungen');
    }
  },

  async publishPlan(planId: string): Promise<WeeklyPlanWithDetails> {
    try {
      return await apiClient.post<WeeklyPlanWithDetails>(`/weekly-plans/${planId}/publish`);
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      if (error.statusCode === 400) {
        throw new Error('Plan kann ohne Zuweisungen nicht veröffentlicht werden');
      }
      throw new Error('Fehler beim Veröffentlichen des Plans');
    }
  },

  // Export
  async exportToExcel(planId: string): Promise<Blob> {
    try {
      return await apiClient.request<Blob>(`/weekly-plans/${planId}/export/excel`, {
        method: 'GET',
      }, 'blob');
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      if (error.statusCode === 400) {
        throw new Error('Nur veröffentlichte Pläne können exportiert werden');
      }
      throw new Error('Fehler beim Excel-Export');
    }
  },

  async exportToPDF(planId: string): Promise<Blob> {
    try {
      return await apiClient.request<Blob>(`/weekly-plans/${planId}/export/pdf`, {
        method: 'GET',
      }, 'blob');
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      if (error.statusCode === 400) {
        throw new Error('Nur veröffentlichte Pläne können exportiert werden');
      }
      throw new Error('Fehler beim PDF-Export');
    }
  },
};
