// frontend/src/services/shiftAssignmentService.ts - WEEKLY PATTERN VERSION
import { ShiftPlan, ScheduledShift } from '../models/ShiftPlan';
import { Employee, EmployeeAvailability } from '../models/Employee';
import { authService } from './authService';
import { AssignmentResult, ScheduleRequest } from '../models/scheduling';

const API_BASE_URL = '/api';



// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

export class ShiftAssignmentService {
  async updateScheduledShift(id: string, updates: { assignedEmployees: string[] }): Promise<void> {
    try {
      //console.log('🔄 Updating scheduled shift via API:', { id, updates });
      
      const response = await fetch(`${API_BASE_URL}/scheduled-shifts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders()
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
  }

  async getScheduledShift(id: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/scheduled-shifts/${id}`, {
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
  }

  // New method to get all scheduled shifts for a plan
  async getScheduledShiftsForPlan(planId: string): Promise<ScheduledShift[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/scheduled-shifts/plan/${planId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch scheduled shifts: ${response.status}`);
      }

      const shifts = await response.json();
      
      // DEBUG: Check the structure of returned shifts
      console.log('🔍 SCHEDULED SHIFTS STRUCTURE:', shifts.slice(0, 3));
      
      // Fix: Ensure timeSlotId is properly mapped
      const fixedShifts = shifts.map((shift: any) => ({
        ...shift,
        timeSlotId: shift.timeSlotId || shift.time_slot_id, // Handle both naming conventions
        requiredEmployees: shift.requiredEmployees || shift.required_employees || 2, // Default fallback
        assignedEmployees: shift.assignedEmployees || shift.assigned_employees || []
      }));

      console.log('✅ Fixed scheduled shifts:', fixedShifts.length);
      return fixedShifts;
    } catch (error) {
      console.error('Error fetching scheduled shifts for plan:', error);
      throw error;
    }
  }

  private async callSchedulingAPI(request: ScheduleRequest): Promise<AssignmentResult> {
    const response = await fetch(`${API_BASE_URL}/scheduling/generate-schedule`, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders()
        },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Scheduling failed');
    }

    return response.json();
  }

  async assignShifts(
    shiftPlan: ShiftPlan,
    employees: Employee[],
    availabilities: EmployeeAvailability[],
    constraints: any = {}
  ): Promise<AssignmentResult> {
    console.log('🧠 Starting scheduling optimization...');

    const scheduleRequest: ScheduleRequest = {
      shiftPlan,
      employees,
      availabilities: availabilities.map(avail => ({
        ...avail,
        preferenceLevel: avail.preferenceLevel as 1 | 2 | 3
      })),
      constraints: Array.isArray(constraints) ? constraints : []
    };

    return await this.callSchedulingAPI(scheduleRequest);
  }
}

export const shiftAssignmentService = new ShiftAssignmentService();