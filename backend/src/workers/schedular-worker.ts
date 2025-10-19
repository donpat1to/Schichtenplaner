// backend/src/workers/scheduler-worker.ts
import { parentPort, workerData } from 'worker_threads';
import { CPModel, CPSolver } from './cp-sat-wrapper.js';
import { ShiftPlan, Shift } from '../models/ShiftPlan.js';
import { Employee, EmployeeAvailability } from '../models/Employee.js';
import { Availability, Constraint } from '../models/scheduling.js';

interface WorkerData {
  shiftPlan: ShiftPlan;
  employees: Employee[];
  availabilities: Availability[];
  constraints: Constraint[];
  shifts: Shift[];
}

function buildSchedulingModel(model: CPModel, data: WorkerData): void {
  const { employees, shifts, availabilities, constraints } = data;
  
  // 1. Entscheidungsvariablen erstellen
  employees.forEach((employee: any) => {
    shifts.forEach((shift: any) => {
      const varName = `assign_${employee.id}_${shift.id}`;
      model.addVariable(varName, 'bool');
    });
  });
  
  // 2. Verfügbarkeits-Constraints
  employees.forEach((employee: any) => {
    shifts.forEach((shift: any) => {
      const availability = availabilities.find(
        (a: any) => a.employeeId === employee.id && a.shiftId === shift.id
      );
      
      if (availability?.preferenceLevel === 3) {
        const varName = `assign_${employee.id}_${shift.id}`;
        model.addConstraint(`${varName} == 0`, `Availability constraint for ${employee.name}`);
      }
    });
  });
  
  // 3. Schicht-Besetzungs-Constraints
  shifts.forEach((shift: any) => {
    const assignmentVars = employees.map(
      (emp: any) => `assign_${emp.id}_${shift.id}`
    );
    
    if (assignmentVars.length > 0) {
      model.addConstraint(
        `${assignmentVars.join(' + ')} >= ${shift.minWorkers || 1}`,
        `Min workers for shift ${shift.id}`
      );
      
      model.addConstraint(
        `${assignmentVars.join(' + ')} <= ${shift.maxWorkers || 3}`,
        `Max workers for shift ${shift.id}`
      );
    }
  });
  
  // 4. Keine zwei Schichten pro Tag pro Employee
  employees.forEach((employee: any) => {
    const shiftsByDate = groupShiftsByDate(shifts);
    
    Object.entries(shiftsByDate).forEach(([date, dayShifts]) => {
      const dayAssignmentVars = (dayShifts as any[]).map(
        (shift: any) => `assign_${employee.id}_${shift.id}`
      );
      
      if (dayAssignmentVars.length > 0) {
        model.addConstraint(
          `${dayAssignmentVars.join(' + ')} <= 1`,
          `Max one shift per day for ${employee.name} on ${date}`
        );
      }
    });
  });
  
  // 5. Trainee-Überwachungs-Constraints
  const trainees = employees.filter((emp: any) => emp.employeeType === 'trainee');
  const experienced = employees.filter((emp: any) => emp.employeeType === 'experienced');
  
  trainees.forEach((trainee: any) => {
    shifts.forEach((shift: any) => {
      const traineeVar = `assign_${trainee.id}_${shift.id}`;
      const experiencedVars = experienced.map((exp: any) => `assign_${exp.id}_${shift.id}`);
      
      if (experiencedVars.length > 0) {
        model.addConstraint(
          `${traineeVar} <= ${experiencedVars.join(' + ')}`,
          `Trainee ${trainee.name} requires supervision in shift ${shift.id}`
        );
      }
    });
  });
  
  // 6. Contract Hours Constraints
  employees.forEach((employee: any) => {
    const contractHours = employee.contractType === 'small' ? 20 : 40;
    const shiftHoursVars: string[] = [];
    
    shifts.forEach((shift: any) => {
      const shiftHours = 8; // Assuming 8 hours per shift
      const varName = `assign_${employee.id}_${shift.id}`;
      shiftHoursVars.push(`${shiftHours} * ${varName}`);
    });
    
    if (shiftHoursVars.length > 0) {
      model.addConstraint(
        `${shiftHoursVars.join(' + ')} <= ${contractHours}`,
        `Contract hours limit for ${employee.name}`
      );
    }
  });
  
  // 7. Ziel: Verfügbarkeits-Score maximieren
  let objectiveExpression = '';
  employees.forEach((employee: any) => {
    shifts.forEach((shift: any) => {
      const availability = availabilities.find(
        (a: any) => a.employeeId === employee.id && a.shiftId === shift.id
      );
      
      if (availability) {
        const score = availability.preferenceLevel === 1 ? 10 : 
                     availability.preferenceLevel === 2 ? 5 : 
                     -1000; // Heavy penalty for assigning unavailable shifts
        
        const varName = `assign_${employee.id}_${shift.id}`;
        if (objectiveExpression) {
          objectiveExpression += ` + ${score} * ${varName}`;
        } else {
          objectiveExpression = `${score} * ${varName}`;
        }
      }
    });
  });
  
  if (objectiveExpression) {
    model.maximize(objectiveExpression);
  }
}

function groupShiftsByDate(shifts: any[]): Record<string, any[]> {
  return shifts.reduce((groups: Record<string, any[]>, shift: any) => {
    const date = shift.date?.split('T')[0] || 'unknown';
    if (!groups[date]) groups[date] = [];
    groups[date].push(shift);
    return groups;
  }, {});
}

