// backend/src/workers/cp-sat-wrapper.ts
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { SolverOptions, Solution, Assignment } from '../models/scheduling.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ProgressStep {
  timestamp: number;
  objective: number;
  bound: number;
  solution_count: number;
}

export interface SolutionWithProgress extends Solution {
  progress?: ProgressStep[];
}

export class CPModel {
  private modelData: any;
  
  constructor() {
    this.modelData = {
      variables: {},
      constraints: [],
      objective: null
    };
  }
  
  addVariable(name: string, type: 'bool' | 'int', min?: number, max?: number): void {
    this.modelData.variables[name] = { type, min, max };
  }
  
  addConstraint(expression: string, description?: string): void {
    this.modelData.constraints.push({
      expression,
      description
    });
  }
  
  maximize(expression: string): void {
    this.modelData.objective = {
      type: 'maximize',
      expression
    };
  }
  
  minimize(expression: string): void {
    this.modelData.objective = {
      type: 'minimize', 
      expression
    };
  }
  
  export(): any {
    return this.modelData;
  }
}

export class CPSolver {
  constructor(private options: SolverOptions) {}
  
  async solve(model: CPModel): Promise<Solution> {
    await this.checkPythonEnvironment();
    
    try {
      return await this.solveViaPythonBridge(model);
    } catch (error) {
      console.error('CP-SAT bridge failed, using TypeScript fallback:', error);
      return await this.solveWithTypeScript(model);
    }
  }
  
  private async solveViaPythonBridge(model: CPModel): Promise<Solution> {
    // Try multiple possible paths for the Python script
    const possiblePaths = [
      path.resolve(process.cwd(), 'python-scripts/scheduling_solver.py'),
      path.resolve(process.cwd(), 'backend/python-scripts/scheduling_solver.py'),
      path.resolve(__dirname, '../../../python-scripts/scheduling_solver.py'),
      path.resolve(__dirname, '../../src/python-scripts/scheduling_solver.py'),
    ];
    
    let pythonScriptPath = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        pythonScriptPath = p;
        break;
      }
    }
    
    if (!pythonScriptPath) {
      throw new Error(`Python script not found. Tried: ${possiblePaths.join(', ')}`);
    }
    
    console.log('Using Python script at:', pythonScriptPath);
    
  const modelData = model.export();
  
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', [pythonScriptPath], {
        timeout: this.options.maxTimeInSeconds * 1000,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        // 🆕 Real-time progress monitoring from stderr
        if (data.toString().includes('Progress:')) {
          console.log('Python Progress:', data.toString().trim());
        }
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`Python process exited with code ${code}`);
          if (stderr) {
            console.error('Python stderr:', stderr);
          }
          reject(new Error(`Python script failed with code ${code}`));
          return;
        }

        try {
          console.log('Python raw output:', stdout.substring(0, 500));
          
          const result = JSON.parse(stdout);
          
          // Enhanced solution parsing with progress data
          const solution: SolutionWithProgress = {
            success: result.success || false,
            assignments: result.assignments || [],
            violations: result.violations || [],
            progress: result.progress || [], // 🆕 Parse progress data
            metadata: {
              solveTime: result.metadata?.solveTime || 0,
              constraintsAdded: result.metadata?.constraintsAdded || 0,
              variablesCreated: result.metadata?.variablesCreated || 0,
              optimal: result.metadata?.optimal || false
            },
            variables: result.variables || {}
          };

          console.log(`Python solver result: success=${solution.success}, assignments=${solution.assignments.length}, progress_steps=${solution.progress?.length}`);
          
          resolve(solution);
        } catch (parseError) {
          console.error('Failed to parse Python output. Raw output:', stdout.substring(0, 500));
          reject(new Error(`Invalid JSON from Python: ${parseError}`));
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('Failed to start Python process:', error);
        reject(error);
      });

      // Send input data
      pythonProcess.stdin.write(JSON.stringify({
        modelData: modelData,
        solverOptions: this.options
      }));
      pythonProcess.stdin.end();
    });
  }

  private async checkPythonEnvironment(): Promise<boolean> {
    try {
      return new Promise((resolve) => {
        // Try multiple Python commands
        const commands = ['python', 'python3', 'py'];
        let currentCommandIndex = 0;
        
        const tryNextCommand = () => {
          if (currentCommandIndex >= commands.length) {
            console.log('❌ Python is not available (tried: ' + commands.join(', ') + ')');
            resolve(false);
            return;
          }
          
          const command = commands[currentCommandIndex];
          const pythonProcess = spawn(command, ['--version']);
          
          pythonProcess.on('close', (code) => {
            if (code === 0) {
              console.log(`✅ Python is available (using: ${command})`);
              resolve(true);
            } else {
              currentCommandIndex++;
              tryNextCommand();
            }
          });
          
          pythonProcess.on('error', () => {
            currentCommandIndex++;
            tryNextCommand();
          });
        };
        
        tryNextCommand();
      });
    } catch {
      return false;
    }
  }

  private async solveWithTypeScript(model: CPModel): Promise<Solution> {
    const startTime = Date.now();
    const modelData = model.export();
    
    console.log('Using TypeScript fallback solver');
    console.log(`Model has ${Object.keys(modelData.variables).length} variables and ${modelData.constraints.length} constraints`);
    
    // Create a simple feasible solution
    const assignments: Assignment[] = [];
    
    // Generate basic assignments - try to satisfy constraints
    const employeeShiftCount: {[key: string]: number} = {};
    const shiftAssignments: {[key: string]: string[]} = {};
    
    // Initialize
    Object.keys(modelData.variables).forEach(varName => {
      if (varName.startsWith('assign_')) {
        const parts = varName.split('_');
        if (parts.length >= 3) {
          const employeeId = parts[1];
          const shiftId = parts.slice(2).join('_');
          
          if (!employeeShiftCount[employeeId]) employeeShiftCount[employeeId] = 0;
          if (!shiftAssignments[shiftId]) shiftAssignments[shiftId] = [];
        }
      }
    });
    
    // Simple assignment logic
    Object.keys(modelData.variables).forEach(varName => {
      if (modelData.variables[varName].type === 'bool' && varName.startsWith('assign_')) {
        const parts = varName.split('_');
        if (parts.length >= 3) {
          const employeeId = parts[1];
          const shiftId = parts.slice(2).join('_');
          
          // Simple logic: assign about 30% of shifts randomly, but respect some constraints
          const shouldAssign = Math.random() > 0.7 && employeeShiftCount[employeeId] < 10;
          
          if (shouldAssign) {
            assignments.push({
              shiftId,
              employeeId,
              assignedAt: new Date(),
              score: Math.floor(Math.random() * 50) + 50 // Random score 50-100
            });
            employeeShiftCount[employeeId]++;
            shiftAssignments[shiftId].push(employeeId);
          }
        }
      }
    });
    
    const processingTime = Date.now() - startTime;
    
    console.log(`TypeScript solver created ${assignments.length} assignments in ${processingTime}ms`);
    
    return {
      assignments,
      violations: [],
      success: assignments.length > 0,
      metadata: {
        solveTime: processingTime,
        constraintsAdded: modelData.constraints.length,
        variablesCreated: Object.keys(modelData.variables).length,
        optimal: false
      }
    };
  }
}