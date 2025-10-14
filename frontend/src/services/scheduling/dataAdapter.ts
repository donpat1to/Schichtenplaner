// frontend/src/services/scheduling/dataAdapter.ts
import { Employee, EmployeeAvailability } from '../../models/Employee';
import { ScheduledShift } from '../../models/ShiftPlan';
import { SchedulingEmployee, SchedulingShift } from './types';

export function transformToSchedulingData(
  employees: Employee[],
  scheduledShifts: ScheduledShift[],
  availabilities: EmployeeAvailability[]
): {
  schedulingEmployees: SchedulingEmployee[];
  schedulingShifts: SchedulingShift[];
  managerShifts: string[];
} {
  
  // Create employee availability map
  const availabilityMap = new Map<string, Map<string, number>>();
  
  availabilities.forEach(avail => {
    if (!availabilityMap.has(avail.employeeId)) {
      availabilityMap.set(avail.employeeId, new Map());
    }
    
    // Create a unique key for each shift pattern (dayOfWeek + timeSlotId)
    const shiftKey = `${avail.dayOfWeek}-${avail.timeSlotId}`;
    availabilityMap.get(avail.employeeId)!.set(shiftKey, avail.preferenceLevel);
  });

  // Transform employees
  const schedulingEmployees: SchedulingEmployee[] = employees.map(emp => {
    // Map roles
    let role: 'manager' | 'erfahren' | 'neu';
    if (emp.role === 'admin') role = 'manager';
    else if (emp.employeeType === 'experienced') role = 'erfahren';
    else role = 'neu';

    // Map contract
    const contract = emp.contractType === 'small' ? 1 : 2;

    return {
      id: emp.id,
      name: emp.name,
      role,
      contract,
      availability: availabilityMap.get(emp.id) || new Map(),
      assignedCount: 0,
      originalData: emp
    };
  });

  // Transform shifts and identify manager shifts
  const schedulingShifts: SchedulingShift[] = scheduledShifts.map(scheduledShift => ({
    id: scheduledShift.id,
    requiredEmployees: scheduledShift.requiredEmployees,
    originalData: scheduledShift
  }));

  // Identify manager shifts (shifts where manager has availability 1 or 2)
  const manager = schedulingEmployees.find(emp => emp.role === 'manager');
  const managerShifts: string[] = [];
  
  if (manager) {
    scheduledShifts.forEach(scheduledShift => {
      const dayOfWeek = getDayOfWeek(scheduledShift.date);
      const shiftKey = `${dayOfWeek}-${scheduledShift.timeSlotId}`;
      const preference = manager.availability.get(shiftKey);
      
      if (preference === 1 || preference === 2) {
        managerShifts.push(scheduledShift.id);
      }
    });
  }

  return {
    schedulingEmployees,
    schedulingShifts,
    managerShifts
  };
}

function getDayOfWeek(dateString: string): number {
  const date = new Date(dateString);
  return date.getDay() === 0 ? 7 : date.getDay();
}