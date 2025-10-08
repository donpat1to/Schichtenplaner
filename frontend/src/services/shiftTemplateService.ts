// frontend/src/services/shiftTemplateService.ts
import { ShiftTemplate, TemplateShift } from '../types/shiftTemplate';
import { authService } from './authService';

const API_BASE = 'http://localhost:3001/api/shift-templates';

export const shiftTemplateService = {
  async getTemplates(): Promise<ShiftTemplate[]> {
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
    
    return response.json();
  },

  async getTemplate(id: string): Promise<ShiftTemplate> {
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

  async createTemplate(template: Omit<ShiftTemplate, 'id' | 'createdAt' | 'createdBy'>): Promise<ShiftTemplate> {
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

  async updateTemplate(id: string, template: Partial<ShiftTemplate>): Promise<ShiftTemplate> {
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