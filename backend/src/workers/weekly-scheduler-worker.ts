// backend/src/workers/weekly-scheduler-worker.ts
import { parentPort, workerData } from 'worker_threads';
import { CPModel, CPSolver } from './cp-sat-wrapper.js';

interface WorkerData {
  plan: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  weeks: {
    id: string;
    weekNumber: number;
    startDate: string;
    endDate: string;
    minEmployees: number;
    maxEmployees: number;
  }[];
  employees: {
    id: string;
    firstname: string;
    lastname: string;
    isTrainee: boolean;
    employeeType: string;
  }[];
  preferences: {
    employeeId: string;
    weekId: string;
    preferenceLevel: 1 | 2 | 3;
  }[];
  requirements: {
    employeeId: string;
    requiredWeeks: number;
  }[];
}

function buildWeeklySchedulingModel(model: CPModel, data: WorkerData): void {
  const { employees, weeks, preferences, requirements } = data;

  // Filter schedulable employees (personell type only, managers handled separately)
  const schedulableEmployees = employees.filter(emp => emp.employeeType === 'personell');
  const managers = employees.filter(emp => emp.employeeType === 'manager');

  const trainees = schedulableEmployees.filter(emp => emp.isTrainee);
  const experienced = schedulableEmployees.filter(emp => !emp.isTrainee);

  console.log('\n🔧 WEEKLY CONSTRAINT ANALYSIS:');
  console.log(`Building model with ${schedulableEmployees.length} schedulable employees, ${weeks.length} weeks`);
  console.log(`- Trainees: ${trainees.length}`);
  console.log(`- Experienced: ${experienced.length}`);
  console.log(`- Managers (auto-assign): ${managers.length}`);

  // 1. Create assignment variables for all possible assignments
  schedulableEmployees.forEach((employee) => {
    weeks.forEach((week) => {
      const varName = `assign_${employee.id}_${week.id}`;
      model.addVariable(varName, 'bool');
    });
  });

  // 2. Unavailability constraints (preference level 3)
  schedulableEmployees.forEach((employee) => {
    weeks.forEach((week) => {
      const preference = preferences.find(
        p => p.employeeId === employee.id && p.weekId === week.id
      );

      const varName = `assign_${employee.id}_${week.id}`;

      // If no preference or preference level 3 (unavailable), cannot assign
      if (!preference || preference.preferenceLevel === 3) {
        model.addConstraint(
          `${varName} == 0`,
          `Employee ${employee.firstname} ${employee.lastname} is unavailable for week ${week.weekNumber}`
        );
      }
    });
  });

  // 3. Exact week count per employee constraint
  schedulableEmployees.forEach((employee) => {
    const requirement = requirements.find(r => r.employeeId === employee.id);
    const requiredWeeks = requirement?.requiredWeeks || 0;

    if (requiredWeeks > 0) {
      const weekVars = weeks.map(week => `assign_${employee.id}_${week.id}`);

      if (weekVars.length > 0) {
        model.addConstraint(
          `${weekVars.join(' + ')} == ${requiredWeeks}`,
          `Employee ${employee.firstname} ${employee.lastname} must work exactly ${requiredWeeks} weeks`
        );
        console.log(`Employee ${employee.firstname}: ${requiredWeeks} weeks required`);
      }
    }
  });

  // 4. Min/Max employees per week constraints
  weeks.forEach((week) => {
    const assignmentVars = schedulableEmployees.map(
      emp => `assign_${emp.id}_${week.id}`
    );

    if (assignmentVars.length > 0) {
      // Minimum employees per week
      model.addConstraint(
        `${assignmentVars.join(' + ')} >= ${week.minEmployees}`,
        `Min ${week.minEmployees} employees for week ${week.weekNumber}`
      );

      // Maximum employees per week
      model.addConstraint(
        `${assignmentVars.join(' + ')} <= ${week.maxEmployees}`,
        `Max ${week.maxEmployees} employees for week ${week.weekNumber}`
      );
    }
  });

  // 5. Trainee supervision constraints
  trainees.forEach((trainee) => {
    weeks.forEach((week) => {
      const traineeVar = `assign_${trainee.id}_${week.id}`;
      const experiencedVars = experienced.map(exp =>
        `assign_${exp.id}_${week.id}`
      );

      if (experiencedVars.length > 0) {
        // If trainee is assigned, at least one experienced must be assigned
        model.addConstraint(
          `${traineeVar} <= ${experiencedVars.join(' + ')}`,
          `Trainee ${trainee.firstname} ${trainee.lastname} requires supervision in week ${week.weekNumber}`
        );
      } else {
        // If no experienced available, trainee cannot be assigned
        model.addConstraint(
          `${traineeVar} == 0`,
          `No experienced staff available for trainee ${trainee.firstname} ${trainee.lastname} in week ${week.weekNumber}`
        );
      }
    });
  });

  // 6. Objective function: Maximize preference satisfaction
  let objectiveExpression = '';

  schedulableEmployees.forEach((employee) => {
    weeks.forEach((week) => {
      const varName = `assign_${employee.id}_${week.id}`;
      const preference = preferences.find(
        p => p.employeeId === employee.id && p.weekId === week.id
      );

      let score = 0;
      if (preference) {
        if (preference.preferenceLevel === 1) {
          score = 100; // High reward for preferred weeks
        } else if (preference.preferenceLevel === 2) {
          score = 50;  // Medium reward for available weeks
        }
        // Level 3 already excluded by constraints
      }

      if (score > 0) {
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
    console.log('Objective function set to maximize preference satisfaction');
  } else {
    console.warn('No valid objective expression could be created');
  }
}

function extractAssignmentsFromSolution(solution: any, employees: any[], weeks: any[]): { weekId: string; employeeId: string }[] {
  const assignments: { weekId: string; employeeId: string }[] = [];

  console.log('🔍 Extracting assignments from solution...');

  if (solution.assignments && solution.assignments.length > 0) {
    console.log('Using Python-parsed assignments');

    solution.assignments.forEach((assignment: any) => {
      // The assignment has shiftId which is actually weekId in our context
      const weekId = assignment.shiftId;
      const employeeId = assignment.employeeId;

      if (weekId && employeeId) {
        // Verify this is a valid week
        const week = weeks.find(w => w.id === weekId);
        if (week) {
          assignments.push({ weekId, employeeId });
        }
      }
    });
  }

  console.log(`🎯 Extracted ${assignments.length} assignments`);
  return assignments;
}

function assignManagersToWeeks(
  assignments: { weekId: string; employeeId: string }[],
  managers: any[],
  weeks: any[],
  preferences: any[]
): { weekId: string; employeeId: string }[] {
  console.log(`Assigning ${managers.length} managers to weeks based on preference=1`);

  managers.forEach((manager) => {
    weeks.forEach((week) => {
      const preference = preferences.find(
        p => p.employeeId === manager.id && p.weekId === week.id
      );

      // Assign manager if they have preference=1 (preferred)
      if (preference?.preferenceLevel === 1) {
        // Check if manager is already assigned (avoid duplicates)
        const alreadyAssigned = assignments.some(
          a => a.weekId === week.id && a.employeeId === manager.id
        );

        if (!alreadyAssigned) {
          assignments.push({ weekId: week.id, employeeId: manager.id });
          console.log(`✅ Assigned manager ${manager.firstname} ${manager.lastname} to week ${week.weekNumber} (preference=1)`);
        }
      }
    });
  });

  return assignments;
}

function detectViolations(
  assignments: { weekId: string; employeeId: string }[],
  employees: any[],
  weeks: any[],
  requirements: any[]
): string[] {
  const violations: string[] = [];
  const employeeMap = new Map(employees.map(emp => [emp.id, emp]));

  // Check for understaffed weeks
  weeks.forEach((week) => {
    const assignedCount = assignments.filter(a => a.weekId === week.id).length;

    if (assignedCount < week.minEmployees) {
      violations.push(`UNDERSTAFFED: Week ${week.weekNumber} has ${assignedCount} employees but requires minimum ${week.minEmployees}`);
    }

    if (assignedCount > week.maxEmployees) {
      violations.push(`OVERSTAFFED: Week ${week.weekNumber} has ${assignedCount} employees but maximum is ${week.maxEmployees}`);
    }
  });

  // Check for trainee supervision
  weeks.forEach((week) => {
    const weekAssignments = assignments.filter(a => a.weekId === week.id);
    const hasTrainee = weekAssignments.some(a => {
      const emp = employeeMap.get(a.employeeId);
      return emp?.isTrainee;
    });

    const hasExperienced = weekAssignments.some(a => {
      const emp = employeeMap.get(a.employeeId);
      return emp && !emp.isTrainee && emp.employeeType === 'personell';
    });

    if (hasTrainee && !hasExperienced) {
      violations.push(`TRAINEE_UNSUPERVISED: Week ${week.weekNumber} has trainee but no experienced employee`);
    }
  });

  // Check employee week count requirements
  employees.forEach((employee) => {
    const requirement = requirements.find(r => r.employeeId === employee.id);
    if (requirement && requirement.requiredWeeks > 0) {
      const assignedCount = assignments.filter(a => a.employeeId === employee.id).length;

      if (assignedCount !== requirement.requiredWeeks) {
        violations.push(`WEEK_COUNT_MISMATCH: ${employee.firstname} ${employee.lastname} assigned ${assignedCount} weeks but requires ${requirement.requiredWeeks}`);
      }
    }
  });

  return violations;
}

async function runWeeklyScheduling() {
  const data: WorkerData = workerData;
  const startTime = Date.now();

  try {
    console.log('Starting weekly scheduling optimization...');

    // Validate input data
    if (!data.weeks || data.weeks.length === 0) {
      throw new Error('No weeks provided for scheduling');
    }

    if (!data.employees || data.employees.length === 0) {
      throw new Error('No employees provided for scheduling');
    }

    console.log(`Optimizing ${data.weeks.length} weeks for ${data.employees.length} employees`);

    // Check if we have any employees who signed up
    const employeesWithPrefs = new Set(
      data.preferences
        .filter(p => p.preferenceLevel === 1 || p.preferenceLevel === 2)
        .map(p => p.employeeId)
    );

    if (employeesWithPrefs.size === 0) {
      console.log('❌ CRITICAL: No employees have set availability!');
      parentPort?.postMessage({
        assignments: [],
        violations: ['NO_PREFERENCES: No employees have set their availability'],
        success: false,
        resolutionReport: ['❌ Scheduling failed: No employees have set their availability'],
        processingTime: Date.now() - startTime
      });
      return;
    }

    const model = new CPModel();
    buildWeeklySchedulingModel(model, data);

    const solver = new CPSolver({
      maxTimeInSeconds: 105,
      numSearchWorkers: 8,
      logSearchProgress: true
    });

    const solution = await solver.solve(model);
    const processingTime = Date.now() - startTime;

    console.log(`Weekly scheduling completed in ${processingTime}ms`);
    console.log(`Solution success: ${solution.success}`);

    let assignments: { weekId: string; employeeId: string }[] = [];
    let violations: string[] = [];
    let resolutionReport: string[] = [
      `Solved in ${processingTime}ms`,
      `Variables: ${solution.metadata?.variablesCreated || 'unknown'}`,
      `Constraints: ${solution.metadata?.constraintsAdded || 'unknown'}`,
      `Optimal: ${solution.metadata?.optimal || false}`,
      `Status: ${solution.success ? 'SUCCESS' : 'FAILED'}`
    ];

    if (solution.success) {
      // Extract assignments for non-managers
      const nonManagers = data.employees.filter(emp => emp.employeeType === 'personell');
      assignments = extractAssignmentsFromSolution(solution, nonManagers, data.weeks);

      // Add managers based on their preferences
      const managers = data.employees.filter(emp => emp.employeeType === 'manager');
      assignments = assignManagersToWeeks(assignments, managers, data.weeks, data.preferences);

      // Detect violations
      violations = detectViolations(assignments, data.employees, data.weeks, data.requirements);

      if (violations.length === 0) {
        resolutionReport.push('✅ No constraint violations detected');
      } else {
        resolutionReport.push(`⚠️ Found ${violations.length} violations:`);
        violations.forEach(v => resolutionReport.push(`   - ${v}`));
      }

      resolutionReport.push(`📊 Total assignments: ${assignments.length}`);

      // Log assignments summary
      console.log('\n📋 ASSIGNMENT SUMMARY:');
      data.weeks.forEach(week => {
        const weekAssignments = assignments.filter(a => a.weekId === week.id);
        const names = weekAssignments.map(a => {
          const emp = data.employees.find(e => e.id === a.employeeId);
          return emp ? `${emp.firstname} ${emp.lastname}` : 'Unknown';
        });
        console.log(`   Week ${week.weekNumber}: ${names.join(', ') || 'None'}`);
      });

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
    console.error('Weekly scheduling worker error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    parentPort?.postMessage({
      error: errorMessage,
      success: false,
      assignments: [],
      violations: [`ERROR: ${errorMessage}`],
      resolutionReport: [`Error: ${errorMessage}`],
      processingTime: Date.now() - startTime
    });
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Weekly scheduling worker received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Weekly scheduling worker received SIGINT, shutting down...');
  process.exit(0);
});

runWeeklyScheduling();
