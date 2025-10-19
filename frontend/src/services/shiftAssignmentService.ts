// frontend/src/services/shiftAssignmentService.ts - WEEKLY PATTERN VERSION
import { ShiftPlan, ScheduledShift } from '../models/ShiftPlan';
import { Employee, EmployeeAvailability } from '../models/Employee';
import { authService } from './authService';
//import { IntelligentShiftScheduler, AssignmentResult, WeeklyPattern } from './scheduling/useScheduling';
import { AssignmentResult } from '../models/scheduling';

const API_BASE_URL = 'http://localhost:3002/api/scheduled-shifts';



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
      
      const response = await fetch(`${API_BASE_URL}/${id}`, {
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
      const response = await fetch(`${API_BASE_URL}/${id}`, {
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
      const response = await fetch(`${API_BASE_URL}/plan/${planId}`, {
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

  async assignShifts(
    shiftPlan: ShiftPlan,
    employees: Employee[],
    availabilities: EmployeeAvailability[],
    constraints: any = {}
  ): Promise<AssignmentResult> {

    console.log('🧠 Starting intelligent scheduling for FIRST WEEK ONLY...');



    return {
      assignments: , 
      violations: ,
      success: ,
      resolutionReport: ,
    };
  }


  private static async createWeeklyPattern(
    definedShifts: ScheduledShift[],
    employees: Employee[],
    availabilities: EmployeeAvailability[],
    enforceNoTraineeAlone: boolean
  ): Promise<WeeklyPattern> {
    
    // Get first week of shifts (7 days from the start)
    const firstWeekShifts = this.getFirstWeekShifts(definedShifts);
    
    console.log('📅 First week analysis:');
    console.log('- Shifts in first week:', firstWeekShifts.length);
    
    // Fix: Use Array.from instead of spread operator with Set
    const uniqueDays = Array.from(new Set(firstWeekShifts.map(s => this.getDayOfWeek(s.date)))).sort();
    console.log('- Days covered:', uniqueDays);

    // Build availability map
    const availabilityMap = this.buildAvailabilityMap(availabilities);
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));

    // Initialize assignment state for first week
    const weeklyAssignments: { [shiftId: string]: string[] } = {};
    const employeeAssignmentCount: { [employeeId: string]: number } = {};
    
    employees.forEach(emp => {
      employeeAssignmentCount[emp.id] = 0;
    });

    firstWeekShifts.forEach(shift => {
      weeklyAssignments[shift.id] = [];
    });

    // Sort employees by capacity and experience
    const sortedEmployees = [...employees].sort((a, b) => {
      const aCapacity = this.getMaxAssignments(a);
      const bCapacity = this.getMaxAssignments(b);
      const aIsManager = a.role === 'admin';
      const bIsManager = b.role === 'admin';
      
      if (aIsManager !== bIsManager) return aIsManager ? -1 : 1;
      if (a.employeeType !== b.employeeType) {
        if (a.employeeType === 'experienced') return -1;
        if (b.employeeType === 'experienced') return 1;
      }
      return bCapacity - aCapacity;
    });

    // Sort shifts by priority (those with fewer available employees first)
    const sortedShifts = [...firstWeekShifts].sort((a, b) => {
      const aAvailable = this.countAvailableEmployees(a, employees, availabilityMap);
      const bAvailable = this.countAvailableEmployees(b, employees, availabilityMap);
      return aAvailable - bAvailable;
    });

    // Assign employees to first week shifts
    for (const employee of sortedEmployees) {
      const maxAssignments = this.getMaxAssignments(employee);
      
      // Get available shifts for this employee in first week
      const availableShifts = sortedShifts
        .filter(shift => {
          if (employeeAssignmentCount[employee.id] >= maxAssignments) return false;
          if (weeklyAssignments[shift.id].length >= shift.requiredEmployees) return false;

          const dayOfWeek = this.getDayOfWeek(shift.date);
          const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
          
          return this.isEmployeeAvailable(employee, shiftKey, availabilityMap) &&
                 this.isAssignmentCompatible(employee, weeklyAssignments[shift.id], employeeMap, enforceNoTraineeAlone);
        })
        .sort((a, b) => {
          // Prefer shifts with fewer current assignments
          return weeklyAssignments[a.id].length - weeklyAssignments[b.id].length;
        });

      // Assign to available shifts until capacity is reached
      for (const shift of availableShifts) {
        if (employeeAssignmentCount[employee.id] >= maxAssignments) break;
        
        weeklyAssignments[shift.id].push(employee.id);
        employeeAssignmentCount[employee.id]++;
        console.log(`✅ Assigned ${employee.name} to weekly pattern shift`);
        
        if (employeeAssignmentCount[employee.id] >= maxAssignments) break;
      }
    }

    // Ensure all shifts in first week have at least one employee
    for (const shift of firstWeekShifts) {
      if (weeklyAssignments[shift.id].length === 0) {
        const dayOfWeek = this.getDayOfWeek(shift.date);
        const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
        
        const availableEmployees = employees
          .filter(emp => 
            this.isEmployeeAvailable(emp, shiftKey, availabilityMap) &&
            this.canAssignByContract(emp, employeeAssignmentCount)
          )
          .sort((a, b) => {
            const aPref = availabilityMap.get(a.id)?.get(shiftKey) || 3;
            const bPref = availabilityMap.get(b.id)?.get(shiftKey) || 3;
            const aCount = employeeAssignmentCount[a.id] || 0;
            const bCount = employeeAssignmentCount[b.id] || 0;
            
            if (aPref !== bPref) return aPref - bPref;
            return aCount - bCount;
          });

        if (availableEmployees.length > 0) {
          const bestCandidate = availableEmployees[0];
          weeklyAssignments[shift.id].push(bestCandidate.id);
          employeeAssignmentCount[bestCandidate.id]++;
          console.log(`🆘 Emergency assigned ${bestCandidate.name} to weekly pattern`);
        }
      }
    }

    return {
      weekShifts: firstWeekShifts,
      assignments: weeklyAssignments,
      weekNumber: 1
    };
  }

  private static applyWeeklyPattern(
    allShifts: ScheduledShift[],
    weeklyPattern: WeeklyPattern
  ): { [shiftId: string]: string[] } {
    
    const assignments: { [shiftId: string]: string[] } = {};
    
    console.log('🔄 Applying weekly pattern to all shifts:', {
      patternShifts: weeklyPattern.weekShifts.length,
      allShifts: allShifts.length,
      patternAssignments: Object.keys(weeklyPattern.assignments).length
    });

    // Group pattern shifts by day-timeSlot for easy lookup
    const patternMap = new Map<string, string[]>();
    
    weeklyPattern.weekShifts.forEach((patternShift: ScheduledShift) => {
      const dayOfWeek = this.getDayOfWeek(patternShift.date);
      const patternKey = `${dayOfWeek}-${patternShift.timeSlotId}`;
      
      if (weeklyPattern.assignments[patternShift.id]) {
        patternMap.set(patternKey, weeklyPattern.assignments[patternShift.id]);
        console.log(`📋 Pattern mapping: ${patternKey} → ${weeklyPattern.assignments[patternShift.id].length} employees`);
      }
    });

    // Apply pattern to all shifts
    allShifts.forEach(shift => {
      const dayOfWeek = this.getDayOfWeek(shift.date);
      const patternKey = `${dayOfWeek}-${shift.timeSlotId}`;
      
      const patternAssignment = patternMap.get(patternKey);
      
      if (patternAssignment) {
        assignments[shift.id] = [...patternAssignment];
      } else {
        assignments[shift.id] = [];
        console.warn(`❌ No pattern assignment found for: ${patternKey} (Shift: ${shift.id})`);
      }
    });

    // Debug: Check assignment coverage
    const assignedShifts = Object.values(assignments).filter(a => a.length > 0).length;
    const totalShifts = allShifts.length;
    
    console.log(`📊 Pattern application result: ${assignedShifts}/${totalShifts} shifts assigned (${Math.round((assignedShifts/totalShifts)*100)}%)`);

    return assignments;
  }

  private static getFirstWeekShifts(shifts: ScheduledShift[]): ScheduledShift[] {
    if (shifts.length === 0) return [];
    
    // Sort by date and get the first 7 days
    const sortedShifts = [...shifts].sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = new Date(sortedShifts[0].date);
    const firstWeekEnd = new Date(firstDate);
    firstWeekEnd.setDate(firstWeekEnd.getDate() + 6); // 7 days total
    
    return sortedShifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      return shiftDate >= firstDate && shiftDate <= firstWeekEnd;
    });
  }

  // ========== EXISTING HELPER METHODS ==========

  static async getDefinedShifts(shiftPlan: ShiftPlan): Promise<ScheduledShift[]> {
    try {
      const scheduledShifts = await shiftAssignmentService.getScheduledShiftsForPlan(shiftPlan.id);
      console.log('📋 Loaded scheduled shifts:', scheduledShifts.length);

      if (!shiftPlan.shifts || shiftPlan.shifts.length === 0) {
        console.warn('⚠️ No shifts defined in shift plan');
        return scheduledShifts;
      }

      // Use first week for weekly pattern (7 days)
      const firstWeekShifts = this.getFirstWeekShifts(scheduledShifts);
      console.log('📅 Using first week shifts for pattern:', firstWeekShifts.length);
      
      return firstWeekShifts;
      
    } catch (err) {
      console.error("❌ Failed to load scheduled shifts:", err);
      return [];
    }
  }

  private static countAvailableEmployees(
    scheduledShift: ScheduledShift,
    employees: Employee[],
    availabilityMap: Map<string, Map<string, number>>
  ): number {
    const dayOfWeek = this.getDayOfWeek(scheduledShift.date);
    const shiftKey = `${dayOfWeek}-${scheduledShift.timeSlotId}`;
    
    return employees.filter(emp => 
      this.isEmployeeAvailable(emp, shiftKey, availabilityMap)
    ).length;
  }

  private static isAssignmentCompatible(
    candidate: Employee,
    currentAssignments: string[],
    employeeMap: Map<string, Employee>,
    enforceNoTraineeAlone: boolean
  ): boolean {
    if (!enforceNoTraineeAlone || currentAssignments.length === 0) return true;

    const currentEmployees = currentAssignments.map(id => employeeMap.get(id)).filter(Boolean) as Employee[];
    
    if (candidate.employeeType === 'trainee') {
      const hasExperiencedOrChef = currentEmployees.some(emp => 
        emp.employeeType === 'experienced' || emp.role === 'admin'
      );
      return hasExperiencedOrChef;
    }

    return true;
  }

  private static buildAvailabilityMap(availabilities: EmployeeAvailability[]): Map<string, Map<string, number>> {
    const map = new Map<string, Map<string, number>>();
    
    availabilities.forEach(avail => {
      if (!map.has(avail.employeeId)) {
        map.set(avail.employeeId, new Map<string, number>());
      }
      
      const shiftKey = `${avail.dayOfWeek}-${avail.timeSlotId}`;
      map.get(avail.employeeId)!.set(shiftKey, avail.preferenceLevel);
    });
    
    return map;
  }

  private static isEmployeeAvailable(
    employee: Employee,
    shiftKey: string,
    availabilityMap: Map<string, Map<string, number>>
  ): boolean {
    if (!employee.isActive) return false;
    
    const employeeAvailability = availabilityMap.get(employee.id);
    if (!employeeAvailability) return false;
    
    const preference = employeeAvailability.get(shiftKey);
    return preference !== undefined && preference !== 3;
  }

  private static canAssignByContract(
    employee: Employee,
    assignmentCount: { [employeeId: string]: number }
  ): boolean {
    const currentCount = assignmentCount[employee.id] || 0;
    const maxAssignments = this.getMaxAssignments(employee);
    return currentCount < maxAssignments;
  }

  private static getMaxAssignments(employee: Employee): number {
    switch (employee.contractType) {
      case 'small': return 1;
      case 'large': return 2;
      default: return 999;
    }
  }

  private static getDayOfWeek(dateString: string): number {
    const date = new Date(dateString);
    return date.getDay() === 0 ? 7 : date.getDay();
  }
}

export const shiftAssignmentService = new ShiftAssignmentService();