// backend/src/workers/shift-scheduler-worker.ts
import { parentPort, workerData } from 'worker_threads';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface WorkerData {
  plan: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
    isTemplate: boolean;
  };
  shifts: {
    id: string;
    planId: string;
    timeSlotId: string;
    dayOfWeek: number;
    requiredEmployees: number;
    minEmployees: number;
    maxEmployees: number;
    color?: string;
    timeSlot: {
      id: string;
      name: string;
      startTime: string;
      endTime: string;
    };
  }[];
  employees: {
    id: string;
    firstname: string;
    lastname: string;
    employeeType: 'manager' | 'personell' | 'apprentice' | 'guest';
    contractType?: 'small' | 'large' | 'flexible';
    canWorkAlone: boolean;
    isTrainee: boolean;
    isActive: boolean;
  }[];
  availabilities: {
    id: string;
    employeeId: string;
    planId: string;
    shiftId: string;
    preferenceLevel: 1 | 2 | 3;
    notes?: string;
  }[];
  constraints: {
    maxShiftsPerDay: number;
    traineeSupervision: boolean;
    enforceContractHours: boolean;
    dayStaffingBalance: boolean;
    dayBalanceTolerance: number;
    overStaffingPenalty: number;
    underStaffingPenalty: number;
  };
  solverOptions?: {
    maxTimeInSeconds: number;
    numSearchWorkers: number;
  };
}

interface PythonSolverResult {
  success: boolean;
  assignments: { shiftId: string; employeeId: string; assignmentIndex: number }[];
  violations: string[];
  progress: any[];
  metadata: {
    solveTime: number;
    variablesCreated: number;
    constraintsAdded: number;
    optimal: boolean;
    status: string;
    solutionsFound?: number;
    objectiveValue?: number;
  };
}

function findPythonScript(): string | null {
  const possiblePaths = [
    path.resolve(process.cwd(), 'python-scripts/shift_scheduling_solver.py'),
    path.resolve(process.cwd(), 'backend/python-scripts/shift_scheduling_solver.py'),
    path.resolve(process.cwd(), 'src/python-scripts/shift_scheduling_solver.py'),
    path.resolve(__dirname, '../../../python-scripts/shift_scheduling_solver.py'),
    path.resolve(__dirname, '../../src/python-scripts/shift_scheduling_solver.py'),
    path.resolve(__dirname, '../python-scripts/shift_scheduling_solver.py'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

function findPythonCommand(): Promise<string> {
  return new Promise((resolve) => {
    const commands = ['python', 'python3', 'py'];
    let currentIndex = 0;

    const tryNext = () => {
      if (currentIndex >= commands.length) {
        resolve('python'); // Default fallback
        return;
      }

      const cmd = commands[currentIndex];
      const proc = spawn(cmd, ['--version']);

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(cmd);
        } else {
          currentIndex++;
          tryNext();
        }
      });

      proc.on('error', () => {
        currentIndex++;
        tryNext();
      });
    };

    tryNext();
  });
}

async function runPythonSolver(data: WorkerData): Promise<PythonSolverResult> {
  const scriptPath = findPythonScript();

  if (!scriptPath) {
    throw new Error('Shift scheduling Python solver not found');
  }

  const pythonCmd = await findPythonCommand();
  console.log(`Using Python command: ${pythonCmd}`);
  console.log(`Using script: ${scriptPath}`);

  return new Promise((resolve, reject) => {
    const proc = spawn(pythonCmd, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      // Log all Python output for debugging
      console.log('[Python]', text.trim());
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python solver exited with code ${code}`);
        console.error('stderr:', stderr);
        reject(new Error(`Python solver failed with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (parseError) {
        console.error('Failed to parse Python output:', stdout.substring(0, 500));
        reject(new Error(`Invalid JSON from Python solver: ${parseError}`));
      }
    });

    proc.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      reject(error);
    });

    // Prepare data for Python solver
    const inputData = {
      plan: data.plan,
      shifts: data.shifts,
      employees: data.employees,
      availabilities: data.availabilities,
      constraints: data.constraints,
      solverOptions: data.solverOptions || {
        maxTimeInSeconds: 120,
        numSearchWorkers: 8
      }
    };

    proc.stdin.write(JSON.stringify(inputData));
    proc.stdin.end();
  });
}

