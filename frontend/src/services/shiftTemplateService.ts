// frontend/src/services/shiftTemplateService.ts
import { TemplateShift } from '../types/shiftTemplate';
import { authService } from './authService';

const API_BASE = 'http://localhost:3001/api/shift-templates';

export const shiftTemplateService = {
  async getTemplates(): Promise<TemplateShift[]> {
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
    // Sortiere die Vorlagen so, dass die Standard-Vorlage immer zuerst kommt
    return templates.sort((a: TemplateShift, b: TemplateShift) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  },

  async getTemplate(id: string): Promise<TemplateShift> {
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

  async createTemplate(template: Omit<TemplateShift, 'id' | 'createdAt' | 'createdBy'>): Promise<TemplateShift> {
    // Wenn diese Vorlage als Standard markiert ist,
    // fragen wir den Benutzer, ob er wirklich die Standard-Vorlage ändern möchte
    if (template.isDefault) {
      const confirm = window.confirm(
        'Diese Vorlage wird als neue Standard-Vorlage festgelegt. Die bisherige Standard-Vorlage wird dadurch zu einer normalen Vorlage. Möchten Sie fortfahren?'
      );
      if (!confirm) {
        throw new Error('Operation abgebrochen');
      }
    }

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

  async updateTemplate(id: string, template: Partial<TemplateShift>): Promise<TemplateShift> {
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