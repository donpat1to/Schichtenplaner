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
  const nonManagerEmployees = employees.filter(emp => emp.isActive && emp.employeeType !== 'manager');
  const activeEmployees = employees.filter(emp => emp.isActive);
  const trainees = nonManagerEmployees.filter(emp => emp.employeeType === 'trainee');
  const experienced = nonManagerEmployees.filter(emp => emp.employeeType === 'experienced');
  
  console.log(`Building model with ${nonManagerEmployees.length} employees, ${shifts.length} shifts`);
  console.log(`Available shifts per week: ${shifts.length}`);

  // 1. Create assignment variables for all possible assignments
  nonManagerEmployees.forEach((employee: any) => {
    shifts.forEach((shift: any) => {
      const varName = `assign_${employee.id}_${shift.id}`;
      model.addVariable(varName, 'bool');
    });
  });

  // 2. Availability constraints
  nonManagerEmployees.forEach((employee: any) => {
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
  nonManagerEmployees.forEach((employee: any) => {
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

  // 4. Shift staffing constraints
  shifts.forEach((shift: any) => {
    const assignmentVars = nonManagerEmployees.map(
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
      const maxWorkers = shift.maxWorkers || 2;
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

  // 6. Employees who cannot work alone constraint
  const employeesWhoCantWorkAlone = nonManagerEmployees.filter(emp => !emp.canWorkAlone);
  console.log(`Found ${employeesWhoCantWorkAlone.length} employees who cannot work alone`);

  employeesWhoCantWorkAlone.forEach((employee: any) => {
    shifts.forEach((shift: any) => {
      const employeeVar = `assign_${employee.id}_${shift.id}`;
      const otherEmployees = nonManagerEmployees.filter(emp => 
        emp.id !== employee.id && emp.isActive
      );
      
      if (otherEmployees.length === 0) {
        // No other employees available, this employee cannot work this shift
        model.addConstraint(
          `${employeeVar} == 0`,
          `No other employees available for ${employee.name} in shift ${shift.id}`
        );
      } else {
        const otherEmployeeVars = otherEmployees.map(emp => 
          `assign_${emp.id}_${shift.id}`
        );
        
        // Constraint: if this employee works, at least one other must work
        model.addConstraint(
          `${employeeVar} <= ${otherEmployeeVars.join(' + ')}`,
          `${employee.name} cannot work alone in ${shift.id}`
        );
      }
    });
  });

  // 7. Contract type constraints
  const totalShifts = shifts.length;
  console.log(`Total available shifts: ${totalShifts}`);

  nonManagerEmployees.forEach((employee: any) => {
    const contractType = employee.contractType || 'large';
    
    // EXACT SHIFTS PER WEEK
    let exactShifts;
    
    if (contractType === 'small') {
      exactShifts = 1;  // Exactly 1 shift for small contract
    } else {
      exactShifts = 2;  // Exactly 2 shifts for large contract
    }
    
    const shiftVars = shifts.map(
      (shift: any) => `assign_${employee.id}_${shift.id}`
    );
    
    if (shiftVars.length > 0) {
      // Use EXACT constraint (== instead of range)
      model.addConstraint(
        `${shiftVars.join(' + ')} == ${exactShifts}`,
        `Exact shifts for ${employee.name} (${contractType} contract)`
      );
      
      console.log(`Employee ${employee.name}: ${exactShifts} shifts (${contractType})`);
    }
  });

  // 8. Objective: Maximize preferred assignments with soft constraints
  let objectiveExpression = '';
  let softConstraintPenalty = '';
  
  nonManagerEmployees.forEach((employee: any) => {
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
  
  console.log('🔍 DEBUG: Available shifts with new ID pattern:');
  shifts.forEach(shift => {
    console.log(`   - ${shift.id} (Day: ${shift.id.split('-')[0]}, TimeSlot: ${shift.id.split('-')[1]})`);
  });

  // Your existing assignment extraction logic...
  if (solution.assignments && solution.assignments.length > 0) {
    console.log('Using Python-parsed assignments (cleaner)');
    
    solution.assignments.forEach((assignment: any) => {
      const shiftId = assignment.shiftId;
      const employeeId = assignment.employeeId;
      
      if (shiftId && employeeId) {
        if (!assignments[shiftId]) {
          assignments[shiftId] = [];
        }
        // Check if this assignment already exists to avoid duplicates
        if (!assignments[shiftId].includes(employeeId)) {
          assignments[shiftId].push(employeeId);
        }
      }
    });
  }

  // 🆕 ADD: Enhanced logging with employee names
  console.log('🎯 FINAL ASSIGNMENTS WITH EMPLOYEE :');
  Object.entries(assignments).forEach(([shiftId, employeeIds]) => {
    const employeeNames = (employeeIds as string[]).map(empId => {
      const employee = employees.find(emp => emp.id === empId);
      return employee ? employee.id : 'Unknown';
    });
    console.log(`   📅 ${shiftId}: ${employeeNames.join(', ')}`);
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
  
  // Check for employees working alone who shouldn't
  shifts.forEach((shift: any) => {
    const assignedEmployees = assignments[shift.id] || [];
    
    if (assignedEmployees.length === 1) {
      const singleEmployeeId = assignedEmployees[0];
      const singleEmployee = employeeMap.get(singleEmployeeId);
      
      if (singleEmployee && !singleEmployee.canWorkAlone) {
        violations.push(`EMPLOYEE_ALONE: ${singleEmployee.name} is working alone in shift ${shift.id} but cannot work alone`);
      }
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

function assignManagersToShifts(assignments: any, managers: any[], shifts: any[], availabilities: any[]): any {
  const managersToAssign = managers.filter(emp => emp.isActive && emp.employeeType === 'manager');
  
  console.log(`Assigning ${managersToAssign.length} managers to shifts based on availability=1`);
  
  managersToAssign.forEach((manager: any) => {
    shifts.forEach((shift: any) => {
      const availability = availabilities.find(
        (a: any) => a.employeeId === manager.id && a.shiftId === shift.id
      );
      
      // Assign manager if they have availability=1 (preferred)
      if (availability?.preferenceLevel === 1) {
        if (!assignments[shift.id]) {
          assignments[shift.id] = [];
        }
        
        // Check if manager is already assigned (avoid duplicates)
        if (!assignments[shift.id].includes(manager.id)) {
          assignments[shift.id].push(manager.id);
          console.log(`✅ Assigned manager ${manager.name} to shift ${shift.id} (availability=1)`);
        }
      }
    });
  });
  
  return assignments;
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

    const nonManagerEmployees = data.employees.filter(emp => emp.isActive && emp.employeeType !== 'manager');
    
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
      // Extract assignments from solution (non-managers only)
      assignments = extractAssignmentsFromSolution(solution, nonManagerEmployees, data.shifts);
      
      // 🆕 ADD THIS: Assign managers to shifts where they have availability=1
      assignments = assignManagersToShifts(assignments, data.employees, data.shifts, data.availabilities);
      
      // Only detect violations for non-manager assignments
      if (Object.keys(assignments).length > 0) {
        violations = detectViolations(assignments, nonManagerEmployees, data.shifts);
      } else {
        violations.push('NO_ASSIGNMENTS: Solver reported success but produced no assignments');
      }
      
      // Update resolution report
      if (violations.length === 0) {
        resolutionReport.push('✅ No constraint violations detected for non-manager employees');
      } else {
        resolutionReport.push(`⚠️ Found ${violations.length} violations for non-manager employees:`);
        violations.forEach(violation => {
          resolutionReport.push(`   - ${violation}`);
        });
      }
      
      // Add assignment statistics (including managers)
      const totalAssignments = Object.values(assignments).reduce((sum: number, shiftAssignments: any) => 
        sum + shiftAssignments.length, 0
      );
      resolutionReport.push(`📊 Total assignments: ${totalAssignments} (including managers)`);
      
    } else {
      violations.push('SCHEDULING_FAILED: No feasible solution found for non-manager employees');
      resolutionReport.push('❌ No feasible solution could be found for non-manager employees');
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