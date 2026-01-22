// backend/src/workers/weekly-scheduler-worker.ts
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
    assignmentStyle?: 'consecutive' | 'scattered' | 'flexible';
    assignmentStyleConsecutive?: number;
  }[];
}

interface PythonSolverResult {
  success: boolean;
  assignments: { weekId: string; employeeId: string }[];
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
    path.resolve(process.cwd(), 'python-scripts/weekly_scheduling_solver.py'),
    path.resolve(process.cwd(), 'backend/python-scripts/weekly_scheduling_solver.py'),
    path.resolve(process.cwd(), 'src/python-scripts/weekly_scheduling_solver.py'),
    path.resolve(__dirname, '../../../python-scripts/weekly_scheduling_solver.py'),
    path.resolve(__dirname, '../../src/python-scripts/weekly_scheduling_solver.py'),
    path.resolve(__dirname, '../python-scripts/weekly_scheduling_solver.py'),
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
    throw new Error('Weekly scheduling Python solver not found');
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

    // Send data to Python solver
    const inputData = {
      plan: data.plan,
      weeks: data.weeks,
      employees: data.employees,
      preferences: data.preferences,
      requirements: data.requirements.map(r => ({
        employeeId: r.employeeId,
        requiredWeeks: r.requiredWeeks,
        assignmentStyle: r.assignmentStyle || 'flexible',
        assignmentStyleConsecutive: r.assignmentStyleConsecutive || 1
      })),
      solverOptions: {
        maxTimeInSeconds: 100,
        numSearchWorkers: 8
      }
    };

    proc.stdin.write(JSON.stringify(inputData));
    proc.stdin.end();
  });
}

async function runWeeklyScheduling() {
  const data: WorkerData = workerData;
  const startTime = Date.now();

  try {
    console.log('\n========================================');
    console.log('Starting weekly scheduling optimization...');
    console.log('========================================');

    // Validate input data
    if (!data.weeks || data.weeks.length === 0) {
      throw new Error('No weeks provided for scheduling');
    }

    if (!data.employees || data.employees.length === 0) {
      throw new Error('No employees provided for scheduling');
    }

    console.log(`Plan: ${data.plan.name}`);
    console.log(`Weeks: ${data.weeks.length}`);
    console.log(`Employees: ${data.employees.length}`);
    console.log(`Preferences: ${data.preferences.length}`);
    console.log(`Requirements: ${data.requirements.length}`);

    // Log employee details
    console.log('\nEmployee Summary:');
    data.employees.forEach(emp => {
      const empPrefs = data.preferences.filter(p => p.employeeId === emp.id);
      const empReq = data.requirements.find(r => r.employeeId === emp.id);
      const pref1 = empPrefs.filter(p => p.preferenceLevel === 1).length;
      const pref2 = empPrefs.filter(p => p.preferenceLevel === 2).length;
      const pref3 = empPrefs.filter(p => p.preferenceLevel === 3).length;

      console.log(`  ${emp.firstname} ${emp.lastname}${emp.isTrainee ? ' (Trainee)' : ''} [${emp.employeeType}]:`
        + ` Wants ${empReq?.requiredWeeks || 0} weeks,`
        + ` Style: ${empReq?.assignmentStyle || 'flexible'},`
        + ` Block: ${empReq?.assignmentStyleConsecutive || 1},`
        + ` Prefs: ${pref1} preferred, ${pref2} available, ${pref3} unavailable`);
    });

    // Check if any employees have set availability
    const employeesWithPrefs = new Set(
      data.preferences
        .filter(p => p.preferenceLevel === 1 || p.preferenceLevel === 2)
        .map(p => p.employeeId)
    );

    if (employeesWithPrefs.size === 0) {
      console.log('\nNo employees have set their availability!');
      parentPort?.postMessage({
        assignments: [],
        violations: ['NO_PREFERENCES: No employees have set their availability'],
        success: false,
        resolutionReport: ['Scheduling failed: No employees have set their availability'],
        processingTime: Date.now() - startTime
      });
      return;
    }

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

    // Log assignment summary
    console.log('\nAssignment Summary:');
    data.weeks.forEach(week => {
      const weekAssignments = solution.assignments.filter(a => a.weekId === week.id);
      const names = weekAssignments.map(a => {
        const emp = data.employees.find(e => e.id === a.employeeId);
        return emp ? `${emp.firstname} ${emp.lastname}` : 'Unknown';
      });
      console.log(`   Week ${week.weekNumber}: ${names.join(', ') || 'None'}`);
    });

    parentPort?.postMessage({
      assignments: solution.assignments,
      violations: solution.violations,
      success: solution.success,
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
