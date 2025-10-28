// backend/src/services/SchedulingService.ts
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { ShiftPlan } from '../models/ShiftPlan.js';
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
    
    // 🆕 ENHANCED DATA VALIDATION
    console.log('\n🔍 ===== ENHANCED DATA VALIDATION =====');
    console.log(`Shift Plan: ${shiftPlan.name} (${shiftPlan.id})`);
    console.log(`Template: ${shiftPlan.isTemplate}`);
    console.log(`Generated shifts: ${shifts.length}`);
    console.log(`Input availabilities: ${availabilities.length}`);
    console.log(`Mapped availabilities: ${workerAvailabilities.length}`);
    
    // Check shift ID patterns
    const shiftIdsFromShifts = shifts.map(s => s.id);
    const shiftIdsFromAvailabilities = [...new Set(workerAvailabilities.map(a => a.shiftId))];
    
    console.log(`Shift IDs in generated shifts: ${shiftIdsFromShifts.length}`);
    console.log(`Unique shift IDs in availabilities: ${shiftIdsFromAvailabilities.length}`);
    
    // Find matching shift IDs
    const matchingShiftIds = shiftIdsFromAvailabilities.filter(availId => 
      shiftIdsFromShifts.includes(availId)
    );
    
    console.log(`✅ Matching shift IDs: ${matchingShiftIds.length}/${shiftIdsFromAvailabilities.length}`);
    
    // Show first few matches for verification
    if (matchingShiftIds.length > 0) {
      console.log('🔍 FIRST 5 MATCHING SHIFT IDs:');
      matchingShiftIds.slice(0, 5).forEach(id => {
        const shift = shifts.find(s => s.id === id);
        const availCount = workerAvailabilities.filter(a => a.shiftId === id).length;
        console.log(`   - ${id}: ${availCount} availabilities, Date: ${shift?.date}, TimeSlot: ${shift?.timeSlotId}`);
      });
    }
    
    // Show unmatched availabilities for debugging
    const unmatchedAvailabilities = workerAvailabilities.filter(avail => 
      !shiftIdsFromShifts.includes(avail.shiftId)
    );
    
    if (unmatchedAvailabilities.length > 0) {
      console.log('❌ UNMATCHED AVAILABILITIES:');
      const uniqueUnmatched = [...new Set(unmatchedAvailabilities.map(a => a.shiftId))];
      uniqueUnmatched.slice(0, 5).forEach(shiftId => {
        const count = unmatchedAvailabilities.filter(a => a.shiftId === shiftId).length;
        console.log(`   - ${shiftId}: ${count} availabilities`);
      });
      if (uniqueUnmatched.length > 5) console.log(`   ... and ${uniqueUnmatched.length - 5} more unique unmatched shift IDs`);
    }
    
    console.log('===== END ENHANCED DATA VALIDATION =====\n');
    
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
    
    if (!shiftPlan || !shiftPlan.startDate) {
      return shifts;
    }

    const startDate = new Date(shiftPlan.startDate);
    
    // Generate shifts for one week (Monday to Sunday)
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + dayOffset);
      
      const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay();
      const dayShifts = shiftPlan.shifts.filter(shift => shift.dayOfWeek === dayOfWeek);
      
      dayShifts.forEach(shift => {
        const shiftId = shift.id; // Use the original shift pattern ID
        const dateStr = currentDate.toISOString().split('T')[0];
        
        shifts.push({
          id: shiftId, // This matches the frontend availability records
          date: dateStr,
          timeSlotId: shift.timeSlotId,
          requiredEmployees: shift.requiredEmployees,
          minWorkers: 1,
          maxWorkers: 2,
          isPriority: false
        });

        console.log(`✅ Generated shift: ${shiftId} for date ${dateStr}, day ${dayOfWeek}, timeSlot ${shift.timeSlotId}`);
      });
    }

    console.log("Created shifts for one week. Amount: ", shifts.length);
    
    // Debug: Show which shift IDs we're using
    console.log('🔍 SHIFT IDS IN GENERATED SHIFTS:');
    shifts.forEach(shift => {
      console.log(`   - ${shift.id} (Date: ${shift.date}, TimeSlot: ${shift.timeSlotId})`);
    });
    
    return shifts;
  }

  private prepareAvailabilities(availabilities: Availability[], shiftPlan: ShiftPlan): any[] {
    console.log('🔄 Preparing availabilities for worker...');
    console.log(`Input availabilities: ${availabilities.length} records`);
    
    const workerAvailabilities = availabilities.map(avail => {
      const shiftId = avail.shiftId;
      
      console.log(`📋 Availability ${avail.id}: employee=${avail.employeeId}, shift=${shiftId}, preference=${avail.preferenceLevel}`);
      
      return {
        employeeId: avail.employeeId,
        shiftId: shiftId, // Use the original shift ID from frontend
        preferenceLevel: avail.preferenceLevel
      };
    });
    console.log(`✅ Mapped ${workerAvailabilities.length} availabilities for worker`);
    return workerAvailabilities;
  }

  private findShiftIdForAvailability(availability: Availability, shiftPlan: ShiftPlan): string {
    return availability.shiftId;
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
