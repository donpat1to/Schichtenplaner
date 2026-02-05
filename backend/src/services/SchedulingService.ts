// backend/src/services/SchedulingService.ts
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { ShiftPlan, Shift } from '../models/ShiftPlan.js';
import { ScheduleRequest, ScheduleResult, Availability, Constraint } from '../models/scheduling.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SchedulingService {
  async generateOptimalSchedule(request: ScheduleRequest): Promise<ScheduleResult> {
    return new Promise((resolve, reject) => {
      const workerPath = path.resolve(__dirname, '../../dist/workers/shift-scheduler-worker.js');
      const workerData = this.prepareWorkerData(request);

      const worker = new Worker(workerPath, {
        workerData
      });

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

    // Enhanced data validation
    console.log('\n🔍 ===== ENHANCED DATA VALIDATION =====');
    console.log(`Shift Plan: ${shiftPlan.name} (${shiftPlan.id})`);
    console.log(`Template: ${shiftPlan.isTemplate}`);
    console.log(`Shifts: ${shifts.length}`);

    // Calculate total assignment slots
    const totalAssignmentSlots = shifts.reduce((sum, shift) => sum + shift.minEmployees, 0);
    console.log(`Total assignment slots needed: ${totalAssignmentSlots}`);

    console.log(`Input availabilities: ${availabilities.length}`);
    console.log(`Mapped availabilities: ${workerAvailabilities.length}`);

    // Check shift ID patterns
    const shiftIdsFromShifts = shifts.map(s => s.id);
    const shiftIdsFromAvailabilities = [...new Set(workerAvailabilities.map(a => a.shiftId))];

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
        console.log(`   - ${id}: ${availCount} availabilities, Day: ${shift?.dayOfWeek}, TimeSlot: ${shift?.timeSlotId}, Minimum: ${shift?.minEmployees}`);
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
      plan: {
        id: shiftPlan.id,
        name: shiftPlan.name,
        startDate: shiftPlan.startDate,
        endDate: shiftPlan.endDate,
        status: shiftPlan.status,
        isTemplate: shiftPlan.isTemplate
      },
      employees: employees.filter(emp => emp.isActive).map(emp => ({
        id: emp.id,
        username: emp.username,
        firstname: emp.firstname,
        lastname: emp.lastname,
        employeeType: emp.employeeType,
        contractType: emp.contractType,
        canWorkAlone: emp.canWorkAlone,
        isActive: emp.isActive,
        isTrainee: emp.isTrainee
      })),
      shifts: shifts,
      availabilities: workerAvailabilities,
      constraints: this.prepareConstraints(constraints),
    };
  }

  private prepareShifts(shiftPlan: ShiftPlan): any[] {
    // Map shifts with their timeSlot information
    return shiftPlan.shifts.map(shift => {
      // Find the timeSlot for this shift
      const timeSlot = shiftPlan.timeSlots.find(ts => ts.id === shift.timeSlotId);

      if (timeSlot === undefined) {
        console.log('❌ UNMATCHED TimeSlot:');
        return;
      }

      return {
        id: shift.id,
        planId: shift.planId,
        timeSlotId: shift.timeSlotId,
        dayOfWeek: shift.dayOfWeek,
        minEmployees: shift.minEmployees || 1,
        maxEmployees: shift.maxEmployees || 2,
        timeSlot: {
          id: timeSlot.id,
          name: timeSlot.name,
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime
        }
      };
    });
  };


  private prepareAvailabilities(availabilities: Availability[], shiftPlan: ShiftPlan): any[] {
    console.log('🔄 Preparing availabilities for worker...');
    console.log(`Input availabilities: ${availabilities.length} records`);

    const workerAvailabilities = availabilities.map(avail => {
      return {
        employeeId: avail.employeeId,
        shiftId: avail.shiftId,
        preferenceLevel: avail.preferenceLevel
      };
    });

    console.log(`✅ Mapped ${workerAvailabilities.length} availabilities for worker`);
    return workerAvailabilities;
  }

  private prepareConstraints(constraints: Constraint[]): any {
    const defaultConstraints = {
      maxShiftsPerDay: 1,
      minEmployeesPerShift: 1,
      maxEmployeesPerShift: 2,
      enforceTraineeSupervision: true,
      contractHoursLimits: true,
      individualAssignments: true // NEW: Flag for individual assignment mode
    };

    return {
      ...defaultConstraints,
      ...constraints.reduce((acc, constraint) => {
        acc[constraint.type] = constraint.parameters;
        return acc;
      }, {} as any)
    };
  }

  // Convert assignments to individual slot format
  public convertToIndividualAssignments(
    assignments: { [shiftId: string]: string[] },
    shifts: Shift[]
  ): { shiftId: string; employeeId: string; assignmentIndex: number }[] {
    const individualAssignments: { shiftId: string; employeeId: string; assignmentIndex: number }[] = [];

    Object.entries(assignments).forEach(([shiftId, employeeIds]) => {
      const shift = shifts.find(s => s.id === shiftId);
      if (!shift) return;

      // For each employee assigned to this shift, create an individual assignment
      employeeIds.forEach((employeeId, index) => {
        individualAssignments.push({
          shiftId,
          employeeId,
          assignmentIndex: index + 1 // 1-based index for assignment slots
        });
      });
    });

    return individualAssignments;
  }
}