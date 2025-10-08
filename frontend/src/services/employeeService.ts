// frontend/src/services/employeeService.ts
import { Employee, Availability, CreateEmployeeRequest, UpdateEmployeeRequest } from '../types/employee';
import { authService } from './authService';

const API_BASE = 'http://localhost:3002/api/employees';

export const employeeService = {
  // Alle Mitarbeiter abrufen
  async getEmployees(): Promise<Employee[]> {
    const response = await fetch(`${API_BASE}?_=${Date.now()}`, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        ...authService.getAuthHeaders()
      }
    });
    
    if (!response.ok) {
      throw new Error('Fehler beim Laden der Mitarbeiter');
    }
    
    return response.json();
  },

  // Einzelnen Mitarbeiter abrufen
  async getEmployee(id: string): Promise<Employee> {
    const response = await fetch(`${API_BASE}/${id}`, {
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders()
      }
    });
    
    if (!response.ok) {
      throw new Error('Mitarbeiter nicht gefunden');
    }
    
    return response.json();
  },

  // Neuen Mitarbeiter erstellen
  async createEmployee(employeeData: CreateEmployeeRequest): Promise<Employee> {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders()
      },
      body: JSON.stringify(employeeData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Fehler beim Erstellen des Mitarbeiters');
    }
    
    return response.json();
  },

  // Mitarbeiter aktualisieren
  async updateEmployee(id: string, updates: UpdateEmployeeRequest): Promise<Employee> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders()
      },
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      throw new Error('Fehler beim Aktualisieren des Mitarbeiters');
    }
    
    return response.json();
  },

  // Mitarbeiter permanent löschen
  async deleteEmployee(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: {
        ...authService.getAuthHeaders()
      }
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Fehler beim Löschen des Mitarbeiters' }));
      throw new Error(error.error || 'Fehler beim Löschen des Mitarbeiters');
    }
  },

  // Verfügbarkeiten abrufen
  async getAvailabilities(employeeId: string): Promise<Availability[]> {
    const response = await fetch(`${API_BASE}/${employeeId}/availabilities`, {
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders()
      }
    });
    
    if (!response.ok) {
      throw new Error('Fehler beim Laden der Verfügbarkeiten');
    }
    
    return response.json();
  },

  // Verfügbarkeiten aktualisieren
  async updateAvailabilities(employeeId: string, availabilities: Availability[]): Promise<Availability[]> {
    const response = await fetch(`${API_BASE}/${employeeId}/availabilities`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders()
      },
      body: JSON.stringify(availabilities)
    });
    
    if (!response.ok) {
      throw new Error('Fehler beim Aktualisieren der Verfügbarkeiten');
    }
    
    return response.json();
  }
};