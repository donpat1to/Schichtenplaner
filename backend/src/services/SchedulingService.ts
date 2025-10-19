// backend/src/services/SchedulingService.ts
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { Employee, EmployeeAvailability } from '../models/Employee.js';
import { ShiftPlan, ScheduledShift } from '../models/ShiftPlan.js';
import { ScheduleRequest, ScheduleResult, Availability, Constraint } from '../models/scheduling.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SchedulingService {
  async generateOptimalSchedule(request: ScheduleRequest): Promise<ScheduleResult> {
    return new Promise((resolve, reject) => {
      // Use the built JavaScript file
      const workerPath = path.resolve(__dirname, '../../dist/workers/scheduler-worker.js');
      
      console.log('Looking for worker at:', workerPath);
      
      const worker = new Worker(workerPath, {
        workerData: this.prepareWorkerData(request)
      });

      // Timeout after 110 seconds
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Scheduling timeout after 110 seconds'));
      }, 110000);

      worker.on('message', (result: ScheduleResult) => {
        clearTimeout(timeout);
        resolve(result);
      });

      worker.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      worker.on('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }

  private prepareWorkerData(request: ScheduleRequest): any {
    const { shiftPlan, employees, availabilities, constraints } = request;
    
    const shifts = this.prepareShifts(shiftPlan);
    const workerAvailabilities = this.prepareAvailabilities(availabilities, shiftPlan);
    
    return {
      shiftPlan: {
        id: shiftPlan.id,
        name: shiftPlan.name,
        startDate: shiftPlan.startDate,
        endDate: shiftPlan.endDate,
        status: shiftPlan.status
      },
      employees: employees.filter(emp => emp.isActive),
      shifts,
      availabilities: workerAvailabilities,
      constraints: this.prepareConstraints(constraints)
    };
  }

  private prepareShifts(shiftPlan: ShiftPlan): any[] {
    if (!shiftPlan.isTemplate || !shiftPlan.scheduledShifts) {
      return this.generateScheduledShiftsFromTemplate(shiftPlan);
    }
    
    return shiftPlan.scheduledShifts.map(shift => ({
      id: shift.id,
      date: shift.date,
      timeSlotId: shift.timeSlotId,
      requiredEmployees: shift.requiredEmployees,
      minWorkers: 1,
      maxWorkers: 2,
      isPriority: false
    }));
  }

  private generateScheduledShiftsFromTemplate(shiftPlan: ShiftPlan): any[] {
      const shifts: any[] = [];
      
      if (!shiftPlan.startDate || !shiftPlan.shifts) {
        return shifts;
      }

      const startDate = new Date(shiftPlan.startDate);
      
      // Generate shifts for one week (Monday to Sunday)
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + dayOffset);
          
          const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay(); // Convert Sunday from 0 to 7
          const dayShifts = shiftPlan.shifts.filter(shift => shift.dayOfWeek === dayOfWeek);
          
          dayShifts.forEach(shift => {
              shifts.push({
                  id: `generated_${currentDate.toISOString().split('T')[0]}_${shift.timeSlotId}`,
                  date: currentDate.toISOString().split('T')[0],
                  timeSlotId: shift.timeSlotId,
                  requiredEmployees: shift.requiredEmployees,
                  minWorkers: 1,
                  maxWorkers: 2,
                  isPriority: false
              });
          });
      }

      console.log("Created shifts for one week. Amount: ", shifts.length);
      
      return shifts;
  }

  private prepareAvailabilities(availabilities: Availability[], shiftPlan: ShiftPlan): any[] {
    return availabilities.map(avail => ({
      employeeId: avail.employeeId,
      shiftId: this.findShiftIdForAvailability(avail, shiftPlan),
      availability: avail.preferenceLevel
    }));
  }

  private findShiftIdForAvailability(availability: Availability, shiftPlan: ShiftPlan): string {
    // Find the corresponding scheduled shift ID for this availability
    if (shiftPlan.scheduledShifts) {
      const scheduledShift = shiftPlan.scheduledShifts.find(shift => 
        shift.timeSlotId === availability.timeSlotId && 
        this.getDayOfWeekFromDate(shift.date) === availability.dayOfWeek
      );
      
      if (scheduledShift) {
        return scheduledShift.id;
      }
    }
    
    // Fallback: generate a consistent ID
    return `shift_${availability.dayOfWeek}_${availability.timeSlotId}`;
  }

  private getDayOfWeekFromDate(dateString: string): number {
    const date = new Date(dateString);
    return date.getDay() === 0 ? 7 : date.getDay();
  }

  private prepareConstraints(constraints: Constraint[]): any {
    const defaultConstraints = {
      maxShiftsPerDay: 1,
      minEmployeesPerShift: 1,
      maxEmployeesPerShift: 2,
      enforceTraineeSupervision: true,
      contractHoursLimits: true
    };

    return {
      ...defaultConstraints,
      ...constraints.reduce((acc, constraint) => {
        acc[constraint.type] = constraint.parameters;
        return acc;
      }, {} as any)
    };
  }
}
