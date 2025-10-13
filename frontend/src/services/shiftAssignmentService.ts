// frontend/src/services/shiftAssignmentService.ts - WEEKLY PATTERN VERSION
import { ShiftPlan, ScheduledShift } from '../models/ShiftPlan';
import { Employee, EmployeeAvailability } from '../models/Employee';

export interface AssignmentResult {
  assignments: { [shiftId: string]: string[] };
  violations: string[];
  success: boolean;
  pattern: WeeklyPattern;
}

export interface WeeklyPattern {
  weekShifts: ScheduledShift[];
  assignments: { [shiftId: string]: string[] };
  weekNumber: number;
}

export class ShiftAssignmentService {

  static async assignShifts(
    shiftPlan: ShiftPlan,
    employees: Employee[],
    availabilities: EmployeeAvailability[],
    constraints: any = {}
  ): Promise<AssignmentResult> {

    console.log('🔄 Starting weekly pattern assignment...');

    // Get defined shifts
    const definedShifts = this.getDefinedShifts(shiftPlan);
    const activeEmployees = employees.filter(emp => emp.isActive);
    
    console.log('📊 Plan analysis:');
    console.log('- Total shifts in plan:', definedShifts.length);
    console.log('- Active employees:', activeEmployees.length);

    // STRATEGY: Create weekly pattern and repeat
    const weeklyPattern = await this.createWeeklyPattern(
      definedShifts,
      activeEmployees,
      availabilities,
      constraints.enforceNoTraineeAlone
    );

    console.log('🎯 Weekly pattern created for', weeklyPattern.weekShifts.length, 'shifts');

    // Apply pattern to all weeks in the plan
    const assignments = this.applyWeeklyPattern(definedShifts, weeklyPattern);
    
    const violations = this.findViolations(assignments, activeEmployees, definedShifts, constraints.enforceNoTraineeAlone);

    console.log('📊 Weekly pattern assignment completed:');
    console.log('- Pattern shifts:', weeklyPattern.weekShifts.length);
    console.log('- Total plan shifts:', definedShifts.length);
    console.log('- Assignments made:', Object.values(assignments).flat().length);
    console.log('- Violations:', violations.length);

    return {
      assignments,
      violations,
      success: violations.length === 0,
      pattern: weeklyPattern
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
    
    // Group all shifts by week
    const shiftsByWeek = this.groupShiftsByWeek(allShifts);
    
    console.log('📅 Applying weekly pattern to', Object.keys(shiftsByWeek).length, 'weeks');

    // For each week, apply the pattern from week 1
    Object.entries(shiftsByWeek).forEach(([weekKey, weekShifts]) => {
      const weekNumber = parseInt(weekKey);
      
      weekShifts.forEach(shift => {
        // Find the corresponding shift in the weekly pattern
        const patternShift = this.findMatchingPatternShift(shift, weeklyPattern.weekShifts);
        
        if (patternShift) {
          // Use the same assignment as the pattern shift
          assignments[shift.id] = [...weeklyPattern.assignments[patternShift.id]];
        } else {
          // No matching pattern shift, leave empty
          assignments[shift.id] = [];
        }
      });
    });

    return assignments;
  }

  private static groupShiftsByWeek(shifts: ScheduledShift[]): { [weekNumber: string]: ScheduledShift[] } {
    const weeks: { [weekNumber: string]: ScheduledShift[] } = {};
    
    shifts.forEach(shift => {
      const weekNumber = this.getWeekNumber(shift.date);
      if (!weeks[weekNumber]) {
        weeks[weekNumber] = [];
      }
      weeks[weekNumber].push(shift);
    });
    
    return weeks;
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

  private static findMatchingPatternShift(
    shift: ScheduledShift,
    patternShifts: ScheduledShift[]
  ): ScheduledShift | null {
    const shiftDayOfWeek = this.getDayOfWeek(shift.date);
    const shiftTimeSlot = shift.timeSlotId;
    
    return patternShifts.find(patternShift => 
      this.getDayOfWeek(patternShift.date) === shiftDayOfWeek &&
      patternShift.timeSlotId === shiftTimeSlot
    ) || null;
  }

  private static getWeekNumber(dateString: string): number {
    const date = new Date(dateString);
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  // ========== EXISTING HELPER METHODS ==========

  private static getDefinedShifts(shiftPlan: ShiftPlan): ScheduledShift[] {
    if (!shiftPlan.scheduledShifts) return [];

    const definedShiftPatterns = new Set(
      shiftPlan.shifts.map(shift => 
        `${shift.dayOfWeek}-${shift.timeSlotId}`
      )
    );

    const definedShifts = shiftPlan.scheduledShifts.filter(scheduledShift => {
      const dayOfWeek = this.getDayOfWeek(scheduledShift.date);
      const pattern = `${dayOfWeek}-${scheduledShift.timeSlotId}`;
      return definedShiftPatterns.has(pattern);
    });

    return definedShifts;
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

  private static findViolations(
    assignments: { [shiftId: string]: string[] },
    employees: Employee[],
    definedShifts: ScheduledShift[],
    enforceNoTraineeAlone: boolean
  ): string[] {
    const violations: string[] = [];
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));

    definedShifts.forEach(scheduledShift => {
      const assignedEmployeeIds = assignments[scheduledShift.id] || [];
      
      if (assignedEmployeeIds.length === 0) {
        violations.push(`Shift has no assigned employees`);
        return;
      }

      const assignedEmployees = assignedEmployeeIds.map(id => employeeMap.get(id)).filter(Boolean) as Employee[];

      if (enforceNoTraineeAlone && assignedEmployees.length === 1) {
        const soloEmployee = assignedEmployees[0];
        if (soloEmployee.employeeType === 'trainee') {
          violations.push(`Trainee ${soloEmployee.name} is working alone`);
        }
      }
    });

    return violations;
  }

  private static getDayOfWeek(dateString: string): number {
    const date = new Date(dateString);
    return date.getDay() === 0 ? 7 : date.getDay();
  }
}