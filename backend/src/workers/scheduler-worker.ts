// backend/src/workers/scheduler-worker.ts
import { parentPort, workerData } from 'worker_threads';
import { CPModel, CPSolver } from './cp-sat-wrapper.js';
import { ShiftPlan, Shift } from '../models/ShiftPlan.js';
import { Employee, EmployeeAvailability } from '../models/Employee.js';
import { Availability, Constraint, Violation, SolverOptions, Solution, Assignment } from '../models/scheduling.js';

interface WorkerData {
  shiftPlan: ShiftPlan;
  employees: Employee[];
  availabilities: Availability[];
  constraints: Constraint[];
  shifts: Shift[];
}


function buildSchedulingModel(model: CPModel, data: WorkerData): void {
  const { employees, shifts, availabilities, constraints } = data;
  
  // Filter employees to only include active ones
  const activeEmployees = employees.filter(emp => emp.isActive);
  const trainees = activeEmployees.filter(emp => emp.employeeType === 'trainee');
  const experienced = activeEmployees.filter(emp => emp.employeeType === 'experienced');
  
  console.log(`Building model with ${activeEmployees.length} employees, ${shifts.length} shifts`);
  console.log(`Available shifts per week: ${shifts.length}`);

  // 1. Create assignment variables for all possible assignments
  activeEmployees.forEach((employee: any) => {
    shifts.forEach((shift: any) => {
      const varName = `assign_${employee.id}_${shift.id}`;
      model.addVariable(varName, 'bool');
    });
  });

  // 2. Availability constraints
  activeEmployees.forEach((employee: any) => {
    shifts.forEach((shift: any) => {
      const availability = availabilities.find(
        (a: any) => a.employeeId === employee.id && a.shiftId === shift.id
      );
      
      // Hard constraint: never assign when preference level is 3 (unavailable)
      if (availability?.preferenceLevel === 3) {
        const varName = `assign_${employee.id}_${shift.id}`;
        model.addConstraint(
          `${varName} == 0`,
          `Hard availability constraint for ${employee.name} in shift ${shift.id}`
        );
      }
    });
  });

  // 3. Max 1 shift per day per employee
  const shiftsByDate = groupShiftsByDate(shifts);
  activeEmployees.forEach((employee: any) => {
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

  // 4. Shift staffing constraints (RELAXED)
  shifts.forEach((shift: any) => {
    const assignmentVars = activeEmployees.map(
      (emp: any) => `assign_${emp.id}_${shift.id}`
    );
    
    if (assignmentVars.length > 0) {
      // Minimum workers - make this a soft constraint if possible
      const minWorkers = Math.max(shift.minWorkers || 1, 1);
      model.addConstraint(
        `${assignmentVars.join(' + ')} >= ${minWorkers}`,
        `Min workers for shift ${shift.id}`
      );
      
      // Maximum workers
      const maxWorkers = shift.maxWorkers || 3;
      model.addConstraint(
        `${assignmentVars.join(' + ')} <= ${maxWorkers}`,
        `Max workers for shift ${shift.id}`
      );
    }
  });

  // 5. Trainee supervision constraints
  trainees.forEach((trainee: any) => {
    shifts.forEach((shift: any) => {
      const traineeVar = `assign_${trainee.id}_${shift.id}`;
      const experiencedVars = experienced.map((exp: any) => 
        `assign_${exp.id}_${shift.id}`
      );
      
      if (experiencedVars.length > 0) {
        // If trainee works, at least one experienced must work
        model.addConstraint(
          `${traineeVar} <= ${experiencedVars.join(' + ')}`,
          `Trainee ${trainee.name} requires supervision in shift ${shift.id}`
        );
      } else {
        // If no experienced available, trainee cannot work this shift
        model.addConstraint(
          `${traineeVar} == 0`,
          `No experienced staff for trainee ${trainee.name} in shift ${shift.id}`
        );
      }
    });
  });

  // 6. Contract type constraints
  const totalShifts = shifts.length;
  console.log(`Total available shifts: ${totalShifts}`);
  
  activeEmployees.forEach((employee: any) => {
    const contractType = employee.contractType || 'large';
    
    // ADJUSTMENT: Make contract constraints feasible with available shifts
    let minShifts, maxShifts;
    
    if (contractType === 'small') {
      // Small contract: 1 shifts
      minShifts = 1;
      maxShifts = Math.min(1, totalShifts);
    } else {
      // Large contract: 2 shifts (2) 
      minShifts = 2;
      maxShifts = Math.min(2, totalShifts);
    }
    
    const shiftVars = shifts.map(
      (shift: any) => `assign_${employee.id}_${shift.id}`
    );
    
    if (shiftVars.length > 0) {
      // Use range instead of exact number
      model.addConstraint(
        `${shiftVars.join(' + ')} == ${minShifts}`,
        `Expected shifts for ${employee.name} (${contractType} contract)`
      );
      
      model.addConstraint(
        `${shiftVars.join(' + ')} <= ${maxShifts}`,
        `Max shifts for ${employee.name} (${contractType} contract)`
      );
      
      console.log(`Employee ${employee.name}: ${minShifts}-${maxShifts} shifts (${contractType})`);
    }
  });

  // 7. Objective: Maximize preferred assignments with soft constraints
  let objectiveExpression = '';
  let softConstraintPenalty = '';
  
  activeEmployees.forEach((employee: any) => {
    shifts.forEach((shift: any) => {
      const varName = `assign_${employee.id}_${shift.id}`;
      const availability = availabilities.find(
        (a: any) => a.employeeId === employee.id && a.shiftId === shift.id
      );
      
      let score = 0;
      if (availability) {
        score = availability.preferenceLevel === 1 ? 10 : 
               availability.preferenceLevel === 2 ? 5 : 
               -10000; // Very heavy penalty for unavailable
      } else {
        // No availability info - slight preference to assign
        score = 1;
      }
      
      if (objectiveExpression) {
        objectiveExpression += ` + ${score} * ${varName}`;
      } else {
        objectiveExpression = `${score} * ${varName}`;
      }
    });
  });
  
  if (objectiveExpression) {
    model.maximize(objectiveExpression);
    console.log('Objective function set with preference optimization');
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
  const employeeAssignments: any = {};
  
  console.log('=== SOLUTION DEBUG INFO ===');
  console.log('Solution success:', solution.success);
  console.log('Raw assignments from Python:', solution.assignments?.length || 0);
  console.log('Variables in solution:', Object.keys(solution.variables || {}).length);
  
  // Initialize assignments object
  shifts.forEach((shift: any) => {
    assignments[shift.id] = [];
  });
  
  employees.forEach((employee: any) => {
    employeeAssignments[employee.id] = 0;
  });

  // METHOD 1: Try to use raw variables from solution
  if (solution.variables) {
    console.log('Using variable-based assignment extraction');
    
    Object.entries(solution.variables).forEach(([varName, value]) => {
      if (varName.startsWith('assign_') && value === 1) {
        const parts = varName.split('_');
        if (parts.length >= 3) {
          const employeeId = parts[1];
          const shiftId = parts.slice(2).join('_');
          
          // Find the actual shift ID (handle generated IDs)
          const actualShift = shifts.find(s => 
            s.id === shiftId || 
            `assign_${employeeId}_${s.id}` === varName
          );
          
          if (actualShift) {
            if (!assignments[actualShift.id]) {
              assignments[actualShift.id] = [];
            }
            assignments[actualShift.id].push(employeeId);
            employeeAssignments[employeeId]++;
          }
        }
      }
    });
  }
  
  // METHOD 2: Fallback to parsed assignments from Python
  if (solution.assignments && solution.assignments.length > 0) {
    console.log('Using Python-parsed assignments');
    
    solution.assignments.forEach((assignment: any) => {
      const shiftId = assignment.shiftId;
      const employeeId = assignment.employeeId;
      
      if (shiftId && employeeId) {
        if (!assignments[shiftId]) {
          assignments[shiftId] = [];
        }
        assignments[shiftId].push(employeeId);
        employeeAssignments[employeeId]++;
      }
    });
  }

  // METHOD 3: Debug - log all variables to see what's available
  if (Object.keys(assignments).length === 0 && solution.variables) {
    console.log('Debug: First 10 variables from solution:');
    const varNames = Object.keys(solution.variables).slice(0, 10);
    varNames.forEach(varName => {
      console.log(`  ${varName} = ${solution.variables[varName]}`);
    });
  }

  // Log results
  console.log('=== ASSIGNMENT RESULTS ===');
  employees.forEach((employee: any) => {
    console.log(`  ${employee.name}: ${employeeAssignments[employee.id]} shifts`);
  });
  
  let totalAssignments = 0;
  shifts.forEach((shift: any) => {
    const count = assignments[shift.id]?.length || 0;
    totalAssignments += count;
    console.log(`  Shift ${shift.id}: ${count} employees`);
  });
  
  console.log(`Total assignments: ${totalAssignments}`);
  console.log('==========================');
  
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
      
      // Only detect violations if we actually have assignments
      if (Object.keys(assignments).length > 0) {
        violations = detectViolations(assignments, data.employees, data.shifts);
      } else {
        violations.push('NO_ASSIGNMENTS: Solver reported success but produced no assignments');
        console.warn('Solver reported success but produced no assignments. Solution:', solution);
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