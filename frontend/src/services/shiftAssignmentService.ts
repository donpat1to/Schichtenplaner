import { ShiftPlan, ScheduledShift } from '../models/ShiftPlan';
import { Employee, EmployeeAvailability } from '../models/Employee';
import { AssignmentResult, ScheduleRequest } from '../models/scheduling';
import { apiClient } from './apiClient';

export class ShiftAssignmentService {
  async updateScheduledShift(id: string, updates: { assignedEmployees: string[] }): Promise<void> {
    try {
      console.log('🔄 Updating scheduled shift via API:', { id, updates });
      
      await apiClient.put(`/scheduled-shifts/${id}`, updates);
      console.log('✅ Scheduled shift updated successfully');
      
    } catch (error) {
      console.error('❌ Error updating scheduled shift:', error);
      throw error;
    }
  }

  async getScheduledShift(id: string): Promise<any> {
    try {
      return await apiClient.get(`/scheduled-shifts/${id}`);
    } catch (error) {
      console.error('Error fetching scheduled shift:', error);
      throw error;
    }
  }

  async getScheduledShiftsForPlan(planId: string): Promise<ScheduledShift[]> {
    try {
      const shifts = await apiClient.get<ScheduledShift[]>(`/scheduled-shifts/plan/${planId}`);
      
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
    return await apiClient.post<AssignmentResult>('/scheduling/generate-schedule', request);
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