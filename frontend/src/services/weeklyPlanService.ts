// frontend/src/services/weeklyPlanService.ts
import {
  WeeklyPlan,
  WeeklyPlanWithDetails,
  CreateWeeklyPlanRequest,
  UpdateWeeklyPlanRequest,
  SavePreferencesRequest,
  MyPreferencesResponse,
  PlanWeek,
  WeeklyPlanStatistics,
  AdminSavePreferencesRequest,
  CreateAssignmentsRequest
} from '../models/WeeklyPlan';
import { apiClient } from './apiClient';

export interface WeeklyPlanListItem extends Omit<WeeklyPlan, 'workDays'> {
  workDays: number[];
  weekCount: number;
  assignmentCount: number;
  employeeCount: number;
  createdByName?: string;
}

export interface GenerateResult {
  success: boolean;
  assignments: { weekId: string; employeeId: string }[];
  violations: string[];
  resolutionReport: string[];
  processingTime: number;
}

export interface ExportOptions {
  format: 'excel' | 'pdf';
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
        throw new Error('Nicht autorisiert - bitte erneut anmelden');
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
        throw new Error('Nicht autorisiert - bitte erneut anmelden');
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
        throw new Error('Nicht autorisiert - bitte erneut anmelden');
      }
      if (error.statusCode === 400) {
        throw new Error('Name, Startdatum und Enddatum sind erforderlich');
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
        throw new Error('Nicht autorisiert - bitte erneut anmelden');
      }
      if (error.statusCode === 404) {
        throw new Error('Wochenplan nicht gefunden');
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
        throw new Error('Nicht autorisiert - bitte erneut anmelden');
      }
      if (error.statusCode === 404) {
        throw new Error('Wochenplan nicht gefunden');
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
        throw new Error('Nicht autorisiert - bitte erneut anmelden');
      }
      if (error.statusCode === 404) {
        throw new Error('Woche nicht gefunden');
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
        throw new Error('Nicht autorisiert - bitte erneut anmelden');
      }
      if (error.statusCode === 404) {
        throw new Error('Wochenplan nicht gefunden');
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
        throw new Error('Nicht autorisiert - bitte erneut anmelden');
      }
      if (error.statusCode === 400) {
        if (error.message?.includes('Assignment block size')) {
          throw new Error('Blockgröße muss zwischen 1 und 10 liegen');
        }
        throw new Error('Ungültige Präferenzdaten');
      }
      throw new Error('Fehler beim Speichern der Präferenzen');
    }
  },

  async saveEmployeePreferences(
    planId: string,
    employeeId: string,
    data: Omit<AdminSavePreferencesRequest, 'employeeId'>
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
        throw new Error('Nicht autorisiert - bitte erneut anmelden');
      }
      if (error.statusCode === 400) {
        if (error.message?.includes('Assignment block size')) {
          throw new Error('Blockgröße muss zwischen 1 und 10 liegen');
        }
        throw new Error('Ungültige Präferenzdaten');
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
        throw new Error('Nicht autorisiert - bitte erneut anmelden');
      }
      if (error.statusCode === 404) {
        throw new Error('Wochenplan nicht gefunden');
      }
      if (error.statusCode === 500) {
        throw new Error('Fehler beim Generieren der Zuweisungen. Bitte überprüfen Sie die Präferenzen.');
      }
      throw new Error('Fehler bei der Generierung der Zuweisungen');
    }
  },

  async createAssignments(planId: string, assignments: CreateAssignmentsRequest): Promise<void> {
    try {
      await apiClient.post<CreateAssignmentsRequest>(`/weekly-plans/${planId}/create`, assignments);
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht autorisiert - bitte erneut anmelden');
      }
      if (error.statusCode === 404) {
        throw new Error('Wochenplan nicht gefunden');
      }
      if (error.statusCode === 500) {
        throw new Error('Fehler beim Generieren der Zuweisungen. Bitte überprüfen Sie die Präferenzen.');
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
        throw new Error('Nicht autorisiert - bitte erneut anmelden');
      }
      if (error.statusCode === 404) {
        throw new Error('Wochenplan nicht gefunden');
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
        throw new Error('Nicht autorisiert - bitte erneut anmelden');
      }
      if (error.statusCode === 400) {
        throw new Error('Plan kann ohne Zuweisungen nicht veröffentlicht werden');
      }
      if (error.statusCode === 404) {
        throw new Error('Wochenplan nicht gefunden');
      }
      throw new Error('Fehler beim Veröffentlichen des Plans');
    }
  },

  // Statistics
  async getPlanStatistics(planId: string): Promise<WeeklyPlanStatistics> {
    try {
      return await apiClient.get<WeeklyPlanStatistics>(`/weekly-plans/${planId}/statistics`);
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht autorisiert - bitte erneut anmelden');
      }
      if (error.statusCode === 404) {
        throw new Error('Wochenplan nicht gefunden');
      }
      throw new Error('Fehler beim Laden der Statistiken');
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
        throw new Error('Nicht autorisiert - bitte erneut anmelden');
      }
      if (error.statusCode === 400) {
        throw new Error('Nur veröffentlichte Pläne können exportiert werden');
      }
      if (error.statusCode === 404) {
        throw new Error('Wochenplan nicht gefunden');
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
        throw new Error('Nicht autorisiert - bitte erneut anmelden');
      }
      if (error.statusCode === 400) {
        throw new Error('Nur veröffentlichte Pläne können exportiert werden');
      }
      if (error.statusCode === 404) {
        throw new Error('Wochenplan nicht gefunden');
      }
      throw new Error('Fehler beim PDF-Export');
    }
  },

  // Helper method to download exported file
  async downloadExportedFile(planId: string, format: 'excel' | 'pdf'): Promise<void> {
    try {
      let blob: Blob;
      let filename: string;

      if (format === 'excel') {
        blob = await this.exportToExcel(planId);
        filename = `Wochenplan_Export.xlsx`;
      } else {
        blob = await this.exportToPDF(planId);
        filename = `Wochenplan_Export.pdf`;
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      throw error;
    }
  },

  // Method to get work requirements for an employee (for admin usage)
  async updateWorkRequirement(
    planId: string,
    employeeId: string,
    data: {
      requiredWeeks?: number;
      assignmentStyle?: 'consecutive' | 'scattered' | 'flexible';
      assignmentStyleConsecutive?: number;
    }
  ): Promise<any> {
    try {
      return await apiClient.put(`/weekly-plans/${planId}/work-requirements/${employeeId}`, data);
    } catch (error: any) {
      if (error.statusCode === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        throw new Error('Nicht autorisiert - bitte erneut anmelden');
      }
      if (error.statusCode === 400) {
        if (error.message?.includes('Assignment block size')) {
          throw new Error('Blockgröße muss zwischen 1 und 10 liegen');
        }
        throw new Error('Ungültige Daten');
      }
      if (error.statusCode === 404) {
        throw new Error('Wochenplan oder Mitarbeiter nicht gefunden');
      }
      throw new Error('Fehler beim Aktualisieren der Arbeitsanforderungen');
    }
  },

};