function extractAssignmentsFromSolution(solution: any, employees: any[], shifts: any[]): any {
  const assignments: any = {};
  
  // Initialize assignments object with shift IDs
  shifts.forEach((shift: any) => {
    assignments[shift.id] = [];
  });
  
  // Extract assignments from solution variables
  employees.forEach((employee: any) => {
    shifts.forEach((shift: any) => {
      const varName = `assign_${employee.id}_${shift.id}`;
      const isAssigned = solution.variables?.[varName] === 1;
      
      if (isAssigned) {
        if (!assignments[shift.id]) {
          assignments[shift.id] = [];
        }
        assignments[shift.id].push(employee.id);
      }
    });
  });
  
  return assignments;
}

function detectViolations(assignments: any, employees: any[], shifts: any[]): string[] {
  const violations: string[] = [];
  const employeeMap = new Map(employees.map((emp: any) => [emp.id, emp]));
  
  // Check for understaffed shifts
  shifts.forEach((shift: any) => {
    const assignedCount = assignments[shift.id]?.length || 0;
    const minRequired = shift.minWorkers || 1;
    
    if (assignedCount < minRequired) {
      violations.push(`UNDERSTAFFED: Shift ${shift.id} has ${assignedCount} employees but requires ${minRequired}`);
    }
  });
  
  // Check for trainee supervision
  shifts.forEach((shift: any) => {
    const assignedEmployees = assignments[shift.id] || [];
    const hasTrainee = assignedEmployees.some((empId: string) => {
      const emp = employeeMap.get(empId);
      return emp?.employeeType === 'trainee';
    });
    
    const hasExperienced = assignedEmployees.some((empId: string) => {
      const emp = employeeMap.get(empId);
      return emp?.employeeType === 'experienced';
    });
    
    if (hasTrainee && !hasExperienced) {
      violations.push(`TRAINEE_UNSUPERVISED: Shift ${shift.id} has trainee but no experienced employee`);
    }
  });
  
  // Check for multiple shifts per day per employee
  const shiftsByDate = groupShiftsByDate(shifts);
  employees.forEach((employee: any) => {
    Object.entries(shiftsByDate).forEach(([date, dayShifts]) => {
      let shiftsAssigned = 0;
      dayShifts.forEach((shift: any) => {
        if (assignments[shift.id]?.includes(employee.id)) {
          shiftsAssigned++;
        }
      });
      
      if (shiftsAssigned > 1) {
        violations.push(`MULTIPLE_SHIFTS: ${employee.name} has ${shiftsAssigned} shifts on ${date}`);
      }
    });
  });
  
  return violations;
}

async function runScheduling() {
  const data: WorkerData = workerData;
  const startTime = Date.now();
  try {
    console.log('Starting scheduling optimization...');
    
    
    // Validate input data
    if (!data.shifts || data.shifts.length === 0) {
      throw new Error('No shifts provided for scheduling');
    }
    
    if (!data.employees || data.employees.length === 0) {
      throw new Error('No employees provided for scheduling');
    }
    
    console.log(`Optimizing ${data.shifts.length} shifts for ${data.employees.length} employees`);
    
    const model = new CPModel();
    buildSchedulingModel(model, data);
    
    const solver = new CPSolver({
      maxTimeInSeconds: 105,
      numSearchWorkers: 8,
      logSearchProgress: true
    });
    
    const solution = await solver.solve(model);
    const processingTime = Date.now() - startTime;
    
    console.log(`Scheduling completed in ${processingTime}ms`);
    console.log(`Solution success: ${solution.success}`);
    
    let assignments = {};
    let violations: string[] = [];
    let resolutionReport: string[] = [
      `Solved in ${processingTime}ms`,
      `Variables: ${solution.metadata?.variablesCreated || 'unknown'}`,
      `Constraints: ${solution.metadata?.constraintsAdded || 'unknown'}`,
      `Optimal: ${solution.metadata?.optimal || false}`,
      `Status: ${solution.success ? 'SUCCESS' : 'FAILED'}`
    ];
    
    if (solution.success) {
      // Extract assignments from solution
      assignments = extractAssignmentsFromSolution(solution, data.employees, data.shifts);
      
      // Detect violations
      violations = detectViolations(assignments, data.employees, data.shifts);
      
      if (violations.length === 0) {
        resolutionReport.push('✅ No constraint violations detected');
      } else {
        resolutionReport.push(`⚠️ Found ${violations.length} violations:`);
        violations.forEach(violation => {
          resolutionReport.push(`   - ${violation}`);
        });
      }
      
      // Add assignment statistics
      const totalAssignments = Object.values(assignments).reduce((sum: number, shiftAssignments: any) => 
        sum + shiftAssignments.length, 0
      );
      resolutionReport.push(`📊 Total assignments: ${totalAssignments}`);
      
    } else {
      violations.push('SCHEDULING_FAILED: No feasible solution found');
      resolutionReport.push('❌ No feasible solution could be found');
    }
    
    parentPort?.postMessage({
      assignments,
      violations,
      success: solution.success && violations.length === 0,
      resolutionReport,
      processingTime
    });
    
  } catch (error) {
    console.error('Scheduling worker error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    parentPort?.postMessage({
      error: errorMessage,
      success: false,
      assignments: {},
      violations: [`ERROR: ${errorMessage}`],
      resolutionReport: [`Error: ${errorMessage}`],
      processingTime: Date.now() - startTime
    });
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Scheduling worker received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Scheduling worker received SIGINT, shutting down...');
  process.exit(0);
});

runScheduling();