async function runShiftScheduling() {
  const data: WorkerData = workerData;
  const startTime = Date.now();

  try {
    console.log('\n========================================');
    console.log('Starting shift scheduling optimization...');
    console.log('========================================');

    // Validate input data
    if (!data.shifts || data.shifts.length === 0) {
      throw new Error('No shifts provided for scheduling');
    }

    if (!data.employees || data.employees.length === 0) {
      throw new Error('No employees provided for scheduling');
    }

    console.log(`Plan: ${data.plan.name}`);
    console.log(`Shifts: ${data.shifts.length}`);
    console.log(`Employees: ${data.employees.length}`);
    console.log(`Availabilities: ${data.availabilities.length}`);

    // Filter schedulable employees
    const schedulableEmployees = data.employees.filter(emp =>
      emp.isActive &&
      emp.employeeType === 'personell'
    );

    const managers = data.employees.filter(emp =>
      emp.isActive &&
      emp.employeeType === 'manager'
    );

    const trainees = schedulableEmployees.filter(emp => emp.isTrainee);
    const experienced = schedulableEmployees.filter(emp => !emp.isTrainee);
    const cannotWorkAlone = schedulableEmployees.filter(emp => !emp.canWorkAlone);

    console.log('\nEmployee Summary:');
    console.log(`  Schedulable (personell): ${schedulableEmployees.length}`);
    console.log(`  - Trainees: ${trainees.length}`);
    console.log(`  - Experienced: ${experienced.length}`);
    console.log(`  - Cannot work alone: ${cannotWorkAlone.length}`);
    console.log(`  Managers (pre-assigned): ${managers.length}`);

    // Check contract types
    const smallContract = schedulableEmployees.filter(emp => emp.contractType === 'small');
    const largeContract = schedulableEmployees.filter(emp => emp.contractType === 'large');
    const flexibleContract = schedulableEmployees.filter(emp => emp.contractType === 'flexible');

    console.log(`\nContract Types:`);
    console.log(`  Small (1 shift required): ${smallContract.length}`);
    console.log(`  Large (2 shifts required): ${largeContract.length}`);
    console.log(`  Flexible: ${flexibleContract.length}`);

    // Check availabilities
    const employeesWithPrefs = new Set(
      data.availabilities
        .filter(a => a.preferenceLevel === 1 || a.preferenceLevel === 2)
        .map(a => a.employeeId)
    );

    const schedulableWithPrefs = schedulableEmployees.filter(emp =>
      employeesWithPrefs.has(emp.id)
    );

    console.log(`\nEmployees with availability set: ${employeesWithPrefs.size}`);
    console.log(`Schedulable employees with availability: ${schedulableWithPrefs.length}`);

    if (schedulableWithPrefs.length === 0) {
      console.log('\nNo schedulable employees have set their availability!');
      parentPort?.postMessage({
        assignments: [],
        violations: ['NO_AVAILABILITIES: No schedulable employees have set their availability'],
        success: false,
        resolutionReport: ['Scheduling failed: No schedulable employees have set their availability'],
        processingTime: Date.now() - startTime
      });
      return;
    }

    // Calculate total required employees
    const totalRequiredSlots = data.shifts.reduce((sum, shift) => sum + shift.requiredEmployees, 0);
    const totalMaxSlots = data.shifts.reduce((sum, shift) => sum + shift.maxEmployees, 0);
    const totalMinSlots = data.shifts.reduce((sum, shift) => sum + shift.minEmployees, 0);

    console.log(`\nShift Requirements:`);
    console.log(`  Total required slots: ${totalRequiredSlots}`);
    console.log(`  Total min slots: ${totalMinSlots}`);
    console.log(`  Total max slots: ${totalMaxSlots}`);

    // Calculate employee capacity based on contract types
    let totalEmployeeCapacity = 0;
    totalEmployeeCapacity += smallContract.length * 1; // Small contract: 1 shift
    totalEmployeeCapacity += largeContract.length * 2; // Large contract: 2 shifts
    totalEmployeeCapacity += flexibleContract.length * Math.max(2, data.shifts.length); // Flexible: at least 2

    console.log(`\nEmployee Capacity:`);
    console.log(`  Total employee capacity: ${totalEmployeeCapacity}`);

    // Feasibility check
    if (totalEmployeeCapacity > totalRequiredSlots) {
      console.log(`⚠️ WARNING: Employee capacity (${totalEmployeeCapacity}) > Required slots (${totalRequiredSlots})`);
    }

    // Get manager pre-assignments (managers with preference level 1)
    const managerAvailabilities = data.availabilities.filter(a => {
      const emp = data.employees.find(e => e.id === a.employeeId);
      return emp && emp.employeeType === 'manager' && a.preferenceLevel === 1;
    });

    console.log(`\nManager pre-assignments: ${managerAvailabilities.length}`);

    // Run Python solver
    console.log('\nCalling Python CP-SAT solver...');
    const solution = await runPythonSolver(data);
    const processingTime = Date.now() - startTime;

    console.log(`\nSolver completed in ${processingTime}ms`);
    console.log(`Success: ${solution.success}`);
    console.log(`Assignments: ${solution.assignments.length}`);
    console.log(`Violations: ${solution.violations.length}`);

    // Log actual violation messages
    if (solution.violations.length > 0) {
      console.log('\nViolation Details:');
      solution.violations.forEach((v, i) => {
        console.log(`  ${i + 1}. ${v}`);
      });
    }

    // Build resolution report
    const resolutionReport: string[] = [
      `Solved in ${processingTime}ms`,
      `Variables: ${solution.metadata.variablesCreated}`,
      `Constraints: ${solution.metadata.constraintsAdded}`,
      `Status: ${solution.metadata.status}`,
      `Optimal: ${solution.metadata.optimal}`,
      `Solutions found: ${solution.metadata.solutionsFound || 'N/A'}`,
      `Objective value: ${solution.metadata.objectiveValue || 'N/A'}`
    ];

    if (solution.violations.length === 0) {
      resolutionReport.push('No constraint violations detected');
    } else {
      resolutionReport.push(`Found ${solution.violations.length} violations:`);
      solution.violations.forEach(v => resolutionReport.push(`   - ${v}`));
    }

    resolutionReport.push(`Total assignments: ${solution.assignments.length}`);

    // Log assignment summary by day
    console.log('\nAssignment Summary by Day:');
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    for (let day = 1; day <= 7; day++) {
      const dayShifts = data.shifts.filter(s => s.dayOfWeek === day);
      if (dayShifts.length === 0) continue;

      const dayAssignments = solution.assignments.filter(a => {
        const shift = data.shifts.find(s => s.id === a.shiftId);
        return shift && shift.dayOfWeek === day;
      });

      console.log(`\n  ${days[day - 1]}:`);

      dayShifts.forEach(shift => {
        const shiftAssignments = solution.assignments.filter(a => a.shiftId === shift.id);
        const timeSlot = shift.timeSlot;
        const names = shiftAssignments.map(a => {
          const emp = data.employees.find(e => e.id === a.employeeId);
          return emp ? `${emp.firstname} ${emp.lastname}` : 'Unknown';
        });

        console.log(`    ${timeSlot.name} (${timeSlot.startTime}-${timeSlot.endTime}): ${names.join(', ') || 'None'}`);
      });
    }

    // Calculate statistics
    const assignmentsPerEmployee: Record<string, number> = {};
    const shiftsPerDay: Record<number, number> = {};

    solution.assignments.forEach(assignment => {
      assignmentsPerEmployee[assignment.employeeId] = (assignmentsPerEmployee[assignment.employeeId] || 0) + 1;

      const shift = data.shifts.find(s => s.id === assignment.shiftId);
      if (shift) {
        shiftsPerDay[shift.dayOfWeek] = (shiftsPerDay[shift.dayOfWeek] || 0) + 1;
      }
    });

    console.log('\nStatistics:');
    console.log(`  Employees with assignments: ${Object.keys(assignmentsPerEmployee).length}`);
    console.log(`  Average assignments per employee: ${(solution.assignments.length / Object.keys(assignmentsPerEmployee).length).toFixed(2)}`);

    Object.entries(shiftsPerDay).forEach(([day, count]) => {
      console.log(`  Day ${day}: ${count} assignments`);
    });

    parentPort?.postMessage({
      success: solution.success,
      assignments: solution.assignments,
      violations: solution.violations,
      resolutionReport,
      processingTime,
    });

  } catch (error) {
    console.error('Shift scheduling worker error:', error);
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
  console.log('Shift scheduling worker received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Shift scheduling worker received SIGINT, shutting down...');
  process.exit(0);
});

runShiftScheduling();