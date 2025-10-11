// frontend/src/services/shiftTemplateService.ts
import { ShiftPlan } from '../../../backend/src/models/shiftPlan.js';
import { authService } from './authService';

const API_BASE = 'http://localhost:3002/api/shift-templates';

export const shiftTemplateService = {
  async getTemplates(): Promise<ShiftPlan[]> {
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
      throw new Error('Fehler beim Laden der Vorlagen');
    }
    
    const templates = await response.json();
    return templates;
  },

  async getTemplate(id: string): Promise<ShiftPlan> {
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
      throw new Error('Vorlage nicht gefunden');
    }
    
    return response.json();
  },

  async createTemplate(template: Omit<ShiftPlan, 'id' | 'createdAt' | 'createdBy'>): Promise<ShiftPlan> {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders()
      },
      body: JSON.stringify(template)
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        authService.logout();
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Erstellen der Vorlage');
    }
    
    return response.json();
  },

  async updateTemplate(id: string, template: Partial<ShiftPlan>): Promise<ShiftPlan> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders()
      },
      body: JSON.stringify(template)
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        authService.logout();
        throw new Error('Nicht authorisiert - bitte erneut anmelden');
      }
      throw new Error('Fehler beim Aktualisieren der Vorlage');
    }
    
    return response.json();
  },

  async deleteTemplate(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/${id}`, {
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
      throw new Error('Fehler beim Löschen der Vorlage');
    }
  }
};